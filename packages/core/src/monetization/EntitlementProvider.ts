/**
 * Whether the current user has unlocked the paid "Pro" tier. Pro removes ads
 * and unlocks premium features, and resolves identically on web and mobile.
 */
export type Entitlements = {
  isPremium: boolean;
  /**
   * Whether this person can **host**: make a board of their own and share it.
   *
   * **Separate from `isPremium` on purpose**, because it is the only thing here
   * with a cost that keeps arriving — see `ENTITLEMENT_CLUB`. Joining somebody
   * else's board needs neither this nor Pro; the host pays.
   */
  hasClub: boolean;
  /**
   * Whether Pro was **bought outright**, rather than coming with Club.
   *
   * The two are not the same promise and should not be told to somebody as
   * though they were: a subscriber's Pro goes when the subscription does, and
   * saying "Pro unlocked" implies a permanence they have not got.
   */
  ownsProOutright: boolean;
};

/**
 * Source of truth for the user's entitlements, implemented per platform: the
 * mobile app backs it with RevenueCat; the web app uses a no-op (web has no
 * native IAP yet). Mirrors the StorageAdapter seam so the rest of the app never
 * touches a platform billing SDK directly.
 */
export interface EntitlementProvider {
  /** Resolve the current entitlements (e.g. from a cached customer-info call). */
  getEntitlements(): Promise<Entitlements>;
  /**
   * Subscribe to entitlement changes (e.g. after a purchase or restore).
   * Returns an unsubscribe function.
   */
  onChange(callback: (entitlements: Entitlements) => void): () => void;
}
