/**
 * Whether the current user has unlocked the paid "Pro" tier. Pro removes ads
 * and unlocks premium features, and resolves identically on web and mobile.
 */
export type Entitlements = {
  isPremium: boolean;
  /**
   * Whether boards can be shared, joined and synced.
   *
   * **Separate from `isPremium` on purpose**, because it is the only thing here
   * with a cost that keeps arriving — see `ENTITLEMENT_SHARED_BOARDS`. Somebody
   * can have one, both, or neither: Pro without this is the app as it shipped
   * in 1.2.0, and this without Pro is a person who can join a board and then
   * cannot see the leaderboard it is drawn on.
   */
  hasSharedBoards: boolean;
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
