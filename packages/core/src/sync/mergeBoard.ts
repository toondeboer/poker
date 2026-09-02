/**
 * Putting the server's copy of a board together with this phone's.
 *
 * **A merge, never a replacement.** The obvious version — take what the server
 * says and overwrite — loses a season of game nights the first time a board
 * syncs, because a board that predates syncing has a history the server has
 * never been told about. Nothing announces that history yet (see
 * `SYNC.md`), so the server's copy of an old board is legitimately emptier than
 * the phone's, and trusting it would delete somebody's year.
 *
 * The cost of merging is that a merge cannot see an absence: a player missing
 * from the server's list might have been removed by an admin, or might simply
 * never have got there. So removals are not inferred — the server names them,
 * and only a named one is applied.
 *
 * The order is: everything both sides have, minus what the server says was
 * deleted, plus what this phone has not managed to send yet. That last part is
 * what stops a game recorded thirty seconds ago from vanishing off the screen
 * the moment a pull lands.
 */

import type { GameResult, Player } from "../leaderboard/gameResult";
import type { GroupState } from "../leaderboard/groups";
import { withPending, type SyncQueue } from "./pendingWrites";

/**
 * What the server says has been removed from a board.
 *
 * Ids only — a tombstone has had its payload stripped so a deleted game cannot
 * be read back out of the table.
 */
export type Deletions = { players: readonly string[]; results: readonly string[] };

export const NOTHING_DELETED: Deletions = Object.freeze({
  players: Object.freeze([]) as readonly string[],
  results: Object.freeze([]) as readonly string[],
});

/** The board as the server sees it, plus what it says is gone. */
export type RemoteBoard = { state: GroupState; deleted: Deletions };

const byId = <T extends { id: string }>(
  mine: readonly T[],
  theirs: readonly T[],
): T[] => {
  const merged = new Map<string, T>();
  /**
   * **Mine first, and that is about order as much as about winning.**
   *
   * Seeding from the server's list put the roster back in whatever order
   * DynamoDB returned the keys in, so the players visibly reshuffled the first
   * time a board pulled — neither render site sorts. Going this way round keeps
   * the order somebody is used to and appends anything new to the end.
   *
   * Mine also wins a collision, which is the same call as before: the two only
   * disagree about a player's name, and the phone in somebody's hand is the one
   * that was just typed into. A game is immutable, so results never reach this.
   */
  for (const item of mine) merged.set(item.id, item);
  for (const item of theirs) if (!merged.has(item.id)) merged.set(item.id, item);
  // `Array.from` rather than spreading the iterator: core targets a lib without
  // downlevel iteration, so spreading a `MapIterator` does not compile.
  return Array.from(merged.values());
};

export const mergeBoard = (
  local: GroupState,
  remote: RemoteBoard,
  queue: SyncQueue,
): GroupState => {
  /**
   * **Both sides' deletions, not just the server's.**
   *
   * Nothing sends a removal to the server yet, so a player deleted on this
   * phone is still in the server's list and absent from *its* deleted list — and
   * a merge that trusted only the server would faithfully restore them on the
   * next foreground. A deleted game would come back into the standings, which
   * is somebody's leaderboard changing on its own.
   */
  const goneP = new Set([...remote.deleted.players, ...(local.deleted?.players ?? [])]);
  const goneR = new Set([...remote.deleted.results, ...(local.deleted?.results ?? [])]);

  const players = byId<Player>(local.players, remote.state.players).filter(
    (player) => !goneP.has(player.id),
  );
  const results = byId<GameResult>(local.results, remote.state.results).filter(
    (result) => !goneR.has(result.id),
  );

  const merged: GroupState = {
    /**
     * **The local name wins, and that is not a preference — it is the only
     * option.** There is no route that renames a board, so the server's name is
     * whatever it was created with and can never be anything else. Taking it
     * would revert somebody's rename on the next foreground, over and over.
     *
     * Two members can therefore see different names for the same board. That is
     * the honest state of the feature until a rename route exists; SYNC.md says
     * so under known gaps.
     */
    group: local.group,
    players,
    results,
    ...(local.deleted ? { deleted: local.deleted } : {}),
  };

  /**
   * **Last, and this is the part that is easy to get wrong.** A pull can land
   * between recording a game and the outbox sending it, and without this the
   * game disappears off the screen for as long as that takes — which looks
   * exactly like the app having lost it.
   *
   * `withPending` also does the newest-first sort, so the board comes back in
   * the order the rest of the app draws it in.
   */
  return withPending(merged, queue);
};

// ---------------------------------------------------------------------------
// Reading what came back
// ---------------------------------------------------------------------------

const str = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];

const isPlayer = (value: unknown): value is Player => {
  const p = value as Player | null;
  return (
    typeof p === "object" &&
    p !== null &&
    typeof p.id === "string" &&
    typeof p.name === "string"
  );
};

const isResult = (value: unknown): value is GameResult => {
  const r = value as (GameResult & Record<string, unknown>) | null;
  return (
    typeof r === "object" &&
    r !== null &&
    typeof r.id === "string" &&
    typeof r.playedAt === "number" &&
    Array.isArray(r.playerIds) &&
    r.playerIds.every((id) => typeof id === "string") &&
    Array.isArray(r.placings) &&
    r.placings.every(
      (p) =>
        typeof p?.playerId === "string" &&
        typeof p?.place === "number" &&
        typeof p?.winnings === "number",
    ) &&
    typeof r.buyIn === "number" &&
    typeof r.bounty === "number" &&
    (r.knockouts === undefined ||
      (Array.isArray(r.knockouts) &&
        r.knockouts.every(
          (k) =>
            typeof k?.playerId === "string" &&
            typeof k?.count === "number" &&
            typeof k?.bounty === "number",
        )))
  );
};

/**
 * Read a board out of what the API answered.
 *
 * **Validated rather than cast**, because this is the first thing in the app to
 * take a whole board from somewhere other than its own storage, and it is going
 * to be merged into the one store whose contents nobody can retype. A row that
 * cannot be read is dropped and the rest is kept, exactly as
 * `syncQueueStorage` does: one bad game must not cost a season.
 *
 * `null` only when there is no board at all — no group means nothing to merge
 * into, and merging into a board with no identity would be a board that every
 * caller has to special-case.
 */
export const readRemoteBoard = (value: unknown): RemoteBoard | null => {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  const group = body.group as Record<string, unknown> | undefined;
  const id = str(group?.id);
  const name = str(group?.name);
  const createdAt = group?.createdAt;
  if (!id || !name || typeof createdAt !== "number") return null;

  const deleted = body.deleted as Record<string, unknown> | undefined;
  return {
    state: {
      group: { id, name, createdAt },
      players: Array.isArray(body.players) ? body.players.filter(isPlayer) : [],
      results: Array.isArray(body.results) ? body.results.filter(isResult) : [],
    },
    // **Absent means nothing was deleted, not "unknown".** An older server that
    // does not send this yet is one whose boards have had nothing removed as
    // far as this phone can tell, and guessing otherwise deletes local rows.
    deleted: {
      players: ids(deleted?.players),
      results: ids(deleted?.results),
    },
  };
};
