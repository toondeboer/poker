import { describe, expect, it } from "vitest";
import {
  boardIsVisible,
  boardSyncs,
  hostRefusal,
  joinRefusal,
  type ClubContext,
} from "./clubPolicy";

const paidUp: ClubContext = {
  signedIn: true,
  entitlementsKnown: true,
  hasClub: true,
  isPremium: true,
};

describe("joining a board somebody sent you", () => {
  it("needs nothing bought at all", () => {
    // **The decision the whole feature rests on.** An invite that asks five
    // friends to subscribe to a poker timer is a feature nobody ever uses.
    expect(joinRefusal({ signedIn: true })).toBeNull();
  });

  it("needs a session, because a membership belongs to somebody", () => {
    expect(joinRefusal({ signedIn: false })).toBe("Sign in to join a board.");
  });

  it("does not care about Pro or Club", () => {
    // Stated as a test because it is the thing most likely to be "tidied" back
    // into a paywall by somebody who has not read why.
    expect(joinRefusal({ signedIn: true })).toBeNull();
  });
});

describe("sharing a board of your own", () => {
  it("is allowed with the subscription", () => {
    expect(hostRefusal(paidUp)).toBeNull();
  });

  it("names Club, and says joining is still free", () => {
    // Somebody refused here should not conclude the whole feature is paywalled
    // — the half they are most likely to want is not.
    const reason = hostRefusal({ ...paidUp, hasClub: false });
    expect(reason).toContain("Club");
    expect(reason).toContain("free");
  });

  it("asks for a sign-in before it asks for money", () => {
    expect(hostRefusal({ ...paidUp, signedIn: false, hasClub: false })).toContain(
      "Sign in",
    );
  });

  it("waits rather than refusing while the store has not answered", () => {
    // **How somebody who has paid gets told to pay.** The entitlement starts
    // `false` and becomes the store's answer a moment later.
    expect(hostRefusal({ ...paidUp, entitlementsKnown: false })).toContain(
      "Still checking",
    );
    expect(
      hostRefusal({ ...paidUp, entitlementsKnown: false, hasClub: false }),
    ).toContain("Still checking");
  });

  it("never tells a subscriber to subscribe", () => {
    for (const signedIn of [true, false]) {
      const reason = hostRefusal({ ...paidUp, signedIn });
      if (reason) expect(reason).not.toContain("part of Club");
    }
  });
});

describe("which boards reach the server", () => {
  it("keeps sending a board the server already has, subscription or not", () => {
    // A board up there has members reading it. Cutting it off would leave them
    // looking at a stale board with no idea why.
    expect(boardSyncs({ hasClub: false, isOnServer: true })).toBe(true);
  });

  it("sends your own boards when you host", () => {
    expect(boardSyncs({ hasClub: true, isOnServer: false })).toBe(true);
  });

  it("leaves a purely local board alone without the subscription", () => {
    // **And this is why writes must not be queued for it either**: it is never
    // announced, so anything queued would sit there being refused for a board
    // the server has never heard of.
    expect(boardSyncs({ hasClub: false, isOnServer: false })).toBe(false);
  });
});

describe("which boards can be looked at", () => {
  it("shows somebody else's board without Pro", () => {
    // Or "guests join free" is a lie: they would join and land on a paywall
    // looking at the board they were invited to.
    expect(boardIsVisible({ isPremium: false, isGuestBoard: true })).toBe(true);
  });

  it("keeps your own boards behind Pro even once they have synced", () => {
    // **The server answers `admin` for a board you created.** Treating any
    // known role as "shared" would hand the Pro leaderboard to anybody who
    // signed in on a device that had pulled its own boards — Pro unlocked by
    // syncing, which is not a thing anybody bought.
    expect(boardIsVisible({ isPremium: false, isGuestBoard: false })).toBe(false);
    expect(boardIsVisible({ isPremium: true, isGuestBoard: false })).toBe(true);
  });
});
