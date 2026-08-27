/**
 * Where a live poker table lives between actions.
 *
 * One item, read by a known key, written back under a condition. That is the
 * whole access pattern, which is why the single table has no index and no
 * query: nothing about a hand in progress is ever looked up by anything except
 * the table it belongs to.
 *
 * ## There is no retry loop here, and that is deliberate
 *
 * The obvious shape for optimistic concurrency is read, decide, conditional
 * write, and on failure read again and retry. That is right when the retry is
 * a *recomputation* — incrementing a counter, appending to a list. It is wrong
 * here, and quietly so.
 *
 * A poker action is a **decision somebody made while looking at a particular
 * state**. If the conditional write fails, somebody else acted first, and the
 * state the decision was made against no longer exists. Re-running the same
 * fold against the new state is not a retry; it is applying a choice to a
 * situation the player never saw — and the situation may be one where they
 * would have done something else entirely. So a failed condition returns
 * `stale` and the client decides again with fresh cards in front of them.
 *
 * The retries that *are* right — a throttle, a 5xx — the SDK already does.
 */

import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Hand } from "@poker/core";
import type { StoredTable } from "./tableAction";

/** How long a table that nobody touched again is kept. */
export const TABLE_TTL_SECONDS = 24 * 60 * 60;

/**
 * The key. `TABLE#` prefixed because this table holds groups and results too,
 * and an unprefixed id is one collision away from a hand overwriting a season.
 */
export const tableKey = (tableId: string) => ({
  pk: `TABLE#${tableId}`,
  sk: "STATE",
});

export type TableStore = {
  read(tableId: string): Promise<StoredTable | null>;
  /**
   * Write, but only if the stored version is still `expectedVersion`.
   *
   * `false` means somebody else got there first — never an error, because it
   * is an ordinary thing that happens at a table where two people tap at once.
   */
  write(
    tableId: string,
    table: StoredTable,
    expectedVersion: number,
    now: number,
  ): Promise<boolean>;
};

type StoredItem = {
  pk: string;
  sk: string;
  hand: Hand;
  version: number;
  /** Epoch **seconds**, which is what DynamoDB's TTL wants. */
  expiresAt: number;
};

/** Build the item, separately, so the shape is testable without a client. */
export const itemFor = (
  tableId: string,
  table: StoredTable,
  now: number,
): StoredItem => ({
  ...tableKey(tableId),
  hand: table.hand,
  version: table.version,
  // Seconds, not milliseconds. DynamoDB does not validate this, so getting it
  // wrong means a TTL 1,000 times too far away — an item that never expires and
  // a bill that grows for a year before anybody notices.
  expiresAt: Math.floor(now / 1000) + TABLE_TTL_SECONDS,
});

/**
 * What a stored item has to look like before it is believed.
 *
 * Lighter than the app's stored-game validator on purpose: this came from our
 * own conditional write rather than from a device's disk, and the engine
 * rejects an impossible hand anyway. What is checked is the shape the *loop*
 * depends on — a missing `version` would make every conditional write
 * unconditional, which is the one failure that silently loses somebody's
 * action.
 */
export const tableFrom = (item: unknown): StoredTable | null => {
  if (typeof item !== "object" || item === null) return null;
  const { hand, version } = item as { hand?: unknown; version?: unknown };
  if (typeof version !== "number" || !Number.isInteger(version)) return null;
  if (typeof hand !== "object" || hand === null) return null;
  return { hand: hand as Hand, version };
};

export const createTableStore = (
  tableName: string,
  client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({}),
    // Undefined attributes are dropped rather than rejected: a hand with no
    // showdown yet has `showdown: null`, and a seat with no cards has an empty
    // array, but future fields will not all be so careful.
    { marshallOptions: { removeUndefinedValues: true } },
  ),
): TableStore => ({
  async read(tableId) {
    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: tableKey(tableId),
        // The whole point of this read is to decide against the current state,
        // so an eventually-consistent one could hand back the hand as it was
        // before the previous player's action.
        ConsistentRead: true,
      }),
    );
    return tableFrom(result.Item);
  },

  async write(tableId, table, expectedVersion, now) {
    try {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: itemFor(tableId, table, now),
          // Either the version is what we read, or this is the first write for
          // a table that does not exist yet. Anything else means somebody
          // acted in between.
          ConditionExpression:
            "attribute_not_exists(pk) OR version = :expected",
          ExpressionAttributeValues: { ":expected": expectedVersion },
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  },
});
