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
  groupKey,
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
const conditional = async (
  run: () => Promise<unknown>,
  reason: string,
): Promise<WriteOutcome> => {
  try {
    await run();
    return OK;
  } catch (error) {
    if (
      error instanceof ConditionalCheckFailedException ||
      error instanceof TransactionCanceledException
    ) {
      return conflict(reason);
    }
    throw error;
  }
};

export const createGroupStore = (
  tableName: string,
  client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({}),
    { marshallOptions: { removeUndefinedValues: true } },
  ),
): GroupStore => ({
  async board(groupId) {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": groupKey(groupId).pk },
        // The board is what the caller is about to act on, so an eventually
        // consistent read could hand back a player somebody just removed.
        ConsistentRead: true,
      }),
    );
    return boardFrom(groupId, result.Items ?? []);
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
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: MEMBERS_INDEX,
        KeyConditionExpression: "sk = :sk AND begins_with(pk, :account)",
        ExpressionAttributeValues: {
          ":sk": membershipKey("", groupId).sk,
          ":account": "ACCOUNT#",
        },
      }),
    );
    return (result.Items ?? [])
      .map(memberFrom)
      .filter((m): m is MembershipItem => m !== null);
  },

  async belongings(accountId) {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `ACCOUNT#${accountId}` },
        ProjectionExpression: "pk, sk",
        ConsistentRead: true,
      }),
    );
    return (result.Items ?? []) as { pk: string; sk: string }[];
  },

  addPlayer(groupId, player) {
    // No condition. Adding is open to any member and a player id is generated,
    // so there is nothing to race against — and a condition here would turn a
    // retried request into an error instead of a no-op.
    return conditional(
      () =>
        client.send(
          new PutCommand({ TableName: tableName, Item: playerItem(groupId, player) }),
        ),
      "player exists",
    );
  },

  recordGame(groupId, result) {
    return conditional(
      () =>
        client.send(
          new PutCommand({ TableName: tableName, Item: resultItem(groupId, result) }),
        ),
      "game exists",
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
                Put: {
                  TableName: tableName,
                  // Claiming yourself is how you join a board — but only if you
                  // are not already on it, or this would reset an admin to a
                  // member.
                  Item: membershipItem(accountId, groupId, "member", now),
                  ConditionExpression: "attribute_not_exists(pk)",
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
    return conditional(
      () =>
        client.send(
          new UpdateCommand({
            TableName: tableName,
            Key: membershipKey(accountId, groupId),
            UpdateExpression: "SET #role = :role",
            ExpressionAttributeNames: { "#role": "role" },
            ExpressionAttributeValues: { ":role": role },
            // Promoting somebody who is not a member would create a membership
            // with no `joinedAt`, which is the field the heir is chosen by.
            ConditionExpression: "attribute_exists(pk)",
          }),
        ),
      "not a member",
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
