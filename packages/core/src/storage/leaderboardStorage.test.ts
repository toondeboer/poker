import { describe, it, expect } from "vitest";
import {
  createLeaderboardStorage,
  LeaderboardState,
} from "./leaderboardStorage";
import { createFailingAdapter, createMemoryAdapter } from "./testAdapters";
import { createGameResult, createPlayer } from "../leaderboard/gameResult";
import { computeStandings } from "../leaderboard/standings";
import {
  EMPTY_LEADERBOARD,
  type GroupedLeaderboard,
  type GroupState,
  migrateToGroups,
} from "../leaderboard/groups";

/**
 * Everything the loader needs to turn the single board that shipped first into
 * a group. Fixed values so a migration is exactly reproducible in a test.
 */
const MIGRATION = {
  createGroupId: () => "migrated-group",
  now: () => 5000,
  defaultGroupName: "My games",
};

const store = (adapter: Parameters<typeof createLeaderboardStorage>[0]) =>
  createLeaderboardStorage(adapter, MIGRATION);

/** The one group a migrated legacy board produces. */
const board = (state: GroupedLeaderboard): Pick<GroupState, "players" | "results"> =>
  state.groups[0] ?? { players: [], results: [] };

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

const seeded = (raw: string) => store(createMemoryAdapter({ leaderboard: raw }));

/** `STATE` as it looks once migrated — what a save/load round-trip produces. */
const GROUPED: GroupedLeaderboard = migrateToGroups(STATE, {
  id: MIGRATION.createGroupId(),
  name: MIGRATION.defaultGroupName,
  now: MIGRATION.now(),
});

