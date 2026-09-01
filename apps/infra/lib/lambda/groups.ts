/**
 * Everything a shared leaderboard can be asked to do.
 *
 * One function behind several routes, because they share the thing that
 * actually matters: **every one of them authorizes before it acts**, and doing
 * that in one place is how it stays true of a route somebody adds later.
 *
 * The shape of a request here is deliberately unlike the poker table's. A table
 * action is a decision made against an exact state and the response says
 * nothing; a board is a set of independent facts, so these return what they
 * changed and the client merges it. See [SYNC.md](../../SYNC.md).
 */

import type { GameResult, GroupState, Player } from "@poker/core";
import { log } from "./logging";
import { may, type GroupAction } from "./groupKeys";
import { createGroupStore, type GroupStore } from "./groupStore";

export type VerifiedRequest = {
  routeKey?: string;
  pathParameters?: Record<string, string | undefined> | null;
  body?: string | null;
  requestContext?: {
    requestId?: string;
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
};

export type Response = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const json = (statusCode: number, body: unknown): Response => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * Who is calling, from the one field in the request they cannot choose.
 *
 * The subject, put there by API Gateway after it verified a signature — never a
 * body field, never a header. A request asking to act as somebody else is not a
 * request with a typo in it.
 */
export const callerOf = (request: VerifiedRequest): string | null => {
  const sub = request.requestContext?.authorizer?.jwt?.claims?.sub;
  return typeof sub === "string" && sub.length > 0 ? sub : null;
};

export const parseBody = (body?: string | null): Record<string, unknown> => {
  if (!body) return {};
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
};

/**
 * A board with the private bits of other people removed.
 *
 * **Only `accountId`.** It says which Cognito account holds a player, and
 * nobody at the table needs to know that — what they need is the name, which is
 * the thing on the board. The caller's *own* claim is kept, because the app
 * shows you which player is you.
 *
 * The same reasoning as the poker table's hole cards: a field that never leaves
 * the server cannot leak, whatever a client does with it.
 */
export const visibleTo = (caller: string, board: GroupState): GroupState => ({
  ...board,
  players: board.players.map((player) =>
    player.accountId && player.accountId !== caller
      ? { id: player.id, name: player.name }
      : player,
  ),
});

const isPlayer = (value: unknown): value is Player =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Player).id === "string" &&
  typeof (value as Player).name === "string";

const isResult = (value: unknown): value is GameResult =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as GameResult).id === "string" &&
  typeof (value as GameResult).playedAt === "number" &&
  Array.isArray((value as GameResult).playerIds);

/**
 * The check every route runs, and the reason this file has one entry point.
 *
 * `null` from `membership` is "not a member", and it is refused for *reading*
 * too. A shared board readable by anybody holding an id would make the id the
 * only thing protecting it, and ids travel — into logs, into a URL somebody
 * pastes, into a screenshot.
 *
 * **404, not 403, for a non-member.** Telling somebody "this group exists and
 * you may not see it" confirms a group id is real, which is the one bit an
 * outsider does not already have.
 */
const authorize = async (
  store: GroupStore,
  caller: string,
  groupId: string,
  action: GroupAction,
): Promise<{ ok: true } | { ok: false; response: Response }> => {
  const membership = await store.membership(caller, groupId);
  if (!membership) {
    return { ok: false, response: json(404, { error: "no such group" }) };
  }
  if (!may(membership, action)) {
    return {
      ok: false,
      // 403 here is safe and useful: they already know the group exists,
      // because they are on it.
      response: json(403, { error: "an admin has to do that" }),
    };
  }
  return { ok: true };
};

