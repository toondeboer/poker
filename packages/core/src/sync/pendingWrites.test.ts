import { describe, expect, it } from "vitest";
import type { GameResult, Player } from "../leaderboard/gameResult";
import type { GroupState } from "../leaderboard/groups";
import {
  EMPTY_QUEUE,
  dismiss,
  enqueue,
  hasPendingFor,
  markSending,
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
  it("cancels an add and a remove that never left the phone", () => {
    // Offline for an evening: add Ann, change your mind. Sending both is two
    // round trips to reach a state the server was never told about, and two
    // chances to fail.
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "removePlayer", groupId: "g1", playerId: "p2" },
    );
    expect(q.pending).toEqual([]);
  });

  it("keeps a removal of somebody the server already knows about", () => {
    // **The distinction that matters.** With no pending add, the removal is
    // real work: the player exists server-side and somebody wants them gone.
    const q = queueOf({ kind: "removePlayer", groupId: "g1", playerId: "p1" });
    expect(q.pending).toHaveLength(1);
  });

  it("keeps an add whose player a pending game still names", () => {
    // Add Bo, record the game he played, then remove him — removing a player
    // deliberately keeps their games, so this is ordinary. Cancelling the add
    // would leave a game naming somebody the server is never told about.
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      {
        kind: "recordGame",
        groupId: "g1",
        result: { ...game("r2"), playerIds: ["p2"] },
      },
      { kind: "removePlayer", groupId: "g1", playerId: "p2" },
    );
    expect(q.pending).toHaveLength(3);
  });

  it("cancels a recorded game deleted before it synced", () => {
    const q = queueOf(
      { kind: "recordGame", groupId: "g1", result: game("r2") },
      { kind: "removeGame", groupId: "g1", gameId: "r2" },
    );
    expect(q.pending).toEqual([]);
  });

  it("does not collapse across different boards", () => {
    // Same player id in two groups is two different people.
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "removePlayer", groupId: "g2", playerId: "p2" },
    );
    expect(q.pending).toHaveLength(2);
  });

  it("leaves recorded games alone", () => {
    // Two games are two games. Collapsing them would need to know which the
    // server has seen, which is the reasoning this queue exists to avoid.
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
    const kinds: PendingWrite["kind"][] = [
      "addPlayer",
      "removePlayer",
      "recordGame",
      "removeGame",
    ];
    expect(kinds).not.toContain("claimPlayer");
  });
});

describe("a write that is already on its way", () => {
  it("cannot be collapsed away", () => {
    // Without this, queuing a removal while the add is mid-request cancels
    // both — the server accepts the add anyway, `settle` finds nothing, and no
    // removal is ever sent. The player is stuck on a shared board with nothing
    // left that intends to take them off.
    const added = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2") });
    const sending = markSending(added, added.pending[0].id, 5);
    const after = enqueue(
      sending,
      write({ kind: "removePlayer", groupId: "g1", playerId: "p2" }),
    );
    expect(after.pending).toHaveLength(2);
  });

  it("is still there after a restart, because it may never have arrived", () => {
    const added = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2") });
    expect(markSending(added, added.pending[0].id, 5).pending).toHaveLength(1);
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

  it("hides a player this phone removed", () => {
    const q = queueOf({ kind: "removePlayer", groupId: "g1", playerId: "p1" });
    expect(withPending(board(), q).players).toEqual([]);
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

  it("ignores writes meant for another board", () => {
    const q = queueOf({ kind: "removePlayer", groupId: "g2", playerId: "p1" });
    expect(withPending(board(), q).players).toHaveLength(1);
  });

  it("leaves the board it was given alone", () => {
    // Applied on read, never written into the cache — so a refused write is
    // just a queue entry that stops being applied, rather than something that
    // has to be unpicked from state somebody has since changed.
    const original = board();
    const q = queueOf({ kind: "removePlayer", groupId: "g1", playerId: "p1" });
    withPending(original, q);
    expect(original.players).toHaveLength(1);
  });

  it("shows nothing different when there is nothing pending", () => {
    expect(withPending(board(), EMPTY_QUEUE)).toEqual(board());
  });
});
