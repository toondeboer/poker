import { describe, it, expect } from "vitest";
import {
  addGameResult,
  addPlayer,
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
