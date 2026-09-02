/**
 * Poker groups: one board per set of friends, and accounts that attach to the
 * people already on it.
 *
 * **Guests are the default, not the exception.** Someone who turns up to one
 * game night on holiday and will never install anything still belongs on the
 * board, so the roster is {@link Player}s — a name and an id — and an account
 * is an optional label on top. The other way round, with accounts as the
 * roster, nobody can be scored until they have downloaded the app, which is
 * exactly backwards for a game played in someone's kitchen.
 *
 * Claiming is therefore additive and lossless: because every {@link GameResult}
 * refers to a player id and never to an account, attaching an account to a
 * player leaves every game that player has ever played exactly where it is, and
 * the account inherits all of it.
 *
 * Framework-agnostic like the rest of @poker/core: ids and timestamps are
 * supplied by the caller, since there is no clock or crypto in here.
 */

import type { GameResult, Player } from "./gameResult";

/** Keep storage small and the picker scannable. */
export const MAX_GROUPS = 20;

export type Group = {
  id: string;
  name: string;
  /** Epoch ms, for stable ordering of groups created in the same session. */
  createdAt: number;
};

/** One group's board: who plays in it, and every game it has recorded. */
export type GroupState = {
  group: Group;
  players: Player[];
  results: GameResult[];
  /**
   * What this phone deleted, so a pull cannot put it back.
   *
   * **A merge cannot see an absence** — that is why the server names its own
   * deletions — and this is the same problem from the other side. Nothing sends
   * a removal to the server (see SYNC.md), so a player deleted here is still in
   * the server's list and absent from *its* deleted list, and a merge would
   * faithfully restore them. A game would come back too, and back into the
   * standings, which is somebody's leaderboard quietly changing on its own.
   *
   * Ids only, and optional: a board saved before this existed has deleted
   * nothing as far as anyone can tell, which is the safe reading.
   */
  deleted?: { players: string[]; results: string[] };
};

/**
 * Every group on this device, and which one is on screen.
 *
 * `activeGroupId` is `null` only when there are no groups at all. Keeping the
 * selection in the persisted state rather than in the UI means the app opens
 * on the board you were last looking at, which for a host with one real group
 * and one "just the lads" group is the difference between the feature being
 * usable and being a chore.
 */
export type GroupedLeaderboard = {
  groups: GroupState[];
  activeGroupId: string | null;
};

/**
 * Frozen, because it is a shared singleton that {@link migrateToGroups} also
 * hands back. An unfrozen one that any consumer pushed into would be corrupt
 * for the rest of the process, and the symptom — a group appearing in a board
 * nobody added it to — would be baffling.
 */
const empty: GroupedLeaderboard = { groups: [], activeGroupId: null };
Object.freeze(empty.groups);
export const EMPTY_LEADERBOARD: GroupedLeaderboard = Object.freeze(empty);

export const createGroup = (params: {
  id: string;
  name: string;
  now: number;
}): Group => ({
  id: params.id,
  name: params.name.trim(),
  createdAt: params.now,
});

/**
 * A group name is usable when it is non-empty and not a case-insensitive
 * duplicate — the same rule player names already follow, and for the same
 * reason: two "Thursday"s are indistinguishable in a picker.
 */
export const isValidGroupName = (
  name: string,
  groups: readonly GroupState[],
  /**
   * The group being renamed, which must not count as a clash with itself —
   * otherwise correcting a group's own capitalisation reports as a duplicate
   * and there is no way for a caller to validate a rename at all.
   */
  excludeGroupId?: string,
): boolean => {
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  return !groups.some(
    (entry) =>
      entry.group.id !== excludeGroupId &&
      entry.group.name.toLowerCase() === trimmed.toLowerCase(),
  );
};

/** Add a group and make it the active one, enforcing {@link MAX_GROUPS}. */
export const addGroup = (
  state: GroupedLeaderboard,
  group: Group,
): GroupedLeaderboard => {
  if (state.groups.length >= MAX_GROUPS) return state;
  return {
    groups: [...state.groups, { group, players: [], results: [] }],
    activeGroupId: group.id,
  };
};

/**
 * Delete a group and everything in it.
 *
 * If it was the one on screen the selection moves to whatever is left, so the
 * app never comes back pointing at a group that no longer exists.
 */
