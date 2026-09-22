import { describe, expect, it } from "vitest";
import { createRandom } from "./cards";
import { MAX_SEATS, isDealComplete } from "./deal";
import {
  type DealerSession,
  canDeal,
  createDealerSession,
  dealNextHand,
  muck,
  nextStreet,
  sitIn,
  sitOut,
  unmuck,
} from "./dealerSession";

const table = (players: string[], buttonIndex = 0) =>
  createDealerSession({ players, buttonIndex });

const deal = (s: DealerSession, seed = 1) =>
  dealNextHand(s, { random: createRandom(seed) });

const runOut = (s: DealerSession): DealerSession => {
  let current = s;
  while (current.deal && !isDealComplete(current.deal)) {
    current = nextStreet(current);
  }
  return current;
};

describe("createDealerSession", () => {
  it("seats everyone, in, with no hand yet", () => {
    const s = table(["a", "b", "c"]);
    expect(s.seats).toEqual([
      { playerId: "a", sittingOut: false },
      { playerId: "b", sittingOut: false },
      { playerId: "c", sittingOut: false },
    ]);
    expect(s.deal).toBeNull();
    expect(s.lastDeal).toBeNull();
    expect(s.handsPlayed).toBe(0);
  });

  it("holds no chips and no finishing order", () => {
    // Both are chip facts, and there are no chips. The board records a night by
    // hand instead — see the Gambling classification section in ROADMAP.md.
    const s = table(["a", "b"]) as unknown as Record<string, unknown>;
    for (const banned of ["bustOrder", "knockouts", "startingStack"]) {
      expect(s).not.toHaveProperty(banned);
    }
  });

  it("refuses a table that cannot play", () => {
    expect(() => table(["a"])).toThrow(/at least 2 players/);
    expect(() =>
      table(Array.from({ length: MAX_SEATS + 1 }, (_, i) => `p${i}`)),
    ).toThrow(/seats at most/);
    expect(() => table(["a", "a"])).toThrow(/own id/);
    expect(() => table(["a", "b"], 4)).toThrow(/not a seat/);
  });
});

describe("dealing hands", () => {
  it("deals everybody in and counts the hand", () => {
    const s = deal(table(["a", "b", "c"]));
    expect(s.deal).not.toBeNull();
    expect(s.deal!.seats).toHaveLength(3);
    expect(s.handsPlayed).toBe(1);
  });

  it("keeps the finished hand so the showdown stays on screen", () => {
    const s = runOut(deal(table(["a", "b"])));
    expect(s.deal).toBeNull();
    expect(s.lastDeal).not.toBeNull();
    expect(s.lastDeal!.board).toHaveLength(5);
  });

  it("deals the first hand from the seat it was given, then moves on", () => {
    // The button moves *between* hands, not before the first — otherwise "this
    // seat deals first" is inexpressible except as the seat before it.
    let s = deal(table(["a", "b", "c"], 0));
    expect(s.buttonIndex).toBe(0);
    s = deal(runOut(s), 2);
    expect(s.buttonIndex).toBe(1);
    s = deal(runOut(s), 3);
    expect(s.buttonIndex).toBe(2);
  });

  it("refuses to deal over a hand in progress", () => {
    expect(() => deal(deal(table(["a", "b"])), 2)).toThrow(
      /finish the current/,
    );
  });

  it("refuses to advance a street with no hand in progress", () => {
    expect(() => nextStreet(table(["a", "b"]))).toThrow(/no hand in progress/);
  });
});

describe("sitting out", () => {
  it("leaves somebody out of the next deal, and brings them back", () => {
    const out = sitOut(table(["a", "b", "c"]), "b");
    expect(deal(out).deal!.seats.map((s) => s.playerId)).toEqual(["a", "c"]);
    expect(deal(sitIn(out, "b")).deal!.seats).toHaveLength(3);
  });

  it("moves the button past a seat that is out", () => {
    let s = table(["a", "b", "c"], 0);
    s = runOut(deal(s));
    s = sitOut(s, "b");
    s = deal(s, 2);
    expect(s.seats[s.buttonIndex].playerId).toBe("c");
  });

  it("skips a seat that is out even on the first hand", () => {
    const s = deal(sitOut(table(["a", "b", "c"], 1), "b"));
    expect(s.seats[s.buttonIndex].playerId).not.toBe("b");
  });

  it("refuses to deal to fewer than two", () => {
    const s = sitOut(sitOut(table(["a", "b", "c"]), "b"), "c");
    expect(canDeal(s)).toBe(false);
    expect(() => deal(s)).toThrow(/not enough players/);
  });

  it("says a hand in progress blocks another deal", () => {
    expect(canDeal(table(["a", "b"]))).toBe(true);
    expect(canDeal(deal(table(["a", "b"])))).toBe(false);
    expect(canDeal(runOut(deal(table(["a", "b"]))))).toBe(true);
  });
});

describe("mucking through the session", () => {
  it("passes a muck down to the hand", () => {
    const s = muck(deal(table(["a", "b", "c"])), "b");
    expect(s.deal!.seats.find((x) => x.playerId === "b")!.mucked).toBe(true);
    expect(
      unmuck(s, "b").deal!.seats.find((x) => x.playerId === "b")!.mucked,
    ).toBe(false);
  });

  it("does nothing between hands", () => {
    const s = table(["a", "b"]);
    expect(muck(s, "a")).toBe(s);
    expect(unmuck(s, "a")).toBe(s);
  });
});