export const handler = async (request: VerifiedRequest): Promise<Response> => {
  const requestId = request.requestContext?.requestId;
  const caller = callerOf(request);
  if (!caller) {
    log("error", "authorized request with no subject", { requestId });
    return json(401, { error: "unauthenticated" });
  }

  const route = request.routeKey ?? "";
  const groupId = request.pathParameters?.groupId;
  const body = parseBody(request.body);
  const store = groupStore();
  const now = Date.now();

  // `GET /groups` is the one route with no group to authorize against — it *is*
  // the list of what this caller may see.
  if (route === "GET /groups") {
    const rows = await store.belongings(caller);
    return json(200, {
      groups: rows
        .filter((row) => row.sk.startsWith("GROUP#"))
        .map((row) => row.sk.slice("GROUP#".length)),
    });
  }

  if (!groupId) return json(400, { error: "no group" });

  switch (route) {
    case "GET /groups/{groupId}": {
      const allowed = await authorize(store, caller, groupId, "read");
      if (!allowed.ok) return allowed.response;
      const board = await store.board(groupId);
      // A membership pointing at a group that is not there is a deleted group
      // whose membership row outlived it. The same answer as never having been
      // a member: there is nothing to show.
      if (!board) return json(404, { error: "no such group" });
      return json(200, visibleTo(caller, board));
    }

    case "POST /groups/{groupId}/players": {
      const allowed = await authorize(store, caller, groupId, "addPlayer");
      if (!allowed.ok) return allowed.response;
      if (!isPlayer(body.player)) return json(400, { error: "no player" });
      // The client's `accountId` is ignored rather than refused: adding a
      // player is not claiming one, and the only way to link an account is the
      // claim route, which is a transaction that checks nobody else holds it.
      const outcome = await store.addPlayer(groupId, {
        id: body.player.id,
        name: body.player.name,
      });
      return answer(outcome, requestId, { groupId, caller });
    }

    case "POST /groups/{groupId}/games": {
      const allowed = await authorize(store, caller, groupId, "recordGame");
      if (!allowed.ok) return allowed.response;
      if (!isResult(body.result)) return json(400, { error: "no result" });
      const outcome = await store.recordGame(groupId, body.result);
      return answer(outcome, requestId, { groupId, caller });
    }

    case "POST /groups/{groupId}/claims": {
      const allowed = await authorize(store, caller, groupId, "claimPlayer");
      if (!allowed.ok) return allowed.response;
      const playerId = body.playerId;
      if (typeof playerId !== "string") return json(400, { error: "no player" });
      const outcome = await store.claimPlayer(caller, groupId, playerId, now);
      // A refused claim is an ordinary answer — somebody else got there, or
      // this account already holds a seat — and 409 says "look again" rather
      // than "you did something wrong".
      return answer(outcome, requestId, { groupId, caller });
    }

    case "DELETE /groups/{groupId}/players/{playerId}": {
      const allowed = await authorize(store, caller, groupId, "removePlayer");
      if (!allowed.ok) return allowed.response;
      const playerId = request.pathParameters?.playerId;
      if (!playerId) return json(400, { error: "no player" });
      const outcome = await store.removePlayer(groupId, playerId, now);
      return answer(outcome, requestId, { groupId, caller });
    }

    case "DELETE /groups/{groupId}/games/{gameId}": {
      const allowed = await authorize(store, caller, groupId, "removeGame");
      if (!allowed.ok) return allowed.response;
      // **The body carries the game, not just the id in the path.** The sort
      // key contains `playedAt`, and the client is the one holding it. A route
      // that took only an id would have to query the partition to find the row
      // first, which is a read on every delete to save the client sending a
      // number it already has.
      if (!isResult(body.result)) return json(400, { error: "no result" });
      if (body.result.id !== request.pathParameters?.gameId) {
        return json(400, { error: "the game in the body is not the one in the path" });
      }
      const outcome = await store.removeGame(groupId, body.result, now);
      return answer(outcome, requestId, { groupId, caller });
    }

    default:
      return json(404, { error: "no such route" });
  }
};

const answer = (
  outcome: { status: "ok" } | { status: "conflict"; reason: string },
  requestId: string | undefined,
  fields: { groupId: string; caller: string },
): Response => {
  if (outcome.status === "ok") return json(200, { status: "ok" });
  log("info", "write refused", {
    requestId,
    accountId: fields.caller,
    groupId: fields.groupId,
    reason: outcome.reason,
  });
  return json(409, { status: "conflict", reason: outcome.reason });
};

let store: GroupStore | null = null;
const groupStore = (): GroupStore => {
  if (store) return store;
  const tableName = process.env.TABLE_NAME;
  // Thrown rather than defaulted: a table name guessed from a convention is a
  // Lambda writing seasons into whatever happens to be there.
  if (!tableName) throw new Error("TABLE_NAME is not set");
  store = createGroupStore(tableName);
  return store;
};

/** For tests, which need each case to start from a known store. */
export const useGroupStore = (replacement: GroupStore | null): void => {
  store = replacement;
};
