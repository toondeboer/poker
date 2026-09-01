/**
 * Where a shared leaderboard lives, and who is allowed to touch it.
 *
 * The pure half of the group store: keys, item shapes, the parsing that decides
 * whether a stored row is believed, and the permission rules. **No I/O**, which
 * is what lets every branch be tested without a DynamoDB — and these are the
 * branches worth testing, because a mis-built key is a row nobody can find
 * again and a mis-read role is a permission check that passes.
 *
 * The design this implements is in [SYNC.md](../../SYNC.md).
 */

import type { GameResult, Group, GroupState, Player } from "@poker/core";

/**
 * The inverted index, and the one question it answers: who is in this group?
 *
 * `GSI1PK = sk`, `GSI1SK = pk`, so a membership keyed `ACCOUNT#<sub>` /
 * `GROUP#<id>` is readable from either end. **Nothing authorizes against it** —
 * see the note on the index in `pokerStack.ts`.
 */
export const MEMBERS_INDEX = "MembersByGroup";

/** Roles a membership can hold. Adding is open; removing is not. */
export type Role = "admin" | "member";

/**
 * How long a tombstone is kept.
 *
 * A deletion has to outlive every phone that might still be holding the thing
 * it deleted, or that phone syncs the row back — see SYNC.md. Ninety days is
 * "longer than a season"; a phone that has been away longer full-resyncs
 * instead of merging.
 */
export const TOMBSTONE_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * Epoch milliseconds are 13 digits until the year 2286 — **and 12 or fewer
 * before September 2001**, which is reachable: a result carries the date the
 * game was *played*, and that is a field somebody can set.
 *
 * Unpadded, a backdated game sorts as though it happened last, because
 * `"999999999999" > "1788180000000"` lexicographically. Padding costs nothing
 * and removes a bug whose only symptom is a board in the wrong order.
 */
export const stampSegment = (playedAt: number): string =>
  String(Math.max(0, Math.trunc(playedAt))).padStart(13, "0");

export const groupKey = (groupId: string) => ({
  pk: `GROUP#${groupId}`,
  sk: "META",
});

export const playerKey = (groupId: string, playerId: string) => ({
  pk: `GROUP#${groupId}`,
  sk: `PLAYER#${playerId}`,
});

export const resultKey = (groupId: string, playedAt: number, id: string) => ({
  pk: `GROUP#${groupId}`,
  sk: `RESULT#${stampSegment(playedAt)}#${id}`,
});

/**
 * What an account may do with a group. **The authorization item**, and the only
 * thing a permission check reads — never the index, which is eventually
 * consistent and can therefore still be carrying a role that was revoked.
 */
export const membershipKey = (accountId: string, groupId: string) => ({
  pk: `ACCOUNT#${accountId}`,
  sk: `GROUP#${groupId}`,
});

/**
 * That this account claimed this player. Its **existence** is the fact; the
 * timestamp only decides who inherits a group when its last admin leaves.
 *
 * Under the account rather than the group so that "everything about this
 * person" is one query. Without it, deletion would have to scan every group in
 * the table, and a `Scan` in a deletion path stops working the moment there is
 * real data.
 */
export const claimKey = (
  accountId: string,
  groupId: string,
  playerId: string,
) => ({
  pk: `ACCOUNT#${accountId}`,
  sk: `CLAIM#${groupId}#${playerId}`,
});

/**
 * That this account holds a seat on this board — **one, at most**.
 *
 * Separate from the claim, whose key carries the player and therefore cannot
 * stop somebody claiming a second person in the same group. `@poker/core`'s
 * `claimPlayer` enforces one seat locally and SYNC.md says the server does too;
 * without this item it did not, and one account could quietly occupy half a
 * leaderboard.
 */
export const seatKey = (accountId: string, groupId: string) => ({
  pk: `ACCOUNT#${accountId}`,
  sk: `SEAT#${groupId}`,
});

/**
 * An invite, keyed by its own token so redeeming it is a `GetItem`.
 *
 * **Its own partition, not a row under the group**, because the person
 * redeeming it does not know the group id yet — that is the entire point of
 * being invited. Looking it up any other way would be a scan.
 */
