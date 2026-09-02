/**
 * Where a shared leaderboard lives, and who is allowed to touch it.
 *
 * The pure half of the group store: keys, item shapes, the parsing that decides
 * whether a stored row is believed, and the permission rules. **No I/O**, which
 * is what lets every branch be tested without a DynamoDB.
 *
 * ## This is the second schema, and the first one is why
 *
 * The first had a single membership row plus an inverted index, a `SEAT#` item
 * to stop one account holding two players, and an `adminCount` on the group.
 * Three review rounds found the same class of bug over and over, because every
 * one of those is an invariant held together **by hand** — across a counter, a
 * second item and an eventually consistent index — and fixing one kept breaking
 * another.
 *
 * They are structural now:
 *
 * - **One seat per board is the shape of a key.** `CLAIM#<groupId>` holds the
 *   player, instead of `CLAIM#<groupId>#<playerId>` needing a separate `SEAT#`
 *   row to enforce what the key could enforce by itself.
 * - **Membership is written twice**, under the account and under the group.
 *   That is the duplication the first design rejected, and it was the wrong
 *   call: two rows in one transaction are less to keep honest than a counter, a
 *   sparse index attribute and a read that might be stale. It also makes "who is
 *   in this group" a **strongly consistent** query, so the decisions resting on
 *   it stop being races.
 * - **There is no `adminCount`.** "Is there another admin?" is answered by
 *   naming one and asserting inside the same transaction that they still are —
 *   a `ConditionCheck`, which cannot be raced, rather than a number four
 *   separate paths had to remember to move.
 * - **There is no index**, which also removes a hot partition: the obvious
 *   inverted one partitioned on `sk`, and every poker table row carries the
 *   constant `sk: "STATE"`.
 *
 * The design is in [SYNC.md](../../SYNC.md).
 */

import type { GameResult, Group, GroupState, Player } from "@poker/core";

/** Roles a membership can hold. Adding is open; removing is not. */
export type Role = "admin" | "member";

/**
 * How long a tombstone is kept.
 *
 * A deletion has to outlive every phone that might still hold the thing it
 * deleted, or that phone syncs the row back. Ninety days is "longer than a
 * season"; a phone away longer than that full-resyncs instead of merging.
 */
export const TOMBSTONE_TTL_SECONDS = 90 * 24 * 60 * 60;

export const groupKey = (groupId: string) => ({
  pk: `GROUP#${groupId}`,
  sk: "META",
});

export const playerKey = (groupId: string, playerId: string) => ({
  pk: `GROUP#${groupId}`,
  sk: `PLAYER#${playerId}`,
});

/**
 * A game, keyed by **its id alone**.
 *
 * The obvious key is `RESULT#<playedAt>#<id>`, so the partition comes back in
 * time order for free. It is wrong, and subtly: it makes a game's identity
 * `(playedAt, id)`, so the *same* id posted with a different `playedAt` writes a
 * **second row** — standings count the night twice, and deleting removes only
 * whichever copy matches the body. `attribute_not_exists(pk)` cannot make an id
 * unique when the id is not the key.
 *
 * Keyed by id, uniqueness is structural. Ordering moves into `boardFrom`, which
 * costs a sort over a season of game nights — tens of rows, not thousands — and
 * it means deleting a game needs only its id rather than the client also
 * handing back the exact `playedAt` the row was written under.
 */
export const resultKey = (groupId: string, id: string) => ({
  pk: `GROUP#${groupId}`,
  sk: `RESULT#${id}`,
});

/**
 * A membership, seen from the group. **The consistent one.**
 *
 * Every decision about who may do what, and about whether a group is about to
 * be left with nobody in charge, is answered from this side — a query on the
 * group's own partition, strongly consistent. The account-side copy answers "my
 * boards" and nothing that matters.
 */
export const memberKey = (groupId: string, accountId: string) => ({
  pk: `GROUP#${groupId}`,
  sk: `MEMBER#${accountId}`,
});

/** The same membership, seen from the account. Answers "my boards". */
export const membershipKey = (accountId: string, groupId: string) => ({
  pk: `ACCOUNT#${accountId}`,
  sk: `GROUP#${groupId}`,
});

