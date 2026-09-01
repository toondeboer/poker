/**
 * The I/O half of the group store.
 *
 * Every write here is **conditional on the state it expects**, and that is not
 * defensive habit — it is what makes the whole thing re-runnable. Account
 * deletion is a sequence of writes that can fail halfway, and a step that
 * cannot be repeated safely turns a half-finished deletion into an account
 * nobody can delete *because* it is half deleted.
 *
 * Design and reasoning in [SYNC.md](../../SYNC.md); the keys, permissions and
 * tombstones are next door in `groupKeys.ts`, which has no I/O so it can be
 * tested exhaustively.
 */

import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { GameResult, GroupState, Player } from "@poker/core";
import {
  MEMBERS_INDEX,
  boardFrom,
  claimKey,
  groupItem,
  seatKey,
  groupKey,
  inviteKey,
  memberFrom,
  membershipItem,
  membershipKey,
  playerItem,
  playerKey,
  resultItem,
  resultKey,
  tombstone,
  type MembershipItem,
  type Role,
} from "./groupKeys";

/** Why a write did not happen. Never an exception for an ordinary refusal. */
export type WriteOutcome =
  | { status: "ok" }
  /** Somebody else got there first, or the row this expected is not there. */
  | { status: "conflict"; reason: string };

const OK: WriteOutcome = { status: "ok" };

export type GroupStore = {
  /** The whole board in one query, tombstones already dropped. */
  board(groupId: string): Promise<GroupState | null>;
  /** What this account may do here, or `null` if it is not a member. */
  membership(accountId: string, groupId: string): Promise<MembershipItem | null>;
  /** Everyone in a group. Reads the index, so may be a moment stale. */
  members(groupId: string): Promise<MembershipItem[]>;
  /** Every row under an account — memberships and claims. */
  belongings(accountId: string): Promise<{ pk: string; sk: string }[]>;
  addPlayer(groupId: string, player: Player): Promise<WriteOutcome>;
  recordGame(groupId: string, result: GameResult): Promise<WriteOutcome>;
  removePlayer(groupId: string, playerId: string, now: number): Promise<WriteOutcome>;
  removeGame(groupId: string, result: GameResult, now: number): Promise<WriteOutcome>;
  claimPlayer(
    accountId: string,
    groupId: string,
    playerId: string,
    now: number,
  ): Promise<WriteOutcome>;
  releaseClaim(
    accountId: string,
    groupId: string,
    playerId: string,
  ): Promise<WriteOutcome>;
  setRole(accountId: string, groupId: string, role: Role): Promise<WriteOutcome>;
  /** Make somebody admin without moving the count — one leaves, one arrives. */
  promoteHeir(accountId: string, groupId: string): Promise<WriteOutcome>;
  createGroup(
    groupId: string,
    name: string,
    founder: string,
    now: number,
  ): Promise<WriteOutcome>;
  removeGroup(groupId: string, now: number): Promise<WriteOutcome>;
  /** Replaces whatever invite the group had. Rotating is how one is revoked. */
  setInvite(groupId: string, token: string, now: number): Promise<WriteOutcome>;
  /** The group a token opens, or `null`. */
  groupForInvite(token: string): Promise<string | null>;
  /** Join a group you were invited to. A no-op if already on it. */
  join(accountId: string, groupId: string, role: Role, now: number): Promise<WriteOutcome>;
  forget(accountId: string, keys: readonly { pk: string; sk: string }[]): Promise<void>;
};

const conflict = (reason: string): WriteOutcome => ({ status: "conflict", reason });

/**
 * Run a conditional write, turning the *expected* failure into an answer.
 *
 * A failed condition is an ordinary event here — two people claiming the same
 * player, a tombstone for a row somebody already deleted — and an exception
 * would make every caller wrap it. Anything else still throws, because a
 * throttle or a permissions error is not a conflict and must not be reported as
 * one.
 */
/**
 * Did this transaction fail a *condition*, or fail for some other reason?
 *
 * **`TransactionCanceledException` is not a synonym for "somebody got there
 * first".** DynamoDB also cancels a transaction for `TransactionConflict`
 * (another transaction touched the same item), `ProvisionedThroughputExceeded`
 * and `ThrottlingError` — all of which are retryable, and none of which mean
 * what a 409 tells the caller. Reporting a throttle as "already claimed" sends
 * somebody off to resolve a conflict that does not exist.
 */
const isConditionFailure = (error: TransactionCanceledException): boolean =>
  (error.CancellationReasons ?? []).some(
    (reason) => reason.Code === "ConditionalCheckFailed",
  );

