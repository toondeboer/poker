/**
 * The Pro trial: Pro for a fixed number of days, started by the user, once.
 *
 * **Opt-in, never automatic, and that is Apple's rule rather than a taste.**
 * App Review Guideline 3.1.1 allows a free time-based trial in a
 * non-subscription app only as a free non-consumable purchase named "XX-day
 * Trial", and forbids an app unlocking features by a mechanism of its own. So
 * the trial begins when somebody takes that purchase, and the date it began is
 * the store's on iOS. Android has no such product, so the app records the date
 * itself; the behaviour is kept the same on both so there is one thing to
 * explain.
 *
 * **Fourteen days because a poker night is weekly at best.** A week can pass
 * without a single game, and a trial nobody played a hand in shows them
 * nothing. The number is also in the store product's name
 * (`PRODUCT_PRO_TRIAL`), which Apple requires to state it, so changing it here
 * means a new product there.
 */
export const PRO_TRIAL_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ProTrialState =
  /** Never started. The offer is still available. */
  | { status: "unused" }
  /** Running. `daysLeft` is what to tell the user, and is never below 1. */
  | { status: "active"; endsAt: number; daysLeft: number }
  /** Used up. It is not offered again. */
  | { status: "ended"; endedAt: number };

/**
 * Where the trial stands, from when it started.
 *
 * `startedAt` is a millisecond timestamp, or `null` when no trial was ever
 * started.
 *
 * **A start date in the future counts as starting now.** It can only come from
 * a device clock that was wrong when the trial began or has been moved since,
 * and the alternative readings are both worse: treating it as not started
 * offers a second trial, and honouring it hands out more than fourteen days.
 */
export function proTrialState(
  startedAt: number | null,
  now: number,
): ProTrialState {
  if (startedAt === null) return { status: "unused" };
  const endsAt = Math.min(startedAt, now) + PRO_TRIAL_DAYS * DAY_MS;
  if (now >= endsAt) return { status: "ended", endedAt: endsAt };
  return {
    status: "active",
    endsAt,
    // Rounded up, so the last few hours read "1 day left" rather than "0".
    daysLeft: Math.ceil((endsAt - now) / DAY_MS),
  };
}
