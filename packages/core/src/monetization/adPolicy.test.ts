import { describe, it, expect } from "vitest";
import { shouldShowAds } from "./adPolicy";

describe("shouldShowAds", () => {
  it("shows ads to non-premium users once consent is resolved", () => {
    expect(shouldShowAds({ isPremium: false, consentResolved: true })).toBe(true);
  });

  it("never shows ads to premium users, regardless of consent", () => {
    expect(shouldShowAds({ isPremium: true, consentResolved: true })).toBe(false);
    expect(shouldShowAds({ isPremium: true, consentResolved: false })).toBe(false);
  });

  it("withholds ads until consent is resolved", () => {
    expect(shouldShowAds({ isPremium: false, consentResolved: false })).toBe(false);
  });
});
