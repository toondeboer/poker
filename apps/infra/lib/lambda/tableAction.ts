/**
 * The one thing allowed to change a poker table.
 *
 * Read the hand, run the rules, write it back on a version check, publish what
 * changed. The rules are `@poker/core`'s — the same module the phone runs — so
 * a client predicting its own action optimistically is running literally the
 * same code as the authority, and the two cannot drift.
 *
 * Optimistic concurrency instead of a lock: two players acting in the same
 * instant means one conditional write wins and the other retries against fresh
 * state. Poker is turn-based and a few actions a minute, so contention is rare
 * and a retry is cheap — and there is no lock to leak if a Lambda dies holding
 * it.
 */

import type { BettingAction, Hand } from "@poker/core";
import { act, isHandComplete, legalActions } from "@poker/core";
import { log } from "./logging";
import { createTableStore, type TableStore } from "./tableStore";
import {
  createPublisher,
  eventsFor,
  type Publisher,
} from "./tablePublisher";

export type ActionRequest = {
  tableId: string;
  playerId: string;
  action: BettingAction;
  /**
   * The version the client believed it was acting on.
   *
   * Its real job is not concurrency — that is the conditional write — but
   * **double-taps**. Without it, a request that timed out on the phone and was
   * retried folds a hand twice: once for the fold the player meant, and once
   * for the next decision they never saw.
   */
  expectedVersion: number;
};

export type StoredTable = {
  hand: Hand;
  version: number;
};

export type ActionOutcome =
  | { status: "applied"; table: StoredTable; handComplete: boolean }
  | { status: "stale"; currentVersion: number }
  | { status: "rejected"; reason: string };

/**
 * Decide what an action does to a stored table.
 *
 * Split out from the I/O so it can be tested without DynamoDB — and so the
 * rules about *whether* an action is allowed sit next to the rules about what
 * it does, rather than being spread between a handler and a retry loop.
 */
export const applyAction = (
  stored: StoredTable,
  request: ActionRequest,
): ActionOutcome => {
  if (stored.version !== request.expectedVersion) {
    // Either somebody else acted first, or this is a retry of a request that
    // already landed. Both mean: look again before doing anything.
    return { status: "stale", currentVersion: stored.version };
  }

  const legal = legalActions(stored.hand);
  if (!legal) {
    return { status: "rejected", reason: "the hand is already complete" };
  }
  if (legal.playerId !== request.playerId) {
    // Whose turn it is. Checked here as well as inside the engine because the
    // engine's version throws, and a rejected action is an ordinary thing that
    // deserves an answer rather than a stack trace.
    //
    // **This is not an authorization check** — it says the *named* player is to
    // act, not that the caller is that player. See {@link actingPlayer}, which
    // is the check that matters and does not live here on purpose: this
    // function decides what an action does, and who is allowed to send one is
    // a question about a request.
    return {
      status: "rejected",
      reason: `it is ${legal.playerId}'s turn`,
    };
  }

  try {
    const hand = act(stored.hand, request.playerId, request.action);
    return {
      status: "applied",
      table: { hand, version: stored.version + 1 },
      handComplete: isHandComplete(hand),
    };
  } catch (error) {
    // An illegal action is a client that is out of date or wrong, not a server
    // fault: say why and leave the table alone.
    return {
      status: "rejected",
      reason: error instanceof Error ? error.message : "illegal action",
    };
  }
};

/**
 * What everyone at the table is allowed to see of a hand.
 *
 * Built here rather than filtered on the phone: a hand that never leaves the
 * server carrying somebody else's cards cannot leak them, however the client is
 * written.
 *
 * Cards are revealed **only at a showdown**, and only for the players in it.
 * Gating on "the hand is over" instead looks equivalent and is not: a hand
 * everyone folds out of ends with no showdown at all, and the uncontested
 * winner never has to show. An earlier version made exactly that mistake and
 * broadcast their cards — which is worse than a display bug, because it teaches
 * the table how somebody plays the hands they steal.
 */
export const publicView = (hand: Hand): Hand => {
  const shown = new Set((hand.showdown ?? []).map((entry) => entry.playerId));
  return {
    ...hand,
    seats: hand.seats.map((seat) => ({
      ...seat,
      hole: shown.has(seat.playerId) ? seat.hole : [],
    })),
    // The deck is the rest of the game. It never goes anywhere.
    deck: [],
  };
};

