/** Inputs to the ad-display decision, kept platform-agnostic. */
export type AdPolicyInput = {
  /** True when the user has unlocked the Pro (ad-free) tier. */
  isPremium: boolean;
  /**
   * True once the platform's consent/privacy gate has resolved — GDPR consent
   * on web, the UMP/ATT flow on mobile. Ads must not load before this.
   */
  consentResolved: boolean;
};

/**
 * Single source of truth for whether any ad surface should render. Every banner
 * and ad slot on both platforms calls this, so unlocking Pro disables ads
 * everywhere with no extra wiring.
 */
export function shouldShowAds({
  isPremium,
  consentResolved,
}: AdPolicyInput): boolean {
  return !isPremium && consentResolved;
}
