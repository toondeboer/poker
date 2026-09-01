/**
 * The I/O half of the group store.
 *
 * Every write is **conditional on the state it expects**, which is what makes
 * the whole thing re-runnable: account deletion is a sequence that can fail
 * halfway, and a step that cannot be repeated safely turns a half-finished
 * deletion into an account nobody can delete *because* it is half deleted.
 *
 * Two habits carry most of the correctness here, both learned the hard way:
 *
 * - **Decisions read the group's own partition, consistently.** Nothing
 *   important is decided from a read that might be stale.
 * - **A rule that spans two rows is a transaction with a `ConditionCheck`**,
 *   not a read followed by a write. The second thing two people can both pass;
 *   the first only one of them can.
 *
 * Keys and permissions are in `groupKeys.ts`, which has no I/O.
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
  boardFrom,
  claimKey,
  groupItem,
  groupKey,
  inviteKey,
  memberFrom,
  memberItem,
  memberKey,
  membersFrom,
  membershipItem,
  membershipKey,
  playerKey,
  resultItem,
  resultKey,
  sameGame,
  tombstone,
  type MemberItem,
  type Role,
} from "./groupKeys";

/** Why a write did not happen. Never an exception for an ordinary refusal. */
export type WriteOutcome =
  | { status: "ok" }
  | { status: "conflict"; reason: string };

const OK: WriteOutcome = { status: "ok" };
const conflict = (reason: string): WriteOutcome => ({ status: "conflict", reason });

export type GroupStore = {
  board(groupId: string): Promise<GroupState | null>;
  /** What this account may do here. **Strongly consistent.** */
  membership(accountId: string, groupId: string): Promise<MemberItem | null>;
  /** Everyone in a group, from the group's own partition. Consistent. */
  members(groupId: string): Promise<MemberItem[]>;
  /** Every row under an account — memberships and claims. */
  belongings(accountId: string): Promise<AccountRow[]>;
  createGroup(groupId: string, name: string, founder: string, now: number): Promise<WriteOutcome>;
  addPlayer(groupId: string, player: Player): Promise<WriteOutcome>;
  recordGame(groupId: string, result: GameResult): Promise<WriteOutcome>;
  removePlayer(groupId: string, playerId: string, now: number): Promise<WriteOutcome>;
  removeGame(groupId: string, gameId: string, now: number): Promise<WriteOutcome>;
  claimPlayer(accountId: string, groupId: string, playerId: string, now: number): Promise<WriteOutcome>;
  releaseClaim(accountId: string, groupId: string, playerId: string): Promise<WriteOutcome>;
  /** Change a role, asserting `guarantor` is still an admin if one is named. */
  setRole(
    accountId: string,
    groupId: string,
    role: Role,
    guarantor: string | null,
  ): Promise<WriteOutcome>;
  join(accountId: string, groupId: string, role: Role, now: number): Promise<WriteOutcome>;
  /** Remove a membership, asserting `guarantor` is still an admin if named. */
  leave(accountId: string, groupId: string, guarantor: string | null): Promise<WriteOutcome>;
  /** What an account holds on a board, if anything — the seat and the player. */
  seatOf(accountId: string, groupId: string): Promise<string | null>;
  setInvite(groupId: string, token: string, previous: string | null, now: number): Promise<WriteOutcome>;
  groupForInvite(token: string): Promise<string | null>;
  inviteTokenOf(groupId: string): Promise<string | null>;
  forget(accountId: string, keys: readonly { pk: string; sk: string }[]): Promise<void>;
};

export type AccountRow = { pk: string; sk: string; playerId?: string; role?: string };

/**
 * `TransactionCanceledException` is **not** a synonym for "somebody got there
 * first". DynamoDB also cancels for `TransactionConflict` and for throttling,
 * both retryable, and telling the caller 409 sends them to resolve a conflict
 * that does not exist.
 */
const failedConditionAt = (error: TransactionCanceledException): number =>
  (error.CancellationReasons ?? []).findIndex(
    (reason) => reason.Code === "ConditionalCheckFailed",
  );

