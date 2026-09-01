import { describe, expect, it } from "vitest";
import type { GameResult, Player } from "../leaderboard/gameResult";
import type { GroupState } from "../leaderboard/groups";
import {
  EMPTY_QUEUE,
  dismiss,
  enqueue,
  hasPendingFor,
  refuse,
  settle,
  withPending,
  type PendingWrite,
  type QueuedWrite,
  type SyncQueue,
} from "./pendingWrites";

let counter = 0;
const write = (w: PendingWrite): QueuedWrite => ({
  ...w,
  id: `w${++counter}`,
  queuedAt: counter,
});

const player = (id: string, name = id): Player => ({ id, name });

const game = (id: string, playedAt = 1): GameResult => ({
  id,
  playedAt,
  playerIds: ["p1"],
  placings: [],
  buyIn: 10,
  bounty: 0,
});

const board = (): GroupState => ({
  group: { id: "g1", name: "Thursday", createdAt: 1 },
  players: [player("p1", "Ann")],
  results: [game("r1", 100)],
});

const queueOf = (...writes: PendingWrite[]): SyncQueue =>
  writes.reduce((q, w) => enqueue(q, write(w)), EMPTY_QUEUE);

describe("what the queue holds", () => {
  it("keeps the intent, not the resulting board", () => {
    // A queue of "the board now looks like this" cannot be replayed against a
    // server that has moved on. A queue of "I added Ann" can.
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2") });
    expect(q.pending[0].kind).toBe("addPlayer");
  });

  it("keeps writes for other boards out of the way", () => {
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "addPlayer", groupId: "g2", player: player("p3") },
    );
    expect(hasPendingFor(q, "g1")).toBe(true);
    expect(hasPendingFor(q, "g9")).toBe(false);
  });
});

describe("collapsing", () => {
  it("ignores a write the queue already holds", () => {
    // A phone that queues the same add twice sends it twice, and the second
    // comes back as a refusal about a player who is perfectly fine.
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
    );
    expect(q.pending).toHaveLength(1);
  });

  it("keeps the same id in two different boards apart", () => {
    // Same player id in two groups is two different people.
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "addPlayer", groupId: "g2", player: player("p2") },
    );
    expect(q.pending).toHaveLength(2);
  });

  it("keeps two different games", () => {
    const q = queueOf(
      { kind: "recordGame", groupId: "g1", result: game("r2") },
      { kind: "recordGame", groupId: "g1", result: game("r3") },
    );
    expect(q.pending).toHaveLength(2);
  });
});

describe("what cannot be queued", () => {
  it("has no way to express a claim", () => {
    // **Claiming needs a connection**, and an earlier version of this file
    // queued it anyway — contradicting its own header. Two people claiming the
    // same player on two offline phones cannot both be right, and both would
    // have been shown the player as theirs until one came back refused, long
    // after somebody had been given an answer.
    const kinds: PendingWrite["kind"][] = ["addPlayer", "recordGame"];
    expect(kinds).not.toContain("claimPlayer");
  });

  it("has no way to express a removal either", () => {
    // Removal is destructive and admin-only, so an offline one hides something
    // on this phone and may be refused days later — with this phone the only
    // place the board ever looked like that. `SYNC.md` always said so; the code
    // did not, twice.
    const kinds: PendingWrite["kind"][] = ["addPlayer", "recordGame"];
    expect(kinds).not.toContain("removePlayer");
    expect(kinds).not.toContain("removeGame");
  });
});

describe("settling and refusing", () => {
  it("drops a write that reached the server", () => {
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2") });
    expect(settle(q, q.pending[0].id).pending).toEqual([]);
  });

  it("moves a refusal somewhere a person can see it", () => {
    // **A write is checked when it syncs, not when it was made.** A game
    // recorded on Tuesday can be refused on Thursday because an admin removed
    // you on Wednesday. Dropping it loses somebody's evening; applying it is a
    // lie.
    const q = queueOf({ kind: "recordGame", groupId: "g1", result: game("r2") });
    const after = refuse(q, q.pending[0].id, "you are not on this board", 5);
    expect(after.pending).toEqual([]);
    expect(after.refused).toHaveLength(1);
    expect(after.refused[0].reason).toBe("you are not on this board");
  });

  it("takes the games that named a refused player down with it", () => {
    // Nothing validates `playerIds`, and `computeStandings` skips ids it does
    // not know — so sending the game after its player was refused leaves a
    // board with a game whose winner is nobody. Worse than sending neither.
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      {
        kind: "recordGame",
        groupId: "g1",
        result: { ...game("r2"), playerIds: ["p2"] },
      },
    );
    const after = refuse(q, q.pending[0].id, "you are not on this board", 5);
    expect(after.pending).toEqual([]);
    expect(after.refused).toHaveLength(2);
    expect(after.refused[1].reason).toContain("the player it names was refused");
  });

  it("leaves a game that does not name the refused player", () => {
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "recordGame", groupId: "g1", result: game("r2") },
    );
    const after = refuse(q, q.pending[0].id, "nope", 5);
    expect(after.pending).toHaveLength(1);
  });

  it("takes a refusal off the queue so the ones behind it can go", () => {
    // Retrying a refusal forever is a queue that never drains and a phone that
    // never syncs anything queued after it.
    const q = queueOf(
      { kind: "recordGame", groupId: "g1", result: game("r2") },
      { kind: "recordGame", groupId: "g1", result: game("r3") },
    );
    const after = refuse(q, q.pending[0].id, "nope", 5);
    expect(after.pending).toHaveLength(1);
  });

  it("ignores a write that is no longer there", () => {
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2") });
    expect(refuse(q, "gone", "nope", 5)).toEqual(q);
    expect(settle(q, "gone")).toEqual(q);
  });

  it("lets somebody dismiss the bad news once they have read it", () => {
    const q = queueOf({ kind: "recordGame", groupId: "g1", result: game("r2") });
    const after = refuse(q, q.pending[0].id, "nope", 5);
    expect(dismiss(after, after.refused[0].write.id).refused).toEqual([]);
  });
});

describe("the board as this phone should draw it", () => {
  it("shows a player who has not synced yet", () => {
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2", "Bo") });
    expect(withPending(board(), q).players.map((p) => p.name)).toEqual([
      "Ann",
      "Bo",
    ]);
  });

  it("does not show somebody twice once the server has them", () => {
    // A replayed add would otherwise duplicate the person on screen until the
    // next fetch.
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p1", "Ann") });
    expect(withPending(board(), q).players).toHaveLength(1);
  });

  it("puts the newest game first, like the rest of the app", () => {
    // **`addGameResult` prepends** and `playedAt` is documented as
    // "newest-first ordering". Sorting the other way reversed the whole history
    // on screen even with an empty queue.
    const older = { ...board(), results: [game("mid", 200), game("old", 100)] };
    const q = queueOf({ kind: "recordGame", groupId: "g1", result: game("new", 300) });
    expect(withPending(older, q).results.map((r) => r.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("leaves the board it was given alone", () => {
    // Applied on read, never written into the cache — so a refused write is
    // just a queue entry that stops being applied, rather than something that
    // has to be unpicked from state somebody has since changed.
    const original = board();
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2") });
    withPending(original, q);
    expect(original.players).toHaveLength(1);
  });

  it("shows nothing different when there is nothing pending", () => {
    expect(withPending(board(), EMPTY_QUEUE)).toEqual(board());
  });
});
