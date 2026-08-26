import { describe, expect, it } from "vitest";
import { createRandom } from "./cards";
import { legalActions } from "./table";
import {
  type GameSession,
  act,
  createSession,
  finishingOrder,
  finishingPlacings,
  isSessionComplete,
  startNextHand,
  toGameResult,
} from "./session";

const session = (players: string[], stack = 200, buttonIndex = 0) =>
  createSession({ players, startingStack: stack, buttonIndex });

const deal = (s: GameSession, seed = 1) =>
  startNextHand(s, { smallBlind: 1, bigBlind: 2, random: createRandom(seed) });

/** Play the current hand out with everybody calling or checking. */
const playToShowdown = (s: GameSession) => {
  let current = s;
  while (current.hand) {
    const legal = legalActions(current.hand)!;
    current = act(
      current,
      legal.playerId,
      legal.canCheck ? { type: "check" } : { type: "call" },
    );
  }
  return current;
};

describe("createSession", () => {
  it("seats everyone with the same stack", () => {
    const s = session(["a", "b", "c"], 500);
    expect(s.seats).toEqual([
      { playerId: "a", stack: 500 },
      { playerId: "b", stack: 500 },
      { playerId: "c", stack: 500 },
    ]);
    expect(s.hand).toBeNull();
    expect(s.handsPlayed).toBe(0);
  });

  it("keeps the last finished hand, so the end of it can be shown", () => {
    // `hand` is cleared the moment it completes, and the showdown, the awards
    // and the final board all live on the hand — so without this the action
    // that calls the river returns nothing but stack totals.
    let s = deal(session(["a", "b", "c"]));
    expect(s.lastHand).toBeNull();
    s = playToShowdown(s);
    expect(s.hand).toBeNull();
    expect(s.lastHand).not.toBeNull();
    expect(s.lastHand!.board).toHaveLength(5);
    expect(s.lastHand!.awards.length).toBeGreaterThan(0);
  });

  it("refuses a table that cannot play", () => {
    expect(() => session(["a"])).toThrow(/at least 2 players/);
    expect(() =>
      createSession({
        players: Array.from({ length: 24 }, (_, i) => `p${i}`),
        startingStack: 100,
      }),
    ).toThrow(/seats at most 23 players/);
    expect(() => session(["a", "a"])).toThrow(/own id/);
    expect(() =>
      createSession({ players: ["a", "b"], startingStack: 0 }),
    ).toThrow(/positive whole number/);
    expect(() =>
      createSession({ players: ["a", "b"], startingStack: 10, buttonIndex: 5 }),
    ).toThrow(/not a seat/);
  });
});

describe("dealing hands", () => {
  it("deals everybody in and counts the hand", () => {
    const s = deal(session(["a", "b", "c"]));
    expect(s.hand).not.toBeNull();
    expect(s.handsPlayed).toBe(1);
    expect(s.hand!.seats).toHaveLength(3);
  });

  it("deals the first hand from the seat it was given, then moves on", () => {
    // The button moves *between* hands, not before the first — otherwise
    // "this seat deals first" is inexpressible except as the seat before it.
    let s = deal(session(["a", "b", "c"], 200, 0));
    expect(s.buttonIndex).toBe(0);
    s = playToShowdown(s);
    s = deal(s, 2);
    expect(s.buttonIndex).toBe(1);
    s = playToShowdown(s);
    s = deal(s, 3);
    expect(s.buttonIndex).toBe(2);
  });

  it("refuses to deal over a hand in progress", () => {
    const s = deal(session(["a", "b", "c"]));
    expect(() => deal(s, 2)).toThrow(/finish the current hand/);
  });

  it("refuses to act when no hand is in progress", () => {
    const s = session(["a", "b"]);
    expect(() => act(s, "a", { type: "check" })).toThrow(/no hand in progress/);
  });

  it("brings the chips home when the hand ends", () => {
    let s = deal(session(["a", "b", "c"]));
    s = playToShowdown(s);
    expect(s.hand).toBeNull();
    expect(s.seats.reduce((sum, seat) => sum + seat.stack, 0)).toBe(600);
  });
});

