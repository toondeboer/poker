/**
 * Keeping one tournament clock in step across several phones.
 *
 * The hard part is **not** the transport, and it is not deciding who may press
 * pause. It is that this timer is built on an absolute instant — `endTime`, a
 * millisecond epoch — and two phones at the same table do not agree on what
 * time it is. Device clocks drift, and a user can set theirs by hand; half a
 * minute out is unremarkable. Broadcast an `endTime` and the phone propped up
 * where everyone can see it counts down to something different from the one in
 * somebody's pocket, on the same round, with no way to tell which is right.
 *
 * So **nothing absolute goes over the wire**. A message says how much of the
 * round is left, and every receiver anchors that to its own clock the instant
 * it arrives. Skew stops mattering entirely; what is left is network latency,
 * which is tens of milliseconds against rounds measured in minutes.
 *
 * Ordering is a logical clock rather than a timestamp, for the same reason:
 * two devices' timestamps are not comparable, so "newest wins" decided by
 * `Date.now()` can hand the argument to whichever phone is running fast.
 */

import type { TimerMachineState } from "../timer/timerMachine";

export type TimerSyncMessage = {
  /**
   * Monotonic per-session counter. Higher wins.
   *
   * A counter rather than a wall-clock time because clocks between devices are
   * not comparable — the whole point of this module.
   */
  version: number;
  /**
   * Which phone sent it.
   *
   * Two people can reach for the phone at once, and both presses then carry the
   * same version — a genuine tie that "higher version wins" cannot break. Left
   * unbroken, each device keeps whichever arrived first and the table quietly
   * splits in two. Comparing senders breaks it the same way on every device, so
   * they converge on one answer; *which* answer is arbitrary, and it has to be,
   * because there is no fact about which press came first.
   *
   * It also lets a device recognise its own message coming back, which some
   * transports deliver and some do not.
   */
  sender: string;
  /** Seconds left in the current round when this was sent. */
  remaining: number;
  /** Round length in seconds. */
  duration: number;
  paused: boolean;
  /** Which blind level the table is on, so a level jump travels too. */
  blindIndex: number;
};

/** A local view of a shared session. */
export type SharedSession = {
  /** The last message applied, or `null` before anything has arrived. */
  applied: TimerSyncMessage | null;
  /** When anything last arrived, on the **local** clock. `null` before it does. */
  lastMessageAt: number | null;
};

export const EMPTY_SHARED_SESSION: SharedSession = Object.freeze({
  applied: null,
  lastMessageAt: null,
});

/**
 * How often the controlling phone repeats itself.
 *
 * A shared clock is mostly silent — a round runs for ten minutes with nothing
 * to say — so silence cannot be distinguished from a dead connection unless
 * something is sent on purpose. The repeat carries the current version, so a
 * phone that missed the original catches up on the next beat rather than
 * waiting for the next time somebody presses something.
 */
export const HEARTBEAT_MS = 5_000;

/** Three missed beats before we admit to the user that we are out of touch. */
export const STALE_AFTER_MS = 15_000;

export type SessionHealth = "waiting" | "live" | "stale";

/**
 * Whether to trust what is on screen, in one word.
 *
 * Worth surfacing rather than hiding: a countdown that has quietly stopped
 * agreeing with the table is worse than one that says it has lost touch, and
 * the clock keeps running locally either way — the phone knows how long the
 * round had left, it just no longer knows whether somebody paused it.
 */
export const sessionHealth = (
  session: SharedSession,
  now: number,
): SessionHealth => {
  if (session.lastMessageAt === null) return "waiting";
  return now - session.lastMessageAt > STALE_AFTER_MS ? "stale" : "live";
};

/**
 * Describe the local timer for broadcast.
 *
 * `remaining` is read from the local `timeLeft`, which the running timer keeps
 * current — not computed from `endTime` against a clock the receiver cannot
 * check.
 */
export const toSyncMessage = ({
  state,
  version,
  blindIndex,
  sender,
}: {
  state: TimerMachineState;
  version: number;
  blindIndex: number;
  sender: string;
}): TimerSyncMessage => ({
  version,
  sender,
  remaining: Math.max(0, Math.round(state.timeLeft)),
  duration: state.timerDuration,
  paused: state.paused,
  blindIndex,
});

/**
 * Should this message be applied, given what has already been?
 *
 * Newer wins; a tie is broken by the sender, so every device breaks it the same
 * way and they converge rather than each keeping whichever press reached it
 * first. A message identical to the one already applied is *ignored* rather
 * than reapplied: it arrives twice as a matter of course — reconnects and
 * heartbeats both repeat the current state — and reapplying re-anchors the
 * countdown to *now*, which on a phone at the table looks like the clock
 * jumping backwards by however long the round has been running.
 */
export const shouldApply = (
  session: SharedSession,
  message: TimerSyncMessage,
): boolean => {
  const applied = session.applied;
  if (applied === null) return true;
  if (message.version !== applied.version) {
    return message.version > applied.version;
  }
  return message.sender > applied.sender;
};

/**
 * Turn a received message into local timer state, anchored on the local clock.
 *
 * `receivedAt` is the receiver's own `Date.now()`. Nothing from the sender's
 * clock is used, which is what makes skew irrelevant.
 *
 * The message describes the moment it was *sent*, so it is already slightly
 * stale by the time it lands. That is deliberately not corrected for: doing so
 * needs a round-trip estimate, and being a few tens of milliseconds behind on a
 * ten-minute round is invisible, whereas a wrong correction is not.
 */
export const applySyncMessage = (
  message: TimerSyncMessage,
  receivedAt: number,
): TimerMachineState => ({
  timerDuration: message.duration,
  timeLeft: message.remaining,
  paused: message.paused,
  // A paused round has no expiry instant — the same shape the timer machine
  // uses locally, so nothing downstream has to know this came from elsewhere.
  endTime: message.paused ? undefined : receivedAt + message.remaining * 1000,
});

/**
 * Record what arrived.
 *
 * A message too old to apply still moves `lastMessageAt`: it is proof the
 * connection is alive, which is exactly what the heartbeat is for — most beats
 * repeat a version already applied, and treating those as silence would report
 * a healthy session as stale after fifteen seconds of nothing changing.
 */
export const receiveSyncMessage = (
  session: SharedSession,
  message: TimerSyncMessage,
  receivedAt: number,
): SharedSession => ({
  applied: shouldApply(session, message) ? message : session.applied,
  lastMessageAt: receivedAt,
});

/**
 * The next version to send from this device.
 *
 * Taken from the highest seen rather than from a local count, so a device that
 * joins late does not send a `1` that everybody ignores — its first message
 * has to beat whatever the table is already on.
 */
export const nextVersion = (session: SharedSession): number =>
  (session.applied?.version ?? 0) + 1;

/**
 * The seam a real transport plugs into.
 *
 * Deliberately tiny, and deliberately here rather than in the app: the same
 * shape has to be satisfied by AppSync Events and by whatever a test uses, and
 * putting it beside the protocol keeps the two describable in one place.
 *
 * `subscribe` returns its own unsubscribe, which is the shape every React
 * effect wants back — anything else turns into bookkeeping at the call site.
 */
export interface SessionTransport {
  /** Start a session and get the id others join with. */
  host(joinCode: string): Promise<string>;
  /** Find a session by the code that was read out. `null` if there isn't one. */
  resolve(joinCode: string): Promise<string | null>;
  publish(sessionId: string, message: TimerSyncMessage): Promise<void>;
  subscribe(
    sessionId: string,
    onMessage: (message: TimerSyncMessage) => void,
  ): () => void;
}