const conditional = async (
  run: () => Promise<unknown>,
  reasons: string | readonly string[],
): Promise<WriteOutcome> => {
  const at = (index: number): string =>
    typeof reasons === "string" ? reasons : (reasons[index] ?? reasons[0] ?? "refused");
  try {
    await run();
    return OK;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return conflict(at(0));
    if (error instanceof TransactionCanceledException) {
      const index = failedConditionAt(error);
      if (index >= 0) return conflict(at(index));
    }
    throw error;
  }
};

/**
 * Read every page.
 *
 * A `Query` stops at 1 MB and hands back a cursor. Ignoring it truncates
 * silently — and the place that hurts is `DELETE /me`, where the rows a
 * truncated query missed are rows nobody deletes, *after* the Cognito user is
 * gone and no token exists to ask again with.
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

/** Assert somebody is still an admin, as part of somebody else's transaction. */
const stillAdmin = (tableName: string, groupId: string, accountId: string) => ({
  ConditionCheck: {
    TableName: tableName,
    Key: memberKey(groupId, accountId),
    ConditionExpression: "#role = :admin",
    ExpressionAttributeNames: { "#role": "role" },
    ExpressionAttributeValues: { ":admin": "admin" },
  },
});

export const createGroupStore = (
  tableName: string,
  client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({}),
    { marshallOptions: { removeUndefinedValues: true } },
  ),
): GroupStore => {
  const groupPartition = (groupId: string) =>
    allPages((start) =>
      client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": groupKey(groupId).pk },
          ConsistentRead: true,
          ExclusiveStartKey: start,
        }),
      ),
    );

  return {
    async board(groupId) {
      return boardFrom(groupId, await groupPartition(groupId));
    },

    async membership(accountId, groupId) {
      // **Strongly consistent, always.** This is the permission check, and an
      // eventually consistent read can carry a role revoked a second ago.
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: memberKey(groupId, accountId),
          ConsistentRead: true,
        }),
      );
      return memberFrom(result.Item);
    },

    async members(groupId) {
      // The group's own partition, so this is consistent — which is the whole
      // reason membership is written twice. The previous design read an index
      // here, and every decision resting on it was a race.
      //
      // `begins_with` rather than filtering the whole partition in memory:
      // `DELETE /me` calls this once per group inside a sequential loop under a
      // ten-second timeout, and reading every player and every game to find the
      // memberships is most of that budget spent on rows it discards.
      const items = await allPages((start) =>
        client.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "pk = :pk AND begins_with(sk, :member)",
            ExpressionAttributeValues: {
              ":pk": groupKey(groupId).pk,
              ":member": "MEMBER#",
            },
            ConsistentRead: true,
            ExclusiveStartKey: start,
          }),
        ),
      );
      return membersFrom(items);
    },

    async belongings(accountId) {
      const items = await allPages((start) =>
        client.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: { ":pk": `ACCOUNT#${accountId}` },
            // `playerId` and `role` come too: deletion needs to know which
            // player a claim held and whether this account was an admin, and
            // re-reading each row to find out is a read per row.
            ProjectionExpression: "pk, sk, playerId, #role",
            ExpressionAttributeNames: { "#role": "role" },
            ConsistentRead: true,
            ExclusiveStartKey: start,
          }),
        ),
      );
      return items as AccountRow[];
    },

    async createGroup(groupId, name, founder, now) {
      // The group and its first admin — both copies of the membership — or
      // nothing. A group whose creator is only a member is one nobody could
      // ever remove a player from.
      const outcome = await conditional(
        () =>
          client.send(
            new TransactWriteCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: tableName,
                    Item: groupItem(groupId, { name, createdAt: now }),
                    ConditionExpression: "attribute_not_exists(pk)",
                  },
                },
                { Put: { TableName: tableName, Item: memberItem(groupId, founder, "admin", now) } },
                { Put: { TableName: tableName, Item: membershipItem(founder, groupId, "admin", now) } },
              ],
            }),
          ),
        "group exists",
      );
      if (outcome.status === "ok") return outcome;

      /**
       * **A board this account is already on is not a conflict.**
       *
       * The client retries a write whose answer it never received, and it
       * announces the boards it already has so a phone that predates syncing
       * can catch up. Both land here, and answering 409 would be a permanent
       * refusal that cascades to every player and game queued behind the
       * group — an evening thrown away because a response was lost.
       *
       * A group belonging to *somebody else* is still a conflict: the id is
       * taken, and this caller has no business on it.
       */
      const mine = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: memberKey(groupId, founder),
          ConsistentRead: true,
        }),
      );
      return mine.Item ? OK : outcome;
    },

    addPlayer(groupId, player) {
      /**
       * An `Update`, not a `Put`, and not over a tombstone.
       *
       * A `Put` replaces the whole row, so a replayed offline add — the thing
       * this is written to tolerate — wipes the `accountId` of whoever claimed
       * that player. And the condition is on `deletedAt` rather than existence,
       * because a replay landing on a deleted row would otherwise resurrect it.
       *
       * **`if_not_exists` on the name, so adding cannot double as renaming.**
       * This route is open to every member; an unconditional `SET` would let
       * anybody rename anybody, including a player somebody else has claimed.
       * Renaming is not in the permission table, and until it is, the way to
       * get it is not to leave it lying here by accident.
       */
      return conditional(
        () =>
          client.send(
            new UpdateCommand({
              TableName: tableName,
              Key: playerKey(groupId, player.id),
              UpdateExpression:
                "SET #name = if_not_exists(#name, :name), playerId = :id",
              ExpressionAttributeNames: { "#name": "name" },
              ExpressionAttributeValues: { ":name": player.name, ":id": player.id },
              ConditionExpression: "attribute_not_exists(deletedAt)",
            }),
          ),
        "that player was removed",
      );
    },

    async recordGame(groupId, result) {
      /**
       * **Create only** — a condition merely on the tombstone would let any
       * member re-POST an id the board just handed them and overwrite a
       * recorded game with an emptier one, deleting it in all but name and
       * routing around the admin-only removal rule.
       *
       * **But a replay of the *same* game is a success.** The app queues writes
       * offline and retries them, so the ordinary case for hitting this
       * condition is a phone sending again what it already sent — and answering
       * 409 to that tells somebody their game did not save when it did. Only a
       * *different* game under the same id is a real conflict.
       */
      const outcome = await conditional(
        () =>
          client.send(
            new PutCommand({
              TableName: tableName,
              Item: resultItem(groupId, result),
              ConditionExpression: "attribute_not_exists(pk)",
            }),
          ),
        "already recorded",
      );
      if (outcome.status === "ok") return outcome;
      const existing = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: resultKey(groupId, result.id),
          ConsistentRead: true,
        }),
      );
      const stored = (existing.Item as { result?: GameResult } | undefined)?.result;
      // The **whole** game, not just its date. Comparing `playedAt` alone
      // answers 200 to a genuinely different game recorded under an id already
      // used — and the client, told it succeeded, drops it from its queue.
      //
      // Compared structurally rather than by `JSON.stringify`: DynamoDB does
      // not preserve key order, so a game never matched itself once it had been
      // round-tripped, and every replay was answered 409. See `sameGame`.
      return stored && sameGame(stored, result) ? OK : outcome;
    },

    async removePlayer(groupId, playerId, now) {
      const key = playerKey(groupId, playerId);
      const existing = await client.send(
        new GetCommand({ TableName: tableName, Key: key, ConsistentRead: true }),
      );
      const holder = (existing.Item as { accountId?: unknown } | undefined)?.accountId;
      const claimer = typeof holder === "string" ? holder : null;

      // The claim goes with the player. Conditional on the holder *still* being
      // who we read, so a claim landing in between is not silently discarded —
      // the whole thing fails and the caller tries again against the truth.
      return conditional(
        () =>
          client.send(
            new TransactWriteCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: tableName,
                    Item: tombstone(key, now),
                    ConditionExpression: claimer
                      ? "attribute_exists(pk) AND accountId = :holder"
                      : "attribute_exists(pk) AND attribute_not_exists(accountId)",
                    ExpressionAttributeValues: claimer ? { ":holder": claimer } : undefined,
                  },
                },
                ...(claimer
                  ? [{ Delete: { TableName: tableName, Key: claimKey(claimer, groupId) } }]
                  : []),
              ],
            }),
          ),
        "the player changed while it was being removed",
      );
    },

    removeGame(groupId, gameId, now) {
      // Just the id, now that the id is the key — the caller no longer has to
      // hand back the exact `playedAt` the row was written under, and cannot
      // get it wrong. The condition makes a wrong id fail loudly rather than
      // leave a tombstone for a game that never existed.
      return conditional(
        () =>
          client.send(
            new PutCommand({
              TableName: tableName,
              Item: tombstone(resultKey(groupId, gameId), now),
              ConditionExpression: "attribute_exists(pk)",
            }),
          ),
        "no such game",
      );
    },

    async claimPlayer(accountId, groupId, playerId, now) {
      /**
       * One transaction, and **one seat per board falls out of the key**: the
       * claim is `CLAIM#<groupId>`, so a second claim on the same board
       * collides with the first. There is no separate seat row to create,
       * delete, or forget about.
       *
       * The membership is an upsert rather than a conditional `Put`: guarded by
       * `attribute_not_exists`, it fails for anybody already a member — almost
       * everybody claiming — and cancels the whole transaction.
       */
      const membershipUpsert = (key: { pk: string; sk: string }) => ({
        Update: {
          TableName: tableName,
          Key: key,
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
      });

      // Claiming is only *also* joining for somebody who is already on the
      // board — otherwise a claim landing just after an admin removed the
      // caller would re-create the membership and silently undo the removal.
      const alreadyAMember = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: memberKey(groupId, accountId),
          ConsistentRead: true,
        }),
      );
      if (!alreadyAMember.Item) return conflict("you are not on this board");

      const attempt = () =>
        conditional(
        () =>
          client.send(
            new TransactWriteCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: tableName,
                    Item: { ...claimKey(accountId, groupId), playerId, claimedAt: now },
                    ConditionExpression: "attribute_not_exists(pk)",
                  },
                },
                {
                  Update: {
                    TableName: tableName,
                    Key: playerKey(groupId, playerId),
                    UpdateExpression: "SET accountId = :account",
                    ExpressionAttributeValues: { ":account": accountId },
                    ConditionExpression:
                      "attribute_exists(pk) AND attribute_not_exists(accountId) AND attribute_not_exists(deletedAt)",
                  },
                },
                membershipUpsert(memberKey(groupId, accountId)),
                membershipUpsert(membershipKey(accountId, groupId)),
              ],
            }),
          ),
        [
          "you already hold a seat on this board",
          "somebody else has claimed that player",
        ],
      );

      const outcome = await attempt();
      if (outcome.status === "ok") return outcome;
      // Replayed from an offline queue, most likely. Holding *this* player
      // already is the thing the caller asked for, so it is a success — where
      // holding a different one is the refusal the message describes.
      const seat = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: claimKey(accountId, groupId),
          ConsistentRead: true,
        }),
      );
      const held = (seat.Item as { playerId?: unknown } | undefined)?.playerId;
      return held === playerId ? OK : outcome;
    },

    releaseClaim(accountId, groupId, playerId) {
      /**
       * The player and every game they played stay: a board refers to the
       * person, not the account.
       *
       * **The seat goes with it.** Clearing only `accountId` leaves the
       * `CLAIM#<groupId>` row behind, and since one seat per board is the shape
       * of that key, the account is then permanently unable to claim anybody:
       * re-claiming the same player answers 200 while the board stays
       * unclaimed, and claiming anybody else is a forever 409. `removePlayer`
       * always deleted both; this path did not.
       */
      return conditional(
        () =>
          client.send(
            new TransactWriteCommand({
              TransactItems: [
                {
                  Update: {
                    TableName: tableName,
                    Key: playerKey(groupId, playerId),
                    UpdateExpression: "REMOVE accountId",
                    // Only if it is still this account's: in between, the player
                    // may have been released and re-claimed by somebody else.
                    ConditionExpression: "accountId = :account",
                    ExpressionAttributeValues: { ":account": accountId },
                  },
                },
                { Delete: { TableName: tableName, Key: claimKey(accountId, groupId) } },
              ],
            }),
          ),
        "claim already released",
      );
    },

    setRole(accountId, groupId, role, guarantor) {
      /**
       * Both copies of the membership, and — when demoting — an assertion that
       * a **named** other admin is still an admin.
       *
       * That assertion is the whole guard, and it is why there is no counter.
       * Reading "is there another admin?" and then writing is something two
       * people can both pass: two admins demoting each other each see the
       * other, each proceed, and the group is left unmanageable. As a
       * `ConditionCheck` in the same transaction, exactly one of them wins.
       */
      const update = (key: { pk: string; sk: string }) => ({
        Update: {
          TableName: tableName,
          Key: key,
          UpdateExpression: "SET #role = :role",
          ExpressionAttributeNames: { "#role": "role" },
          ExpressionAttributeValues: { ":role": role },
          ConditionExpression: "attribute_exists(pk)",
        },
      });
      return conditional(
        () =>
          client.send(
            new TransactWriteCommand({
              TransactItems: [
                update(memberKey(groupId, accountId)),
                update(membershipKey(accountId, groupId)),
                ...(guarantor ? [stillAdmin(tableName, groupId, guarantor)] : []),
              ],
            }),
          ),
        ["not a member", "not a member", "a group needs at least one admin"],
      );
    },

    join(accountId, groupId, role, now) {
      // Conditional so redeeming a pinned link twice does not reset an admin
      // back to member. A second redemption is a no-op, which is what somebody
      // tapping the link again expects.
      return conditional(
        () =>
          client.send(
            new TransactWriteCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: tableName,
                    Item: memberItem(groupId, accountId, role, now),
                    ConditionExpression: "attribute_not_exists(pk)",
                  },
                },
                {
                  Put: {
                    TableName: tableName,
                    Item: membershipItem(accountId, groupId, role, now),
                    ConditionExpression: "attribute_not_exists(pk)",
                  },
                },
              ],
            }),
          ),
        "already a member",
      );
    },

    leave(accountId, groupId, guarantor) {
      // Both copies go together, and if this account was the last admin the
      // caller has already named who is taking over — asserted here so a
      // concurrent change cannot slip between the decision and the write.
      return conditional(
        () =>
          client.send(
            new TransactWriteCommand({
              TransactItems: [
                { Delete: { TableName: tableName, Key: memberKey(groupId, accountId) } },
                { Delete: { TableName: tableName, Key: membershipKey(accountId, groupId) } },
                ...(guarantor ? [stillAdmin(tableName, groupId, guarantor)] : []),
              ],
            }),
          ),
        ["could not leave", "could not leave", "the group would be left with no admin"],
      );
    },

    setInvite(groupId, token, previous, now) {
      /**
       * Rotation is the only revocation an invite that never expires has, so a
       * group must never end up with two working links. The old token's row is
       * deleted in the **same transaction** that writes the new one, and the
       * group's own row is updated conditional on still carrying the token the
       * caller read — so two concurrent rotations cannot both succeed.
       */
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
                    ExpressionAttributeValues: previous
                      ? { ":token": token, ":previous": previous }
                      : { ":token": token },
                    ConditionExpression: previous
                      ? "inviteToken = :previous"
                      : "attribute_exists(pk) AND attribute_not_exists(inviteToken)",
                  },
                },
                ...(previous
                  ? [{ Delete: { TableName: tableName, Key: inviteKey(previous) } }]
                  : []),
              ],
            }),
          ),
        ["could not write the invite", "the link changed while it was being rotated"],
      );
    },

    async groupForInvite(token) {
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: inviteKey(token),
          ConsistentRead: true,
        }),
      );
      const groupId = (result.Item as { groupId?: unknown } | undefined)?.groupId;
      return typeof groupId === "string" && groupId.length > 0 ? groupId : null;
    },

    async inviteTokenOf(groupId) {
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: groupKey(groupId),
          ConsistentRead: true,
        }),
      );
      const token = (result.Item as { inviteToken?: unknown } | undefined)?.inviteToken;
      return typeof token === "string" && token.length > 0 ? token : null;
    },

    async seatOf(accountId, groupId) {
      const seat = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: claimKey(accountId, groupId),
          ConsistentRead: true,
        }),
      );
      const playerId = (seat.Item as { playerId?: unknown } | undefined)?.playerId;
      return typeof playerId === "string" ? playerId : null;
    },

    async forget(accountId, keys) {
      // Unconditional, deliberately: this runs last in account deletion, and a
      // delete of something a previous attempt already removed has to succeed
      // or the sequence stops being re-runnable.
      for (const key of keys) {
        await client.send(new DeleteCommand({ TableName: tableName, Key: key }));
      }
    },
  };
};
