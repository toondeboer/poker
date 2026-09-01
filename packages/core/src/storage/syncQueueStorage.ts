import { StorageAdapter } from "./StorageAdapter";
import {
  EMPTY_QUEUE,
  type QueuedWrite,
  type RefusedWrite,
  type SyncQueue,
} from "../sync/pendingWrites";

export const SYNC_QUEUE_KEY = "sync_queue";

export interface SyncQueueStorage {
  loadQueue(): Promise<SyncQueue>;
  saveQueue(queue: SyncQueue): Promise<void>;
  clearQueue(): Promise<void>;
}

/**
 * A write this phone has not sent is a thing somebody did.
 *
 * They typed a name at a table with no signal, or recorded the game that just
 * finished. Losing the queue on a cold launch loses that, silently, and the
 * only symptom is a board missing a night nobody can quite place — so it is
 * persisted like anything else the app would be embarrassed to forget.
 */
const isQueuedWrite = (value: unknown): value is QueuedWrite => {
  if (typeof value !== "object" || value === null) return false;
  const write = value as QueuedWrite;
  if (typeof write.id !== "string" || typeof write.queuedAt !== "number") {
    return false;
  }
  if (typeof write.groupId !== "string" || write.groupId.length === 0) {
    return false;
  }
  // **The kind decides what else has to be there**, and an unrecognised one is
  // dropped rather than guessed at: a queue is replayed against a live server,
  // and a write this version does not understand is one it cannot send
  // correctly either.
  if (write.kind === "createGroup") {
    return typeof write.name === "string" && typeof write.createdAt === "number";
  }
  if (write.kind === "addPlayer") {
    return (
      typeof write.player?.id === "string" && typeof write.player?.name === "string"
    );
  }
  if (write.kind === "recordGame") {
    const result = write.result;
    /**
     * **Every field the board will touch, not just the ones that identify it.**
     *
     * A stored result with no `placings` passed a looser check, loaded happily,
     * got merged into the board by `withPending`, and then `computeStandings`
     * threw `placings is not iterable` — on **every launch**, because the queue
     * is loaded every launch. That is the crash-loop-from-saved-data the app's
     * recovery screen exists for, arriving from a store that was not in the
     * recovery list either.
     */
    return (
      typeof result?.id === "string" &&
      typeof result?.playedAt === "number" &&
      Array.isArray(result?.playerIds) &&
      result.playerIds.every((id) => typeof id === "string") &&
      Array.isArray(result?.placings) &&
      result.placings.every(
        (placing) =>
          typeof placing?.playerId === "string" &&
          typeof placing?.place === "number" &&
          typeof placing?.winnings === "number",
      ) &&
      typeof result?.buyIn === "number" &&
      typeof result?.bounty === "number"
    );
  }
  return false;
};

const isRefusedWrite = (value: unknown): value is RefusedWrite => {
  if (typeof value !== "object" || value === null) return false;
  const refused = value as RefusedWrite;
  return (
    typeof refused.reason === "string" &&
    typeof refused.refusedAt === "number" &&
    isQueuedWrite(refused.write)
  );
};

/**
 * Create a store for the pending-write queue, backed by any
 * {@link StorageAdapter}. Pure persistence and validation — no platform or UI
 * dependencies.
 */
export function createSyncQueueStorage(storage: StorageAdapter): SyncQueueStorage {
  return {
    async loadQueue(): Promise<SyncQueue> {
      try {
        const raw = await storage.getItem(SYNC_QUEUE_KEY);
        if (!raw) return EMPTY_QUEUE;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return EMPTY_QUEUE;
        const { pending, refused } = parsed as {
          pending?: unknown;
          refused?: unknown;
        };
        return {
          // Filtered rather than rejected wholesale: one unreadable row should
          // not throw away an evening's worth of writes beside it.
          pending: Array.isArray(pending) ? pending.filter(isQueuedWrite) : [],
          refused: Array.isArray(refused) ? refused.filter(isRefusedWrite) : [],
        };
      } catch {
        // Unreadable JSON is the one case where there is nothing to salvage.
        return EMPTY_QUEUE;
      }
    },

    async saveQueue(queue: SyncQueue): Promise<void> {
      await storage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    },

    async clearQueue(): Promise<void> {
      await storage.multiRemove([SYNC_QUEUE_KEY]);
    },
  };
}
