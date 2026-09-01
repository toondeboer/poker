/**
 * What this phone has done to a shared board and not yet told the server.
 *
 * The board lives on the server, so this is not a merge and deliberately not a
 * CRDT: local state is a **cache plus a queue**. The server's copy is the truth,
 * and everything here is "things I did that it has not heard about yet",
 * replayed in order when there is a connection.
 *
 * That works because of how the boundary was drawn — an action is allowed
 * offline when the worst case is that it merges *late*, and refused when the
 * worst case is that it merges *wrongly*. Claiming a player is the refusal:
 * two people claiming the same person on two offline phones cannot both be
 * right, and resolving it afterwards means telling somebody they are not who
 * they said they were. See `apps/infra/SYNC.md`.
 *
 * **No I/O here.** The app sends these; this decides what is in the queue, what
 * a board looks like with them applied, and what happens when one comes back
 * refused.
 */

import type { GameResult, Player } from "../leaderboard/gameResult";
import type { GroupState } from "../leaderboard/groups";

/**
 * One thing done to a board, waiting to be sent.
 *
 * Deliberately the *intent* rather than the resulting state. A queue of
 * "the board now looks like this" cannot be replayed against a server that has
 * moved on; a queue of "I added Ann" can.
 */
export type PendingWrite =
  | { kind: "addPlayer"; groupId: string; player: Player }
  | { kind: "removePlayer"; groupId: string; playerId: string }
  | { kind: "recordGame"; groupId: string; result: GameResult }
  | { kind: "removeGame"; groupId: string; gameId: string }
  | { kind: "claimPlayer"; groupId: string; playerId: string }
  | { kind: "releasePlayer"; groupId: string; playerId: string };

export type QueuedWrite = PendingWrite & {
  /** Stable across retries, so a resend is recognisably the same write. */
  id: string;
  queuedAt: number;
};

/** Why the server would not take a write, in words a person can act on. */
export type RefusedWrite = {
  write: QueuedWrite;
  reason: string;
  refusedAt: number;
};

export type SyncQueue = {
  pending: QueuedWrite[];
  /**
   * Writes the server refused.
   *
   * **Kept rather than dropped.** A write is checked when it *syncs*, not when
   * it was made, so a game recorded on Tuesday can be refused on Thursday
   * because an admin removed you on Wednesday. Silently discarding it loses
   * somebody's evening; silently applying it is a lie. It has to be somewhere a
   * person can see.
   */
  refused: RefusedWrite[];
};

export const EMPTY_QUEUE: SyncQueue = Object.freeze({
  // Frozen for the same reason `EMPTY_LEADERBOARD` is: it is a shared
  // singleton, and anything that pushed into it would corrupt every queue for
  // the rest of the process — with a symptom (a write appearing in a queue
  // nobody enqueued it into) that gives no hint where it came from.
  pending: Object.freeze([]) as readonly QueuedWrite[] as QueuedWrite[],
  refused: Object.freeze([]) as readonly RefusedWrite[] as RefusedWrite[],
});

/** What a write is about, for collapsing a queue. */
const subjectOf = (write: PendingWrite): string => {
  switch (write.kind) {
    case "addPlayer":
      return `player:${write.groupId}:${write.player.id}`;
    case "removePlayer":
    case "claimPlayer":
    case "releasePlayer":
      return `player:${write.groupId}:${write.playerId}`;
    case "recordGame":
      return `game:${write.groupId}:${write.result.id}`;
    case "removeGame":
      return `game:${write.groupId}:${write.gameId}`;
  }
};

/**
 * Add a write, collapsing what the queue already holds about the same thing.
 *
 * A phone offline for an evening can queue "add Ann", "record a game", "remove
 * Ann" — and sending all three is three round trips to reach a state the server
 * could have been told once. Worse, it is three chances to fail.
 *
 * The rules are narrow on purpose:
 *
 * - **Adding then removing the same player cancels both**, but only if the add
 *   is still pending. If the add already reached the server, the removal is
 *   real work and has to go.
 * - **A later claim or release replaces an earlier one** for the same player —
 *   only the last one means anything.
 * - Everything else is appended. Collapsing more would mean reasoning about
 *   what the server has seen, which is exactly the reasoning this queue exists
 *   to avoid.
 */
