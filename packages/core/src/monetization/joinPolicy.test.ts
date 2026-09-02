import { describe, expect, it } from "vitest";
import { joinRefusal, type JoinContext } from "./joinPolicy";

const allowed: JoinContext = {
  signedIn: true,
  entitlementsKnown: true,
  hasSharedBoards: true,
  isPremium: true,
};

describe("who can join a shared board", () => {
  it("lets somebody through who has everything", () => {
    expect(joinRefusal(allowed)).toBeNull();
  });
});

describe("what somebody is told, and in what order", () => {
  it("asks a signed-out person to sign in, whatever else is missing", () => {
    // **The screen offers a "Sign in" button and nothing else in this state**,
    // so any other message leaves the words and the only available action
    // disagreeing about what is wrong.
    const out: JoinContext = {
      signedIn: false,
      entitlementsKnown: true,
      hasSharedBoards: false,
      isPremium: false,
    };
    expect(joinRefusal(out)).toBe("Sign in to join a board.");
  });

  it("waits rather than refusing while the store has not answered", () => {
    // **This is how somebody who has paid gets told to pay.** The entitlement
    // starts `false` and becomes the store's answer a moment later; joining
    // from a cold launch lands squarely inside that window.
    const loading: JoinContext = { ...allowed, entitlementsKnown: false };
    expect(joinRefusal(loading)).toContain("Still checking");
    // And the same for somebody who genuinely has nothing — the wait comes
    // first either way, because until the answer lands the two are the same.
    expect(
      joinRefusal({ ...loading, hasSharedBoards: false, isPremium: false }),
    ).toContain("Still checking");
  });

  it("names the subscription when that is what is missing", () => {
    expect(joinRefusal({ ...allowed, hasSharedBoards: false })).toContain(
      "subscription",
    );
  });

  it("names Pro when that is what is missing", () => {
    // Somebody who subscribed to sharing but never bought Pro. Telling them to
    // subscribe would be telling them to buy what they already have.
    const proless = joinRefusal({ ...allowed, isPremium: false });
    expect(proless).toContain("Pro");
    expect(proless).not.toContain("subscription");
  });

  it("names the subscription first when both are missing", () => {
    // One message at a time, and this is the one that unlocks joining at all.
    expect(
      joinRefusal({ ...allowed, hasSharedBoards: false, isPremium: false }),
    ).toContain("subscription");
  });

  it("never tells somebody to buy what they already own", () => {
    // The property all of the above is really about, asserted across every
    // combination rather than case by case.
    for (const signedIn of [true, false]) {
      for (const hasSharedBoards of [true, false]) {
        for (const isPremium of [true, false]) {
          const reason = joinRefusal({
            signedIn,
            entitlementsKnown: true,
            hasSharedBoards,
            isPremium,
          });
          if (!reason) continue;
          if (hasSharedBoards) expect(reason).not.toContain("subscription");
          if (isPremium) expect(reason).not.toContain("part of Pro");
        }
      }
    }
  });
});
