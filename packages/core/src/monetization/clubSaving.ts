/**
 * What the annual plan saves against paying monthly.
 *
 * **Here rather than in the paywall, because a wrong number here is a legal
 * problem and not a cosmetic one.** "Save 44%" is a price claim; it has to be
 * derived from what the store actually charges, in every currency, or not shown
 * at all.
 *
 * Takes **numbers, never the localised price strings.** `priceString` is
 * "€19,99", "$17.99" or "¥3,000" depending on the storefront, and parsing that
 * back into a number is the same class of mistake as matching Club products by
 * name — it works in the currency it was written in and silently produces
 * nonsense everywhere else. RevenueCat gives a numeric `price` beside the
 * formatted one for exactly this.
 *
 * Both prices come from the same storefront and therefore the same currency, so
 * the ratio needs no currency handling of its own.
 */
export const annualSavingPercent = (
  /** The monthly plan's price, as a number in the storefront's currency. */
  monthlyPrice: number,
  /** The annual plan's price, in that same currency. */
  annualPrice: number,
): number | null => {
  /**
   * **`!(x > 0)` rather than `x <= 0`**, so `NaN` is refused too. A missing
   * price arrives as `NaN` often enough to be worth the odd-looking comparison,
   * and `NaN <= 0` is `false` — which would let it through to produce
   * "Save NaN%".
   */
  if (!(monthlyPrice > 0) || !(annualPrice > 0)) return null;

  const twelveMonths = monthlyPrice * 12;

  /**
   * **No claim when there is nothing to claim.** If the annual ever costs the
   * same or more — a pricing mistake, a storefront where the rounding lands
   * badly, or a promotional monthly — the honest answer is to say nothing
   * rather than to advertise a saving of zero or a negative one.
   */
  if (annualPrice >= twelveMonths) return null;

  return Math.round((1 - annualPrice / twelveMonths) * 100);
};
