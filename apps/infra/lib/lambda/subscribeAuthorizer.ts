/**
 * Who may watch a table.
 *
 * **The hole in the stack that everything else was waiting on.** The shared
 * `table` namespace was authenticated but not authorized: a subscriber had to
 * be signed in, and sign-up is open, so "signed in" is anybody at all. An
 * account holding a table id could stream a stranger's game — every bet, every
 * board, every showdown — and the only reason it was not exploitable is that
 * nothing published and nothing connected. Both of those changed in the last
 * two commits, which is why this one is now.
 *
 * Private channels are guarded a different way, and deliberately: `/player/…`
 * is checked by an APPSYNC_JS handler comparing a path segment to the caller's
 * own subject, which needs no I/O and cannot fail open. **A shared table needs
 * a lookup** — membership is a fact about the game, not about the path — and
 * an APPSYNC_JS handler cannot read a database. Hence a Lambda.
 *
 * ## Failing closed, on purpose, in every branch
 *
 * Every path that is not "this signed-in person is seated at this table"
 * refuses: a malformed channel, an unknown table, a read that throws, a caller
 * with no subject. There is no branch that returns success because it ran out
 * of reasons to say no — which is the shape authorization bugs actually take.
 */

import { TABLE_NAMESPACE } from "@poker/core";
import { createTableStore, type TableStore } from "./tableStore";
import { log } from "./logging";

/** What AppSync sends. Only these two fields matter. */
export type SubscribeEvent = {
  info?: { channel?: { path?: string } };
  identity?: { sub?: string } | null;
};

/**
 * What AppSync expects back.
 *
 * `null` allows the subscription; an object with `error` refuses it. Not a
 * boolean and not a throw — a thrown exception is an *invocation* failure,
 * which AppSync reports differently and which would make a denial
 * indistinguishable from a broken function.
 */
export type SubscribeResponse = { error: string } | null;

/**
 * The table a channel is about, or `null` if it is not a table channel at all.
 *
 * Its own function so the parsing has tests: a guard that mis-parses a path is
 * a guard that checks the wrong table, and reads exactly like a working one.
 */
export const tableFromChannel = (path: string | undefined): string | null => {
  if (!path) return null;
  const segments = path.split("/");
  // ["", "table", tableId]
  if (segments.length !== 3) return null;
  if (segments[0] !== "" || segments[1] !== TABLE_NAMESPACE) return null;
  return segments[2].length > 0 ? segments[2] : null;
};

const DENIED: SubscribeResponse = { error: "not a member of this table" };

/**
 * Decide, given a store. Separated from the handler so every branch is
 * testable without a Lambda, an AppSync, or a DynamoDB.
 */
export const authorize = async (
  event: SubscribeEvent,
  store: TableStore,
): Promise<SubscribeResponse> => {
  const sub = event.identity?.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    // Should be unreachable: the namespace's auth mode is the Cognito user
    // pool. Checked anyway, because "unreachable" is where these live.
    log("warn", "subscribe with no subject");
    return DENIED;
  }

  const tableId = tableFromChannel(event.info?.channel?.path);
  if (!tableId) {
    log("warn", "subscribe to an unparseable channel");
    return DENIED;
  }

  let members: readonly string[];
  try {
    const stored = await store.read(tableId);
    if (!stored) {
      // Refused rather than allowed-because-empty. Allowing a subscription to
      // a table that does not exist would let somebody sit waiting on an id
      // and be joined to whatever is created under it later.
      log("warn", "subscribe to a table that does not exist", { tableId });
      return DENIED;
    }
    members = stored.members ?? [];
  } catch (error) {
    // A failed read is not permission. This is the branch that most often
    // becomes an accidental "allow" when somebody adds a fallback later.
    log("error", "subscribe check could not read the table", {
      tableId,
      error: String(error),
    });
    return DENIED;
  }

  if (!members.includes(sub)) {
    log("warn", "subscribe by a non-member", { tableId, accountId: sub });
    return DENIED;
  }

  return null;
};

let store: TableStore | null = null;

export const handler = async (
  event: SubscribeEvent,
): Promise<SubscribeResponse> => {
  if (!store) {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      // Refuse rather than guess a table name. A guard reading the wrong table
      // is worse than one that is down.
      log("error", "TABLE_NAME is not set; refusing every subscription");
      return DENIED;
    }
    store = createTableStore(tableName);
  }
  return authorize(event, store);
};

/** For tests, which need a store that is not DynamoDB. */
export const useTableStore = (replacement: TableStore | null): void => {
  store = replacement;
};
