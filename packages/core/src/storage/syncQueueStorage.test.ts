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

  it("does not persist that a request was in the air", async () => {
    // Nothing is in flight across a launch. Restoring the flag would describe a
    // request made by a process that no longer exists.
    const store = createSyncQueueStorage(createMemoryAdapter());
    await store.saveQueue(queue({ ...add("p1"), sentAt: 12345 }));
    expect((await store.loadQueue()).pending[0].sentAt).toBeUndefined();
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

  it("is empty rather than throwing on unreadable JSON", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem(SYNC_QUEUE_KEY, "{not json");
    expect(await createSyncQueueStorage(adapter).loadQueue()).toEqual(EMPTY_QUEUE);
  });

  it("is empty when nothing was ever saved", async () => {
    expect(await createSyncQueueStorage(createMemoryAdapter()).loadQueue()).toEqual(
      EMPTY_QUEUE,
    );
  });
});