describe("knocking players out", () => {
  it("leaves a busted seat out of the deal", () => {
    const s: GameSession = {
      ...session(["a", "b", "c"]),
      seats: [
        { playerId: "a", stack: 200 },
        { playerId: "b", stack: 0 },
        { playerId: "c", stack: 200 },
      ],
      bustOrder: ["b"],
    };
    const dealt = deal(s);
    expect(dealt.hand!.seats.map((seat) => seat.playerId)).toEqual(["a", "c"]);
  });

  it("moves the button past a busted seat", () => {
    const s: GameSession = {
      ...session(["a", "b", "c"]),
      // A hand has been played, so the button advances from "a" — and "b" is
      // out, so it must land on "c" rather than on a seat with no chips.
      handsPlayed: 1,
      seats: [
        { playerId: "a", stack: 200 },
        { playerId: "b", stack: 0 },
        { playerId: "c", stack: 200 },
      ],
      bustOrder: ["b"],
    };
    const dealt = deal(s);
    expect(dealt.seats[dealt.buttonIndex].playerId).toBe("c");
  });

  it("skips a busted starting seat even on the first hand", () => {
    const s: GameSession = {
      ...session(["a", "b", "c"], 200, 1),
      seats: [
        { playerId: "a", stack: 200 },
        { playerId: "b", stack: 0 },
        { playerId: "c", stack: 200 },
      ],
      bustOrder: ["b"],
    };
    const dealt = deal(s);
    expect(dealt.seats[dealt.buttonIndex].playerId).toBe("c");
  });

  it("orders two players busting in the same hand by the stack they started with", () => {
    // The table rule, and the only information left: after the hand both are
    // on zero, so nothing about the final counts can separate them. Seed 5 is
    // a deal where both short stacks are settled in one hand.
    const s: GameSession = {
      ...session(["big", "small", "chip"]),
      seats: [
        { playerId: "big", stack: 500 },
        { playerId: "small", stack: 30 },
        { playerId: "chip", stack: 10 },
      ],
    };
    let played = deal(s, 5);
    while (played.hand) {
      const legal = legalActions(played.hand)!;
      played = act(
        played,
        legal.playerId,
        legal.canRaise
          ? { type: "raise", to: legal.maxRaiseTo }
          : legal.canCall
            ? { type: "call" }
            : { type: "check" },
      );
    }

    // "chip" started the hand with less, so goes out first and finishes last.
    expect(played.bustOrder).toEqual(["chip", "small"]);
    expect(finishingOrder(played)).toEqual(["big", "small", "chip"]);
    expect(isSessionComplete(played)).toBe(true);
  });

  it("refuses to deal once the game is over", () => {
    const s: GameSession = {
      ...session(["a", "b"]),
      seats: [
        { playerId: "a", stack: 400 },
        { playerId: "b", stack: 0 },
      ],
    };
    expect(isSessionComplete(s)).toBe(true);
    expect(() => deal(s)).toThrow(/game is over/);
  });
});

describe("finishingOrder", () => {
  it("puts the survivor first and the bust order in reverse behind them", () => {
    const s: GameSession = {
      ...session(["a", "b", "c"]),
      seats: [
        { playerId: "a", stack: 600 },
        { playerId: "b", stack: 0 },
        { playerId: "c", stack: 0 },
      ],
      bustOrder: ["c", "b"],
    };
    // c went out first, so c finished last.
    expect(finishingOrder(s)).toEqual(["a", "b", "c"]);
  });

  it("ranks the players still in by stack, for a mid-game standing", () => {
    const s: GameSession = {
      ...session(["a", "b", "c"]),
      seats: [
        { playerId: "a", stack: 100 },
        { playerId: "b", stack: 300 },
        { playerId: "c", stack: 0 },
      ],
      bustOrder: ["c"],
    };
    expect(finishingOrder(s)).toEqual(["b", "a", "c"]);
  });
});

