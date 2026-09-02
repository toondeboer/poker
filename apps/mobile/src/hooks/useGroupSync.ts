// src/hooks/useGroupSync.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  EMPTY_QUEUE,
  MAX_REFUSALS,
  applyReport,
  cancel,
  cancelBoard,
  mergeBoard,
  dismiss,
  drain,
  enqueue,
  type GroupState,
  type RemoteBoard,
  type PendingWrite,
  type SyncQueue,
  type WriteSubject,
} from "@poker/core";
import { createSyncQueueStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";
import { createGroupApi, type GroupApi } from "@/src/services/groupApi";
import { apiToken, onSignedIn } from "@/src/contexts/AuthContext";
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
  /**
   * Tell the server about boards it may not know.
   *
   * **Needed for every group that already existed on the device.** Only newly
   * created ones were announced, so an upgrader's boards — and the default
   * group the app makes on its own — would have been refused "no such group" on
   * every write, forever, with nothing that would ever fix it.
   */
  announce: (groups: readonly { id: string; name: string; createdAt: number }[]) => void;
  /**
   * Withdraw a write nobody has sent, because what it was about is gone.
   *
   * Deleting a player added offline has to take the queued add with it, or the
   * add lands anyway and only an admin can undo it.
   */
  cancel: (subject: WriteSubject) => void;
  /** The same, for a whole board that has just been deleted. */
  cancelBoard: (groupId: string) => void;
  /**
   * Read a board back, merged with what this phone has and has not sent.
   *
   * `null` when there is nothing to apply — no backend, no session, no signal,
   * or a board this account cannot see. The caller keeps what it has.
   */
  fetchBoard: (groupId: string) => Promise<RemoteBoard | null>;
  /**
   * Merge a fetched board into a local one, against the queue as it is *now*.
   *
   * Split from the fetch so a caller can read its local board **after** the
   * request comes back rather than before. A game recorded while the request
   * was in flight is only on this phone, and merging against the copy the fetch
   * started with writes it back out of the board.
   */
  mergeInto: (local: GroupState, remote: RemoteBoard) => GroupState;
  /** Every board this account is on, server-side. `null` when it could not ask. */
  myBoards: () => Promise<string[] | null>;
  /** Mint a link for a board. Admin only; `null` when that is refused. */
  createInvite: (groupId: string) => Promise<string | null>;
  /** Redeem somebody's link, saying which board or why not. */
  redeemInvite: GroupApi["redeemInvite"];
  /**
   * Somebody should pull, because something changed on the server side of this
   * phone's world: it came to the foreground, or the outbox just drained.
   *
   * A counter rather than a callback, so the board can watch it without this
   * hook needing to know what a board is.
   */
  pullsWanted: number;
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
  /**
   * Bumped whenever it is worth reading boards back.
   *
   * **Not a pull itself**, because this hook holds the outbox and not the
   * board. It says *when*; `LeaderboardContext` knows *what*.
   */
  const [pullsWanted, setPullsWanted] = useState(0);
  const wantPull = useCallback(() => setPullsWanted((n) => n + 1), []);

  const update = useCallback((next: (current: SyncQueue) => SyncQueue) => {
    /**
     * **The ref is computed here, not inside the `setQueue` updater.**
     *
     * React defers an updater to the render pass, so assigning the ref inside
     * one leaves it stale for the rest of the current tick — and `record` calls
     * `syncNow` on the very next line. It read `pending.length === 0` and
     * returned, so nothing was ever sent at the moment it was recorded and the
     * outbox ran a write behind, catching up only on the next foreground.
     *
     * The ref is the live value; state is what renders.
     */
    const value = next(latest.current);
    latest.current = value;
    setQueue(value);
    // Persisted on every change rather than on a timer: the writes worth
    // queueing are the ones made when the app is about to be put in a pocket.
    QueueStorage.saveQueue(value).catch((error) =>
      logger.error("Failed to save the sync queue:", error),
    );
  }, []);

  const syncNow = useCallback(() => {
    // **One at a time.** Two drains would send the same writes twice — harmless
    // on the server, which is idempotent, and confusing here, because both
    // would apply reports built from different snapshots.
    if (draining.current) return;
    if (!backendConfig) return;
    if (latest.current.pending.length === 0) return;

    draining.current = true;
    void (async () => {
      /**
       * Round again while writes keep arriving.
       *
       * Anything recorded *during* a drain hits the guard above and is skipped,
       * so without this it would wait for the next foreground — which for a
       * weekly game is a week. The loop ends: every pass either sends or
       * refuses everything it found, so it only goes round for writes made
       * since it started.
       */
      while (latest.current.pending.length > 0) {
        const report = await drain(latest.current, api.send);
        if (report.settled.length > 0 || report.refused.length > 0) {
          update((current) => applyReport(current, report, Date.now()));
        }
        // Unreachable. Going round again just fails the same way; the
        // foreground and sign-in listeners are what try next.
        if (report.stopped) break;
      }
      /**
       * **After the writes, not before.** Pulling first would hand back a board
       * that does not yet contain what this phone just sent, and the merge
       * would then have to be trusted to put it back — which it does, but only
       * for writes still queued. One that settled mid-pull would be in neither.
       */
      wantPull();
    })()
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

  const announce = useCallback(
    (groups: readonly { id: string; name: string; createdAt: number }[]) => {
      if (!backendConfig) return;
      // Safe to repeat: `enqueue` ignores a board already queued, and the server
      // answers *ok* to a group it already has — so this can run on every load
      // without piling up.
      for (const group of groups) {
        record({
          kind: "createGroup",
          groupId: group.id,
          name: group.name,
          createdAt: group.createdAt,
        });
      }
    },
    [record],
  );

  const cancelWrite = useCallback(
    (subject: WriteSubject) => {
      if (!backendConfig) return;
      update((current) => cancel(current, subject));
    },
    [update],
  );

  const cancelWholeBoard = useCallback(
    (groupId: string) => {
      if (!backendConfig) return;
      update((current) => cancelBoard(current, groupId));
    },
    [update],
  );

  const fetchBoard = useCallback(async (groupId: string): Promise<RemoteBoard | null> => {
    if (!backendConfig) return null;
    return api.board(groupId);
  }, []);

  // `latest.current`, so the queue is the one that exists when the merge runs
  // rather than the one that existed when the request went out.
  const mergeInto = useCallback(
    (local: GroupState, remote: RemoteBoard) => mergeBoard(local, remote, latest.current),
    [],
  );

  const myBoards = useCallback(() => api.myBoards(), []);
  const createInvite = useCallback((groupId: string) => api.createInvite(groupId), []);
  const redeemInvite = useCallback(
    (token: string) => api.redeemInvite(token),
    [],
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
      if (next !== "active") return;
      syncNow();
      // Somebody else's phone has had all the time the app was closed to change
      // a board. This is the moment to find out.
      wantPull();
    });
    return () => subscription.remove();
  }, [syncNow]);

  /**
   * And whenever somebody signs in.
   *
   * Every write made while signed out came back *unreachable* — `send` has no
   * token to use — so the queue after a sign-in is exactly the backlog that
   * could not have gone before it.
   */
  useEffect(
    () =>
      onSignedIn(() => {
        syncNow();
        // **Separately from `syncNow`**, which returns at its empty-queue guard
        // long before it reaches `wantPull` — so signing in with nothing waiting
        // to send read no boards at all, which is the ordinary case on a fresh
        // install and exactly when there is most to fetch.
        wantPull();
      }),
    [syncNow, wantPull],
  );

  useEffect(() => {
    let active = true;
    QueueStorage.loadQueue()
      .then((loaded) => {
        if (!active) return;
        /**
         * **Merged under what is already here, not swapped in.**
         *
         * This read races two others: the board loads on its own promise and
         * announces every group, and a person can record something before
         * either lands. Replacing the queue threw those away and then persisted
         * the result over them.
         *
         * The stored writes are the older ones, so they go first and anything
         * recorded meanwhile is enqueued on top — which also dedupes it, since
         * an announce made twice is one write.
         */
        update((current) => {
          const merged = current.pending.reduce(
            (queue, write) => enqueue(queue, write),
            loaded,
          );
          return {
            ...merged,
            refused: [...loaded.refused, ...current.refused].slice(-MAX_REFUSALS),
          };
        });
        // Whatever an earlier session could not send is the first thing to try.
        syncNow();
      })
      .catch((error) => logger.error("Failed to load the sync queue:", error));
    return () => {
      active = false;
    };
    // Once, on mount: `syncNow` and `update` are stable and re-running this
    // would re-read a queue that state already holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoised so consumers can depend on the whole thing without re-running on
  // every render of the provider that holds it.
  return useMemo(
    () => ({
      queue,
      record,
      syncNow,
      acknowledge,
      announce,
      cancel: cancelWrite,
      cancelBoard: cancelWholeBoard,
      fetchBoard,
      mergeInto,
      myBoards,
      createInvite,
      redeemInvite,
      pullsWanted,
    }),
    [
      queue,
      record,
      syncNow,
      acknowledge,
      announce,
      cancelWrite,
      cancelWholeBoard,
      fetchBoard,
      mergeInto,
      myBoards,
      createInvite,
      redeemInvite,
      pullsWanted,
    ],
  );
};
