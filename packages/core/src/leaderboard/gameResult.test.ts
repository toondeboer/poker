import { describe, it, expect } from "vitest";
import {
  addGameResult,
  addPlayer,
  bountiesWon,
  createGameResult,
  createPlayer,
  isValidPlayerName,
  removeGameResult,
  removePlayer,
  validateGameResult,
  MAX_GAME_RESULTS,
  MAX_PLAYERS,
  GameResult,
  Player,
} from "./gameResult";

const player = (id: string, name = id.toUpperCase()): Player =>
  createPlayer({ id, name });

const result = (id: string, now = 1): GameResult =>
  createGameResult({
    id,
    playerIds: ["a", "b", "c"],
    placings: [
      { playerId: "a", place: 1, winnings: 60 },
      { playerId: "b", place: 2, winnings: 40 },
    ],
    buyIn: 20,
    bounty: 0,
    now,
  });

describe("createPlayer", () => {
  it("trims the name", () => {
    expect(createPlayer({ id: "a", name: "  Dave  " }).name).toBe("Dave");
  });

  it("omits accountId entirely when nobody has claimed the player", () => {
    // A guest is the default. The key is absent rather than set to undefined,
    // so a round-trip through JSON gives back the same object.
    const guest = createPlayer({ id: "a", name: "Dave" });
    expect(guest).toEqual({ id: "a", name: "Dave" });
    expect(Object.hasOwn(guest, "accountId")).toBe(false);
  });

  it("carries an accountId through when one is given", () => {
    expect(createPlayer({ id: "a", name: "Dave", accountId: "acct-1" })).toEqual({
      id: "a",
      name: "Dave",
      accountId: "acct-1",
    });
  });
});

describe("isValidPlayerName", () => {
  const players = [player("a", "Dave")];

  it("accepts a fresh name", () => {
    expect(isValidPlayerName("Sam", players)).toBe(true);
  });

  it("rejects empty or whitespace-only names", () => {
    expect(isValidPlayerName("", players)).toBe(false);
    expect(isValidPlayerName("   ", players)).toBe(false);
  });

  it("rejects a case-insensitive duplicate", () => {
    // Two "Dave"s are indistinguishable in every view that matters.
    expect(isValidPlayerName("dave", players)).toBe(false);
    expect(isValidPlayerName("  DAVE ", players)).toBe(false);
  });
});

describe("addPlayer / removePlayer", () => {
  it("appends and removes by id", () => {
    const list = addPlayer([player("a")], player("b"));
    expect(list.map((p) => p.id)).toEqual(["a", "b"]);
    expect(removePlayer(list, "a").map((p) => p.id)).toEqual(["b"]);
  });

  it("removing an unknown id changes nothing", () => {
    expect(removePlayer([player("a")], "zz")).toHaveLength(1);
  });

  it("refuses to grow past MAX_PLAYERS", () => {
    let list: Player[] = [];
    for (let i = 0; i < MAX_PLAYERS; i += 1) {
      list = addPlayer(list, player(`p${i}`, `P${i}`));
    }
    expect(list).toHaveLength(MAX_PLAYERS);
    // Dropping the *oldest* would silently delete someone's history, so the
    // add is refused instead.
    const after = addPlayer(list, player("extra", "Extra"));
    expect(after).toHaveLength(MAX_PLAYERS);
    expect(after.some((p) => p.id === "extra")).toBe(false);
  });
});