describe("toGameResult", () => {
  const finished: GameSession = {
    ...session(["a", "b", "c", "d"]),
    seats: [
      { playerId: "a", stack: 800 },
      { playerId: "b", stack: 0 },
      { playerId: "c", stack: 0 },
      { playerId: "d", stack: 0 },
    ],
    bustOrder: ["d", "c", "b"],
  };

  it("records everyone who played, and the podium even past the paid places", () => {
    // Who got paid and who finished where are different questions. A game
    // paying two places still has a third-place finisher, and the
    // leaderboard's podium tie-break needs it.
    const result = toGameResult(finished, {
      id: "game-1",
      now: 1000,
      buyIn: 20,
      bounty: 0,
      winningsByPlace: [50, 30],
    });
    expect(result.playerIds).toEqual(["a", "b", "c", "d"]);
    expect(result.placings).toEqual([
      { playerId: "a", place: 1, winnings: 50 },
      { playerId: "b", place: 2, winnings: 30 },
      { playerId: "c", place: 3, winnings: 0 },
    ]);
    expect(result.buyIn).toBe(20);
    expect(result.playedAt).toBe(1000);
  });

  it("still records a winner when there is no prize money at all", () => {
    // Wins are counted from finishing first, not from being paid — so
    // recording nothing here would mean a friendly game had no winner.
    const result = toGameResult(finished, {
      id: "g",
      now: 1,
      buyIn: 0,
      bounty: 0,
      winningsByPlace: [],
    });
    expect(result.placings).toEqual([
      { playerId: "a", place: 1, winnings: 0 },
      { playerId: "b", place: 2, winnings: 0 },
      { playerId: "c", place: 3, winnings: 0 },
    ]);
    expect(result.playerIds).toHaveLength(4);
  });

  it("records every paid place when more than three are paid", () => {
    const result = toGameResult(finished, {
      id: "g",
      now: 1,
      buyIn: 20,
      bounty: 0,
      winningsByPlace: [40, 25, 10, 5],
    });
    expect(result.placings.map((p) => p.place)).toEqual([1, 2, 3, 4]);
    expect(result.placings[3]).toEqual({ playerId: "d", place: 4, winnings: 5 });
  });

  it("never records more finishes than there were players", () => {
    const heads: GameSession = {
      ...session(["a", "b"]),
      seats: [
        { playerId: "a", stack: 400 },
        { playerId: "b", stack: 0 },
      ],
      bustOrder: ["b"],
    };
    const result = toGameResult(heads, {
      id: "g",
      now: 1,
      buyIn: 20,
      bounty: 0,
      winningsByPlace: [],
    });
    expect(result.placings.map((p) => p.place)).toEqual([1, 2]);
  });

  it("shares its placings rule with finishingPlacings", () => {
    // The app records games itself and mints its own ids, so it uses the
    // smaller function. The two must not disagree about what a finish is.
    const winningsByPlace = [50, 30];
    expect(
      toGameResult(finished, {
        id: "g",
        now: 1,
        buyIn: 20,
        bounty: 0,
        winningsByPlace,
      }).placings,
    ).toEqual(finishingPlacings(finished, winningsByPlace));
  });

  it("refuses placings for a game that is still going", () => {
    expect(() => finishingPlacings(session(["a", "b"]), [40])).toThrow(
      /not over yet/,
    );
  });

  it("refuses a game that is still going", () => {
    expect(() =>
      toGameResult(session(["a", "b"]), {
        id: "g",
        now: 1,
        buyIn: 20,
        bounty: 0,
        winningsByPlace: [40],
      }),
    ).toThrow(/not over yet/);
  });
});

describe("a whole game, played out", () => {
  it("always reaches one winner, with every chip accounted for", () => {
    const failures: string[] = [];

    for (let seed = 1; seed <= 300; seed++) {
      let state = seed >>> 0;
      const next = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const count = 2 + Math.floor(next() * 4);
      const stack = 40 + Math.floor(next() * 200);
      const players = Array.from({ length: count }, (_, i) => `p${i}`);
      let game = createSession({ players, startingStack: stack });
      const total = stack * count;

      let hands = 0;
      while (!isSessionComplete(game)) {
        if (++hands > 400) {
          failures.push(`seed ${seed}: never finished`);
          break;
        }
        game = startNextHand(game, {
          smallBlind: 1,
          bigBlind: 2,
          random: createRandom(seed * 131 + hands),
        });
        while (game.hand) {
          const legal = legalActions(game.hand)!;
          const roll = next();
          game = act(
            game,
            legal.playerId,
            legal.canRaise && roll < 0.25
              ? { type: "raise", to: legal.maxRaiseTo }
              : roll < 0.35
                ? { type: "fold" }
                : legal.canCall
                  ? { type: "call" }
                  : { type: "check" },
          );
        }

        const inPlay = game.seats.reduce((sum, seat) => sum + seat.stack, 0);
        if (inPlay !== total) {
          failures.push(`seed ${seed}: ${total} chips became ${inPlay}`);
          break;
        }
      }

      if (hands <= 400) {
        const order = finishingOrder(game);
        if (order.length !== count) {
          failures.push(`seed ${seed}: ${order.length} of ${count} placed`);
        }
        if (new Set(order).size !== count) {
          failures.push(`seed ${seed}: a player was placed twice`);
        }
        if (game.bustOrder.length !== count - 1) {
          failures.push(
            `seed ${seed}: ${game.bustOrder.length} knocked out of ${count - 1}`,
          );
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
