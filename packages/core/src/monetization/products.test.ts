import { describe, it, expect } from "vitest";
import { ENTITLEMENT_PRO, PRODUCT_PRO_LIFETIME } from "./products";
import { SHARE_MESSAGE, SITE_URL } from "../share/links";

/**
 * These are contracts with systems outside this repo, not implementation
 * details — the entitlement id must match RevenueCat, and the product id must
 * match App Store Connect and Play Console. Renaming one is a config change in
 * three consoles, and getting it wrong doesn't fail the build or the tests: it
 * fails at purchase time, for real users, only in production. Pinning the
 * literals makes an accidental rename show up here first.
 */
describe("store identifiers", () => {
  it("pins the Pro entitlement id", () => {
    expect(ENTITLEMENT_PRO).toBe("pro");
  });

  it("pins the Pro product id", () => {
    expect(PRODUCT_PRO_LIFETIME).toBe("pro_lifetime");
  });
});

describe("share links", () => {
  it("points at the canonical site over https", () => {
    expect(SITE_URL).toBe("https://poker-timer.toondeboer.com");
    expect(() => new URL(SITE_URL)).not.toThrow();
  });

  it("has no trailing slash, so appending a path can't double up", () => {
    expect(SITE_URL.endsWith("/")).toBe(false);
  });

  it("keeps the share message non-empty and free of the URL", () => {
    // The message prefaces the link rather than containing it; if the URL
    // leaked in here it would be shared twice.
    expect(SHARE_MESSAGE.trim().length).toBeGreaterThan(0);
    expect(SHARE_MESSAGE).not.toContain(SITE_URL);
  });
});
