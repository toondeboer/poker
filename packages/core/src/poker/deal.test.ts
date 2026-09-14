import { describe, expect, it } from "vitest";
import { createRandom } from "./cards";
import {
  BOARD_CARDS,
  HOLE_CARDS,
  MAX_SEATS,
  type Deal,
  isDealComplete,
  muck,
  nextStreet,
  showdownFor,
  startDeal,
  stillIn,
  unmuck,
} from "./deal";

const deal = (players: string[], seed = 1, buttonIndex = 0): Deal =>
  startDeal({ seats: players, buttonIndex, random: createRandom(seed) });

/** Every card in play, as comparable strings. */
const allCards = (d: Deal): string[] => [
  ...d.board.map((c) => `${c.rank}${c.suit}`),
  ...d.deck.map((c) => `${c.rank}${c.suit}`),
  ...d.seats.flatMap((s) => s.hole.map((c) => `${c.rank}${c.suit}`)),
];

const runOut = (d: Deal): Deal => {
  let current = d;
  while (!isDealComplete(current)) current = nextStreet(current);
  return current;
};

describe("startDeal", () => {
  it("gives everybody two cards and nobody the board", () => {
    const d = deal(["a", "b", "c"]);
    expect(d.seats).toHaveLength(3);
    for (const seat of d.seats) {
      expect(seat.hole).toHaveLength(HOLE_CARDS);
      expect(seat.mucked).toBe(false);
    }
    expect(d.board).toEqual([]);
    expect(d.street).toBe("preflop");
    expect(d.showdown).toBeNull();
  });

  it("deals no chips, no blinds and no pot", () => {
    // The property this module exists for. If any of these ever appear, the
    // rating question this removal answered is open again — see ROADMAP.md.
    const d = deal(["a", "b"]) as unknown as Record<string, unknown>;
    for (const banned of [
      "pots",
      "awards",
      "round",
      "smallBlind",
      "bigBlind",
    ]) {
      expect(d).not.toHaveProperty(banned);
    }
    for (const seat of deal(["a", "b"]).seats) {
      expect(seat).not.toHaveProperty("stack");
      expect(seat).not.toHaveProperty("committed");
    }
  });

  it("accounts for all 52 cards exactly once", () => {
    const cards = allCards(deal(["a", "b", "c", "d"]));
    expect(cards).toHaveLength(52);
    expect(new Set(cards).size).toBe(52);
  });

  it("refuses a table that cannot be dealt", () => {
    expect(() => deal(["a"])).toThrow(/at least 2 players/);
    expect(() =>
      deal(Array.from({ length: MAX_SEATS + 1 }, (_, i) => `p${i}`)),
    ).toThrow(/seats at most/);
    expect(() => deal(["a", "a"])).toThrow(/own id/);
    expect(() => deal(["a", "b"], 1, 5)).toThrow(/not a seat/);
    expect(() => deal(["a", "b"], 1, -1)).toThrow(/not a seat/);
  });

  it("deals the same hand from the same seed, and a different one otherwise", () => {
    expect(allCards(deal(["a", "b"], 7))).toEqual(
      allCards(deal(["a", "b"], 7)),
    );
    expect(allCards(deal(["a", "b"], 7))).not.toEqual(
      allCards(deal(["a", "b"], 8)),
    );
  });
});

describe("turning the streets", () => {
  it("deals three, then one, then one", () => {
    let d = deal(["a", "b"]);
    d = nextStreet(d);
    expect(d.street).toBe("flop");
    expect(d.board).toHaveLength(3);
    d = nextStreet(d);
    expect(d.street).toBe("turn");
    expect(d.board).toHaveLength(4);
    d = nextStreet(d);
    expect(d.street).toBe("river");
    expect(d.board).toHaveLength(BOARD_CARDS);
  });

  it("still accounts for every card once the board is out", () => {
    const cards = allCards(runOut(deal(["a", "b", "c"])));
    expect(cards).toHaveLength(52);
    expect(new Set(cards).size).toBe(52);
  });

  it("ends at the showdown and stays there", () => {
    const done = runOut(deal(["a", "b"]));
    expect(isDealComplete(done)).toBe(true);
    expect(nextStreet(done)).toBe(done);
  });

  it("burns nothing — the board comes off the top", () => {
    // No burn cards: a burn defeats a marked deck at a physical table, and
    // there is no deck to mark here.
    const preflop = deal(["a", "b"]);
    const flop = nextStreet(preflop);
    expect(flop.board).toEqual(preflop.deck.slice(0, 3));
  });
});

describe("the showdown", () => {
  it("ranks everyone still holding cards, best first", () => {
    const done = runOut(deal(["a", "b", "c"]));
    expect(done.showdown).not.toBeNull();
    expect(done.showdown).toHaveLength(3);
    const values = done.showdown!.map((s) => s.hand.value);
    expect([...values].sort((x, y) => y - x)).toEqual(values);
  });

  it("names the hand, so the table can see why it won", () => {
    const done = runOut(deal(["a", "b"]));
    expect(typeof done.showdown![0].hand.category).toBe("string");
    expect(done.showdown![0].hand.cards).toHaveLength(5);
  });

  it("shows nothing when only one player is left", () => {
    // An uncontested hand is not shown, at a real table or here — revealing it
    // gives away how somebody plays for free.
    const done = runOut(muck(deal(["a", "b"]), "b"));
    expect(done.showdown).toBeNull();
  });

  it("leaves a mucked player out of the ranking", () => {
    const done = runOut(muck(deal(["a", "b", "c"]), "b"));
    expect(done.showdown!.map((s) => s.playerId).sort()).toEqual(["a", "c"]);
  });

  it("refuses to rank before the board is complete", () => {
    expect(showdownFor(deal(["a", "b"]))).toBeNull();
  });
});

describe("mucking", () => {
  it("takes a seat out of the hand and back in", () => {
    const d = deal(["a", "b", "c"]);
    expect(stillIn(muck(d, "b")).map((s) => s.playerId)).toEqual(["a", "c"]);
    expect(stillIn(unmuck(muck(d, "b"), "b"))).toHaveLength(3);
  });

  it("is idempotent, and ignores an id nobody has", () => {
    const d = deal(["a", "b"]);
    expect(muck(muck(d, "a"), "a")).toEqual(muck(d, "a"));
    expect(muck(d, "nobody")).toEqual(d);
    expect(unmuck(d, "nobody")).toEqual(d);
  });

  it("does nothing once the hand is over", () => {
    const done = runOut(deal(["a", "b"]));
    expect(muck(done, "a")).toBe(done);
    expect(unmuck(done, "a")).toBe(done);
  });
});