export const removeGroup = (
  state: GroupedLeaderboard,
  groupId: string,
): GroupedLeaderboard => {
  const groups = state.groups.filter((entry) => entry.group.id !== groupId);
  if (groups.length === state.groups.length) return state;
  return {
    groups,
    activeGroupId:
      state.activeGroupId === groupId
        ? (groups[0]?.group.id ?? null)
        : state.activeGroupId,
  };
};

/**
 * Rename a group, holding it to the same rule as creating one.
 *
 * Returns the state untouched when the name is unusable or the group isn't
 * there — the same shape as every other refusal here, so a caller that ignores
 * the result cannot end up with an unnamed group.
 */
export const renameGroup = (
  state: GroupedLeaderboard,
  groupId: string,
  name: string,
): GroupedLeaderboard => {
  if (!state.groups.some((entry) => entry.group.id === groupId)) return state;
  if (!isValidGroupName(name, state.groups, groupId)) return state;
  return {
    ...state,
    groups: state.groups.map((entry) =>
      entry.group.id === groupId
        ? { ...entry, group: { ...entry.group, name: name.trim() } }
        : entry,
    ),
  };
};

/** Switch the board on screen. A group that isn't there is ignored. */
export const setActiveGroup = (
  state: GroupedLeaderboard,
  groupId: string,
): GroupedLeaderboard =>
  state.groups.some((entry) => entry.group.id === groupId)
    ? { ...state, activeGroupId: groupId }
    : state;

/** The group currently on screen, or `null`. */
export const activeGroup = (state: GroupedLeaderboard): GroupState | null =>
  state.groups.find((entry) => entry.group.id === state.activeGroupId) ?? null;

/**
 * Replace one group's board, leaving the others alone.
 *
 * Returns the *same* state object when the group isn't there, rather than an
 * equal copy. Every function here does, so a consumer can compare by reference
 * to decide whether to re-render or write to disk — and a typo in an id shows
 * up as nothing happening rather than as a pointless save.
 */
export const updateGroup = (
  state: GroupedLeaderboard,
  groupId: string,
  update: (entry: GroupState) => GroupState,
): GroupedLeaderboard => {
  if (!state.groups.some((entry) => entry.group.id === groupId)) return state;
  return {
    ...state,
    groups: state.groups.map((entry) =>
      entry.group.id === groupId ? update(entry) : entry,
    ),
  };
};

/** Why an account couldn't be attached to a player. */
export type ClaimError =
  | "no-such-group"
  | "no-such-player"
  /** That player has already been claimed by a different account. */
  | "player-already-claimed"
  /** This account already holds another player in the same group. */
  | "account-already-in-group";

export type ClaimResult =
  | { ok: true; state: GroupedLeaderboard }
  | { ok: false; error: ClaimError };

/**
 * Attach an account to a player who is already on a group's roster.
 *
 * This is the whole point of guests being first class: someone plays for
 * months as a name on somebody else's phone, then signs up, claims themselves,
 * and every result they were ever part of is theirs — because those results
 * were only ever pointing at the player id.
 *
 * Two things are refused rather than resolved, because both mean somebody is
 * about to be scored wrongly and neither has a safe automatic answer:
 *
 * - **A player another account already holds.** Two people cannot both be
 *   Dave. First claim wins; a second needs the first unlinked deliberately.
 * - **An account that already holds someone else in this group.** One person is
 *   one seat at the table, so holding two would double-count their nights and
 *   let them appear twice in the same game's standings.
 *
 * Re-claiming a player the *same* account already holds succeeds unchanged, so
 * a retried request can't fail on its second attempt.
 */
export const claimPlayer = (
  state: GroupedLeaderboard,
  params: { groupId: string; playerId: string; accountId: string },
): ClaimResult => {
  const entry = state.groups.find((g) => g.group.id === params.groupId);
  if (!entry) return { ok: false, error: "no-such-group" };

  const player = entry.players.find((p) => p.id === params.playerId);
  if (!player) return { ok: false, error: "no-such-player" };

  if (player.accountId === params.accountId) {
    return { ok: true, state };
  }
  if (player.accountId !== undefined) {
    return { ok: false, error: "player-already-claimed" };
  }
  if (entry.players.some((p) => p.accountId === params.accountId)) {
    return { ok: false, error: "account-already-in-group" };
  }

  return {
    ok: true,
    state: updateGroup(state, params.groupId, (group) => ({
      ...group,
      players: group.players.map((p) =>
        p.id === params.playerId ? { ...p, accountId: params.accountId } : p,
      ),
    })),
  };
};

