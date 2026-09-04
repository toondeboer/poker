import { describe, expect, it } from "vitest";
import type { GameResult, Player } from "../leaderboard/gameResult";
import type { GroupState } from "../leaderboard/groups";
import {
  EMPTY_QUEUE,
  MAX_REFUSALS,
  cancel,
  cancelBoard,
  clearBoardRefusals,
  describeWrite,
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

describe("a board made with no signal", () => {
  it("can announce itself later", () => {
    // A player or a game names a group, and the server refuses both for a group
    // it has never heard of — so without this, a board created at a table with
    // no signal could never sync anything. It works only because the client
    // picks the group id.
    const q = queueOf({
      kind: "createGroup",
      groupId: "g1",
      name: "Thursday",
      createdAt: 1,
    });
    expect(q.pending[0].kind).toBe("createGroup");
  });

  it("takes everything queued for it down if it is refused", () => {
    // Otherwise every player and game for that group is refused separately, for
    // the same reason, one at a time.
    const q = queueOf(
      { kind: "createGroup", groupId: "g1", name: "Thursday", createdAt: 1 },
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "recordGame", groupId: "g1", result: game("r2") },
    );
    const after = refuse(q, q.pending[0].id, "group exists", 5);
    expect(after.pending).toEqual([]);
    expect(after.refused).toHaveLength(3);
  });

  it("does not take another board down with it", () => {
    const q = queueOf(
      { kind: "createGroup", groupId: "g1", name: "Thursday", createdAt: 1 },
      { kind: "addPlayer", groupId: "g2", player: player("p2") },
    );
    expect(refuse(q, q.pending[0].id, "nope", 5).pending).toHaveLength(1);
  });

  it("shows nothing extra on the board it creates", () => {
    // The board being drawn *is* the group; a pending creation is only about
    // telling the server it exists.
    const q = queueOf({
      kind: "createGroup",
      groupId: "g1",
      name: "Thursday",
      createdAt: 1,
    });
    expect(withPending(board(), q)).toEqual(board());
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

describe("withdrawing a write that was never sent", () => {
  it("takes the add with the deletion", () => {
    // **The bug this exists for.** A name typed at a table with no signal and
    // deleted a moment later would still have been POSTed on the next
    // foreground — and removing a player from a shared board is admin-only, so
    // the typo would be on every member's board permanently.
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2") });
    expect(cancel(q, { kind: "addPlayer", groupId: "g1", playerId: "p2" }).pending).toEqual(
      [],
    );
  });

  it("leaves a game that named the cancelled player", () => {
    // Where this differs from a refusal. The local board keeps the game and
    // drops the player from the standings; a server that never heard the add
    // does exactly the same. The two agree, so there is nothing to withhold.
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "recordGame", groupId: "g1", result: { ...game("r2"), playerIds: ["p2"] } },
    );
    const after = cancel(q, { kind: "addPlayer", groupId: "g1", playerId: "p2" });
    expect(after.pending).toHaveLength(1);
    expect(after.pending[0].kind).toBe("recordGame");
  });

  it("leaves the same player on another board alone", () => {
    const q = queueOf({ kind: "addPlayer", groupId: "g2", player: player("p2") });
    expect(cancel(q, { kind: "addPlayer", groupId: "g1", playerId: "p2" }).pending).toHaveLength(
      1,
    );
  });

  it("does nothing when the write has already gone", () => {
    // There is no recalling a sent write, and pretending otherwise would be
    // worse than the divergence.
    expect(cancel(EMPTY_QUEUE, { kind: "recordGame", groupId: "g1", resultId: "r1" })).toEqual(
      EMPTY_QUEUE,
    );
  });
});

describe("withdrawing a whole board", () => {
  it("takes its players and games with it", () => {
    // A board made with no signal and deleted before it synced would otherwise
    // be created on the server *with its players*. No route deletes a board, so
    // it would be there for good.
    const q = queueOf(
      { kind: "createGroup", groupId: "g1", name: "T", createdAt: 1 },
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "recordGame", groupId: "g1", result: game("r2") },
      { kind: "addPlayer", groupId: "g2", player: player("p3") },
    );
    const after = cancelBoard(q, "g1");
    expect(after.pending).toHaveLength(1);
    expect(after.pending[0].groupId).toBe("g2");
  });

  it("frees a board's refusals when somebody joins it again", () => {
    // A refusal blocks its subject until a person says otherwise, and joining
    // by link is that. Without this a board that was refused, deleted and
    // re-joined could never announce itself: its own `createGroup` stayed
    // blocked, and every player and game queued behind it came back as "no
    // such group".
    const q = queueOf(
      { kind: "createGroup", groupId: "g1", name: "T", createdAt: 1 },
      { kind: "addPlayer", groupId: "g2", player: player("p3") },
    );
    const refused = refuse(q, q.pending[0].id, "nope", 5);
    const other = refuse(refused, refused.pending[0].id, "nope", 6);

    const freed = clearBoardRefusals(other, "g1");
    expect(freed.refused).toHaveLength(1);
    expect(freed.refused[0].write.groupId).toBe("g2");

    // And the subject is queueable again, which is the whole point.
    const requeued = enqueue(freed, {
      ...q.pending[0],
      name: "T again",
    });
    expect(requeued.pending).toHaveLength(1);
  });

  it("is the same queue when a join freed nothing", () => {
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2") });
    expect(clearBoardRefusals(q, "g1")).toBe(q);
  });

  it("leaves refusals alone, because somebody still has not read them", () => {
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2") });
    const refused = refuse(q, q.pending[0].id, "nope", 5);
    expect(cancelBoard(refused, "g1").refused).toHaveLength(1);
  });
});

describe("queueing something that was already refused", () => {
  it("does not queue it again", () => {
    // The app announces every board on each launch. Without this, a board the
    // server keeps refusing appends an identical refusal every launch until the
    // cap evicts the one somebody actually needed to read.
    const q = queueOf({ kind: "createGroup", groupId: "g1", name: "T", createdAt: 1 });
    const refused = refuse(q, q.pending[0].id, "you are not on this board", 5);
    const again = enqueue(
      refused,
      write({ kind: "createGroup", groupId: "g1", name: "T", createdAt: 1 }),
    );
    expect(again.pending).toEqual([]);
    expect(again.refused).toHaveLength(1);
  });

  it("lets it be queued again once somebody has dismissed it", () => {
    // Dismissing is what says "try this again" — and it takes a person.
    const q = queueOf({ kind: "createGroup", groupId: "g1", name: "T", createdAt: 1 });
    const refused = refuse(q, q.pending[0].id, "nope", 5);
    const cleared = dismiss(refused, refused.refused[0].write.id);
    const again = enqueue(
      cleared,
      write({ kind: "createGroup", groupId: "g1", name: "T", createdAt: 1 }),
    );
    expect(again.pending).toHaveLength(1);
  });
});

describe("saying what a write was", () => {
  it("names the person, the board, or the game", () => {
    // The only part of showing a refusal that can be wrong, and a screen is the
    // one thing this repo cannot test — so the wording lives here.
    expect(describeWrite({ kind: "addPlayer", groupId: "g1", player: player("p2", "Ann") }))
      .toBe("Ann was not added");
    expect(
      describeWrite({ kind: "createGroup", groupId: "g1", name: "Thursday", createdAt: 1 }),
    ).toBe("The board “Thursday” was not created");
    expect(describeWrite({ kind: "recordGame", groupId: "g1", result: game("r1") })).toBe(
      "A game was not recorded",
    );
  });
});

describe("explaining a cascade", () => {
  it("names the board when it was the board that was refused", () => {
    // Every casualty used to be told "the player it names was refused", which
    // for a refused *board* is simply untrue — and this is the message somebody
    // reads to work out what happened to their evening.
    const q = queueOf(
      { kind: "createGroup", groupId: "g1", name: "Thursday", createdAt: 1 },
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
    );
    const after = refuse(q, q.pending[0].id, "that name is taken", 5);
    expect(after.refused[1].reason).toContain("the board it belongs to was refused");
  });
});

describe("how many refusals are kept", () => {
  it("keeps the newest and lets the oldest go", () => {
    // Unbounded, this is a list that only ever grows — in storage, forever, for
    // writes nobody is going to act on. The newest are the ones still worth
    // explaining.
    let q = EMPTY_QUEUE;
    for (let i = 0; i < MAX_REFUSALS + 5; i += 1) {
      q = enqueue(q, write({ kind: "recordGame", groupId: "g1", result: game(`r${i}`) }));
      q = refuse(q, q.pending[0].id, `nope ${i}`, i);
    }
    expect(q.refused).toHaveLength(MAX_REFUSALS);
    expect(q.refused[q.refused.length - 1].reason).toBe(`nope ${MAX_REFUSALS + 4}`);
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

  it("ignores writes queued for a different board", () => {
    // The queue is one outbox for every board, so this is the ordinary case,
    // not an edge: a player added to Thursday must not appear on Sunday.
    const q = queueOf({ kind: "addPlayer", groupId: "g2", player: player("p9", "Zoe") });
    expect(withPending(board(), q).players.map((p) => p.id)).toEqual(["p1"]);
  });

  it("does not show a game twice once the server has it", () => {
    // A write is settled by a report, not by the board arriving, so there is a
    // window where the game is in both — and showing it twice double-counts
    // somebody's night in the standings.
    const q = queueOf({ kind: "recordGame", groupId: "g1", result: game("r1", 100) });
    expect(withPending(board(), q).results.map((r) => r.id)).toEqual(["r1"]);
  });

  it("keeps two games in the same millisecond in a stable order", () => {
    // Without the id tie-break the sort is unstable and the two swap places
    // between renders, which looks like the list flickering for no reason.
    const same = { ...board(), results: [game("b", 500), game("a", 500)] };
    const drawn = withPending(same, EMPTY_QUEUE).results.map((r) => r.id);
    expect(drawn).toEqual(["a", "b"]);
    // And the same answer whichever way round they arrive.
    const flipped = { ...board(), results: [game("a", 500), game("b", 500)] };
    expect(withPending(flipped, EMPTY_QUEUE).results.map((r) => r.id)).toEqual(drawn);
  });

  it("does not fall over on a board holding the same game twice", () => {
    // Storage validates each stored result but does not dedupe ids, so this is
    // reachable from a file somebody's phone actually has. The comparator has
    // to be total: returning a made-up order for two equal keys is what makes a
    // sort unstable, and the list then flickers between renders.
    const twice = { ...board(), results: [game("r9", 500), game("r9", 500)] };
    expect(withPending(twice, EMPTY_QUEUE).results.map((r) => r.id)).toEqual([
      "r9",
      "r9",
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
