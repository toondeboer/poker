import { describe, expect, it } from "vitest";
import { cardToString, createRandom } from "./cards";
import {
  type Hand,
  act,
  isHandComplete,
  legalActions,
  startHand,
} from "./table";

const players = (count: number, stack = 200) =>
  Array.from({ length: count }, (_, i) => ({ playerId: `p${i}`, stack }));

const deal = (count: number, seed = 1, stack = 200, buttonIndex = 0) =>
  startHand({
    seats: players(count, stack),
    buttonIndex,
    smallBlind: 1,
    bigBlind: 2,
    random: createRandom(seed),
  });

const toAct = (hand: Hand) => legalActions(hand)?.playerId;
const play = (hand: Hand, action: Parameters<typeof act>[2]) =>
  act(hand, legalActions(hand)!.playerId, action);

const chipsInPlay = (hand: Hand) =>
  hand.seats.reduce((sum, seat) => sum + seat.stack + seat.committed, 0);

describe("startHand", () => {
  it("deals two cards to everyone, all different", () => {
    const hand = deal(6);
    const all = hand.seats.flatMap((seat) => seat.hole);
    expect(hand.seats.every((seat) => seat.hole.length === 2)).toBe(true);
    expect(new Set(all.map(cardToString)).size).toBe(12);
  });

  it("leaves the rest of the deck behind, untouched and unique", () => {
    const hand = deal(6);
    expect(hand.deck).toHaveLength(52 - 12);
    expect(hand.board).toEqual([]);
  });

  it("posts the blinds to the left of the button", () => {
    const hand = deal(6, 1, 200, 0);
    expect(hand.seats[1].committed).toBe(1); // small blind
    expect(hand.seats[2].committed).toBe(2); // big blind
    expect(hand.seats[0].committed).toBe(0);
  });

  it("opens the action under the gun", () => {
    expect(toAct(deal(6, 1, 200, 0))).toBe("p3");
  });

  it("puts the button on the small blind heads-up, acting first", () => {
    // The exception everyone forgets: heads-up the button posts the small
    // blind and acts first before the flop.
    const hand = deal(2, 1, 200, 0);
    expect(hand.seats[0].committed).toBe(1);
    expect(hand.seats[1].committed).toBe(2);
    expect(toAct(hand)).toBe("p0");
  });

  it("deals a player in even when the blind puts them all-in", () => {
    const hand = startHand({
      seats: [
        { playerId: "a", stack: 200 },
        { playerId: "b", stack: 200 },
        { playerId: "short", stack: 1 },
      ],
      buttonIndex: 0,
      smallBlind: 1,
      bigBlind: 2,
      random: createRandom(5),
    });
    expect(hand.seats[2].status).toBe("all-in");
    expect(hand.seats[2].hole).toHaveLength(2);
  });

  it("replays exactly from the same seed", () => {
    const a = deal(4, 99);
    const b = deal(4, 99);
    expect(a.seats.map((s) => s.hole.map(cardToString))).toEqual(
      b.seats.map((s) => s.hole.map(cardToString)),
    );
  });

  it("rejects a table that cannot play", () => {
    const random = createRandom(1);
    expect(() =>
      startHand({ seats: players(1), buttonIndex: 0, smallBlind: 1, bigBlind: 2, random }),
    ).toThrow(/at least 2 players/);
    expect(() =>
      startHand({ seats: players(3), buttonIndex: 9, smallBlind: 1, bigBlind: 2, random }),
    ).toThrow(/buttonIndex 9 is not a seat/);
    expect(() =>
      startHand({ seats: players(3), buttonIndex: 0, smallBlind: 2, bigBlind: 2, random }),
    ).toThrow(/bigBlind must be a whole number above the small blind/);
    expect(() =>
      startHand({
        seats: [{ playerId: "a", stack: 0 }, { playerId: "b", stack: 10 }],
        buttonIndex: 0,
        smallBlind: 1,
        bigBlind: 2,
        random,
      }),
    ).toThrow(/needs a positive whole stack/);
    expect(() =>
      startHand({ seats: players(3), buttonIndex: 0, smallBlind: 0, bigBlind: 2, random }),
    ).toThrow(/smallBlind must be a positive whole number/);
  });

  it("keeps the bet at the big blind when the big blind is short", () => {
    // A player too short to cover the big blind is all-in for less; everyone
    // behind still has to call the full amount. Taking the maximum of what was
    // actually posted would quietly lower the price of the hand.
    const hand = startHand({
      seats: [
        { playerId: "utg", stack: 500 },
        { playerId: "sb", stack: 500 },
        { playerId: "shortbb", stack: 7 },
      ],
      buttonIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      random: createRandom(21),
    });
    expect(hand.seats[2].committed).toBe(7);
    expect(hand.seats[2].status).toBe("all-in");
    const legal = legalActions(hand)!;
    expect(legal.playerId).toBe("utg");
    expect(legal.callAmount).toBe(10);
    expect(legal.minRaiseTo).toBe(20);
  });

  it("does not hand the small blind a free check when the big blind is shorter", () => {
    const hand = startHand({
      seats: [
        { playerId: "utg", stack: 500 },
        { playerId: "sb", stack: 500 },
        { playerId: "tiny", stack: 2 },
      ],
      buttonIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      random: createRandom(22),
    });
    const legal = legalActions(hand)!;
    expect(legal.canCheck).toBe(false);
    expect(legal.callAmount).toBe(10);
  });

  it("refuses two seats sharing a player id", () => {
    // Awards are paid by id, so a duplicate is paid twice — once per seat,
    // including a seat that folded. Chips appear out of nowhere.
    expect(() =>
      startHand({
        seats: [
          { playerId: "same", stack: 100 },
          { playerId: "same", stack: 100 },
          { playerId: "other", stack: 100 },
        ],
        buttonIndex: 0,
        smallBlind: 1,
        bigBlind: 2,
        random: createRandom(1),
      }),
    ).toThrow(/every seat needs its own player id/);
  });

  it("refuses more players than one deck can deal", () => {
    // 2 each plus 5 on the board: 24 players runs the deck out mid-river and
    // used to complete the hand on a four-card board without a word.
    expect(() =>
      startHand({
        seats: players(24, 100),
        buttonIndex: 0,
        smallBlind: 1,
        bigBlind: 2,
        random: createRandom(1),
      }),
    ).toThrow(/23 players is the most a deck can deal/);
    // 23 is fine.
    const hand = startHand({
      seats: players(23, 100),
      buttonIndex: 0,
      smallBlind: 1,
      bigBlind: 2,
      random: createRandom(1),
    });
    expect(hand.seats).toHaveLength(23);
  });

  it("finds no seat to act when nobody qualifies", () => {
    // `nextIndex` returning -1 is the "there is nobody" answer the street
    // machinery leans on; every other path reaches it only through a hand
    // where all-ins have emptied the table, so it is worth pinning directly.
    // A two-handed hand where both are all-in on the blinds does exactly that.
    const hand = startHand({
      seats: [
        { playerId: "a", stack: 1 },
        { playerId: "b", stack: 2 },
      ],
      buttonIndex: 0,
      smallBlind: 1,
      bigBlind: 2,
      random: createRandom(3),
    });
    // Both are all-in before a card is acted on, so the hand settles itself.
    expect(isHandComplete(hand)).toBe(true);
    expect(hand.board).toHaveLength(5);
    expect(hand.seats.reduce((sum, s) => sum + s.stack, 0)).toBe(3);
  });
});

