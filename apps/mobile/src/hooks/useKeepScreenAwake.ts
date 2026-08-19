// src/hooks/useKeepScreenAwake.ts
import { useEffect } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { logger } from "@/src/utils/logger";

/**
 * Tag scoping this lock to the running round. `expo-keep-awake` tracks a *set*
 * of tags and only releases the screen once the set empties, so using our own
 * tag means releasing ours can never clobber a lock something else is holding.
 */
const KEEP_AWAKE_TAG = "poker-timer-round";

/**
 * Serialized reconciliation to the desired state.
 *
 * Both native calls are async, and pausing a round is fast, so firing them
 * independently lets them land out of order — and the native side is a tag set,
 * not a counter, so whichever lands last wins outright. A release that overtakes
 * its own acquire removes a tag that isn't there yet, the acquire then re-adds
 * it, and the screen stays pinned on for the rest of the session with nothing
 * left to turn it off. Chaining each release onto its own acquire fixed that one
 * ordering; this fixes all of them, by never having two calls in flight.
 *
 * Module-level rather than per-hook because the tag is global to the app: there
 * is exactly one lock, so there should be exactly one queue for it.
 */
let queue: Promise<void> = Promise.resolve();
let applied = false;

function reconcile(desired: boolean) {
  queue = queue
    .then(async () => {
      // The queue may hold several flips by the time this runs; only the ones
      // that actually change the native state are worth a call.
      if (desired === applied) return;
      applied = desired;
      logger.log(
        desired
          ? "keep-awake: acquiring screen lock"
          : "keep-awake: releasing screen lock",
        KEEP_AWAKE_TAG,
      );
      if (desired) {
        await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      } else {
        await deactivateKeepAwake(KEEP_AWAKE_TAG);
      }
    })
    .catch((error) => {
      // Non-fatal either way: the timer still runs, the screen just isn't
      // pinned on (or isn't released, until the next flip corrects it). Logged
      // rather than swallowed — a screen that won't sleep is otherwise
      // indistinguishable from the phone's own auto-lock setting.
      logger.warn("keep-awake: could not reconcile screen lock", error);
      applied = !desired;
    });
}

/**
 * Holds the screen on while `active`, releasing it as soon as that goes false.
 *
 * A poker timer sitting on the table is the whole point of the app, and iOS/
 * Android will lock the screen out from under it after ~30-60s of no touches —
 * which backgrounds the app, suspends the JS timer, and hands the round over to
 * the notification/Live-Activity fallback path. That fallback deliberately only
 * carries a single round (see TimerContext's backgrounded-expiry handling), so
 * without this a tournament left alone drops out of the foreground during its
 * *first* level and stays there, needing a human at every level change.
 *
 * Deliberately conditional rather than `useKeepAwake()`: a paused or finished
 * timer has no claim on the user's battery.
 *
 * **Releasing does not wake anything up — it re-arms the OS idle timer from that
 * moment.** So the screen sleeps one full auto-lock interval after the pause,
 * not immediately, and on a phone set to a 5-minute (or Never) auto-lock this is
 * indistinguishable from a lock that never released. Check the device setting
 * before believing the app is at fault; the log lines above say which calls
 * actually ran.
 */
export function useKeepScreenAwake(active: boolean) {
  useEffect(() => {
    reconcile(active);
    // No cleanup that releases: `active` going false is itself the release, and
    // it runs through the same queue as every other flip. An unmount while a
    // round is genuinely running is the app going away entirely, which drops the
    // lock with the process.
  }, [active]);
}
