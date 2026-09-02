import { describe, expect, it } from "vitest";
import type { GameResult, Player } from "../leaderboard/gameResult";
import type { GroupState } from "../leaderboard/groups";
import {
  NOTHING_DELETED,
  mergeBoard,
  readRemoteBoard,
  type RemoteBoard,
} from "./mergeBoard";
import { EMPTY_QUEUE, enqueue, type PendingWrite, type SyncQueue } from "./pendingWrites";

const player = (id: string, name = id): Player => ({ id, name });

const game = (id: string, playedAt = 1): GameResult => ({
  id,
  playedAt,
  playerIds: ["p1"],
  placings: [],
  buyIn: 10,
  bounty: 0,
});

const board = (over: Partial<GroupState> = {}): GroupState => ({
  group: { id: "g1", name: "Thursday", createdAt: 1 },
  players: [player("p1", "Ann")],
  results: [game("r1", 100)],
  ...over,
});

const remote = (over: Partial<GroupState> = {}, deleted = NOTHING_DELETED): RemoteBoard => ({
  state: board(over),
  deleted,
});

let counter = 0;
const queueOf = (...writes: PendingWrite[]): SyncQueue =>
  writes.reduce(
    (q, w) => enqueue(q, { ...w, id: `w${++counter}`, queuedAt: counter }),
    EMPTY_QUEUE,
  );

