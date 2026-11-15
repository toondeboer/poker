/**
 * The Club free trial: a store-native introductory offer on the subscription.
 *
 * **Configured in the stores, not here.** App Store Connect and Play Console
 * each attach a free period to the Club products; the app only reads what the
 * store offers this user and shows it. So there is no length constant in this
 * file on purpose: the store's answer is the only one that is true, and a
 * number here would drift from it.
 */

/**
 * Whether Club counts as having been *held* for the purpose of keeping Pro.
 *
 * `periodType` is RevenueCat's name for the last period the entitlement was
 * in, or `undefined` when it has never existed.
 *
 * **A free trial does not count, and that is what keeps Pro worth buying.**
 * "Pro, once granted by Club, stays granted" was safe while the cheapest way
 * into Club cost what Pro costs. A free trial breaks that: start it, cancel it,
 * keep Pro for nothing. So only a period somebody paid for counts. During the
 * trial itself Pro is unlocked anyway, because Club is active; this decides
 * what is left once it is not.
 *
 * Compared without regard to case, because the two SDK type definitions
 * disagree about it.
 */
export function clubPeriodKeepsPro(periodType: string | undefined): boolean {
  if (periodType === undefined) return false;
  return periodType.toUpperCase() !== "TRIAL";
}

/**
 * A free period's length in words, as the paywall says it: "14 days",
 * "1 month". `null` when the store's answer cannot be put honestly.
 *
 * **Weeks are said in days.** Both stores describe a fortnight as two weeks,
 * and "2 weeks free" beside "14-day free trial" on the same sheet reads as two
 * different offers.
 */
export function freeTrialLengthLabel(
  unit: string,
  count: number,
): string | null {
  if (!Number.isInteger(count) || count <= 0) return null;
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`;
  switch (unit.toUpperCase()) {
    case "DAY":
      return plural(count, "day");
    case "WEEK":
      return plural(count * 7, "day");
    case "MONTH":
      return plural(count, "month");
    case "YEAR":
      return plural(count, "year");
    default:
      return null;
  }
}
