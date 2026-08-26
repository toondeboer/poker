import { describe, expect, it } from "vitest";
import { createRandom, legalActions, startHand, type Hand } from "@poker/core";
import {
  applyAction,
  privateView,
  publicView,
  type StoredTable,
} from "../lib/lambda/tableAction";

const dealHand = (seed = 1): Hand =>
  startHand({
    seats: [
      { playerId: "a", stack: 200 },
      { playerId: "b", stack: 200 },
      { playerId: "c", stack: 200 },
    ],
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    random: createRandom(seed),
  });

const stored = (hand: Hand, version = 1): StoredTable => ({ hand, version });

const whoseTurn = (hand: Hand) => legalActions(hand)!.playerId;

describe("applyAction", () => {
  it("applies a legal action and moves the version on", () => {
    const table = stored(dealHand());
    const result = applyAction(table, {
      tableId: "t1",
      playerId: whoseTurn(table.hand),
      action: { type: "call" },
      expectedVersion: 1,
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.table.version).toBe(2);
    expect(result.handComplete).toBe(false);
  });

  it("refuses an action aimed at a version that has moved on", () => {
    // Somebody else acted first — or this is a retry of a request that already
    // landed, which without the check folds a hand twice: once for the fold the
    // player meant, and once for the decision they never saw.
    const table = stored(dealHand(), 7);
    const result = applyAction(table, {
      tableId: "t1",
      playerId: whoseTurn(table.hand),
      action: { type: "fold" },
      expectedVersion: 6,
    });
    expect(result).toEqual({ status: "stale", currentVersion: 7 });
  });

  it("refuses a player acting out of turn", () => {
    const table = stored(dealHand());
    const notTheirTurn = table.hand.seats
      .map((seat) => seat.playerId)
      .find((id) => id !== whoseTurn(table.hand))!;
    const result = applyAction(table, {
      tableId: "t1",
      playerId: notTheirTurn,
      action: { type: "call" },
      expectedVersion: 1,
    });
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") return;
    expect(result.reason).toContain("turn");
  });

  it("explains an illegal action instead of failing", () => {
    // Checking into a bet is a client that is out of date, not a server fault.
    const table = stored(dealHand());
    const result = applyAction(table, {
      tableId: "t1",
      playerId: whoseTurn(table.hand),
      action: { type: "check" },
      expectedVersion: 1,
    });
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") return;
    expect(result.reason).toMatch(/cannot check/);
  });

  it("refuses to act on a hand that is already over", () => {
    let hand = dealHand();
    while (legalActions(hand)) {
      const legal = legalActions(hand)!;
      const next = applyAction(stored(hand), {
        tableId: "t1",
        playerId: legal.playerId,
        action: { type: "fold" },
        expectedVersion: 1,
      });
      if (next.status !== "applied") break;
      hand = next.table.hand;
    }
    const result = applyAction(stored(hand), {
      tableId: "t1",
      playerId: "a",
      action: { type: "check" },
      expectedVersion: 1,
    });
    expect(result).toEqual({
      status: "rejected",
      reason: "the hand is already complete",
    });
  });

  it("reports a hand that finished on this action", () => {
    // Two folds leaves one player, which ends the hand.
    let table = stored(dealHand());
    for (let i = 0; i < 2; i++) {
      const result = applyAction(table, {
        tableId: "t1",
        playerId: whoseTurn(table.hand),
        action: { type: "fold" },
        expectedVersion: table.version,
      });
      expect(result.status).toBe("applied");
      if (result.status !== "applied") return;
      table = result.table;
      if (result.handComplete) {
        expect(i).toBe(1);
        return;
      }
    }
    throw new Error("the hand should have ended after two folds");
  });
});

describe("what leaves the server", () => {
  it("never sends the deck", () => {
    // The deck is the rest of the game. A client holding it knows every card
    // still to come, and no amount of careful UI hides that.
    const hand = dealHand();
    expect(hand.deck.length).toBeGreaterThan(0);
    expect(publicView(hand).deck).toEqual([]);
  });

  it("hides everybody's cards while the hand is being played", () => {
    const view = publicView(dealHand());
    expect(view.seats.every((seat) => seat.hole.length === 0)).toBe(true);
  });

  it("does NOT show the winner's cards when everyone folded to them", () => {
    // A hand folded out has no showdown, and the winner never has to show.
    // Gating on "the hand is over" instead of "there was a showdown" leaks
    // exactly this — and it teaches the table how somebody plays the hands
    // they steal, which is worse than a display bug.
    let table = stored(dealHand());
    for (let i = 0; i < 2; i++) {
      const result = applyAction(table, {
        tableId: "t1",
        playerId: whoseTurn(table.hand),
        action: { type: "fold" },
        expectedVersion: table.version,
      });
      expect(result.status).toBe("applied");
      if (result.status !== "applied") return;
      table = result.table;
    }
    expect(table.hand.showdown).toBeNull();
    const view = publicView(table.hand);
    expect(view.seats.every((seat) => seat.hole.length === 0)).toBe(true);
  });

  it("shows down the cards of everyone still in once the hand is over", () => {
    // At a showdown the cards are public — that is what a showdown is.
    let hand = dealHand();
    while (legalActions(hand)) {
      const legal = legalActions(hand)!;
      const result = applyAction(stored(hand), {
        tableId: "t1",
        playerId: legal.playerId,
        action: legal.canCheck ? { type: "check" } : { type: "call" },
        expectedVersion: 1,
      });
      if (result.status !== "applied") break;
      hand = result.table.hand;
    }
    const view = publicView(hand);
    const shown = view.seats.filter((seat) => seat.hole.length === 2);
    expect(shown.length).toBeGreaterThanOrEqual(2);
    expect(view.deck).toEqual([]);
  });

  it("keeps a folded player's cards to themselves, even at the end", () => {
    // Nobody has to show a hand they folded, and the rest of the table would
    // learn how they play for free.
    let table = stored(dealHand());
    const folder = whoseTurn(table.hand);
    const first = applyAction(table, {
      tableId: "t1",
      playerId: folder,
      action: { type: "fold" },
      expectedVersion: 1,
    });
    expect(first.status).toBe("applied");
    if (first.status !== "applied") return;
    table = first.table;

    while (legalActions(table.hand)) {
      const legal = legalActions(table.hand)!;
      const result = applyAction(table, {
        tableId: "t1",
        playerId: legal.playerId,
        action: legal.canCheck ? { type: "check" } : { type: "call" },
        expectedVersion: table.version,
      });
      if (result.status !== "applied") break;
      table = result.table;
    }

    const view = publicView(table.hand);
    const folded = view.seats.find((seat) => seat.playerId === folder)!;
    expect(folded.hole).toEqual([]);
  });

  it("gives a player their own two cards and nobody else's", () => {
    const hand = dealHand();
    const mine = privateView(hand, "b");
    expect(mine).not.toBeNull();
    expect(mine!.hole).toHaveLength(2);
    expect(mine!.hole).toEqual(
      hand.seats.find((seat) => seat.playerId === "b")!.hole,
    );
  });

  it("has nothing to give somebody who isn't at the table", () => {
    expect(privateView(dealHand(), "stranger")).toBeNull();
  });
});
