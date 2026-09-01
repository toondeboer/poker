// src/hooks/useGroupSync.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  EMPTY_QUEUE,
  applyReport,
  dismiss,
  drain,
  enqueue,
  type PendingWrite,
  type SyncQueue,
} from "@poker/core";
import { createSyncQueueStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";
import { createGroupApi } from "@/src/services/groupApi";
import { apiToken } from "@/src/contexts/AuthContext";
import { backendConfig } from "@/src/services/backendConfig";
import { generateId } from "@/src/utils/id";
import { logger } from "@/src/utils/logger";

const QueueStorage = createSyncQueueStorage(asyncStorageAdapter);
const api = createGroupApi(apiToken);

/**
 * The outbox: what this phone has done to a shared board and not yet sent.
 *
 * **The board is written first and this is told second**, which is what makes
 * the queue safe to lose — see `pendingWrites.ts`. Nothing here touches the
 * leaderboard; it only remembers what the server still needs to hear.
 */
export type GroupSync = {
  queue: SyncQueue;
  /** Remember a write, and try to send it. */
  record: (write: PendingWrite) => void;
  /** Send whatever is waiting. Safe to call when there is nothing. */
  syncNow: () => void;
  /** Somebody has read a refusal. */
  acknowledge: (id: string) => void;
};

export const useGroupSync = (): GroupSync => {
  const [queue, setQueue] = useState<SyncQueue>(EMPTY_QUEUE);
  /**
   * The queue as it is *right now*, for the drain to work from.
   *
   * React state is a snapshot per render and a drain takes as long as the
   * network does, so reading `queue` inside it would work from whatever was
   * true when the effect was created. The ref is the live one; the state is
   * what renders.
   */
  const latest = useRef(queue);
  const draining = useRef(false);

  const update = useCallback((next: (current: SyncQueue) => SyncQueue) => {
    setQueue((current) => {
      const value = next(current);
      latest.current = value;
      // Persisted on every change rather than on a timer: the writes worth
      // queueing are the ones made when the app is about to be put in a pocket.
      QueueStorage.saveQueue(value).catch((error) =>
        logger.error("Failed to save the sync queue:", error),
      );
      return value;
    });
  }, []);

  const syncNow = useCallback(() => {
    // **One at a time.** Two drains would send the same writes twice — harmless
    // on the server, which is idempotent, and confusing here, because both
    // would apply reports built from different snapshots.
    if (draining.current) return;
    if (!backendConfig) return;
    if (latest.current.pending.length === 0) return;

    draining.current = true;
    void drain(latest.current, api.send)
      .then((report) => {
        if (report.settled.length > 0 || report.refused.length > 0) {
          update((current) => applyReport(current, report, Date.now()));
        }
      })
      .catch((error) => logger.error("Sync failed unexpectedly:", error))
      .finally(() => {
        draining.current = false;
      });
  }, [update]);

  const record = useCallback(
    (write: PendingWrite) => {
      // Nothing to tell, and nobody to tell it to. A build with no backend
      // behaves exactly as it did before any of this existed.
      if (!backendConfig) return;
      update((current) =>
        enqueue(current, { ...write, id: generateId(), queuedAt: Date.now() }),
      );
      syncNow();
    },
    [update, syncNow],
  );

  const acknowledge = useCallback(
    (id: string) => update((current) => dismiss(current, id)),
    [update],
  );

  /**
   * Try again whenever the app comes back to the foreground.
   *
   * **The moment a phone most likely has signal again**, and the one the queue
   * is written for: somebody records a game at a table with two bars, pockets
   * the phone, and opens it on the way home. Without this the writes sit until
   * the next one is made, which for a weekly game is a week.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") syncNow();
    });
    return () => subscription.remove();
  }, [syncNow]);

  useEffect(() => {
    let active = true;
    QueueStorage.loadQueue()
      .then((loaded) => {
        if (!active) return;
        latest.current = loaded;
        setQueue(loaded);
        // Whatever an earlier session could not send is the first thing to try.
        syncNow();
      })
      .catch((error) => logger.error("Failed to load the sync queue:", error));
    return () => {
      active = false;
    };
    // Once, on mount: `syncNow` is stable and re-running this would re-read a
    // queue that state already holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoised so consumers can depend on the whole thing without re-running on
  // every render of the provider that holds it.
  return useMemo(
    () => ({ queue, record, syncNow, acknowledge }),
    [queue, record, syncNow, acknowledge],
  );
};
