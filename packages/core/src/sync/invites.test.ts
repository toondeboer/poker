import { describe, expect, it } from "vitest";
import { INVITE_PATH, inviteUrlFor, isInviteToken, tokenFromUrl } from "./invites";

// What the server actually mints: 24 random bytes as base64url.
const TOKEN = "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MEFC";

describe("building a link to share", () => {
  it("puts the token on the end of a join path", () => {
    expect(inviteUrlFor(TOKEN, "https://pokerkit.app")).toBe(
      `https://pokerkit.app/${INVITE_PATH}/${TOKEN}`,
    );
  });

  it("does not double the slash on a base that has one", () => {
    expect(inviteUrlFor(TOKEN, "https://pokerkit.app/")).not.toContain("//join");
  });

  it("keeps the two slashes of a scheme", () => {
    // **The trap this had.** Stripping trailing slashes blindly turned
    // `pokerkit://` into `pokerkit:`, so the app's base had to be written as
    // the odd `"pokerkit:/"` and anybody spelling it naturally got a
    // single-slash link that nothing would open.
    expect(inviteUrlFor(TOKEN, "pokerkit://")).toBe(
      `pokerkit://${INVITE_PATH}/${TOKEN}`,
    );
    expect(tokenFromUrl(inviteUrlFor(TOKEN, "pokerkit://"))).toBe(TOKEN);
  });
});

describe("reading a link somebody tapped", () => {
  it("reads the token back out of its own link", () => {
    expect(tokenFromUrl(inviteUrlFor(TOKEN, "https://pokerkit.app"))).toBe(TOKEN);
  });

  it("reads it out of the custom scheme", () => {
    expect(tokenFromUrl(`pokerkit://${INVITE_PATH}/${TOKEN}`)).toBe(TOKEN);
  });

  it("ignores what a mail client appended", () => {
    // A link arrives having been through somebody else's software.
    expect(tokenFromUrl(`https://pokerkit.app/join/${TOKEN}?utm_source=whatsapp`)).toBe(
      TOKEN,
    );
    expect(tokenFromUrl(`https://pokerkit.app/join/${TOKEN}#top`)).toBe(TOKEN);
  });

  it("ignores punctuation a person put there", () => {
    // "here's the link: https://…/join/<token>." — the full stop is not part of
    // it, and base64url contains no punctuation, so this cannot eat a real
    // character.
    expect(tokenFromUrl(`https://pokerkit.app/join/${TOKEN}.`)).toBe(TOKEN);
    expect(tokenFromUrl(`https://pokerkit.app/join/${TOKEN})`)).toBe(TOKEN);
  });

  it("is not fooled by any other deep link the app handles", () => {
    // **Without the `join` check this is a real bug**: `pokerkit://account`
    // would send "account" to the server as though it were a token.
    expect(tokenFromUrl("pokerkit://account")).toBeNull();
    expect(tokenFromUrl("pokerkit://leaderboard?record=1")).toBeNull();
    expect(tokenFromUrl(`https://pokerkit.app/${TOKEN}`)).toBeNull();
  });

  it("refuses something that is not a token", () => {
    expect(tokenFromUrl("https://pokerkit.app/join/short")).toBeNull();
    expect(tokenFromUrl("https://pokerkit.app/join/has spaces in it here")).toBeNull();
    expect(tokenFromUrl("https://pokerkit.app/join/")).toBeNull();
    expect(tokenFromUrl("")).toBeNull();
  });

  it("does not throw on a malformed escape", () => {
    // `decodeURIComponent("%")` throws, and this runs on whatever the OS hands
    // the app — which is not necessarily something the app produced.
    expect(tokenFromUrl("https://pokerkit.app/join/%")).toBeNull();
  });

  it("survives a token that was escaped on the way out", () => {
    expect(tokenFromUrl(inviteUrlFor(TOKEN, "https://pokerkit.app"))).toBe(TOKEN);
  });
});

describe("what counts as a token", () => {
  it("takes base64url and nothing else", () => {
    expect(isInviteToken(TOKEN)).toBe(true);
    expect(isInviteToken("has-underscores_and-dashes-1234")).toBe(true);
    // `+` and `/` are base64, not base64url — they would need escaping in a URL,
    // which is exactly why the server mints base64url.
    expect(isInviteToken("plus+and/slash/aaaaaaaaaaaaaaa")).toBe(false);
    expect(isInviteToken("tooshort")).toBe(false);
    expect(isInviteToken(null)).toBe(false);
    expect(isInviteToken(12345)).toBe(false);
  });
});
