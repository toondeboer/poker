/**
 * Stable identifiers shared by web and mobile so both reference the same
 * RevenueCat entitlement and store products. Keep these in sync with
 * RevenueCat, App Store Connect, and Google Play Console.
 */

/** RevenueCat entitlement id that grants the Pro tier (ad-free + premium features). */
export const ENTITLEMENT_PRO = "pro";

/** Store product id for the one-time "Pro / Remove Ads" unlock (non-consumable). */
export const PRODUCT_PRO_LIFETIME = "pro_lifetime";

/**
 * The entitlement for hosting: **the Club**.
 *
 * **A second entitlement, not a second tier**, and the distinction is the whole
 * design. `pro` is a one-time purchase and everything it grants runs on the
 * phone: the leaderboard, payouts, dealing a hand, no ads. None of that costs
 * anything per person, so none of it moves, and **nobody who has already paid
 * loses a thing**. There is nothing to migrate either — a separate entitlement
 * cannot affect `pro`, so there is no restore edge case and no receipt to
 * rewrite.
 *
 * Shared boards are different: they run on infrastructure that is billed every
 * month for as long as somebody keeps a board. A one-time payment cannot fund
 * an ongoing cost, and pretending otherwise is a bill that grows while the
 * revenue does not.
 *
 * **Named for what it does rather than where it sits.** "Pro+" would say the
 * thing people already bought had been demoted; it has not, and it has not
 * changed at all. "Club" also outlives shared boards specifically — the shared
 * clock, playing a hand together and anything else needing other people belong
 * to the same subscription, and none of them will need this renamed.
 *
 * **The host pays; guests do not.** Somebody who is sent a board can join it,
 * read it and record on it having bought nothing at all. That is not
 * generosity: an invite that asks five friends to subscribe to a poker timer is
 * a feature nobody ever uses, and a board costs the same whether one person is
 * on it or eight. The person who organises the game night is the one who gets
 * the value and the one who pays for it.
 */
export const ENTITLEMENT_CLUB = "club";

/** Store product id for the Club subscription. */
export const PRODUCT_CLUB = "club_monthly";