const conditional = async (
  run: () => Promise<unknown>,
  reason: string,
): Promise<WriteOutcome> => {
  try {
    await run();
    return OK;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return conflict(reason);
    if (error instanceof TransactionCanceledException && isConditionFailure(error)) {
      return conflict(reason);
    }
    throw error;
  }
};

/**
 * Read every page.
 *
 * A `Query` stops at 1 MB and hands back a cursor. Ignoring it silently
 * truncates — and the place that hurt most is `DELETE /me`, where the rows this
 * did not return are rows nobody deletes, *after* the Cognito user is gone and
 * no token exists to ask again with.
 */
const allPages = async (
  send: (start?: Record<string, unknown>) => Promise<{
    Items?: Record<string, unknown>[];
    LastEvaluatedKey?: Record<string, unknown>;
  }>,
): Promise<Record<string, unknown>[]> => {
  const items: Record<string, unknown>[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const page = await send(start);
    items.push(...(page.Items ?? []));
    start = page.LastEvaluatedKey;
  } while (start);
  return items;
};

export const createGroupStore = (
  tableName: string,
  client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({}),
    { marshallOptions: { removeUndefinedValues: true } },
  ),
): GroupStore => ({
  async board(groupId) {
    const items = await allPages((start) =>
      client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": groupKey(groupId).pk },
          // The board is what the caller is about to act on, so an eventually
          // consistent read could hand back a player somebody just removed.
          ConsistentRead: true,
          ExclusiveStartKey: start,
        }),
      ),
    );
    return boardFrom(groupId, items);
  },

  async membership(accountId, groupId) {
    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: membershipKey(accountId, groupId),
        // **Strongly consistent, always.** This is the permission check. An
        // eventually consistent read can carry a role that was revoked a
        // second ago, which is a demoted admin still being able to delete.
        ConsistentRead: true,
      }),
    );
    return memberFrom(result.Item);
  },

  async members(groupId) {
    // The index, and the only thing that reads it. Listing tolerates being a
    // moment stale; authorization does not, which is why it is above and not
    // built on top of this.
    const items = await allPages((start) =>
      client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: MEMBERS_INDEX,
          KeyConditionExpression: "sk = :sk AND begins_with(pk, :account)",
          ExpressionAttributeValues: {
            ":sk": membershipKey("", groupId).sk,
            ":account": "ACCOUNT#",
          },
          ExclusiveStartKey: start,
        }),
      ),
    );
    return items.map(memberFrom).filter((m): m is MembershipItem => m !== null);
  },

  async belongings(accountId) {
    const items = await allPages((start) =>
      client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": `ACCOUNT#${accountId}` },
          ProjectionExpression: "pk, sk",
          ConsistentRead: true,
          ExclusiveStartKey: start,
        }),
      ),
    );
    return items as { pk: string; sk: string }[];
  },

  addPlayer(groupId, player) {
    /**
     * **Not over a tombstone.** An unconditional `Put` is what an add wants —
     * ids are generated, so a retry should be a harmless no-op rather than an
     * error. But the app queues writes offline and replays them, and a replayed
     * add landing on a row somebody has since deleted **resurrects it**, which
     * is the exact failure tombstones exist to prevent. The guard is on
     * `deletedAt`, not on existence, so a retry still overwrites a live row.
     */
    return conditional(
      () =>
        client.send(
          new PutCommand({
            TableName: tableName,
            Item: playerItem(groupId, player),
            ConditionExpression: "attribute_not_exists(deletedAt)",
          }),
        ),
      "that player was removed",
    );
  },

  recordGame(groupId, result) {
    // Same reasoning: a replayed offline record must not bring back a game an
    // admin deleted in the meantime.
    return conditional(
      () =>
        client.send(
          new PutCommand({
            TableName: tableName,
            Item: resultItem(groupId, result),
            ConditionExpression: "attribute_not_exists(deletedAt)",
          }),
        ),
      "that game was removed",
    );
  },

  removePlayer(groupId, playerId, now) {
    const key = playerKey(groupId, playerId);
    return conditional(
      () =>
        client.send(
          new PutCommand({
            TableName: tableName,
            Item: tombstone(key, now),
            // The row has to be there. Without this a tombstone for a
            // mistyped id creates a row that means "a thing that never
            // existed is deleted", and the real one carries on.
            ConditionExpression: "attribute_exists(pk)",
          }),
        ),
      "no such player",
    );
  },

  removeGame(groupId, result, now) {
    // Rebuilt from the result the caller holds, because the sort key carries
    // `playedAt` and the app deletes by id alone. Safe only while a recorded
    // game is immutable — see SYNC.md. The condition is what makes a wrong key
    // fail loudly rather than orphan a tombstone.
    const key = resultKey(groupId, result.playedAt, result.id);
    return conditional(
      () =>
        client.send(
          new PutCommand({
            TableName: tableName,
            Item: tombstone(key, now),
            ConditionExpression: "attribute_exists(pk)",
          }),
        ),
      "no such game",
    );
  },

  claimPlayer(accountId, groupId, playerId, now) {
    /**
     * The one contended write, and the only transaction here.
     *
     * Three items, all or none. A claim without the player update would show
     * an account a board it is not on; the player updated without the claim
     * would be invisible to account deletion, which finds what to release by
     * reading the account's own partition.
     */
    return conditional(
      () =>
        client.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: { ...claimKey(accountId, groupId, playerId), claimedAt: now },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
              {
                /**
                 * One seat per board.
                 *
                 * The claim key carries the *player*, so on its own it stops
                 * two accounts holding one person and does nothing about one
                 * account holding two people. `@poker/core` enforces one seat
                 * locally and SYNC.md says the server does; without this it did
                 * not, and one account could occupy half a leaderboard and
                 * double-count its own nights.
                 */
                Put: {
                  TableName: tableName,
                  Item: { ...seatKey(accountId, groupId), playerId, claimedAt: now },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
              {
                Update: {
                  TableName: tableName,
                  Key: playerKey(groupId, playerId),
                  UpdateExpression: "SET accountId = :account",
                  ExpressionAttributeValues: { ":account": accountId },
                  // Nobody else has this player, and the player exists. One
                  // person is one seat; a second claim is refused rather than
                  // overwriting somebody.
                  ConditionExpression:
                    "attribute_exists(pk) AND attribute_not_exists(accountId)",
                },
              },
              {
                /**
                 * Join the board, unless already on it.
                 *
                 * **An upsert, not a conditional `Put`**, and the difference is
                 * not stylistic. A `Put` guarded by `attribute_not_exists(pk)`
                 * fails for anybody who is already a member — which is almost
                 * everybody claiming a player — and because a transaction is
                 * all-or-nothing that cancelled the entire claim. Claiming on a
                 * board you were already on could never succeed.
                 *
                 * `if_not_exists` gives both halves at once: the row appears
                 * for somebody joining by claiming, and an existing admin keeps
                 * the role and the `joinedAt` that decides who inherits the
                 * group. No condition, so it cannot fail the transaction.
                 */
                Update: {
                  TableName: tableName,
                  Key: membershipKey(accountId, groupId),
                  UpdateExpression:
                    "SET #role = if_not_exists(#role, :member), joinedAt = if_not_exists(joinedAt, :now), accountId = :account, groupId = :group",
                  ExpressionAttributeNames: { "#role": "role" },
                  ExpressionAttributeValues: {
                    ":member": "member",
                    ":now": now,
                    ":account": accountId,
                    ":group": groupId,
                  },
                },
              },
            ],
          }),
        ),
      "already claimed",
    );
  },

  releaseClaim(accountId, groupId, playerId) {
    // Used by account deletion. The player and every game they played stay —
    // the board refers to the person, not the account, so nobody else loses
    // anything when somebody leaves.
    return conditional(
      () =>
        client.send(
          new UpdateCommand({
            TableName: tableName,
            Key: playerKey(groupId, playerId),
            UpdateExpression: "REMOVE accountId",
            // Only if it is still this account's. Between reading the claim and
            // writing this, the player may have been released and re-claimed by
            // somebody else, and clearing that would unclaim the wrong person.
            ConditionExpression: "accountId = :account",
            ExpressionAttributeValues: { ":account": accountId },
          }),
        ),
      "claim already released",
    );
  },

  setRole(accountId, groupId, role) {
    /**
     * A role and the group's admin count, in one transaction.
     *
     * **The count is what makes "would this leave nobody in charge?" safe to
     * ask.** Reading the members and then writing is a check that two people
     * can both pass: two admins demoting each other at the same moment each see
     * another admin, each proceed, and the group is left unmanageable — with no
     * support channel to undo it. As a condition on the write, only one of them
     * can win.
     *
     * The role condition also keeps the count honest: promoting somebody who is
     * already an admin would increment it for nothing, and a count that drifts
     * above the truth eventually permits the demotion it exists to refuse.
     */
    const demoting = role === "member";
    return conditional(
      () =>
        client.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: tableName,
                  Key: membershipKey(accountId, groupId),
                  UpdateExpression: "SET #role = :role",
                  ExpressionAttributeNames: { "#role": "role" },
                  ExpressionAttributeValues: {
                    ":role": role,
                    ":other": demoting ? "member" : "admin",
                  },
                  // Exists, and is not already the role being set — otherwise
                  // the counter below moves without the role moving.
                  ConditionExpression:
                    "attribute_exists(pk) AND #role <> :other",
                },
              },
              {
                Update: {
                  TableName: tableName,
                  Key: groupKey(groupId),
                  UpdateExpression: "SET adminCount = adminCount + :delta",
                  ExpressionAttributeValues: demoting
                    ? { ":delta": -1, ":floor": 1 }
                    : { ":delta": 1 },
                  // Never below one. This is the whole guard.
                  ConditionExpression: demoting
                    ? "adminCount > :floor"
                    : "attribute_exists(pk)",
                },
              },
            ],
          }),
        ),
      demoting ? "a group needs at least one admin" : "already an admin",
    );
  },

  /**
   * Promote an heir when the last admin is leaving.
   *
   * Separate from `setRole` because the count does **not** move: one admin is
   * going and one is arriving. Conditional on the heir still being a member, so
   * a stale index that named somebody who has since left fails loudly rather
   * than creating a membership out of nothing.
   */
  promoteHeir(accountId, groupId) {
    return conditional(
      () =>
        client.send(
          new UpdateCommand({
            TableName: tableName,
            Key: membershipKey(accountId, groupId),
            UpdateExpression: "SET #role = :admin",
            ExpressionAttributeNames: { "#role": "role" },
            ExpressionAttributeValues: { ":admin": "admin" },
            ConditionExpression: "attribute_exists(pk)",
          }),
        ),
      "heir is no longer a member",
    );
  },

  createGroup(groupId, name, founder, now) {
    /**
     * A group and its first admin, together or not at all.
     *
     * A group with no membership is invisible to the person who made it — they
     * would create a board and immediately be a stranger to it, because
     * membership is what authorization reads. And **`admin`**, because a group
     * whose creator is a member could never have a player removed from it by
     * anybody.
     */
    return conditional(
      () =>
        client.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: { ...groupItem(groupId, { name, createdAt: now }, 1) },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: membershipItem(founder, groupId, "admin", now),
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
            ],
          }),
        ),
      "group exists",
    );
  },

  removeGroup(groupId, now) {
    // Only reached when the last member of a group deletes their account:
    // nobody else's history is in it. The players and results are left to their
    // own TTL rather than deleted one by one — the group row is what every read
    // starts from, so without it the board is already gone.
    return conditional(
      () =>
        client.send(
          new PutCommand({
            TableName: tableName,
            Item: tombstone(groupKey(groupId), now),
            ConditionExpression: "attribute_exists(pk)",
          }),
        ),
      "no such group",
    );
  },

  async setInvite(groupId, token, now) {
    // Rotation is the only revocation there is: a link that does not expire can
    // be undone only by making the old token stop resolving. The old row is
    // deleted first, so a crash between the two leaves a group with no working
    // invite rather than two working ones.
    // Consistent: two rotations in quick succession off a stale read would each
    // delete a token the other had already replaced, and leave two links
    // working — the one state the design says a group cannot be in, given
    // rotation is the only revocation an invite that never expires has.
    const previous = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: groupKey(groupId),
        ConsistentRead: true,
      }),
    );
    const old = (previous.Item as { inviteToken?: string } | undefined)?.inviteToken;
    if (old && old !== token) {
      await client.send(
        new DeleteCommand({ TableName: tableName, Key: inviteKey(old) }),
      );
    }
    return conditional(
      () =>
        client.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: { ...inviteKey(token), groupId, createdAt: now },
                },
              },
              {
                Update: {
                  TableName: tableName,
                  Key: groupKey(groupId),
                  UpdateExpression: "SET inviteToken = :token",
                  ExpressionAttributeValues: { ":token": token },
                  ConditionExpression: "attribute_exists(pk)",
                },
              },
            ],
          }),
        ),
      "no such group",
    );
  },

  async groupForInvite(token) {
    const result = await client.send(
      new GetCommand({ TableName: tableName, Key: inviteKey(token), ConsistentRead: true }),
    );
    const groupId = (result.Item as { groupId?: unknown } | undefined)?.groupId;
    return typeof groupId === "string" && groupId.length > 0 ? groupId : null;
  },

  join(accountId, groupId, role, now) {
    // Conditional so redeeming a link twice does not reset an admin who
    // already belongs back down to `member`. A second redemption is a no-op,
    // which is what somebody tapping a pinned link again expects.
    return conditional(
      () =>
        client.send(
          new PutCommand({
            TableName: tableName,
            Item: membershipItem(accountId, groupId, role, now),
            ConditionExpression: "attribute_not_exists(pk)",
          }),
        ),
      "already a member",
    );
  },

  async forget(accountId, keys) {
    // Unconditional deletes, and deliberately: this runs last in account
    // deletion, and a delete of something already deleted has to be a success
    // or the whole sequence stops being re-runnable.
    for (const key of keys) {
      await client.send(new DeleteCommand({ TableName: tableName, Key: key }));
    }
  },
});
