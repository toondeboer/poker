import { describe, it, expect } from "vitest";
import {
  INTERSTITIAL_EVERY_N_ROUNDS,
  INTERSTITIAL_LAUNCH_GRACE_MS,
  shouldShowInterstitial,
  type InterstitialPolicyInput,
} from "./interstitialPolicy";

const LAUNCH = 1_000_000;
const AFTER_GRACE = LAUNCH + INTERSTITIAL_LAUNCH_GRACE_MS;

const eligible: InterstitialPolicyInput = {
  isPremium: false,
  consentResolved: true,
  roundsSinceLastAd: INTERSTITIAL_EVERY_N_ROUNDS,
  now: AFTER_GRACE,
  launchedAt: LAUNCH,
};

describe("shouldShowInterstitial", () => {
  it("shows once enough round changes have passed", () => {
    expect(shouldShowInterstitial(eligible)).toBe(true);
    expect(
      shouldShowInterstitial({
        ...eligible,
        roundsSinceLastAd: INTERSTITIAL_EVERY_N_ROUNDS - 1,
      }),
    ).toBe(false);
  });

  it("still shows when an earlier round's ad could not load", () => {
    expect(
      shouldShowInterstitial({
        ...eligible,
        roundsSinceLastAd: INTERSTITIAL_EVERY_N_ROUNDS + 1,
      }),
    ).toBe(true);
  });

  it("never shows to premium users", () => {
    expect(shouldShowInterstitial({ ...eligible, isPremium: true })).toBe(
      false,
    );
  });

  it("waits for the consent gate", () => {
    expect(
      shouldShowInterstitial({ ...eligible, consentResolved: false }),
    ).toBe(false);
  });

  it("holds off during the launch grace", () => {
    expect(shouldShowInterstitial({ ...eligible, now: AFTER_GRACE - 1 })).toBe(
      false,
    );
  });
});