describe("streets", () => {
  it("deals a flop once the betting closes", () => {
    let hand = deal(3);
    hand = play(hand, { type: "call" }); // p0 (button)
    hand = play(hand, { type: "call" }); // p1 (sb)
    hand = play(hand, { type: "check" }); // p2 (bb option)
    expect(hand.street).toBe("flop");
    expect(hand.board).toHaveLength(3);
  });

  it("moves the action to the left of the button after the flop", () => {
    let hand = deal(3);
    hand = play(hand, { type: "call" });
    hand = play(hand, { type: "call" });
    hand = play(hand, { type: "check" });
    expect(toAct(hand)).toBe("p1");
  });

  it("gives the button last action after the flop, even heads-up", () => {
    // Heads-up the button acts first preflop and last on every street after.
    let hand = deal(2);
    hand = play(hand, { type: "call" }); // p0 button/sb
    hand = play(hand, { type: "check" }); // p1 bb option
    expect(hand.street).toBe("flop");
    expect(toAct(hand)).toBe("p1");
  });

  it("walks flop to turn to river, three then four then five cards", () => {
    let hand = deal(3);
    const checkAround = () => {
      while (hand.round && !isHandComplete(hand)) {
        const legal = legalActions(hand)!;
        hand = play(hand, legal.canCheck ? { type: "check" } : { type: "call" });
      }
    };
    checkAround();
    expect(hand.board).toHaveLength(5);
    expect(hand.street).toBe("complete");
  });
});