describe("validateGameResult", () => {
  it("accepts a well-formed result", () => {
    expect(
      validateGameResult({
        playerIds: ["a", "b", "c"],
        placings: [
          { playerId: "a", place: 1, winnings: 60 },
          { playerId: "b", place: 2, winnings: 40 },
        ],
      }),
    ).toBeNull();
  });

  it("accepts a game where nobody was paid", () => {
    expect(
      validateGameResult({ playerIds: ["a", "b"], placings: [] }),
    ).toBeNull();
  });

  it.each([
    [{ playerIds: [], placings: [] }, "no-players"],
    [{ playerIds: ["a", "a"], placings: [] }, "duplicate-players"],
    [
      {
        playerIds: ["a"],
        placings: [{ playerId: "z", place: 1, winnings: 0 }],
      },
      "placing-not-in-field",
    ],
    [
      {
        playerIds: ["a", "b"],
        placings: [
          { playerId: "a", place: 1, winnings: 0 },
          { playerId: "a", place: 2, winnings: 0 },
        ],
      },
      "duplicate-placing",
    ],
    [
      {
        playerIds: ["a", "b"],
        placings: [
          { playerId: "a", place: 1, winnings: 0 },
          { playerId: "b", place: 1, winnings: 0 },
        ],
      },
      "duplicate-place",
    ],
    [
      {
        playerIds: ["a", "b"],
        placings: [{ playerId: "a", place: 0, winnings: 0 }],
      },
      "place-out-of-range",
    ],
    [
      {
        playerIds: ["a", "b"],
        placings: [{ playerId: "a", place: 3, winnings: 0 }],
      },
      "place-out-of-range",
    ],
    [
      {
        playerIds: ["a", "b"],
        placings: [{ playerId: "a", place: Number.NaN, winnings: 0 }],
      },
      "place-out-of-range",
    ],
    [
      {
        playerIds: ["a", "b"],
        placings: [{ playerId: "a", place: 1, winnings: -5 }],
      },
      "negative-winnings",
    ],
    [
      {
        playerIds: ["a", "b"],
        placings: [{ playerId: "a", place: 1, winnings: Number.NaN }],
      },
      "negative-winnings",
    ],
  ])("rejects %o as %s", (input, expected) => {
    expect(validateGameResult(input)).toBe(expected);
  });
});

describe("createGameResult", () => {
  it("stamps playedAt from `now` and copies the inputs", () => {
    const ids = ["a", "b"];
    const created = createGameResult({
      id: "g1",
      playerIds: ids,
      placings: [{ playerId: "a", place: 1, winnings: 40 }],
      buyIn: 20,
      bounty: 5,
      now: 999,
    });
    expect(created.playedAt).toBe(999);
    expect(created.buyIn).toBe(20);
    expect(created.bounty).toBe(5);
    // Copied, not aliased: mutating the caller's array must not reach inside.
    ids.push("c");
    expect(created.playerIds).toEqual(["a", "b"]);
  });

  it("sorts placings into finishing order however they were entered", () => {
    const created = createGameResult({
      id: "g1",
      playerIds: ["a", "b", "c"],
      placings: [
        { playerId: "c", place: 3, winnings: 10 },
        { playerId: "a", place: 1, winnings: 60 },
        { playerId: "b", place: 2, winnings: 30 },
      ],
      buyIn: 20,
      bounty: 0,
      now: 1,
    });
    expect(created.placings.map((p) => p.place)).toEqual([1, 2, 3]);
  });
});

describe("addGameResult / removeGameResult", () => {
  it("prepends newest-first", () => {
    const list = addGameResult([result("1")], result("2"));
    expect(list.map((r) => r.id)).toEqual(["2", "1"]);
  });

  it("caps at MAX_GAME_RESULTS, dropping the oldest", () => {
    let list: GameResult[] = [];
    for (let i = 0; i < MAX_GAME_RESULTS + 5; i += 1) {
      list = addGameResult(list, result(String(i), i));
    }
    expect(list).toHaveLength(MAX_GAME_RESULTS);
    expect(list[0].id).toBe(String(MAX_GAME_RESULTS + 4));
  });

  it("removes by id and ignores an unknown one", () => {
    const list = addGameResult([result("1")], result("2"));
    expect(removeGameResult(list, "1").map((r) => r.id)).toEqual(["2"]);
    expect(removeGameResult(list, "zz")).toHaveLength(2);
  });
});