export const inviteKey = (token: string) => ({
  pk: `INVITE#${token}`,
  sk: "META",
});

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

type Keyed = { pk: string; sk: string };

export type GroupItem = Keyed & {
  name: string;
  createdAt: number;
  /** Guards rename and role changes. Results and players do not need one. */
  version: number;
  /**
   * How many admins this group has.
   *
   * **A counter rather than a count of what a query returned**, because the
   * question it answers — "would demoting this person leave nobody in charge?"
   * — has to be settled by a *condition on a write*, not by a read followed by
   * a write. Two admins demoting each other at the same moment both read "there
   * is another admin", both proceed, and the group is left unmanageable with no
   * support channel to fix it.
   *
   * Kept on the group's own item so it is read consistently and updated in the
   * same transaction as the role it counts.
   */
  adminCount: number;
  deletedAt?: number;
  expiresAt?: number;
};

export type PlayerItem = Keyed & {
  playerId: string;
  name: string;
  accountId?: string;
  deletedAt?: number;
  expiresAt?: number;
};

export type ResultItem = Keyed & {
  result?: GameResult;
  playedAt: number;
  deletedAt?: number;
  expiresAt?: number;
};

export type MembershipItem = Keyed & {
  groupId: string;
  accountId: string;
  role: Role;
  joinedAt: number;
};

export const groupItem = (
  groupId: string,
  group: Omit<Group, "id">,
  version: number,
  adminCount = 1,
): GroupItem => ({
  ...groupKey(groupId),
  name: group.name,
  createdAt: group.createdAt,
  version,
  adminCount,
});

export const playerItem = (groupId: string, player: Player): PlayerItem => ({
  ...playerKey(groupId, player.id),
  playerId: player.id,
  name: player.name,
  // Spread rather than always-present: `removeUndefinedValues` would drop it
  // anyway, and an explicit `undefined` here reads as "unclaimed" in a way an
  // absent attribute does not.
  ...(player.accountId ? { accountId: player.accountId } : {}),
});

export const resultItem = (groupId: string, result: GameResult): ResultItem => ({
  ...resultKey(groupId, result.playedAt, result.id),
  result,
  playedAt: result.playedAt,
});

export const membershipItem = (
  accountId: string,
  groupId: string,
  role: Role,
  joinedAt: number,
): MembershipItem => ({
  ...membershipKey(accountId, groupId),
  groupId,
  accountId,
  role,
  joinedAt,
});

/**
 * What a deleted row becomes.
 *
 * **The payload is stripped, and that is deliberate.** A tombstone exists to
 * say "this is gone", and a tombstone that still carries the game it deleted is
 * a deleted game somebody can still read out of the table.
 */
export const tombstone = <T extends Keyed>(
  key: T,
  now: number,
): Keyed & { deletedAt: number; expiresAt: number } => ({
  pk: key.pk,
  sk: key.sk,
  deletedAt: now,
  expiresAt: Math.floor(now / 1000) + TOMBSTONE_TTL_SECONDS,
});

export const isTombstone = (item: unknown): boolean =>
  typeof item === "object" &&
  item !== null &&
  typeof (item as { deletedAt?: unknown }).deletedAt === "number";

// ---------------------------------------------------------------------------
// Reading rows back
// ---------------------------------------------------------------------------

const str = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const isRole = (value: unknown): value is Role =>
  value === "admin" || value === "member";

export const memberFrom = (item: unknown): MembershipItem | null => {
  if (typeof item !== "object" || item === null) return null;
  const row = item as Record<string, unknown>;
  const accountId = str(row.accountId);
  const groupId = str(row.groupId);
  const joinedAt = num(row.joinedAt);
  // A membership with an unreadable role is not a member with no powers — it
  // is a row this code does not understand, and treating it as a `member`
  // would be inventing a permission from a parse failure.
  if (!accountId || !groupId || joinedAt === null || !isRole(row.role)) {
    return null;
  }
  return { ...membershipKey(accountId, groupId), accountId, groupId, role: row.role, joinedAt };
};

