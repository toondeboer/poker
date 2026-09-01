import { describe, expect, it } from "vitest";
import { createSyncQueueStorage, SYNC_QUEUE_KEY } from "./syncQueueStorage";
import { createMemoryAdapter } from "./testAdapters";
import { EMPTY_QUEUE, type QueuedWrite, type SyncQueue } from "../sync/pendingWrites";

const add = (id: string, groupId = "g1"): QueuedWrite => ({
  kind: "addPlayer",
  groupId,
  player: { id, name: id },
  id: `w-${id}`,
  queuedAt: 1,
});

const queue = (...pending: QueuedWrite[]): SyncQueue => ({ pending, refused: [] });

describe("keeping what has not been sent", () => {
  it("survives a round trip", async () => {
    // A write nobody sent is a thing somebody did — a name typed at a table
    // with no signal. Losing it on a cold launch loses that silently.
    const store = createSyncQueueStorage(createMemoryAdapter());
    await store.saveQueue(queue(add("p1")));
    const loaded = await store.loadQueue();
    expect(loaded.pending).toHaveLength(1);
    expect(loaded.pending[0].id).toBe("w-p1");
  });

  it("keeps refusals, so somebody can still be told", async () => {
    const store = createSyncQueueStorage(createMemoryAdapter());
    await store.saveQueue({
      pending: [],
      refused: [{ write: add("p1"), reason: "not on this board", refusedAt: 9 }],
    });
    expect((await store.loadQueue()).refused[0].reason).toBe("not on this board");
  });
});

describe("reading back something it does not recognise", () => {
  it("drops one bad row without losing the good ones beside it", async () => {
    // An evening's worth of writes should not go because one row is unreadable.
    const adapter = createMemoryAdapter();
    await adapter.setItem(
      SYNC_QUEUE_KEY,
      JSON.stringify({
        pending: [add("p1"), { kind: "addPlayer" }, add("p2")],
        refused: [],
      }),
    );
    const loaded = await createSyncQueueStorage(adapter).loadQueue();
    expect(loaded.pending.map((w) => w.id)).toEqual(["w-p1", "w-p2"]);
  });

  it("drops a kind this version cannot send", async () => {
    // A queue is replayed against a live server. A write this build does not
    // understand is one it cannot send correctly either, so guessing is worse
    // than dropping.
    const adapter = createMemoryAdapter();
    await adapter.setItem(
      SYNC_QUEUE_KEY,
      JSON.stringify({
        pending: [{ ...add("p1"), kind: "somethingNewer" }],
        refused: [],
      }),
    );
    expect((await createSyncQueueStorage(adapter).loadQueue()).pending).toEqual([]);
  });

  it("drops a game whose knockouts are unreadable", async () => {
    // The same crash-at-launch class `placings` is checked for: the board reads
    // knockouts to award bounties, and a row it cannot read takes the app down
    // on every start — with the queue in storage, so it never recovers.
    const adapter = createMemoryAdapter();
    await adapter.setItem(
      SYNC_QUEUE_KEY,
      JSON.stringify({
        pending: [
          {
            kind: "recordGame",
            groupId: "g1",
            result: {
              id: "r1",
              playedAt: 1,
              playerIds: ["p1"],
              placings: [],
              buyIn: 10,
              bounty: 5,
              knockouts: [{ playerId: "p1" }],
            },
            id: "w-r1",
            queuedAt: 1,
          },
        ],
        refused: [],
      }),
    );
    expect((await createSyncQueueStorage(adapter).loadQueue()).pending).toEqual([]);
  });

  it("keeps a game that simply has no knockouts", async () => {
    // Optional: only a game the app dealt knows who knocked whom out.
    const adapter = createMemoryAdapter();
    await adapter.setItem(
      SYNC_QUEUE_KEY,
      JSON.stringify({
        pending: [
          {
            kind: "recordGame",
            groupId: "g1",
            result: {
              id: "r1",
              playedAt: 1,
              playerIds: ["p1"],
              placings: [],
              buyIn: 10,
              bounty: 0,
            },
            id: "w-r1",
            queuedAt: 1,
          },
        ],
        refused: [],
      }),
    );
    expect((await createSyncQueueStorage(adapter).loadQueue()).pending).toHaveLength(1);
  });

  it("drops a write that does not say which board it is for", () => {
    // Without a board there is no route to send it to, and guessing the active
    // one would post somebody's game to the wrong leaderboard.
    const adapter = createMemoryAdapter();
    return (async () => {
      await adapter.setItem(
        SYNC_QUEUE_KEY,
        JSON.stringify({ pending: [{ ...add("p1"), groupId: "" }], refused: [] }),
      );
      expect((await createSyncQueueStorage(adapter).loadQueue()).pending).toEqual([]);
    })();
  });

  it("drops a board whose name did not survive", () => {
    const adapter = createMemoryAdapter();
    return (async () => {
      await adapter.setItem(
        SYNC_QUEUE_KEY,
        JSON.stringify({
          pending: [
            { kind: "createGroup", groupId: "g1", createdAt: 1, id: "w1", queuedAt: 1 },
            { kind: "createGroup", groupId: "g2", name: "Sunday", createdAt: 1, id: "w2", queuedAt: 1 },
          ],
          refused: [],
        }),
      );
      const loaded = await createSyncQueueStorage(adapter).loadQueue();
      expect(loaded.pending.map((w) => w.groupId)).toEqual(["g2"]);
    })();
  });

  it("is empty rather than throwing on unreadable JSON", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem(SYNC_QUEUE_KEY, "{not json");
    expect(await createSyncQueueStorage(adapter).loadQueue()).toEqual(EMPTY_QUEUE);
  });

  it("can be cleared, for the recovery path", () => {
    // `SYNC_QUEUE_KEY` is in `RECOVERY_CLEARS` because an unreadable queue used
    // to crash the app on every launch with no way back.
    const adapter = createMemoryAdapter();
    return (async () => {
      const store = createSyncQueueStorage(adapter);
      await store.saveQueue(queue(add("p1")));
      await store.clearQueue();
      expect((await store.loadQueue()).pending).toEqual([]);
    })();
  });

  it("is empty when nothing was ever saved", async () => {
    expect(await createSyncQueueStorage(createMemoryAdapter()).loadQueue()).toEqual(
      EMPTY_QUEUE,
    );
  });
});