describe("createLeaderboardStorage", () => {
  it("is empty when nothing is stored", async () => {
    const storage = store(createMemoryAdapter());
    expect(await storage.loadLeaderboard()).toEqual(EMPTY_LEADERBOARD);
  });

  it("round-trips a grouped board", async () => {
    const storage = store(createMemoryAdapter());
    await storage.saveLeaderboard(GROUPED);
    expect(await storage.loadLeaderboard()).toEqual(GROUPED);
  });

  it("survives a round-trip well enough to rebuild the same standings", async () => {
    const storage = store(createMemoryAdapter());
    await storage.saveLeaderboard(GROUPED);
    const loaded = board(await storage.loadLeaderboard());
    expect(computeStandings(loaded.players, loaded.results)).toEqual(
      computeStandings(STATE.players, STATE.results),
    );
  });

  it("clears back to empty", async () => {
    const adapter = createMemoryAdapter();
    const storage = store(adapter);
    await storage.saveLeaderboard(GROUPED);
    await storage.clearLeaderboard();
    expect(adapter.store.has("leaderboard")).toBe(false);
    expect(await storage.loadLeaderboard()).toEqual(EMPTY_LEADERBOARD);
  });

  it("falls back to empty when the stored value is not JSON", async () => {
    expect(await seeded("{not json").loadLeaderboard()).toEqual(
      EMPTY_LEADERBOARD,
    );
  });

  it("falls back to empty when the stored value is JSON but not an object", async () => {
    for (const raw of ["null", "42", '"hello"', "[]"]) {
      expect(await seeded(raw).loadLeaderboard()).toEqual(EMPTY_LEADERBOARD);
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
    const loaded = board(await storage.loadLeaderboard());
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
    const loaded = board(await storage.loadLeaderboard());
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
    const loaded = board(await storage.loadLeaderboard());
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
    const [loaded] = board(await storage.loadLeaderboard()).results;
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
    expect(board(await storage.loadLeaderboard()).results[0].playerIds).toEqual([
      "a",
      "b",
    ]);
  });

  it("treats non-array players/results as empty", async () => {
    const storage = seeded(
      JSON.stringify({ players: "nope", results: { a: 1 } }),
    );
    expect(await storage.loadLeaderboard()).toEqual(EMPTY_LEADERBOARD);
  });

  it("falls back to empty when storage throws", async () => {
    const storage = store(createFailingAdapter());
    expect(await storage.loadLeaderboard()).toEqual(EMPTY_LEADERBOARD);
  });
});

describe("accounts on the roster", () => {
  it("keeps a claimed player's account across a save and load", () => {
    // Player gained `accountId` when groups arrived, and the loader rebuilt
    // each row as { id, name } — so the first claim to be persisted vanished
    // on the next launch, silently.
    const adapter = createMemoryAdapter();
    const storage = store(adapter);
    return storage
      .saveLeaderboard(
        migrateToGroups(
          {
            players: [
              { id: "p1", name: "Dave", accountId: "acct-1" },
              { id: "p2", name: "Sam" },
            ],
            results: [],
          },
          { id: "g", name: "x", now: 1 },
        ),
      )
      .then(() => storage.loadLeaderboard())
      .then((state) => {
        const loaded = board(state);
        expect(loaded.players[0]).toEqual({
          id: "p1",
          name: "Dave",
          accountId: "acct-1",
        });
        expect(Object.hasOwn(loaded.players[1], "accountId")).toBe(false);
      });
  });

  it("degrades a corrupt account to a guest rather than dropping the player", () => {
    const adapter = createMemoryAdapter();
    const storage = store(adapter);
    return adapter
      .setItem(
        "leaderboard",
        JSON.stringify({
          players: [{ id: "p1", name: "Dave", accountId: 42 }],
          results: [],
        }),
      )
      .then(() => storage.loadLeaderboard())
      .then((state) => {
        expect(board(state).players).toEqual([{ id: "p1", name: "Dave" }]);
      });
  });
});

describe("migrating the board that shipped first", () => {
  it("turns a stored single board into one selected group", async () => {
    // This is somebody's real season. It becomes a group rather than being
    // replaced by one, and the app opens on it exactly as before.
    const loaded = await seeded(JSON.stringify(STATE)).loadLeaderboard();
    expect(loaded.groups).toHaveLength(1);
    expect(loaded.activeGroupId).toBe("migrated-group");
    expect(loaded.groups[0].group).toEqual({
      id: "migrated-group",
      name: "My games",
      createdAt: 5000,
    });
    expect(loaded.groups[0].players).toEqual(STATE.players);
    expect(loaded.groups[0].results).toEqual(STATE.results);
  });

  it("makes no group at all from a stored but empty board", async () => {
    const raw = JSON.stringify({ players: [], results: [] });
    expect(await seeded(raw).loadLeaderboard()).toEqual(EMPTY_LEADERBOARD);
  });

  it("writes the migrated board back, so it migrates once and not every launch", async () => {
    // Without this the legacy blob stays on disk until something else happens
    // to save, and the group is rebuilt with a new id on every launch — which
    // is invisible while there is one group and a real bug as soon as a group
    // can be selected or renamed.
    const adapter = createMemoryAdapter({ leaderboard: JSON.stringify(STATE) });
    const first = await store(adapter).loadLeaderboard();

    const stored = JSON.parse(adapter.store.get("leaderboard")!);
    expect(stored.groups).toEqual(first.groups);
    expect(stored.activeGroupId).toBe(first.activeGroupId);

    // A second load reads the grouped shape rather than migrating again.
    const second = await store(adapter).loadLeaderboard();
    expect(second).toEqual(first);
    expect(second.groups).toHaveLength(1);
    expect(second.groups[0].group.id).toBe(first.groups[0].group.id);
  });

  it("still returns the migrated board when writing it back fails", async () => {
    // A full disk must not cost somebody a season of history.
    const failing = createFailingAdapter();
    const reading = {
      ...failing,
      getItem: async () => JSON.stringify(STATE),
    };
    const loaded = await store(reading).loadLeaderboard();
    expect(loaded.groups).toHaveLength(1);
    expect(loaded.groups[0].players).toEqual(STATE.players);
  });
});

describe("reading a grouped board back", () => {
  const grouped = (partial: unknown) => JSON.stringify(partial);

  it("drops a group with no usable identity, keeping the rest", async () => {
    const raw = grouped({
      groups: [
        { group: { id: 1, name: "bad" }, players: [], results: [] },
        { group: { id: "g2", name: "Good", createdAt: 7 }, players: [], results: [] },
      ],
      activeGroupId: "g2",
    });
    const loaded = await seeded(raw).loadLeaderboard();
    expect(loaded.groups).toHaveLength(1);
    expect(loaded.groups[0].group.name).toBe("Good");
  });

  it("defaults a missing createdAt rather than dropping the group", async () => {
    const raw = grouped({
      groups: [{ group: { id: "g1", name: "Thursday" }, players: [], results: [] }],
      activeGroupId: "g1",
    });
    const loaded = await seeded(raw).loadLeaderboard();
    expect(loaded.groups[0].group.createdAt).toBe(0);
  });

  it("carries knockouts back, so a bounty game keeps its money", async () => {
    // **They used to be dropped on every read.** `coerceResults` rebuilt each
    // result field by field and never named `knockouts`, so a game the app
    // dealt came back with none — `computeStandings` reported 0 bounties won
    // for everybody, and the next save wrote the stripped result back.
    const raw = grouped({
      groups: [
        {
          group: { id: "g1", name: "Thursday", createdAt: 1 },
          players: [],
          results: [
            {
              id: "r1",
              playedAt: 2,
              playerIds: ["a", "b"],
              placings: [{ playerId: "a", place: 1, winnings: 10 }],
              buyIn: 20,
              bounty: 5,
              knockouts: [
                { playerId: "a", count: 2, bounty: 10 },
                { playerId: "b", count: "no", bounty: 1 },
              ],
            },
          ],
        },
      ],
      activeGroupId: "g1",
    });
    const loaded = await seeded(raw).loadLeaderboard();
    // The unusable row goes; the good one survives whole.
    expect(loaded.groups[0].results[0].knockouts).toEqual([
      { playerId: "a", count: 2, bounty: 10 },
    ]);
  });

  it("leaves knockouts absent for a game recorded by hand", async () => {
    // Absent, never `[]`: an empty list would claim nobody knocked anybody
    // out, which is false of every game ever played.
    const raw = grouped({
      groups: [
        {
          group: { id: "g1", name: "Thursday", createdAt: 1 },
          players: [],
          results: [
            {
              id: "r1",
              playedAt: 2,
              playerIds: ["a"],
              placings: [],
              buyIn: 20,
              bounty: 0,
            },
          ],
        },
      ],
      activeGroupId: "g1",
    });
    const loaded = await seeded(raw).loadLeaderboard();
    expect("knockouts" in loaded.groups[0].results[0]).toBe(false);
  });

  it("carries which account a board is on the server under", async () => {
    // **Useless unless it survives a relaunch.** It is what stops a board being
    // re-announced under a second account signed in on the same phone — and
    // that re-announce happens on launch, so a field that did not persist would
    // protect nothing at all.
    const raw = grouped({
      groups: [
        {
          group: { id: "g1", name: "Thursday", createdAt: 1 },
          players: [],
          results: [],
          role: "admin",
          ownerAccountId: "acct-a",
        },
      ],
      activeGroupId: "g1",
    });
    const loaded = await seeded(raw).loadLeaderboard();
    expect(loaded.groups[0].ownerAccountId).toBe("acct-a");
  });

  it("leaves the owner absent for a board nobody has synced", async () => {
    // Absent means adoptable by the first account that syncs it. Storing an
    // empty string instead would make an upgraded install look owned by nobody
    // in particular, and strand every board on it.
    const raw = grouped({
      groups: [
        {
          group: { id: "g1", name: "Thursday", createdAt: 1 },
          players: [],
          results: [],
          ownerAccountId: "",
        },
      ],
      activeGroupId: "g1",
    });
    const loaded = await seeded(raw).loadLeaderboard();
    expect("ownerAccountId" in loaded.groups[0]).toBe(false);
  });

  it("re-points a selection at a group that didn't survive", async () => {
    // Otherwise the app opens on an empty board indistinguishable from a real
    // one, with no way for the user to tell anything was lost.
    const raw = grouped({
      groups: [{ group: { id: "g1", name: "Thursday", createdAt: 1 }, players: [], results: [] }],
      activeGroupId: "gone",
    });
    expect((await seeded(raw).loadLeaderboard()).activeGroupId).toBe("g1");
  });

  it("is empty when every group was corrupt", async () => {
    const raw = grouped({ groups: [{ group: null }], activeGroupId: "g1" });
    expect(await seeded(raw).loadLeaderboard()).toEqual(EMPTY_LEADERBOARD);
  });

  it("still drops a corrupt player inside a group without losing the roster", async () => {
    const raw = grouped({
      groups: [
        {
          group: { id: "g1", name: "Thursday", createdAt: 1 },
          players: [{ id: "a", name: "Ana" }, { id: 5 }, { name: "no id" }],
          results: [],
        },
      ],
      activeGroupId: "g1",
    });
    const loaded = await seeded(raw).loadLeaderboard();
    expect(loaded.groups[0].players).toEqual([{ id: "a", name: "Ana" }]);
  });
});

describe("staying readable by a build from before groups", () => {
  /** Exactly what the old loader did: read the two top-level arrays. */
  const readAsOldBuild = (raw: string) => {
    const parsed = JSON.parse(raw);
    return { players: parsed.players, results: parsed.results };
  };

  it("mirrors the active group in the old shape, so a rollback loses nothing", async () => {
    // Writing only `groups` makes the update one-way: an older build finds no
    // players or results, shows an empty leaderboard, and the first edit there
    // saves that emptiness over a season of history.
    const adapter = createMemoryAdapter();
    await store(adapter).saveLeaderboard(GROUPED);
    expect(readAsOldBuild(adapter.store.get("leaderboard")!)).toEqual({
      players: STATE.players,
      results: STATE.results,
    });
  });

  it("mirrors on the migration write-back too, not only on later saves", async () => {
    const adapter = createMemoryAdapter({ leaderboard: JSON.stringify(STATE) });
    await store(adapter).loadLeaderboard();
    expect(readAsOldBuild(adapter.store.get("leaderboard")!)).toEqual({
      players: STATE.players,
      results: STATE.results,
    });
  });

  it("prefers the grouped fields when reading its own write back", async () => {
    // The mirror must never be mistaken for the source of truth.
    const adapter = createMemoryAdapter();
    await store(adapter).saveLeaderboard(GROUPED);
    expect(await store(adapter).loadLeaderboard()).toEqual(GROUPED);
  });

  it("mirrors empty arrays when there are no groups at all", async () => {
    const adapter = createMemoryAdapter();
    await store(adapter).saveLeaderboard(EMPTY_LEADERBOARD);
    expect(readAsOldBuild(adapter.store.get("leaderboard")!)).toEqual({
      players: [],
      results: [],
    });
  });
});

describe("tolerating a damaged group", () => {
  it("keeps a group whose name is unusable, since only the id is fatal", async () => {
    // Losing a name costs a label; dropping the group costs a roster and every
    // game it recorded.
    const raw = JSON.stringify({
      groups: [
        {
          group: { id: "g1", name: 42, createdAt: 3 },
          players: [{ id: "a", name: "Ana" }],
          results: [],
        },
      ],
      activeGroupId: "g1",
    });
    const loaded = await seeded(raw).loadLeaderboard();
    expect(loaded.groups).toHaveLength(1);
    expect(loaded.groups[0].group.name).toBe("My games");
    expect(loaded.groups[0].players).toEqual([{ id: "a", name: "Ana" }]);
  });
});

describe("what this phone deleted", () => {
  it("survives a relaunch, or the delete undoes itself", async () => {
    // The only thing keeping a pull from restoring what somebody deleted — and
    // a pull happens the moment the app comes forward.
    const storage = store(createMemoryAdapter());
    await storage.saveLeaderboard({
      activeGroupId: "g1",
      groups: [
        {
          group: { id: "g1", name: "Thursday", createdAt: 1 },
          players: [],
          results: [],
          deleted: { players: ["p1"], results: ["r1"] },
        },
      ],
    });
    const loaded = await storage.loadLeaderboard();
    expect(loaded.groups[0].deleted).toEqual({ players: ["p1"], results: ["r1"] });
  });

  it("is absent on a board that has deleted nothing", async () => {
    // Absent rather than empty, so a board round-trips to the shape it had
    // before any of this existed.
    const storage = store(createMemoryAdapter());
    await storage.saveLeaderboard({
      activeGroupId: "g1",
      groups: [
        { group: { id: "g1", name: "Thursday", createdAt: 1 }, players: [], results: [] },
      ],
    });
    expect((await storage.loadLeaderboard()).groups[0]).not.toHaveProperty("deleted");
  });

  it("drops ids that are not ids", async () => {
    const storage = store(createMemoryAdapter());
    await storage.saveLeaderboard({
      activeGroupId: "g1",
      groups: [
        {
          group: { id: "g1", name: "Thursday", createdAt: 1 },
          players: [],
          results: [],
          deleted: { players: ["p1", 7 as unknown as string], results: "nope" as never },
        },
      ],
    });
    expect((await storage.loadLeaderboard()).groups[0].deleted).toEqual({
      players: ["p1"],
      results: [],
    });
  });
});

describe("a board this device deleted", () => {
  it("stays deleted across a relaunch", async () => {
    // The membership lives on the server and `GET /groups` keeps listing it, so
    // this list is the only thing stopping the pull from putting the whole
    // board back on the next foreground.
    const storage = store(createMemoryAdapter());
    await storage.saveLeaderboard({
      groups: [],
      activeGroupId: null,
      dismissed: ["g1"],
    });
    expect((await storage.loadLeaderboard()).dismissed).toEqual(["g1"]);
  });

  it("is absent when nothing has been deleted", async () => {
    const storage = store(createMemoryAdapter());
    await storage.saveLeaderboard({ groups: [], activeGroupId: null });
    expect(await storage.loadLeaderboard()).not.toHaveProperty("dismissed");
  });
});

describe("what this account may do on a board", () => {
  const boardWith = (role?: "admin" | "member") => ({
    groups: [
      {
        group: { id: "g1", name: "Thursday", createdAt: 1 },
        players: [],
        results: [],
        ...(role ? { role } : {}),
      },
    ],
    activeGroupId: "g1",
  });

  it("survives a relaunch, so the share button does not flicker", async () => {
    const storage = store(createMemoryAdapter());
    await storage.saveLeaderboard(boardWith("member"));
    expect((await storage.loadLeaderboard()).groups[0].role).toBe("member");
  });

  it("is absent when nobody has said, rather than guessed at", async () => {
    const storage = store(createMemoryAdapter());
    await storage.saveLeaderboard(boardWith());
    expect((await storage.loadLeaderboard()).groups[0]).not.toHaveProperty("role");
  });

  it("drops a role this version does not understand", async () => {
    const storage = store(createMemoryAdapter());
    await storage.saveLeaderboard(
      boardWith("owner" as unknown as "admin"),
    );
    expect((await storage.loadLeaderboard()).groups[0]).not.toHaveProperty("role");
  });
});