/**
 * The one player this account holds on this board.
 *
 * **Keyed by the group, not the group and the player.** One seat per board is
 * then the shape of the key: a second claim collides with the first and is
 * refused by `attribute_not_exists`, with nothing to keep in step. The previous
 * shape carried the player id here and needed a separate `SEAT#` row to enforce
 * the same rule — which then had to be created, deleted and reasoned about
 * everywhere a claim was.
 */
export const claimKey = (accountId: string, groupId: string) => ({
  pk: `ACCOUNT#${accountId}`,
  sk: `CLAIM#${groupId}`,
});

/**
 * An invite, keyed by its own token so redeeming it is a `GetItem`.
 *
 * Its own partition because whoever is redeeming it does not know the group id
 * yet — that is the entire point of being invited.
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
  /** Guards a rename. Players and results do not need one. */
  version: number;
  inviteToken?: string;
  deletedAt?: number;
  expiresAt?: number;
};

export type MemberItem = Keyed & {
  groupId: string;
  accountId: string;
  role: Role;
  joinedAt: number;
};

export const groupItem = (
  groupId: string,
  group: Omit<Group, "id">,
  version = 1,
): GroupItem => ({
  ...groupKey(groupId),
  name: group.name,
  createdAt: group.createdAt,
  version,
});

export const playerItem = (groupId: string, player: Player) => ({
  ...playerKey(groupId, player.id),
  playerId: player.id,
  name: player.name,
  ...(player.accountId ? { accountId: player.accountId } : {}),
});

export const resultItem = (groupId: string, result: GameResult) => ({
  ...resultKey(groupId, result.id),
  result,
  playedAt: result.playedAt,
});

/** The group-side copy — the one every decision reads. */
export const memberItem = (
  groupId: string,
  accountId: string,
  role: Role,
  joinedAt: number,
): MemberItem => ({
  ...memberKey(groupId, accountId),
  groupId,
  accountId,
  role,
  joinedAt,
});

/** The account-side copy — the one that answers "my boards". */
export const membershipItem = (
  accountId: string,
  groupId: string,
  role: Role,
  joinedAt: number,
): MemberItem => ({
  ...membershipKey(accountId, groupId),
  groupId,
  accountId,
  role,
  joinedAt,
});

/**
 * What a deleted row becomes.
 *
 * **The payload is stripped**, because a tombstone still carrying the game it
 * deleted is a deleted game somebody can read out of the table.
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

/**
 * A name or an id somebody could actually find again.
 *
 * An empty string passes `typeof value === "string"`, is written happily, and
 * is then dropped on every read — a row that exists, answered 200, never
 * appears, and cannot be deleted through an API that addresses it by the id it
 * does not have. A `#` would break the key it lands in.
 */
export const isUsableId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && !value.includes("#");

export const memberFrom = (item: unknown): MemberItem | null => {
  if (typeof item !== "object" || item === null) return null;
  const row = item as Record<string, unknown>;
  const accountId = str(row.accountId);
  const groupId = str(row.groupId);
  const joinedAt = num(row.joinedAt);
  // A membership with an unreadable role is not a member with no powers — it is
  // a row this code does not understand, and treating it as a `member` would be
  // inventing a permission from a parse failure.
  if (!accountId || !groupId || joinedAt === null || !isRole(row.role)) return null;
  return memberItem(groupId, accountId, row.role, joinedAt);
};

/** Everyone in a group, from a query of its own partition. */
export const membersFrom = (items: readonly unknown[]): MemberItem[] =>
  items
    .filter(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { sk?: unknown }).sk === "string" &&
        (item as { sk: string }).sk.startsWith("MEMBER#"),
    )
    .map(memberFrom)
    .filter((m): m is MemberItem => m !== null);

/**
 * The board, assembled from one partition query.
 *
 * Tombstones are dropped here rather than by the caller, so exactly one place
 * decides what "deleted" means — and `MEMBER#` rows are dropped too: who is in
 * the group is a different question from what is on the board, and they share a
 * partition only because that is what makes both consistent.
 */
/**
 * What a board has had removed, so a phone can remove it too.
 *
 * **A pull that only carried what exists could never propagate a deletion.** A
 * phone merges what it is given into what it already has — it has to, or a
 * board's local history would be wiped the first time it synced against a
 * server that had never been told about it — and a merge by definition cannot
 * see an absence. So the absences are sent explicitly.
 *
 * The ids alone: a tombstone has had its payload stripped, deliberately, so a
 * deleted game cannot be read back out of the table.
 *
 * **Bounded by the tombstone TTL** (90 days). A phone that has not synced in
 * longer than that can miss a deletion, which is the known gap in SYNC.md that
 * a full resync is the answer to.
 */
