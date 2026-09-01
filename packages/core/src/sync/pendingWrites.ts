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
 * ## The queue is an outbox, not the only copy
 *
 * **A write goes into the local board *and* into this queue**, and that
 * ordering matters more than it looks. If the queue were the only record of an
 * offline write, it would be storing somebody's evening — and the recovery
 * screen, which clears the queue and promises the leaderboard survives, would
 * be quietly lying. Writing the board first makes the queue purely "and tell
 * the server", so losing it costs the *news*, never the night.
 *
 * That is also what {@link withPending} is for: after a fetch, the server's copy
 * does not yet contain what has not been sent, so the two are combined on read
 * rather than the fetch overwriting local state.
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
  | { kind: "recordGame"; groupId: string; result: GameResult };

/**
 * **Only additive writes, and that is the whole of it.**
 *
 * Two earlier versions of this file were wider, and both contradicted the
 * design in `apps/infra/SYNC.md` that its own header cites:
 *
 * - **Claiming a player** was queueable. Two people claiming the same person on
 *   two offline phones cannot both be right; both would have been shown the
 *   player as theirs until one came back refused, long after somebody was given
 *   an answer. Merging late and merging wrongly are the same thing here.
 * - **Removing a player or a game** was queueable. Removal is destructive and
 *   admin-only, so an offline removal hides something immediately on one phone
 *   and may be refused days later — and until then that phone is the only place
 *   where the board looks like that.
 *
 * Adding is the safe direction: the worst case is that a player or a game turns
 * up on everybody else's board later than it did on yours. Keeping the queue to
 * that removed the collapse rules, the dependency guard they needed, and both
 * classes of bug the wider versions had.
 */
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

/** What a write is about. Two writes about the same thing are one write. */
const subjectOf = (write: PendingWrite): string =>
  write.kind === "addPlayer"
    ? `player:${write.groupId}:${write.player.id}`
    : `game:${write.groupId}:${write.result.id}`;

/**
 * Does this write depend on that one having landed first?
 *
 * Exported because `drain` needs the same answer, and a second copy that drifted
 * would silently send a game naming a player whose add was refused.
 */
export const dependsOn = (write: QueuedWrite, other: QueuedWrite): boolean =>
  write.kind === "recordGame" &&
  other.kind === "addPlayer" &&
  write.groupId === other.groupId &&
  write.result.playerIds.includes(other.player.id);

/**
 * Add a write, unless the queue already says the same thing.
 *
 * **The only rule left is idempotence**, and it is here rather than left to the
 * caller because a phone that queues the same add twice sends it twice, and the
 * second one comes back as a refusal about a player who is perfectly fine.
 *
 * Earlier versions collapsed an add against a later removal, which needed a
 * guard against orphaning a game that named the player, and another against
 * cancelling a write already on its way. Narrowing the queue to additive writes
 * deleted all of it: there is no removal to collapse against.
 */
export const enqueue = (queue: SyncQueue, write: QueuedWrite): SyncQueue => {
  const subject = subjectOf(write);
  if (queue.pending.some((q) => subjectOf(q) === subject)) return queue;
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

  /**
   * Anything that needed it takes the refusal with it.
   *
   * A refused `addPlayer` leaves a queued game naming somebody the server has
   * never heard of — nothing validates `playerIds`, and `computeStandings`
   * skips ids it does not know, so the board would keep a game whose winner is
   * nobody. Sending the game after its player was refused is not a partial
   * success; it is a worse outcome than sending neither.
   */
  const orphaned = queue.pending.filter((w) => dependsOn(w, write));
  const casualties = [write, ...orphaned];
  const ids = new Set(casualties.map((w) => w.id));

  return {
    pending: queue.pending.filter((w) => !ids.has(w.id)),
    refused: [
      ...queue.refused,
      ...casualties.map((casualty) => ({
        write: casualty,
        reason:
          casualty.id === id
            ? reason
            : `not sent, because the player it names was refused: ${reason}`,
        refusedAt: now,
      })),
    ],
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
      case "recordGame":
        if (!results.some((r) => r.id === write.result.id)) {
          results = [...results, write.result];
        }
        break;
    }
  }

  /**
   * **Newest first**, which is the order the app has always kept results in —
   * `addGameResult` prepends, and `playedAt` is documented as "newest-first
   * ordering". An ascending sort here reversed the whole history on screen even
   * with an empty queue.
   *
   * The id breaks a tie so two games recorded in the same millisecond do not
   * swap places between renders, and equal ids compare equal rather than
   * claiming an order that does not exist.
   */
  results.sort(
    (a, b) =>
      b.playedAt - a.playedAt || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1),
  );
  return { ...board, players, results };
};

/** Is there anything to send for this board? */
export const hasPendingFor = (queue: SyncQueue, groupId: string): boolean =>
  queue.pending.some((write) => write.groupId === groupId);
