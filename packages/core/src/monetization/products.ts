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
 * The entitlement for anything that talks to the server.
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
 * changed at all.
 */
export const ENTITLEMENT_SHARED_BOARDS = "shared_boards";

/** Store product id for the shared-boards subscription. */
export const PRODUCT_SHARED_BOARDS = "shared_boards_monthly";
