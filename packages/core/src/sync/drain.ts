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

import {
  markSending,
  refuse,
  release,
  settle,
  type QueuedWrite,
  type SyncQueue,
} from "./pendingWrites";

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

export type DrainReport = {
  queue: SyncQueue;
  sent: number;
  refused: number;
  /** True when it gave up early because the server could not be reached. */
  stopped: boolean;
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
  now: () => number,
): Promise<DrainReport> => {
  let current = queue;
  let sent = 0;
  let refused = 0;

  // A copy, because `current` is rebuilt as writes settle and a refusal can
  // take dependants out of it. Skipping anything already gone is what keeps
  // those two facts from disagreeing.
  const toSend = [...queue.pending];

  for (const write of toSend) {
    if (!current.pending.some((w) => w.id === write.id)) continue;

    current = markSending(current, write.id, now());
    const result = await send(write);

    if (result.status === "ok") {
      current = settle(current, write.id);
      sent += 1;
      continue;
    }
    if (result.status === "refused") {
      const before = current.refused.length;
      current = refuse(current, write.id, result.reason, now());
      // Counted from the queue rather than as one, because a refusal takes
      // whatever depended on it down too.
      refused += current.refused.length - before;
      continue;
    }

    // Unreachable. Put it back so it does not look like it is still in flight,
    // and stop: everything behind it may depend on it.
    return { queue: release(current, write.id), sent, refused, stopped: true };
  }

  return { queue: current, sent, refused, stopped: false };
};
