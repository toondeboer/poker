/**
 * A shared clock, kept as one row that everybody overwrites.
 *
 * **This is not a message bus, and it deliberately is not one.** The protocol
 * in `@poker/core` sends a whole state snapshot every five seconds rather than
 * a stream of deltas — `HEARTBEAT_MS`, and `STALE_AFTER_MS` at fifteen — so a
 * reader that misses one is repaired by the next. That is what makes a single
 * mutable row correct here: there is no history worth keeping, because the only
 * question anybody asks is "what is the clock doing *now*".
 *
 * It is also why this needs no AppSync, no subscribe authorizer and no
 * connection handling. `ROADMAP.md` assumed a shared clock meant standing the
 * deleted realtime bus back up; the protocol says otherwise, and the cost of
 * being wrong is four seconds of latency on a second screen rather than a
 * broken feature.
 *
 * ## Why the join code is the key
 *
 * A session is found by the six characters somebody reads across a table, so
 * the code *is* the address. There is no separate id to look up first, which
 * removes a round trip from joining — the slowest moment in the whole flow,
 * because it is the one somebody is standing there waiting through.
 *
 * **The code says which table; the authorizer says who.** Both, not either — a
 * session is peer-to-peer, so anybody holding a code can publish to it, and a
 * guessed one would pause somebody's game rather than merely watch it. That is
 * why these routes are behind the JWT authorizer like everything else except
 * the kill switch; `sessions.ts` has the full reasoning.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import type { TimerSyncMessage } from "@poker/core";

/**
 * How long a session outlives its last message.
 *
 * **Six hours, which is a long game night and not a long lease.** The row is
 * rewritten on every heartbeat, so an active session keeps pushing its own
 * expiry forward and only an abandoned one actually expires. Short enough that
 * a code is reusable the next day; long enough that a table that pauses for
 * dinner does not come back to a dead session.
 */
export const SESSION_TTL_SECONDS = 6 * 60 * 60;

/** `SESSION#<code>` / `META` — one row, keyed by what people say out loud. */
export const sessionKey = (joinCode: string) => ({
  pk: `SESSION#${joinCode}`,
  sk: "META",
});

export type StoredSession = {
  joinCode: string;
  /** The last snapshot published, or `null` between hosting and the first tick. */
  message: TimerSyncMessage | null;
  hostedAt: number;
};

export type SessionStore = {
  /**
   * Claim a code. `false` when somebody already holds it.
   *
   * Conditional on the row not existing, so two phones generating the same code
   * in the same moment cannot both believe they own it — one of them is told to
   * pick again rather than silently joining the other's table.
   */
  host(joinCode: string, now: number): Promise<boolean>;
  read(joinCode: string): Promise<StoredSession | null>;
  /**
   * Overwrite the snapshot.
   *
   * **Last write wins, and no version check happens here.** The protocol
   * already resolves conflicts on the reading device — `shouldApply` compares
   * `version` and breaks ties on `sender`, identically everywhere — so a server
   * that also arbitrated would be a second opinion the clients did not ask for,
   * and the two could disagree. The server's job is to hold the most recent
   * thing it was handed.
   */
  publish(
    joinCode: string,
    message: TimerSyncMessage,
    now: number,
  ): Promise<boolean>;
};

const isMessage = (value: unknown): value is TimerSyncMessage => {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.version === "number" &&
    typeof m.sender === "string" &&
    typeof m.remaining === "number" &&
    typeof m.duration === "number" &&
    typeof m.paused === "boolean" &&
    typeof m.blindIndex === "number"
  );
};

export const createSessionStore = (
  tableName: string,
  client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({}),
    { marshallOptions: { removeUndefinedValues: true } },
  ),
): SessionStore => ({
  async host(joinCode, now) {
    try {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            ...sessionKey(joinCode),
            joinCode,
            message: null,
            hostedAt: now,
            expiresAt: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
      return true;
    } catch (error) {
      // The only expected failure, and it means the code is taken.
      if (
        (error as { name?: string }).name === "ConditionalCheckFailedException"
      ) {
        return false;
      }
      throw error;
    }
  },

  async read(joinCode) {
    const result = await client.send(
      new GetCommand({ TableName: tableName, Key: sessionKey(joinCode) }),
    );
    const item = result.Item;
    if (!item) return null;
    return {
      joinCode,
      message: isMessage(item.message) ? item.message : null,
      hostedAt: typeof item.hostedAt === "number" ? item.hostedAt : 0,
    };
  },

  async publish(joinCode, message, now) {
    try {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            ...sessionKey(joinCode),
            joinCode,
            message,
            hostedAt: now,
            // Rewritten every heartbeat, so a live session never expires and an
            // abandoned one does.
            expiresAt: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
          },
          // **Publishing to a session nobody hosted is refused.** Otherwise a
          // typo'd code silently creates a table of one, and the person who
          // typed it waits forever for a host who is elsewhere.
          ConditionExpression: "attribute_exists(pk)",
        }),
      );
      return true;
    } catch (error) {
      if (
        (error as { name?: string }).name === "ConditionalCheckFailedException"
      ) {
        return false;
      }
      throw error;
    }
  },
});
