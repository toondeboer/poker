import { describe, expect, it } from "vitest";
import {
  boardBelongsToAnotherAccount,
  boardIsVisible,
  entitlementsFrom,
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

describe("what a purchase grants", () => {
  it("gives a subscriber Pro as well", () => {
    // **A shared board is a leaderboard, and the leaderboard is Pro.** Without
    // this a subscriber hosts a board they cannot open — not an awkward state,
    // a broken one, sold deliberately.
    expect(entitlementsFrom({ pro: false, club: true, clubEver: true })).toEqual({
      isPremium: true,
      hasClub: true,
      // Not bought, only included — and it goes when the subscription does.
      ownsProOutright: false,
    });
  });

  it("does not give a Pro buyer hosting", () => {
    // The rule runs one way only. Pro has never included hosting.
    expect(entitlementsFrom({ pro: true, club: false, clubEver: false })).toEqual({
      isPremium: true,
      hasClub: false,
      ownsProOutright: true,
    });
  });

  it("grants nothing to somebody who has bought nothing", () => {
    expect(entitlementsFrom({ pro: false, club: false, clubEver: false })).toEqual({
      isPremium: false,
      hasClub: false,
      ownsProOutright: false,
    });
  });

  it("keeps Pro after the subscription lapses", () => {
    // **The decision this exists for.** Without it a lapsed subscriber loses
    // the leaderboard and with it the sight of every board they own, while
    // those boards carry on syncing for the members still reading them.
    expect(
      entitlementsFrom({ pro: false, club: false, clubEver: true }),
    ).toEqual({ isPremium: true, hasClub: false, ownsProOutright: false });
  });

  it("does not keep hosting after it lapses", () => {
    // Pro persists; hosting is the thing being paid for and stops.
    expect(entitlementsFrom({ pro: false, club: false, clubEver: true }).hasClub).toBe(
      false,
    );
  });

  it("lets somebody hold both without contradiction", () => {
    // Somebody who bought Pro years ago and later subscribes.
    expect(entitlementsFrom({ pro: true, club: true, clubEver: true })).toEqual({
      isPremium: true,
      hasClub: true,
      // Their Pro survives the subscription ending; that is what they paid for.
      ownsProOutright: true,
    });
  });
});

describe("whose board is it, on the server", () => {
  it("is somebody else's when a different account owns it", () => {
    // The case that produced two contradictory-looking refusals on one screen:
    // `createGroup` refused "group exists" — it does, under the other account —
    // and every player behind it refused "no such group", because this account
    // cannot see it.
    expect(
      boardBelongsToAnotherAccount({ ownerAccountId: "acct-a", accountId: "acct-b" }),
    ).toBe(true);
  });

  it("is not somebody else's when the same account owns it", () => {
    expect(
      boardBelongsToAnotherAccount({ ownerAccountId: "acct-a", accountId: "acct-a" }),
    ).toBe(false);
  });

  it("is adoptable when nobody owns it yet", () => {
    // A board made offline, or made before this field existed. Answering `true`
    // would strand every board on an upgraded install.
    expect(
      boardBelongsToAnotherAccount({ ownerAccountId: undefined, accountId: "acct-a" }),
    ).toBe(false);
  });

  it("is not somebody else's merely because nobody is signed in", () => {
    // Nothing is going to be sent anyway, and `true` here would have the UI
    // describe a board as another person's purely for want of a session.
    expect(
      boardBelongsToAnotherAccount({ ownerAccountId: "acct-a", accountId: null }),
    ).toBe(false);
  });
});

describe("a board that belongs to another account", () => {
  it("does not sync, even for a subscriber", () => {
    // **Club is not permission to re-home somebody else's board.** Without this
    // the outbox re-announces the previous account's boards on every launch.
    expect(
      boardSyncs({ hasClub: true, isOnServer: true, belongsToAnotherAccount: true }),
    ).toBe(false);
    expect(
      boardSyncs({ hasClub: true, isOnServer: false, belongsToAnotherAccount: true }),
    ).toBe(false);
  });

  it("behaves exactly as before when ownership is not passed", () => {
    // The flag defaults to false so an untaught caller is unchanged rather than
    // silently stranding every board.
    expect(boardSyncs({ hasClub: false, isOnServer: true })).toBe(true);
    expect(boardSyncs({ hasClub: true, isOnServer: false })).toBe(true);
    expect(boardSyncs({ hasClub: false, isOnServer: false })).toBe(false);
  });
});