describe("how a hand ends", () => {
  it("gives the pot to the last player standing, with no showdown", () => {
    let hand = deal(3);
    hand = play(hand, { type: "fold" }); // p0
    hand = play(hand, { type: "fold" }); // p1
    expect(isHandComplete(hand)).toBe(true);
    // Nobody has to show a hand nobody contested.
    expect(hand.showdown).toBeNull();
    expect(hand.awards).toEqual([{ playerId: "p2", amount: 3 }]);
  });

  it("leaves the winner up by what the others put in", () => {
    let hand = deal(3, 1, 200);
    hand = play(hand, { type: "fold" });
    hand = play(hand, { type: "fold" });
    const bb = hand.seats.find((s) => s.playerId === "p2")!;
    expect(bb.stack).toBe(201); // 200 - 2 posted + 3 won
  });

  it("shows down at the river and names a winner", () => {
    let hand = deal(3, 7);
    while (!isHandComplete(hand)) {
      const legal = legalActions(hand)!;
      hand = play(hand, legal.canCheck ? { type: "check" } : { type: "call" });
    }
    expect(hand.street).toBe("complete");
    expect(hand.showdown).not.toBeNull();
    expect(hand.showdown!.length).toBe(3);
    expect(hand.awards.length).toBeGreaterThan(0);
  });

  it("runs the board out with no more betting when everyone is all-in", () => {
    let hand = deal(2, 3, 50);
    hand = play(hand, { type: "raise", to: 50 }); // p0 all-in
    hand = play(hand, { type: "call" }); // p1 calls all-in
    expect(isHandComplete(hand)).toBe(true);
    expect(hand.board).toHaveLength(5);
    expect(hand.showdown).not.toBeNull();
  });

  it("refuses another action once the hand is done", () => {
    let hand = deal(3);
    hand = play(hand, { type: "fold" });
    hand = play(hand, { type: "fold" });
    expect(() => act(hand, "p2", { type: "check" })).toThrow(
      /hand is already complete/,
    );
    expect(legalActions(hand)).toBeNull();
  });

  it("builds side pots when a short stack is all-in for less", () => {
    const hand0 = startHand({
      seats: [
        { playerId: "big1", stack: 200 },
        { playerId: "big2", stack: 200 },
        { playerId: "short", stack: 20 },
      ],
      buttonIndex: 0,
      smallBlind: 1,
      bigBlind: 2,
      random: createRandom(11),
    });
    let hand = hand0;
    hand = play(hand, { type: "raise", to: 20 }); // big1 (button, utg at 3-handed)
    hand = play(hand, { type: "call" }); // big2 (sb)
    hand = play(hand, { type: "call" }); // short (bb) — all-in for 20
    while (!isHandComplete(hand)) {
      const legal = legalActions(hand)!;
      hand = play(hand, legal.canCheck ? { type: "check" } : { type: "call" });
    }
    expect(hand.pots.length).toBeGreaterThanOrEqual(1);
    expect(hand.pots.every((pot) => pot.amount > 0)).toBe(true);
  });
});