export const privateView = (
  hand: Hand,
  playerId: string,
): { playerId: string; hole: Hand["seats"][number]["hole"] } | null => {
  const seat = hand.seats.find((candidate) => candidate.playerId === playerId);
  return seat ? { playerId, hole: seat.hole } : null;
};

/** What API Gateway hands over once it has verified the token. */
export type VerifiedRequest = {
  pathParameters?: Record<string, string | undefined> | null;
  body?: string | null;
  requestContext?: {
    requestId?: string;
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
};

export type Refusal = { error: string };

/**
 * Which player this request is allowed to act as.
 *
 * **The single most important line in this file.** A token that passes the
 * authorizer only proves somebody is signed in — sign-up is open, so that is
 * anybody at all. Without this, a stranger holding a table id could fold
 * somebody else's hand, and the engine would apply it happily: it checks that
 * the *claimed* player is to act, and the claim would be a lie.
 *
 * The player id **is** the Cognito subject. Not a field in the body, not a
 * header — the one value in the request the caller cannot choose, because API
 * Gateway put it there after verifying a signature. A body field that
 * disagrees is not reconciled or preferred; it is refused, because a request
 * asking to act as somebody else is not a request with a typo in it.
 */
export const actingPlayer = (
  request: VerifiedRequest,
  claimedPlayerId?: string,
): { playerId: string } | Refusal => {
  const sub = request.requestContext?.authorizer?.jwt?.claims?.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    return { error: "unauthenticated" };
  }
  if (claimedPlayerId !== undefined && claimedPlayerId !== sub) {
    return { error: "you cannot act for another player" };
  }
  return { playerId: sub };
};

/**
 * Which table this request is about.
 *
 * **The path, never the body.** They are two places to say the same thing, and
 * whenever there are two, something eventually reads the wrong one: a rate
 * limit or an authorizer keyed on `{tableId}` would be guarding a table the
 * request is not touching, and the access log would name it wrongly for good
 * measure. A body that disagrees is refused rather than ignored — silently
 * preferring one is how the two drift apart in the first place.
 */
export const targetTable = (
  request: VerifiedRequest,
  bodyTableId?: string,
): { tableId: string } | Refusal => {
  const tableId = request.pathParameters?.tableId;
  if (typeof tableId !== "string" || tableId.length === 0) {
    return { error: "no table" };
  }
  if (bodyTableId !== undefined && bodyTableId !== tableId) {
    return { error: "the table in the body is not the table in the path" };
  }
  return { tableId };
};

export const isRefusal = (value: unknown): value is Refusal =>
  typeof value === "object" && value !== null && "error" in value;

/**
 * The Lambda entry point.
 *
 * Read, decide, write under a condition, answer. **The answer is deliberately
 * thin**: accepted or rejected, and nothing about the table. Every player
 * learns what happened from the event on the channel, including the one who
 * acted — one code path for state instead of two that can disagree, and the
 * thing that makes optimistic prediction on a phone safe.
 *
 * **The write happens before the publish, and the response says whether the
 * publish worked.** That order is the only safe one: publishing first would
 * announce a hand that might not be stored, and every phone would then be
 * ahead of the authority with no way to find out. The other way round, a
 * failed publish leaves the table correct and the screens stale — which the
 * next action or a reconnect fixes, and which the response admits to rather
 * than reporting as a clean success.
 */