describe("what a phone keeps", () => {
  it("keeps a season the server has never been told about", () => {
    // **The whole reason this merges rather than replaces.** A board that
    // predates syncing has a history nothing has announced, so the server's
    // copy is legitimately emptier — and overwriting would delete somebody's
    // year of game nights on the first pull.
    const mine = board({
      players: [player("p1", "Ann"), player("p2", "Bo")],
      results: [game("r1", 100), game("r2", 200)],
    });
    const merged = mergeBoard(mine, remote({ players: [], results: [] }), EMPTY_QUEUE);
    expect(merged.players.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    expect(merged.results.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
  });

  it("takes what somebody else added", () => {
    const merged = mergeBoard(
      board({ players: [player("p1", "Ann")] }),
      remote({ players: [player("p1", "Ann"), player("p9", "Zoe")] }),
      EMPTY_QUEUE,
    );
    expect(merged.players.map((p) => p.id).sort()).toEqual(["p1", "p9"]);
  });

  it("does not show the same person twice", () => {
    const merged = mergeBoard(board(), remote(), EMPTY_QUEUE);
    expect(merged.players).toHaveLength(1);
    expect(merged.results).toHaveLength(1);
  });
});

describe("what a phone lets go of", () => {
  it("removes a player the server says was removed", () => {
    // A merge cannot see an absence, so this only works because the server
    // names it. Inferring it from a missing entry would delete the season above.
    const merged = mergeBoard(
      board({ players: [player("p1"), player("p2")] }),
      remote({ players: [player("p1")] }, { players: ["p2"], results: [] }),
      EMPTY_QUEUE,
    );
    expect(merged.players.map((p) => p.id)).toEqual(["p1"]);
  });

  it("removes a game the server says was removed", () => {
    const merged = mergeBoard(
      board({ results: [game("r1", 100), game("r2", 200)] }),
      remote({ results: [] }, { players: [], results: ["r2"] }),
      EMPTY_QUEUE,
    );
    expect(merged.results.map((r) => r.id)).toEqual(["r1"]);
  });

  it("keeps a player who is merely missing, rather than deleted", () => {
    // The distinction the whole design rests on: absent is not deleted.
    const merged = mergeBoard(
      board({ players: [player("p1"), player("p2")] }),
      remote({ players: [player("p1")] }),
      EMPTY_QUEUE,
    );
    expect(merged.players.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });
});

describe("a pull landing mid-write", () => {
  it("does not take away a game the outbox has not sent yet", () => {
    // **The failure this exists to prevent.** A pull can land in the seconds
    // between recording a game and the queue sending it, and without the
    // pending writes reapplied the game vanishes off the screen — which looks
    // exactly like the app having lost it.
    const q = queueOf({ kind: "recordGame", groupId: "g1", result: game("r9", 500) });
    const merged = mergeBoard(board({ results: [game("r9", 500)] }), remote({ results: [] }), q);
    expect(merged.results.map((r) => r.id)).toContain("r9");
  });

  it("does not take away a player the outbox has not sent yet", () => {
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p8", "Sam") });
    const merged = mergeBoard(
      board({ players: [player("p8", "Sam")] }),
      remote({ players: [] }),
      q,
    );
    expect(merged.players.map((p) => p.id)).toContain("p8");
  });

  it("hands the board back newest game first, like the rest of the app", () => {
    const merged = mergeBoard(
      board({ results: [game("old", 100)] }),
      remote({ results: [game("new", 300), game("mid", 200)] }),
      EMPTY_QUEUE,
    );
    expect(merged.results.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });
});

describe("whose answer wins", () => {
  it("keeps the name typed on this phone", () => {
    // The two only disagree about a name, and the phone in somebody's hand is
    // the one that was just typed into. A game is immutable, so results never
    // reach this.
    const merged = mergeBoard(
      board({ players: [player("p1", "Annabel")] }),
      remote({ players: [player("p1", "Ann")] }),
      EMPTY_QUEUE,
    );
    expect(merged.players[0].name).toBe("Annabel");
  });

  it("takes the board's own name from the server", () => {
    // Renaming a board is not something a phone can send — there is no route —
    // so the server's name is the one everybody else is looking at.
    const merged = mergeBoard(
      board(),
      remote({ group: { id: "g1", name: "Sunday", createdAt: 1 } }),
      EMPTY_QUEUE,
    );
    expect(merged.group.name).toBe("Sunday");
    expect(merged.group.id).toBe("g1");
  });

  it("leaves the board it was given alone", () => {
    const mine = board();
    const before = JSON.stringify(mine);
    mergeBoard(mine, remote({ players: [player("p9")] }), EMPTY_QUEUE);
    expect(JSON.stringify(mine)).toBe(before);
  });
});

describe("reading what the API answered", () => {
  const good = {
    group: { id: "g1", name: "Thursday", createdAt: 1 },
    players: [{ id: "p1", name: "Ann" }],
    results: [game("r1", 100)],
    deleted: { players: ["p9"], results: ["r9"] },
  };

  it("reads a whole board", () => {
    const read = readRemoteBoard(good);
    expect(read?.state.players).toHaveLength(1);
    expect(read?.state.results).toHaveLength(1);
    expect(read?.deleted).toEqual({ players: ["p9"], results: ["r9"] });
  });

  it("drops one unreadable game and keeps the rest", () => {
    // This is merged into the one store nobody can retype the contents of, so
    // one bad row must not cost a season.
    const read = readRemoteBoard({
      ...good,
      results: [game("r1", 100), { id: "r2" }, game("r3", 300)],
    });
    expect(read?.state.results.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  it("drops a player with no name", () => {
    const read = readRemoteBoard({ ...good, players: [{ id: "p1" }] });
    expect(read?.state.players).toEqual([]);
  });

  it("treats a missing deleted list as nothing deleted", () => {
    // **Absent is not "unknown".** Guessing otherwise would delete local rows
    // against a server that simply had not been asked.
    const read = readRemoteBoard({ ...good, deleted: undefined });
    expect(read?.deleted).toEqual({ players: [], results: [] });
  });

  it("treats missing lists as empty ones", () => {
    // A board with no players is a board somebody just made, not a broken
    // response — and the merge keeps whatever this phone already had anyway.
    const read = readRemoteBoard({ group: good.group });
    expect(read?.state.players).toEqual([]);
    expect(read?.state.results).toEqual([]);
  });

  it("is nothing at all without a group", () => {
    expect(readRemoteBoard({ ...good, group: undefined })).toBeNull();
    expect(readRemoteBoard({ ...good, group: { id: "g1", name: "T" } })).toBeNull();
    expect(readRemoteBoard(null)).toBeNull();
    expect(readRemoteBoard("nonsense")).toBeNull();
  });

  it("keeps a game with knockouts and drops one whose knockouts are broken", () => {
    const withKnockouts = { ...game("r4", 400), knockouts: [{ playerId: "p1", count: 1, bounty: 5 }] };
    const broken = { ...game("r5", 500), knockouts: [{ playerId: "p1" }] };
    const read = readRemoteBoard({ ...good, results: [withKnockouts, broken] });
    expect(read?.state.results.map((r) => r.id)).toEqual(["r4"]);
  });
});
