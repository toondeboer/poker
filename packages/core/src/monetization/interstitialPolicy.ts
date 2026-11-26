import { shouldShowAds, type AdPolicyInput } from "./adPolicy";

/**
 * When a full-screen (interstitial) ad may appear.
 *
 * **Only at a round change** — the moment the user answers the end-of-round
 * alert. That is a "logical break in between levels", which is the placement
 * AdMob's interstitial policy describes, and it is triggered by the user's own
 * tap rather than appearing unexpectedly. The next round starts as usual and
 * the ad is shown over it; the clock keeps correct time underneath, because it
 * runs from an end time rather than counting ticks.
 *
 * **Every round change, by the owner's choice (2026-11-26), to maximise ad
 * revenue.** Counted in round changes rather than minutes, so the rhythm is the
 * same for 5-minute turbo levels and 30-minute deep ones. Note AdMob's
 * "no more than one interstitial after every two user actions": with one tap
 * per round that is borderline, and setting this to 2 is the conservative
 * answer if AdMob ever flags it.
 *
 * None in the first minutes after launch either: reopening the app onto a
 * round that ended while it was closed would otherwise put an ad on almost the
 * first thing the user touches, which is close to the "app load" placement
 * AdMob forbids.
 */
export const INTERSTITIAL_LAUNCH_GRACE_MS = 3 * 60 * 1000;
export const INTERSTITIAL_EVERY_N_ROUNDS = 1;

export type InterstitialPolicyInput = AdPolicyInput & {
  /**
   * Round changes since the last interstitial (or since launch, if none has
   * shown), counting the one happening now.
   */
  roundsSinceLastAd: number;
  /** Current time, epoch ms. Passed in to keep this pure and testable. */
  now: number;
  /** When this app launch began, epoch ms. */
  launchedAt: number;
};

export function shouldShowInterstitial({
  roundsSinceLastAd,
  now,
  launchedAt,
  ...adPolicy
}: InterstitialPolicyInput): boolean {
  if (!shouldShowAds(adPolicy)) return false;
  if (now - launchedAt < INTERSTITIAL_LAUNCH_GRACE_MS) return false;
  return roundsSinceLastAd >= INTERSTITIAL_EVERY_N_ROUNDS;
}
