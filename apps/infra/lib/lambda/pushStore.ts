/**
 * Where a phone can be reached, keyed by the account that owns it.
 *
 * **One row per device, not per account.** Somebody signs in on a phone and a
 * tablet and expects both to buzz; a single-token row would silently make the
 * second sign-in unregister the first, which is the kind of bug nobody reports
 * because the phone that stops working is the one they are not holding.
 *
 * `ACCOUNT#<accountId>` / `PUSH#<token>` — the token is in the sort key, so
 * registering the same device twice is idempotent and removing one device is a
 * delete rather than a read-modify-write.
 *
 * ## Why tokens expire on their own
 *
 * A token dies when the app is uninstalled, and nothing tells the server. Expo
 * answers `DeviceNotRegistered` for those, and `forget` exists so the sender
 * can clear them out when it hears that — the only reliable signal there is.
 * The TTL is the backstop for the case where nobody ever sends to it again.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

/**
 * How long an unrefreshed token is kept.
 *
 * **A year, and the app re-registers on every launch**, so this only ever
 * collects devices that stopped opening the app at all — which is exactly the
 * set worth forgetting.
 */
export const PUSH_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;

export const pushTokenKey = (accountId: string, token: string) => ({
  pk: `ACCOUNT#${accountId}`,
  sk: `PUSH#${token}`,
});

/**
 * What Expo issues, and the only shape worth storing.
 *
 * Checked rather than trusted because this is a body field: a client sending
 * anything else is either broken or probing, and neither is worth a row. The
 * format is Expo's own — `ExponentPushToken[...]`.
 */
export const isExpoPushToken = (value: unknown): value is string =>
  typeof value === "string" &&
  /^ExponentPushToken\[[A-Za-z0-9._-]{1,128}\]$/.test(value);

export type PushStore = {
  remember(accountId: string, token: string, now: number): Promise<void>;
  forget(accountId: string, token: string): Promise<void>;
  /** Every device this account has registered. */
  tokensFor(accountId: string): Promise<string[]>;
};

export const createPushStore = (
  tableName: string,
  client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({}),
    { marshallOptions: { removeUndefinedValues: true } },
  ),
): PushStore => ({
  async remember(accountId, token, now) {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          ...pushTokenKey(accountId, token),
          accountId,
          token,
          registeredAt: now,
          expiresAt: Math.floor(now / 1000) + PUSH_TOKEN_TTL_SECONDS,
        },
      }),
    );
  },

  async forget(accountId, token) {
    await client.send(
      new DeleteCommand({
        TableName: tableName,
        Key: pushTokenKey(accountId, token),
      }),
    );
  },

  async tokensFor(accountId) {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `ACCOUNT#${accountId}`,
          ":sk": "PUSH#",
        },
      }),
    );
    return (result.Items ?? [])
      .map((item) => item.token)
      .filter((token): token is string => typeof token === "string");
  },
});