export const handler = async (request: VerifiedRequest): Promise<Response> => {
  const started = Date.now();
  const body = parseBody(request.body);

  // Identity first, before anything is read or written. A token that passes
  // the authorizer proves only that somebody is signed in — sign-up is open,
  // so that is anybody at all.
  const actor = actingPlayer(request, body.playerId);
  if (isRefusal(actor)) return refuse(403, actor.error, request);

  const table = targetTable(request, body.tableId);
  if (isRefusal(table)) return refuse(400, table.error, request);

  const action = body.action;
  if (!action) return refuse(400, "no action", request);
  const expectedVersion = body.expectedVersion;
  if (expectedVersion === undefined) {
    return refuse(400, "no expected version", request);
  }

  const store = tableStore();
  const stored = await store.read(table.tableId);
  if (!stored) return refuse(404, "no such table", request);

  const outcome = applyAction(stored, {
    tableId: table.tableId,
    playerId: actor.playerId,
    action,
    expectedVersion,
  });

  if (outcome.status === "stale") {
    // Not an error. Somebody else acted, or this is a retry of a request that
    // already landed, and either way the client should look again.
    return answer(409, { status: "stale", version: outcome.currentVersion });
  }
  if (outcome.status === "rejected") {
    return answer(422, { status: "rejected", reason: outcome.reason });
  }

  const written = await store.write(
    table.tableId,
    outcome.table,
    stored.version,
    Date.now(),
  );
  if (!written) {
    // The state moved between the read and the write. The decision was made
    // against cards that are no longer on the table, so it is not retried —
    // see `tableStore`.
    return answer(409, { status: "stale" });
  }

  // Hole cards go only to the channel their owner subscribes to, and the
  // shared view has every one of them stripped — see `eventsFor`, which is the
  // security boundary of the whole feature.
  const published = await publisher().send(
    eventsFor(table.tableId, outcome.table),
  );

  log("info", "action applied", {
    requestId: request.requestContext?.requestId,
    accountId: actor.playerId,
    tableId: table.tableId,
    version: outcome.table.version,
    handComplete: outcome.handComplete,
    published,
    durationMs: Date.now() - started,
  });

  return answer(202, {
    status: "applied",
    version: outcome.table.version,
    // Reported rather than assumed. A client told the publish failed can ask
    // for the table again instead of waiting for an event that is not coming.
    published,
  });
};

export type Response = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const answer = (statusCode: number, body: unknown): Response => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/** Refuse, and say so in the log as well as in the response. */
const refuse = (
  statusCode: number,
  reason: string,
  request: VerifiedRequest,
): Response => {
  log("warn", "action refused", {
    requestId: request.requestContext?.requestId,
    reason,
    statusCode,
  });
  return answer(statusCode, { status: "refused", reason });
};

/**
 * The store, built once per container rather than per invocation.
 *
 * A DynamoDB client sets up a connection pool and resolves credentials on
 * construction, and doing that per request adds tens of milliseconds to every
 * one — on a warm container, for nothing.
 */
let store: TableStore | null = null;
const tableStore = (): TableStore => {
  if (store) return store;
  const tableName = process.env.TABLE_NAME;
  // Thrown rather than defaulted: a table name guessed from a convention is a
  // Lambda writing hands into whatever happens to be there.
  if (!tableName) throw new Error("TABLE_NAME is not set");
  store = createTableStore(tableName);
  return store;
};

/** For tests, which need each case to start from a known store. */
export const useTableStore = (replacement: TableStore | null): void => {
  store = replacement;
};

let events: Publisher | null = null;
const publisher = (): Publisher => {
  if (events) return events;
  const endpoint = process.env.EVENT_API_HTTP;
  if (!endpoint) throw new Error("EVENT_API_HTTP is not set");
  events = createPublisher(
    // The stack passes the bare DNS name; a scheme is what `fetch` needs.
    endpoint.startsWith("http") ? endpoint : `https://${endpoint}`,
    process.env.AWS_REGION ?? "",
  );
  return events;
};

/** For tests, so nothing here ever tries to reach AppSync. */
export const usePublisher = (replacement: Publisher | null): void => {
  events = replacement;
};

/**
 * Whatever the caller sent, treated as untrusted and never trusted for
 * identity.
 *
 * The action is checked only far enough to be an object with a type. The
 * engine refuses anything it does not understand, and duplicating its rules
 * here is how the two versions of them drift apart — the wrong kind of
 * defence in depth, where the second layer is a worse copy of the first.
 */
export const parseBody = (
  body?: string | null,
): {
  playerId?: string;
  tableId?: string;
  action?: BettingAction;
  expectedVersion?: number;
} => {
  if (!body) return {};
  try {
    const parsed: unknown = JSON.parse(body);
    // An array is an object to `typeof`, and a body of `[]` is not a request.
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const record = parsed as Record<string, unknown>;
    return {
      playerId:
        typeof record.playerId === "string" ? record.playerId : undefined,
      tableId: typeof record.tableId === "string" ? record.tableId : undefined,
      action: isAction(record.action) ? record.action : undefined,
      expectedVersion:
        typeof record.expectedVersion === "number" &&
        Number.isInteger(record.expectedVersion)
          ? record.expectedVersion
          : undefined,
    };
  } catch {
    // Unparseable is the same as absent for these fields; the request is
    // refused below for want of an action, not for want of JSON.
    return {};
  }
};

const isAction = (value: unknown): value is BettingAction =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { type?: unknown }).type === "string";
