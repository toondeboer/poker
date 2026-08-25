import { describe, expect, it } from "vitest";
import { createRandom } from "./cards";
import { legalActions } from "./table";
import {
  type GameSession,
  act,
  createSession,
  finishingOrder,
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

  it("refuses a table that cannot play", () => {
    expect(() => session(["a"])).toThrow(/at least 2 players/);
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

  it("moves the button on between hands", () => {
    let s = deal(session(["a", "b", "c"]));
    expect(s.buttonIndex).toBe(1);
    s = playToShowdown(s);
    s = deal(s, 2);
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
  it("skips a busted seat when dealing, and moves the button past them", () => {
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
    // The button was on "a"; the next player still in is "c", not "b".
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

  it("records everyone who played and only the places that pay", () => {
    // A nine-handed game should not list six finishes worth nothing.
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
    ]);
    expect(result.buyIn).toBe(20);
    expect(result.playedAt).toBe(1000);
  });

  it("records nobody as paid when nothing is on offer", () => {
    const result = toGameResult(finished, {
      id: "g",
      now: 1,
      buyIn: 0,
      bounty: 0,
      winningsByPlace: [],
    });
    expect(result.placings).toEqual([]);
    expect(result.playerIds).toHaveLength(4);
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