/**
 * Detach an account from a player.
 *
 * The player stays, with every game they have played, and goes back to being a
 * guest — which is what makes an accidental claim recoverable rather than
 * something that needs the group rebuilding.
 */
export const unclaimPlayer = (
  state: GroupedLeaderboard,
  params: { groupId: string; playerId: string },
): GroupedLeaderboard => {
  const entry = state.groups.find((g) => g.group.id === params.groupId);
  const player = entry?.players.find((p) => p.id === params.playerId);
  // Nothing to do: no such group, no such player, or they were never claimed.
  if (!player || player.accountId === undefined) return state;

  return updateGroup(state, params.groupId, (group) => ({
    ...group,
    players: group.players.map((player) => {
      if (player.id !== params.playerId) return player;
      // Delete the key rather than setting it undefined, so a round-trip
      // through JSON gives back the same object. Copy-and-delete rather than
      // a rest destructure so that any field Player gains later comes along
      // by itself.
      const rest = { ...player };
      delete rest.accountId;
      return rest;
    }),
  }));
};

/** Which player an account holds in a group, if any. */
export const playerForAccount = (
  state: GroupedLeaderboard,
  groupId: string,
  accountId: string,
): Player | null => {
  const entry = state.groups.find((g) => g.group.id === groupId);
  return entry?.players.find((p) => p.accountId === accountId) ?? null;
};

/**
 * Turn the single-board shape that shipped first into a group.
 *
 * The board that already exists is somebody's real history, so it becomes a
 * group rather than being replaced by one — and it stays selected, so the app
 * opens on exactly what it opened on before. An empty board becomes no groups
 * at all: making a group called "My group" for someone who never used the
 * feature is clutter they then have to delete.
 */
export const migrateToGroups = (
  legacy: { players: Player[]; results: GameResult[] },
  params: { id: string; name: string; now: number },
): GroupedLeaderboard => {
  if (legacy.players.length === 0 && legacy.results.length === 0) {
    return EMPTY_LEADERBOARD;
  }
  const group = createGroup(params);
  return {
    groups: [{ group, players: legacy.players, results: legacy.results }],
    activeGroupId: group.id,
  };
};

/**
 * Put a merged board back where it came from.
 *
 * By id, and a board that is no longer there is simply not added: somebody can
 * delete a group while a pull of it is in flight, and resurrecting it would
 * undo a deletion they just made.
 */
/**
 * Put a whole board on this device — the one somebody just joined.
 *
 * Distinct from `addGroup`, which makes an empty one: a joined board arrives
 * with a roster and a season already in it.
 *
 * **A board already here is replaced rather than duplicated.** Redeeming a link
 * for a board you are already on is an ordinary thing to do — somebody sends it
 * twice, or you tap it again months later — and the server answers happily.
 * Adding a second copy would give the app two boards with one id, which every
 * lookup here resolves by taking the first.
 *
 * **It does not change which board is on screen.** Joining does that, with
 * `setActiveGroup`, because somebody who just tapped a link is looking for that
 * board — but a pull that discovers a board joined on another device must not
 * yank the screen away from whatever is being looked at.
 */
export const addBoard = (
  state: GroupedLeaderboard,
  board: GroupState,
): GroupedLeaderboard => {
  const known = state.groups.some((entry) => entry.group.id === board.group.id);
  if (!known && state.groups.length >= MAX_GROUPS) return state;
  return {
    groups: known
      ? state.groups.map((entry) =>
          entry.group.id === board.group.id ? board : entry,
        )
      : [...state.groups, board],
    // The first board on an empty device has to be the active one, or the app
    // shows nothing at all.
    activeGroupId: state.activeGroupId ?? board.group.id,
  };
};

/** Note that this phone deleted something, so a pull will not restore it. */
export const noteDeleted = (
  board: GroupState,
  what: "players" | "results",
  id: string,
): GroupState => {
  const deleted = board.deleted ?? { players: [], results: [] };
  if (deleted[what].includes(id)) return board;
  return { ...board, deleted: { ...deleted, [what]: [...deleted[what], id] } };
};

/**
 * Put a merged board back where it came from.
 *
 * By id, and a board that is no longer there is simply not added: somebody can
 * delete a group while a pull of it is in flight, and resurrecting it would
 * undo a deletion they just made.
 */
export const replaceBoard = (
  state: GroupedLeaderboard,
  board: GroupState,
): GroupedLeaderboard => ({
  ...state,
  groups: state.groups.map((entry) =>
    entry.group.id === board.group.id ? board : entry,
  ),
});