/**
 * The board, assembled from one partition query.
 *
 * Tombstones are dropped here rather than by the caller, so there is exactly
 * one place that decides what "deleted" means. A caller that forgot would show
 * a deleted game, which is the failure this whole tombstone scheme exists to
 * avoid in the first place.
 */
export const boardFrom = (
  groupId: string,
  items: readonly unknown[],
): GroupState | null => {
  let group: Group | null = null;
  const players: Player[] = [];
  const results: GameResult[] = [];

  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    const sk = str(row.sk);
    if (!sk) continue;
    if (isTombstone(row)) continue;

    if (sk === "META") {
      const name = str(row.name);
      const createdAt = num(row.createdAt);
      if (name && createdAt !== null) group = { id: groupId, name, createdAt };
    } else if (sk.startsWith("PLAYER#")) {
      const id = str(row.playerId);
      const name = str(row.name);
      const accountId = str(row.accountId);
      if (id && name) players.push({ id, name, ...(accountId ? { accountId } : {}) });
    } else if (sk.startsWith("RESULT#")) {
      const result = row.result;
      if (typeof result === "object" && result !== null) {
        results.push(result as GameResult);
      }
    }
  }

  // No group row means no group. Returning players and results without it would
  // be handing back a board with no identity, which every caller would then
  // have to special-case.
  return group ? { group, players, results } : null;
};

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/**
 * Everything an account can be allowed to do to a group.
 *
 * **Adding is open and removing is not.** Anybody at the table can write down a
 * name; only somebody trusted can make a season's history disappear. It also
 * keeps the permission read on the rare path — recording a game is the weekly
 * action, and it needs only membership.
 */
export type GroupAction =
  | "read"
  | "addPlayer"
  | "recordGame"
  | "claimPlayer"
  | "removePlayer"
  | "removeGame"
  | "rename"
  | "manageAdmins";

const ADMIN_ONLY: ReadonlySet<GroupAction> = new Set<GroupAction>([
  "removePlayer",
  "removeGame",
  "rename",
  "manageAdmins",
]);

/**
 * May this membership do this?
 *
 * `null` is "not a member", and it is refused for everything including `read` —
 * a shared board is readable by the people on it, which is the whole difference
 * between this and a board that is public to anybody holding an id.
 */
export const may = (
  membership: { role: Role } | null,
  action: GroupAction,
): boolean => {
  if (!membership) return false;
  return ADMIN_ONLY.has(action) ? membership.role === "admin" : true;
};

/**
 * Who inherits a group whose last admin is leaving.
 *
 * Longest-standing member by `joinedAt`, with the account id breaking a tie so
 * that two people who joined in the same millisecond do not make this depend on
 * what order DynamoDB happened to return.
 *
 * `null` means nobody is left, and the caller tombstones the group — there is
 * no history belonging to anybody else in it.
 */
/**
 * A name or an id somebody could actually find again.
 *
 * An empty string passes `typeof value === "string"` and is written happily,
 * and then `boardFrom` drops it on every read — a row that exists, answers 200,
 * never appears, and cannot be deleted through an API that addresses it by the
 * id it does not have.
 */
export const isUsableId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && !value.includes("#");

export const heirTo = (
  members: readonly MembershipItem[],
  leaving: string,
): MembershipItem | null => {
  const remaining = members.filter((m) => m.accountId !== leaving);
  if (remaining.length === 0) return null;
  return remaining.reduce((best, candidate) =>
    candidate.joinedAt < best.joinedAt ||
    (candidate.joinedAt === best.joinedAt && candidate.accountId < best.accountId)
      ? candidate
      : best,
  );
};

/**
 * Is this group about to be left with nobody who can manage it?
 *
 * Asked before an admin leaves or is demoted, and the reason the answer matters
 * is that there is no support channel: a group with no admin cannot be renamed,
 * cannot have a player removed, and cannot be fixed by anybody.
 */
export const wouldStrandGroup = (
  members: readonly MembershipItem[],
  leaving: string,
): boolean =>
  members.some((m) => m.accountId === leaving && m.role === "admin") &&
  !members.some((m) => m.accountId !== leaving && m.role === "admin");