export type Deletions = { players: string[]; results: string[] };

export const deletionsFrom = (items: readonly unknown[]): Deletions => {
  const players: string[] = [];
  const results: string[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    const sk = str(row.sk);
    if (!sk || !isTombstone(row)) continue;
    if (sk.startsWith("PLAYER#")) players.push(sk.slice("PLAYER#".length));
    else if (sk.startsWith("RESULT#")) results.push(sk.slice("RESULT#".length));
  }
  return { players, results };
};

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
    if (!sk || isTombstone(row)) continue;

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

  // No group row means no group. Players and results without it are a board
  // with no identity that every caller would have to special-case.
  if (!group) return null;
  /**
   * Sorted here rather than by the key, because the key is the game's id — see
   * `resultKey` for why that is worth a sort.
   *
   * **Newest first, matching the app.** `addGameResult` prepends and `playedAt`
   * is documented as "newest-first ordering", so a server sorting the other way
   * hands back a history that renders backwards the moment a phone reads it.
   * The id breaks a tie, and equal ids compare equal.
   */
  results.sort(
    (a, b) => b.playedAt - a.playedAt || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1),
  );
  return { group, players, results };
};

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

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
 * **Adding is open and removing is not.** Anybody at the table can write down a
 * name; only somebody trusted can make a season's history disappear. It also
 * keeps the permission read on the rare path — recording a game is the weekly
 * action.
 *
 * `null` is "not a member", refused for everything including `read`: a shared
 * board readable by anybody holding an id makes the id the only thing
 * protecting it, and ids travel.
 */
export const may = (
  membership: { role: Role } | null,
  action: GroupAction,
): boolean => {
  if (!membership) return false;
  return ADMIN_ONLY.has(action) ? membership.role === "admin" : true;
};

/**
 * Another admin, if there is one — the one a write will assert is still there.
 *
 * **Named rather than counted.** "Is there another admin?" answered as a number
 * is a read somebody can invalidate before the write lands. Answered as a
 * *specific account*, it becomes a `ConditionCheck` in the same transaction,
 * which cannot be raced: two admins demoting each other at the same instant
 * each assert the other is still an admin, and exactly one wins.
 */
export const anotherAdmin = (
  members: readonly MemberItem[],
  besides: string,
): MemberItem | null =>
  members.find((m) => m.accountId !== besides && m.role === "admin") ?? null;

/**
 * Who inherits a group whose last admin is leaving.
 *
 * Longest-standing member by `joinedAt`, with the account id breaking a tie so
 * two people who joined in the same millisecond do not make this depend on what
 * order DynamoDB happened to return them in.
 */
export const heirTo = (
  members: readonly MemberItem[],
  leaving: string,
): MemberItem | null => {
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
 * Are these the same game, as far as anybody can tell?
 *
 * **Not `JSON.stringify`, which was the bug.** That compares key *order*, and a
 * game read back from DynamoDB has whatever order the attribute map felt like:
 * a `placings` entry sent as `{playerId, place, winnings}` came back as
 * `{playerId, winnings, place}`. So a replayed game — the ordinary case, since
 * a phone re-sends anything whose answer went missing — never matched itself,
 * and the caller was told 409 for a game that had saved perfectly. Its client
 * reads that as a permanent refusal and throws away the evening.
 *
 * Arrays stay ordered, because `placings` *is* an order — first place is not
 * third place. Absent and `undefined` compare equal, because the document
 * client drops undefined on the way in, so a field the client sent as
 * `undefined` comes back missing rather than null.
 */
export const sameGame = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameGame(item, b[index]))
    );
  }
  if (typeof a !== "object" || typeof b !== "object") return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    // An absent key and an explicit `undefined` are the same thing here: the
    // document client is configured to remove undefined values, so one becomes
    // the other on the way to storage.
    if (left[key] === undefined && right[key] === undefined) continue;
    if (!sameGame(left[key], right[key])) return false;
  }
  return true;
};
