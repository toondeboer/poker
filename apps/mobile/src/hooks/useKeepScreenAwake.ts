// src/hooks/useKeepScreenAwake.ts
import { useEffect } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { logger } from "@/src/utils/logger";

/**
 * Tag scoping this lock to the running round. `expo-keep-awake` reference-counts
 * by tag, so releasing ours can never clobber a lock some other part of the app
 * (or a library) is holding for its own reasons.
 */
const KEEP_AWAKE_TAG = "poker-timer-round";

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
 */
export function useKeepScreenAwake(active: boolean) {
  useEffect(() => {
    if (!active) return;

    // Release is chained onto the acquire, never fired alongside it. Both calls
    // are async, and pausing a round is fast: releasing independently meant a
    // pause that landed before the acquire resolved released a lock that did not
    // exist yet, and the acquire then completed *after* it — leaving the screen
    // pinned on for the rest of the session with nothing left to turn it off.
    // Which is exactly what "pausing doesn't let the screen sleep" looked like.
    const acquired = activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((error) => {
      // Non-fatal: the timer still runs, the screen just isn't pinned on.
      logger.warn("Could not keep the screen awake:", error);
    });

    return () => {
      void acquired.then(() =>
        // Still throws if the acquire above failed outright, which is nothing to
        // report — there was no lock to give back.
        Promise.resolve(deactivateKeepAwake(KEEP_AWAKE_TAG)).catch(() => {}),
      );
    };
  }, [active]);
}
