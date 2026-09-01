/**
 * Sending what this phone owes the server, in order, and stopping when it
 * cannot.
 *
 * **No I/O.** The sender is injected, so every branch here — a refusal, a
 * timeout, a queue that runs out — is testable without a network, which is
 * where the interesting behaviour is. The app supplies the `fetch`.
 *
 * See `pendingWrites.ts` for what is allowed in the queue and why, and
 * `apps/infra/SYNC.md` for the design.
 */

import { refuse, settle, type QueuedWrite, type SyncQueue } from "./pendingWrites";

/** What came back. */
export type SendResult =
  /** The server has it. */
  | { status: "ok" }
  /** The server understood and said no. This one is never retried. */
  | { status: "refused"; reason: string }
  /**
   * No answer: a timeout, a dropped connection, a plane.
   *
   * **Not the same as a refusal**, and the difference is the whole reason this
   * type has three cases rather than a boolean. A refusal is an answer and
   * retrying it forever is a queue that never drains; silence is not an answer,
   * and dropping the write because of it loses somebody's evening to a bad
   * signal.
   */
  | { status: "unreachable" };

export type Sender = (write: QueuedWrite) => Promise<SendResult>;

/**
 * What happened, as **things to apply** rather than as a finished queue.
 *
 * The obvious shape is to hand back a replacement queue, and it silently loses
 * writes: draining takes as long as the network does, somebody adds a player
 * while it runs, and a caller doing `setQueue(report.queue)` overwrites them
 * with a queue built from a snapshot taken before they existed. Naming what
 * settled and what was refused lets the caller apply it to whatever the queue
 * has become.
 */
export type DrainReport = {
  /** Ids the server took. */
  settled: string[];
  /** Ids the server refused, with what to tell somebody. */
  refused: { id: string; reason: string }[];
  /** True when it gave up early because the server could not be reached. */
  stopped: boolean;
};

/** Fold a drain's outcome into whatever the queue is *now*. */
export const applyReport = (
  queue: SyncQueue,
  report: DrainReport,
  now: number,
): SyncQueue => {
  let current = queue;
  for (const id of report.settled) current = settle(current, id);
  for (const { id, reason } of report.refused) {
    current = refuse(current, id, reason, now);
  }
  // Anything left flagged in flight was flagged by this pass and never
  // answered, so it is not in flight any more.
  return {
    ...current,
    pending: current.pending.map((write) =>
      write.sentAt === undefined ? write : { ...write, sentAt: undefined },
    ),
  };
};

/**
 * Send everything pending, oldest first.
 *
 * **Order matters and the loop stops at the first silence.** A game names the
 * players in it, so a game queued after an add depends on that add having
 * landed — carrying on past an unreachable server would send the game and not
 * the player, and the board would show a game whose winner is nobody. Stopping
 * also means the next attempt starts from the same place rather than a hole.
 *
 * **Everything is retried, including writes marked as sent.** A write stamped
 * in a previous session may or may not have arrived — the phone died before it
 * found out — and the only honest thing to do is send it again. That is safe
 * because the server was built for it: adding a player is an update rather than
 * a replace, and recording a game the server already has answers *ok* rather
 * than a conflict. Idempotence on that side is what lets this side be simple.
 */
export const drain = async (
  queue: SyncQueue,
  send: Sender,
): Promise<DrainReport> => {
  const settled: string[] = [];
  const refusedIds: { id: string; reason: string }[] = [];
  const gone = new Set<string>();

  for (const write of queue.pending) {
    // A refusal takes whatever depended on it out too, so those are never sent.
    if (gone.has(write.id)) continue;

    let result: SendResult;
    try {
      result = await send(write);
    } catch {
      /**
       * **A sender that throws is silence, not a refusal.** React Native's
       * `fetch` rejects on a network failure rather than resolving, and letting
       * that propagate would discard the whole report — including refusals
       * already recorded in this pass, which are answers nobody would get
       * again.
       */
      result = { status: "unreachable" };
    }

    if (result.status === "ok") {
      settled.push(write.id);
      continue;
    }
    if (result.status === "refused") {
      refusedIds.push({ id: write.id, reason: result.reason });
      gone.add(write.id);
      // Mirrors `refuse`: a game naming a player the server just refused is not
      // a partial success, it is a worse outcome than sending neither.
      for (const other of queue.pending) {
        if (dependsOn(other, write)) gone.add(other.id);
      }
      continue;
    }

    // Unreachable, so stop: everything behind this may depend on it.
    return { settled, refused: refusedIds, stopped: true };
  }

  return { settled, refused: refusedIds, stopped: false };
};

/** Does this write need that one to have landed first? */
const dependsOn = (write: QueuedWrite, other: QueuedWrite): boolean =>
  write.kind === "recordGame" &&
  other.kind === "addPlayer" &&
  write.groupId === other.groupId &&
  write.result.playerIds.includes(other.player.id);
