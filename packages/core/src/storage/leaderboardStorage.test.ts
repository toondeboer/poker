import { describe, it, expect } from "vitest";
import {
  createLeaderboardStorage,
  LeaderboardState,
} from "./leaderboardStorage";
import { createFailingAdapter, createMemoryAdapter } from "./testAdapters";
import { createGameResult, createPlayer } from "../leaderboard/gameResult";
import { computeStandings } from "../leaderboard/standings";

const STATE: LeaderboardState = {
  players: [
    createPlayer({ id: "a", name: "Ana" }),
    createPlayer({ id: "b", name: "Ben" }),
  ],
  results: [
    createGameResult({
      id: "g1",
      playerIds: ["a", "b"],
      placings: [{ playerId: "a", place: 1, winnings: 40 }],
      buyIn: 20,
      bounty: 5,
      now: 1234,
    }),
  ],
};

const seeded = (raw: string) =>
  createLeaderboardStorage(createMemoryAdapter({ leaderboard: raw }));

describe("createLeaderboardStorage", () => {
  it("is empty when nothing is stored", async () => {
    const storage = createLeaderboardStorage(createMemoryAdapter());
    expect(await storage.loadLeaderboard()).toEqual({
      players: [],
      results: [],
    });
  });

  it("round-trips players and results together", async () => {
    const storage = createLeaderboardStorage(createMemoryAdapter());
    await storage.saveLeaderboard(STATE);
    expect(await storage.loadLeaderboard()).toEqual(STATE);
  });

  it("survives a round-trip well enough to rebuild the same standings", async () => {
    const storage = createLeaderboardStorage(createMemoryAdapter());
    await storage.saveLeaderboard(STATE);
    const loaded = await storage.loadLeaderboard();
    expect(computeStandings(loaded.players, loaded.results)).toEqual(
      computeStandings(STATE.players, STATE.results),
    );
  });

  it("clears back to empty", async () => {
    const adapter = createMemoryAdapter();
    const storage = createLeaderboardStorage(adapter);
    await storage.saveLeaderboard(STATE);
    await storage.clearLeaderboard();
    expect(adapter.store.has("leaderboard")).toBe(false);
    expect(await storage.loadLeaderboard()).toEqual({
      players: [],
      results: [],
    });
  });

  it("falls back to empty when the stored value is not JSON", async () => {
    expect(await seeded("{not json").loadLeaderboard()).toEqual({
      players: [],
      results: [],
    });
  });

  it("falls back to empty when the stored value is JSON but not an object", async () => {
    for (const raw of ["null", "42", '"hello"', "[]"]) {
      expect(await seeded(raw).loadLeaderboard()).toEqual({
        players: [],
        results: [],
      });
    }
  });

  it("drops a corrupt player without losing the rest of the roster", async () => {
    // One bad row must not cost the host a season of game nights.
    const storage = seeded(
      JSON.stringify({
        players: [
          { id: "a", name: "Ana" },
          { id: 7, name: "NotAString" },
          { name: "NoId" },
          null,
          "nonsense",
          { id: "b", name: "Ben" },
        ],
        results: [],
      }),
    );
    const loaded = await storage.loadLeaderboard();
    expect(loaded.players.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("drops a corrupt result without losing the rest of the history", async () => {
    const storage = seeded(
      JSON.stringify({
        players: [],
        results: [
          { id: "good", playerIds: ["a"], placings: [], buyIn: 20, bounty: 0 },
          { playerIds: ["a"] },
          { id: "noPlayers" },
          42,
          {
            id: "good2",
            playerIds: ["a", "b"],
            placings: [],
            buyIn: 10,
            bounty: 0,
          },
        ],
      }),
    );
    const loaded = await storage.loadLeaderboard();
    expect(loaded.results.map((r) => r.id)).toEqual(["good", "good2"]);
  });

  it("drops only the bad placings inside an otherwise good result", async () => {
    const storage = seeded(
      JSON.stringify({
        players: [],
        results: [
          {
            id: "g",
            playerIds: ["a", "b"],
            placings: [
              { playerId: "a", place: 1, winnings: 40 },
              { playerId: "b", place: "2", winnings: 10 },
              { place: 3, winnings: 5 },
              { playerId: "b", place: 2, winnings: null },
              null,
            ],
            buyIn: 20,
            bounty: 0,
          },
        ],
      }),
    );
    const loaded = await storage.loadLeaderboard();
    expect(loaded.results[0].placings).toEqual([
      { playerId: "a", place: 1, winnings: 40 },
    ]);
  });

  it("defaults the scalar fields a result is missing", async () => {
    const storage = seeded(
      JSON.stringify({
        players: [],
        results: [{ id: "g", playerIds: ["a"] }],
      }),
    );
    const [loaded] = (await storage.loadLeaderboard()).results;
    expect(loaded.playedAt).toBe(0);
    expect(loaded.buyIn).toBe(0);
    expect(loaded.bounty).toBe(0);
    expect(loaded.placings).toEqual([]);
  });

  it("keeps only the string entries in a mangled playerIds array", async () => {
    const storage = seeded(
      JSON.stringify({
        players: [],
        results: [{ id: "g", playerIds: ["a", 3, null, "b"] }],
      }),
    );
    expect((await storage.loadLeaderboard()).results[0].playerIds).toEqual([
      "a",
      "b",
    ]);
  });

  it("treats non-array players/results as empty", async () => {
    const storage = seeded(
      JSON.stringify({ players: "nope", results: { a: 1 } }),
    );
    expect(await storage.loadLeaderboard()).toEqual({
      players: [],
      results: [],
    });
  });

  it("falls back to empty when storage throws", async () => {
    const storage = createLeaderboardStorage(createFailingAdapter());
    expect(await storage.loadLeaderboard()).toEqual({
      players: [],
      results: [],
    });
  });
});