describe("invariants", () => {
  /** Play a whole hand out with pseudo-random but always legal choices. */
  const playHand = (seed: number) => {
    let state = seed >>> 0;
    const next = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const count = 2 + Math.floor(next() * 5);
    const seats = Array.from({ length: count }, (_, i) => ({
      playerId: `p${i}`,
      stack: 2 + Math.floor(next() * 300),
    }));
    let hand = startHand({
      seats,
      buttonIndex: Math.floor(next() * count),
      smallBlind: 1,
      bigBlind: 2,
      random: createRandom(seed * 7919 + 13),
    });
    const startingChips = chipsInPlay(hand);

    let guard = 0;
    while (!isHandComplete(hand)) {
      if (++guard > 800) return { hand, startingChips, ranAway: true };
      const legal = legalActions(hand)!;
      const roll = next();
      if (roll < 0.12) {
        hand = act(hand, legal.playerId, { type: "fold" });
      } else if (legal.canRaise && roll < 0.35) {
        const span = legal.maxRaiseTo - legal.minRaiseTo;
        const to = legal.minRaiseTo + Math.floor(next() * (span + 1));
        hand = act(hand, legal.playerId, { type: "raise", to });
      } else if (legal.canCall) {
        hand = act(hand, legal.playerId, { type: "call" });
      } else {
        hand = act(hand, legal.playerId, { type: "check" });
      }
    }
    return { hand, startingChips, ranAway: false };
  };

  /**
   * One sweep, every invariant.
   *
   * Six separate `it`s over the same 2,000 seeds replayed 12,000 hands to check
   * six things; this replays 2,000 and checks all six, for a sixth of the time.
   * Failures are collected per category and asserted once at the end, so a
   * broken invariant still names itself instead of stopping at the first hand.
   */
  it("holds across two thousand randomly played hands", () => {
    const failures: Record<string, string[]> = {
      neverEnded: [],
      chipsChanged: [],
      duplicateCards: [],
      moneyMismatch: [],
      wrongShowdown: [],
      negativeStack: [],
      shortBoard: [],
    };

    for (let seed = 1; seed <= 2000; seed++) {
      const { hand, startingChips, ranAway } = playHand(seed);

      if (ranAway) {
        // A hand that cannot end is the worst failure available: the game
        // stops with everyone's money in the middle. Nothing else about this
        // hand is meaningful, so move on.
        failures.neverEnded.push(`seed ${seed}`);
        continue;
      }

      const ending = hand.seats.reduce((sum, s) => sum + s.stack, 0);
      if (ending !== startingChips) {
        failures.chipsChanged.push(`seed ${seed}: ${startingChips} became ${ending}`);
      }

      // The board and every hole card come out of one deck; a slicing mistake
      // would quietly deal the same card twice and decide a pot with it.
      const dealt = [
        ...hand.seats.flatMap((s) => s.hole),
        ...hand.board,
        ...hand.deck,
      ].map(cardToString);
      if (dealt.length !== 52 || new Set(dealt).size !== 52) {
        failures.duplicateCards.push(
          `seed ${seed}: ${dealt.length} cards, ${new Set(dealt).size} unique`,
        );
      }

      const paid = hand.awards.reduce((sum, a) => sum + a.amount, 0);
      const collected = hand.pots.reduce((sum, p) => sum + p.amount, 0);
      const committed = hand.seats.reduce((sum, s) => sum + s.committed, 0);
      if (paid !== collected || collected !== committed) {
        failures.moneyMismatch.push(
          `seed ${seed}: committed ${committed}, potted ${collected}, paid ${paid}`,
        );
      }

      // Every showdown is judged on a full five-card board. A deck that ran
      // short would otherwise settle a pot on four cards without a word.
      if (hand.showdown !== null && hand.board.length !== 5) {
        failures.shortBoard.push(`seed ${seed}: ${hand.board.length}-card board`);
      }

      const stillIn = hand.seats.filter((s) => s.status !== "folded").length;
      if (hand.showdown === null && stillIn >= 2) {
        failures.wrongShowdown.push(`seed ${seed}: ${stillIn} in but no showdown`);
      }
      if (hand.showdown !== null && stillIn < 2) {
        failures.wrongShowdown.push(`seed ${seed}: showdown with ${stillIn} in`);
      }

      for (const s of hand.seats) {
        if (s.stack < 0) {
          failures.negativeStack.push(`seed ${seed}: ${s.playerId} at ${s.stack}`);
        }
      }
    }

    expect(failures).toEqual({
      neverEnded: [],
      chipsChanged: [],
      duplicateCards: [],
      moneyMismatch: [],
      wrongShowdown: [],
      negativeStack: [],
      shortBoard: [],
    });
  });
});