describe("knockouts on a recorded game", () => {
  const base = {
    id: "g1",
    playerIds: ["a", "b", "c"],
    placings: [{ playerId: "a", place: 1, winnings: 60 }],
    buyIn: 20,
    bounty: 5,
    now: 1_000,
  };

  it("is absent, not empty, for a game recorded by hand", () => {
    // The difference matters: an empty list claims nobody knocked anybody out,
    // which is false of every game ever played, and a bounty total built on it
    // would be wrong rather than merely missing.
    const result = createGameResult(base);
    expect(result.knockouts).toBeUndefined();
    expect("knockouts" in result).toBe(false);
  });

  it("is recorded for a game the app dealt", () => {
    const result = createGameResult({
      ...base,
      knockouts: [{ playerId: "a", count: 2, bounty: 10 }],
    });
    expect(result.knockouts).toEqual([
      { playerId: "a", count: 2, bounty: 10 },
    ]);
  });

  it("reads the same way twice, whatever order it arrives in", () => {
    const one = createGameResult({
      ...base,
      knockouts: [
        { playerId: "b", count: 1, bounty: 5 },
        { playerId: "a", count: 3, bounty: 15 },
      ],
    });
    const other = createGameResult({
      ...base,
      knockouts: [
        { playerId: "a", count: 3, bounty: 15 },
        { playerId: "b", count: 1, bounty: 5 },
      ],
    });
    expect(one.knockouts).toEqual(other.knockouts);
    expect(one.knockouts?.[0].playerId).toBe("a");
  });

  it("breaks a tie on count by player, rather than by arrival order", () => {
    const result = createGameResult({
      ...base,
      knockouts: [
        { playerId: "c", count: 1, bounty: 5 },
        { playerId: "b", count: 1, bounty: 5 },
      ],
    });
    expect(result.knockouts?.map((k) => k.playerId)).toEqual(["b", "c"]);
  });

  it("leaves out anybody who knocked nobody out", () => {
    const result = createGameResult({
      ...base,
      knockouts: [
        { playerId: "a", count: 1, bounty: 5 },
        { playerId: "b", count: 0, bounty: 0 },
      ],
    });
    expect(result.knockouts).toEqual([
      { playerId: "a", count: 1, bounty: 5 },
    ]);
  });
});

describe("bounty money", () => {
  const dealt = createGameResult({
    id: "g1",
    playerIds: ["a", "b", "c"],
    placings: [{ playerId: "a", place: 1, winnings: 60 }],
    buyIn: 20,
    bounty: 5,
    now: 1_000,
    knockouts: [{ playerId: "a", count: 2, bounty: 10 }],
  });

  it("is the count times the bounty in force", () => {
    expect(bountiesWon(dealt, "a")).toBe(10);
  });

  it("is nothing for somebody who knocked nobody out", () => {
    expect(bountiesWon(dealt, "b")).toBe(0);
  });

  it("is nothing at all for a game that never tracked them", () => {
    // Not a guess, and not a claim that they won none — just nothing to show.
    const byHand = createGameResult({
      id: "g2",
      playerIds: ["a", "b"],
      placings: [],
      buyIn: 20,
      bounty: 5,
      now: 1_000,
    });
    expect(bountiesWon(byHand, "a")).toBe(0);
  });
});

describe("validating the knockouts on a result", () => {
  const field = { playerIds: ["a", "b", "c"], placings: [] };

  it("accepts a result that never tracked them", () => {
    expect(validateGameResult(field)).toBeNull();
  });

  it("accepts a plausible one", () => {
    expect(
      validateGameResult({
        ...field,
        knockouts: [{ playerId: "a", count: 2, bounty: 10 }],
      }),
    ).toBeNull();
  });

  it("refuses credit to somebody who was not even there", () => {
    // This is money that lands in a total and stays there.
    expect(
      validateGameResult({
        ...field,
        knockouts: [{ playerId: "z", count: 1, bounty: 5 }],
      }),
    ).toBe("knockout-not-in-field");
  });

  it("refuses the same player twice", () => {
    expect(
      validateGameResult({
        ...field,
        knockouts: [
          { playerId: "a", count: 1, bounty: 5 },
          { playerId: "a", count: 1, bounty: 5 },
        ],
      }),
    ).toBe("duplicate-knockout");
  });

  it("refuses more eliminations than there were people to eliminate", () => {
    expect(
      validateGameResult({
        ...field,
        knockouts: [{ playerId: "a", count: 3, bounty: 15 }],
      }),
    ).toBe("impossible-knockout");
  });

  it("refuses negative or nonsensical money", () => {
    const failures: string[] = [];
    const cases = [
      { playerId: "a", count: -1, bounty: 0 },
      { playerId: "a", count: 1, bounty: -5 },
      { playerId: "a", count: Number.NaN, bounty: 0 },
      { playerId: "a", count: 1, bounty: Number.POSITIVE_INFINITY },
    ];
    for (const knockout of cases) {
      if (
        validateGameResult({ ...field, knockouts: [knockout] }) !==
        "impossible-knockout"
      ) {
        failures.push(JSON.stringify(knockout));
      }
    }
    expect(failures).toEqual([]);
  });
});
