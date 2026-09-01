import { describe, expect, it } from "vitest";
import type { GameResult, Player } from "../leaderboard/gameResult";
import { EMPTY_QUEUE, enqueue, type PendingWrite, type QueuedWrite, type SyncQueue } from "./pendingWrites";
import { drain, type SendResult, type Sender } from "./drain";

let counter = 0;
const write = (w: PendingWrite): QueuedWrite => ({
  ...w,
  id: `w${++counter}`,
  queuedAt: counter,
});

const player = (id: string): Player => ({ id, name: id });

const game = (id: string, playerIds = ["p1"]): GameResult => ({
  id,
  playedAt: 1,
  playerIds,
  placings: [],
  buyIn: 10,
  bounty: 0,
});

const queueOf = (...writes: PendingWrite[]): SyncQueue =>
  writes.reduce((q, w) => enqueue(q, write(w)), EMPTY_QUEUE);

/** A sender that answers from a script and records what it was asked. */
const sender = (...answers: SendResult[]): Sender & { seen: QueuedWrite[] } => {
  const seen: QueuedWrite[] = [];
  const queue = [...answers];
  const fn = async (w: QueuedWrite) => {
    seen.push(w);
    return queue.shift() ?? { status: "ok" as const };
  };
  return Object.assign(fn, { seen });
};

const clock = () => {
  let t = 0;
  return () => ++t;
};

describe("draining", () => {
  it("sends everything and empties the queue", async () => {
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "recordGame", groupId: "g1", result: game("r1") },
    );
    const send = sender();
    const report = await drain(q, send, clock());
    expect(report.sent).toBe(2);
    expect(report.queue.pending).toEqual([]);
    expect(report.stopped).toBe(false);
  });

  it("sends oldest first", async () => {
    // A game names the players in it, so a game queued after an add depends on
    // that add having landed.
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "recordGame", groupId: "g1", result: game("r1", ["p2"]) },
    );
    const send = sender();
    await drain(q, send, clock());
    expect(send.seen.map((w) => w.kind)).toEqual(["addPlayer", "recordGame"]);
  });
});

describe("when the server cannot be reached", () => {
  it("stops rather than carrying on past it", async () => {
    // Carrying on would send the game and not the player it names, and the
    // board would show a game whose winner is nobody.
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "recordGame", groupId: "g1", result: game("r1", ["p2"]) },
    );
    const send = sender({ status: "unreachable" });
    const report = await drain(q, send, clock());
    expect(send.seen).toHaveLength(1);
    expect(report.stopped).toBe(true);
    expect(report.queue.pending).toHaveLength(2);
  });

  it("puts the write back rather than leaving it flagged as in flight", async () => {
    // A write left marked as sent is one every later attempt skips forever.
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2") });
    const report = await drain(q, sender({ status: "unreachable" }), clock());
    expect(report.queue.pending[0].sentAt).toBeUndefined();
  });

  it("keeps what it managed to send before the silence", async () => {
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "addPlayer", groupId: "g1", player: player("p3") },
    );
    const report = await drain(q, sender({ status: "ok" }, { status: "unreachable" }), clock());
    expect(report.sent).toBe(1);
    expect(report.queue.pending).toHaveLength(1);
  });
});

describe("when the server says no", () => {
  it("carries on with the rest", async () => {
    // A refusal is an answer. Stopping on one would mean a single bad write
    // blocks everything queued behind it forever.
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "addPlayer", groupId: "g1", player: player("p3") },
    );
    const send = sender({ status: "refused", reason: "not on this board" });
    const report = await drain(q, send, clock());
    expect(send.seen).toHaveLength(2);
    expect(report.refused).toBe(1);
    expect(report.sent).toBe(1);
  });

  it("does not send a game whose player was just refused", async () => {
    // The refusal takes its dependants out of the queue, and the loop has to
    // notice — otherwise it sends a game naming somebody the server has never
    // heard of.
    const q = queueOf(
      { kind: "addPlayer", groupId: "g1", player: player("p2") },
      { kind: "recordGame", groupId: "g1", result: game("r1", ["p2"]) },
    );
    const send = sender({ status: "refused", reason: "not on this board" });
    const report = await drain(q, send, clock());
    expect(send.seen).toHaveLength(1);
    expect(report.refused).toBe(2);
    expect(report.queue.refused).toHaveLength(2);
  });

  it("keeps the reason for somebody to read", async () => {
    const q = queueOf({ kind: "recordGame", groupId: "g1", result: game("r1") });
    const report = await drain(q, sender({ status: "refused", reason: "already recorded" }), clock());
    expect(report.queue.refused[0].reason).toBe("already recorded");
  });
});

describe("retrying", () => {
  it("sends a write again even though a previous attempt marked it sent", async () => {
    // The phone died before finding out whether it landed, and the only honest
    // thing is to send it again. Safe because the server was built for it:
    // adding is an update, and recording a game it already has answers ok.
    const q = queueOf({ kind: "addPlayer", groupId: "g1", player: player("p2") });
    const stale: SyncQueue = {
      ...q,
      pending: q.pending.map((w) => ({ ...w, sentAt: 1 })),
    };
    const send = sender();
    const report = await drain(stale, send, clock());
    expect(send.seen).toHaveLength(1);
    expect(report.sent).toBe(1);
  });

  it("does nothing at all with an empty queue", async () => {
    const send = sender();
    const report = await drain(EMPTY_QUEUE, send, clock());
    expect(send.seen).toEqual([]);
    expect(report).toMatchObject({ sent: 0, refused: 0, stopped: false });
  });
});