export const enqueue = (queue: SyncQueue, write: QueuedWrite): SyncQueue => {
  const subject = subjectOf(write);
  const sameSubject = queue.pending.filter((q) => subjectOf(q) === subject);

  // Removing something this phone has not managed to create yet: neither write
  // needs to happen at all.
  if (
    (write.kind === "removePlayer" &&
      sameSubject.some((q) => q.kind === "addPlayer")) ||
    (write.kind === "removeGame" && sameSubject.some((q) => q.kind === "recordGame"))
  ) {
    return {
      ...queue,
      pending: queue.pending.filter((q) => subjectOf(q) !== subject),
    };
  }

  // Only the last word on a claim counts.
  if (write.kind === "claimPlayer" || write.kind === "releasePlayer") {
    return {
      ...queue,
      pending: [
        ...queue.pending.filter(
          (q) =>
            subjectOf(q) !== subject ||
            (q.kind !== "claimPlayer" && q.kind !== "releasePlayer"),
        ),
        write,
      ],
    };
  }

  return { ...queue, pending: [...queue.pending, write] };
};

/** It reached the server. */
export const settle = (queue: SyncQueue, id: string): SyncQueue => ({
  ...queue,
  pending: queue.pending.filter((write) => write.id !== id),
});

/**
 * The server refused it.
 *
 * Off the queue — retrying a refusal forever is a queue that never drains and a
 * phone that never syncs anything behind it — and onto a list somebody can be
 * shown.
 */
export const refuse = (
  queue: SyncQueue,
  id: string,
  reason: string,
  now: number,
): SyncQueue => {
  const write = queue.pending.find((w) => w.id === id);
  if (!write) return queue;
  return {
    pending: queue.pending.filter((w) => w.id !== id),
    refused: [...queue.refused, { write, reason, refusedAt: now }],
  };
};

/** Somebody has read the bad news. */
export const dismiss = (queue: SyncQueue, id: string): SyncQueue => ({
  ...queue,
  refused: queue.refused.filter((r) => r.write.id !== id),
});

/**
 * The board as this phone should draw it: the server's copy, plus what has not
 * reached it yet.
 *
 * **Applied on read rather than written into the cache.** Writing them in would
 * mean the cache and the server disagreeing with no record of why, and a
 * refused write would have to be *unpicked* from state somebody has since
 * changed. Kept separate, a refusal is just a queue entry that stops being
 * applied.
 */
export const withPending = (
  board: GroupState,
  queue: SyncQueue,
  accountId: string | null,
): GroupState => {
  let players = [...board.players];
  let results = [...board.results];

  for (const write of queue.pending) {
    if (write.groupId !== board.group.id) continue;
    switch (write.kind) {
      case "addPlayer":
        // Not if the server already has them: a replayed add would otherwise
        // show the same person twice until the next fetch.
        if (!players.some((p) => p.id === write.player.id)) {
          players = [...players, write.player];
        }
        break;
      case "removePlayer":
        players = players.filter((p) => p.id !== write.playerId);
        break;
      case "recordGame":
        if (!results.some((r) => r.id === write.result.id)) {
          results = [...results, write.result];
        }
        break;
      case "removeGame":
        results = results.filter((r) => r.id !== write.gameId);
        break;
      case "claimPlayer":
        players = players.map((p) =>
          p.id === write.playerId && accountId ? { ...p, accountId } : p,
        );
        break;
      case "releasePlayer":
        players = players.map((p) =>
          p.id === write.playerId ? { id: p.id, name: p.name } : p,
        );
        break;
    }
  }

  // Same order the server would give: by when the game was played, id breaking
  // a tie, so a pending game does not jump to the end and then move once it
  // syncs.
  results.sort((a, b) => a.playedAt - b.playedAt || (a.id < b.id ? -1 : 1));
  return { ...board, players, results };
};

/** Is there anything to send for this board? */
export const hasPendingFor = (queue: SyncQueue, groupId: string): boolean =>
  queue.pending.some((write) => write.groupId === groupId);
