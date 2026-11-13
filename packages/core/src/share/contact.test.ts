import { describe, it, expect } from "vitest";
import { adReportMailto, CONTACT_EMAIL } from "./contact";

/** Splits a mailto: URL back into its address and decoded query fields. */
function parse(url: string) {
  const [address, query] = url.slice("mailto:".length).split("?");
  const fields = Object.fromEntries(
    query.split("&").map((pair) => {
      const [key, value] = pair.split("=");
      return [key, decodeURIComponent(value)];
    }),
  );
  return { address, fields };
}

describe("adReportMailto", () => {
  it("addresses the support inbox with a 'Report an ad' subject", () => {
    const { address, fields } = parse(
      adReportMailto({ platform: "iOS", appVersion: "1.2.1" }),
    );
    expect(address).toBe(CONTACT_EMAIL);
    expect(fields.subject).toBe("Report an ad");
  });

  it("asks what the ad was and names the platform and version", () => {
    const { fields } = parse(
      adReportMailto({ platform: "Android", appVersion: "1.2.1" }),
    );
    expect(fields.body).toContain("What was the ad for");
    expect(fields.body).toContain(
      "Poker Blinds Timer & Buzzer 1.2.1 on Android",
    );
  });

  it("leaves the version out rather than printing 'undefined' or 'null'", () => {
    for (const appVersion of [undefined, null, ""]) {
      const { fields } = parse(adReportMailto({ platform: "iOS", appVersion }));
      expect(fields.body).toContain("Poker Blinds Timer & Buzzer on iOS");
      expect(fields.body).not.toMatch(/undefined|null/);
    }
  });

  // RFC 6068: a space in a mailto: header is %20. A "+" would reach the mail
  // app literally, and the "&" in the app name would split the query.
  it("encodes spaces as %20 and keeps the body's '&' inside the body", () => {
    const url = adReportMailto({ platform: "iOS", appVersion: "1.2.1" });
    expect(url).not.toContain("+");
    expect(url).toContain("subject=Report%20an%20ad");
    expect(url.split("&")).toHaveLength(2);
  });
});
