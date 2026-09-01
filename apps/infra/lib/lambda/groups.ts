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

import { MAX_PLAYERS, type GameResult, type GroupState, type Placing, type Player } from "@poker/core";
import { log } from "./logging";
import { anotherAdmin, isUsableId, may, type GroupAction } from "./groupKeys";
import { createGroupStore, type GroupStore } from "./groupStore";
import { deleteAccount } from "./deleteAccount";
import { randomBytes, randomUUID } from "node:crypto";
import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

/**
 * An invite token.
 *
 * **Not the six-character join code.** That one is built to be read aloud
 * across a table, so it drops every character that gets misheard and is short
 * enough to say — and short enough to guess. A link is pasted, never spoken, so
 * it can afford real entropy, and it needs it: this invite does not expire, so
 * anybody who ever guesses one is in the group until somebody rotates it.
 */
export const createInviteToken = (
  random: (size: number) => Buffer = randomBytes,
): string => random(24).toString("base64url");

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

const isPlayer = (value: unknown): value is Player => {
  if (typeof value !== "object" || value === null) return false;
  const player = value as Player;
  // **Not merely `typeof === "string"`.** An empty id is written happily and
  // then dropped by `boardFrom` on every read: a row that exists, answered 200,
  // never appears, and cannot be deleted through an API that addresses it by
  // the id it does not have. A `#` would break the key it lands in.
  return isUsableId(player.id) && typeof player.name === "string" &&
    player.name.trim().length > 0;
};

/**
 * The game, rebuilt from the fields we know.
 *
 * **Validating is not enough when the object is stored verbatim and served to
 * every member.** Unknown keys ride along into everybody else's app, and an
 * unbounded array is somebody else's rendering problem. The player route has
 * always rebuilt `{id, name}`; this is the same idea, and it is why a result is
 * checked field by field above rather than waved through.
 */
export const cleanResult = (result: GameResult): GameResult => ({
  id: result.id,
  playedAt: result.playedAt,
  playerIds: result.playerIds.slice(0, MAX_PLAYERS),
  placings: result.placings.slice(0, MAX_PLAYERS).map((placing) => ({
    playerId: placing.playerId,
    place: placing.place,
    winnings: placing.winnings,
  })),
  buyIn: result.buyIn,
  bounty: result.bounty,
  // Optional, and only for a game the app dealt — a game written down by hand
  // cannot say who knocked whom out.
  ...(Array.isArray(result.knockouts)
    ? {
        knockouts: result.knockouts.slice(0, MAX_PLAYERS).map((k) => ({
          playerId: k.playerId,
          count: k.count,
          bounty: k.bounty,
        })),
      }
    : {}),
});

const isPlacing = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return false;
  const placing = value as Placing;
  return (
    isUsableId(placing.playerId) &&
    Number.isInteger(placing.place) &&
    placing.place > 0 &&
    typeof placing.winnings === "number" &&
    Number.isFinite(placing.winnings)
  );
};

/**
 * A game, checked properly before it is believed.
 *
 * **This is stored verbatim and then served to every member of the group.** A
 * client sending a malformed `placings` does not break its own screen; it puts
 * something on a shared board that everybody else's app then has to render.
 * The player route sidesteps this by rebuilding `{id, name}` and ignoring the
 * rest — a result is too big for that, so it is validated instead.
 *
 * The engine's own rules are not duplicated here. What is checked is the shape
 * the board depends on: ids that can be found again, numbers that are numbers.
 */
const isResult = (value: unknown): value is GameResult => {
  if (typeof value !== "object" || value === null) return false;
  const result = value as GameResult;
  return (
    isUsableId(result.id) &&
    Number.isFinite(result.playedAt) &&
    Array.isArray(result.playerIds) &&
    result.playerIds.every(isUsableId) &&
    Array.isArray(result.placings) &&
    result.placings.every(isPlacing) &&
    typeof result.buyIn === "number" &&
    Number.isFinite(result.buyIn) &&
    typeof result.bounty === "number" &&
    Number.isFinite(result.bounty)
  );
};

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

  if (route === "DELETE /me") {
    // Everything this account touched, then the account. See `deleteAccount`
    // for why Cognito is last and why every step before it is re-runnable.
    const report = await deleteAccount(caller, store, deleteUser(), requestId);
    return json(200, report);
  }

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

  if (route === "POST /groups") {
    const name = body.name;
    if (typeof name !== "string" || name.trim().length === 0) {
      return json(400, { error: "a group needs a name" });
    }
    const id = randomUUID();
    // The founder is an admin, in the same transaction. A group whose creator
    // is only a member is a group nobody could ever remove a player from.
    const outcome = await store.createGroup(id, name.trim(), caller, now);
    if (outcome.status !== "ok") {
      return json(409, { status: "conflict", reason: outcome.reason });
    }
    log("info", "group created", { requestId, accountId: caller, groupId: id });
    return json(201, { groupId: id, name: name.trim(), createdAt: now });
  }

  if (route === "POST /invites/{token}") {
    const token = request.pathParameters?.token;
    if (!token) return json(400, { error: "no token" });
    const invited = await store.groupForInvite(token);
    // The same answer for an unknown token, a revoked one, and a link to a
    // group that no longer exists. Distinguishing them would tell somebody
    // holding an old link that it used to work, which is a fact about a group
    // they are not in — and the board check is not only privacy: an invite row
    // outlives the group it names, and joining one would grant a membership to
    // something that answers 404 forever.
    if (!invited || !(await store.board(invited))) {
      return json(404, { error: "that link is no longer valid" });
    }
    const outcome = await store.join(caller, invited, "member", now);
    // Already a member is a success: somebody tapping a pinned link a second
    // time expects to end up in the group, not to be told off.
    log("info", "invite redeemed", { requestId, accountId: caller, groupId: invited });
    return json(200, { groupId: invited, joined: outcome.status === "ok" });
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
      const outcome = await store.recordGame(groupId, cleanResult(body.result));
      return answer(outcome, requestId, { groupId, caller });
    }

    case "POST /groups/{groupId}/claims": {
      const allowed = await authorize(store, caller, groupId, "claimPlayer");
      if (!allowed.ok) return allowed.response;
      const playerId = body.playerId;
      // `isUsableId`, not `typeof === "string"`. An empty or `#`-bearing id
      // reaches `playerKey`, misses, and comes back as a 409 saying somebody
      // else holds that player — which is a confusing answer to a malformed
      // request.
      if (!isUsableId(playerId)) return json(400, { error: "no player" });
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
      if (!isUsableId(playerId)) return json(400, { error: "no player" });
      const outcome = await store.removePlayer(groupId, playerId, now);
      return answer(outcome, requestId, { groupId, caller });
    }

    case "DELETE /groups/{groupId}/games/{gameId}": {
      const allowed = await authorize(store, caller, groupId, "removeGame");
      if (!allowed.ok) return allowed.response;
      // Just the id. This used to need the whole game in the body, because the
      // sort key carried `playedAt` and only the client had it — which also
      // meant a body naming a different game could tombstone the wrong row.
      // Keying a result by its id removed the need and the hazard together.
      const gameId = request.pathParameters?.gameId;
      if (!isUsableId(gameId)) return json(400, { error: "no game" });
      const outcome = await store.removeGame(groupId, gameId, now);
      return answer(outcome, requestId, { groupId, caller });
    }

    case "GET /groups/{groupId}/members": {
      const allowed = await authorize(store, caller, groupId, "read");
      if (!allowed.ok) return allowed.response;
      // **Without this there is no way to promote a second admin.** The board
      // strips other people's `accountId`, and `GET /groups` returns ids only —
      // so an admin had no way to learn the subject that
      // `PUT /members/{accountId}` needs, and the route was undrivable.
      //
      // Members only, and only to members: this is the one place an account id
      // is disclosed, and it is disclosed to the people already on the board.
      const members = await store.members(groupId);
      return json(200, {
        members: members.map((m) => ({
          accountId: m.accountId,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      });
    }

    case "POST /groups/{groupId}/invite": {
      const allowed = await authorize(store, caller, groupId, "manageAdmins");
      if (!allowed.ok) return allowed.response;
      // Rotating is the only way to revoke a link that never expires, so
      // creating and revoking are deliberately the same operation: there is no
      // state where a group has two working links.
      const token = createInviteToken();
      // The token this replaces, asserted by the write so two people rotating
      // at once cannot both succeed and leave two working links.
      const previous = await store.inviteTokenOf(groupId);
      const outcome = await store.setInvite(groupId, token, previous, now);
      if (outcome.status !== "ok") {
        return json(409, { status: "conflict", reason: outcome.reason });
      }
      log("info", "invite rotated", { requestId, accountId: caller, groupId });
      return json(200, { token });
    }

    case "DELETE /groups/{groupId}/members/{accountId}": {
      const allowed = await authorize(store, caller, groupId, "manageAdmins");
      if (!allowed.ok) return allowed.response;
      const subject = request.pathParameters?.accountId;
      if (!isUsableId(subject)) return json(400, { error: "no account" });
      /**
       * **Without this, rotating an invite was not revocation.** A leaked link
       * lets somebody join; rotating it only stops the *next* person, and there
       * was no way at all to remove the one already on the board.
       *
       * Their claim goes too, so the player they held returns to the board
       * unclaimed rather than pointing at somebody who is no longer here.
       */
      const guarantor =
        anotherAdmin(await store.members(groupId), subject)?.accountId ?? null;
      const seat = await store.seatOf(subject, groupId);
      if (seat) await store.releaseClaim(subject, groupId, seat);
      const outcome = await store.leave(subject, groupId, guarantor);
      return answer(outcome, requestId, { groupId, caller });
    }

    case "PUT /groups/{groupId}/members/{accountId}": {
      const allowed = await authorize(store, caller, groupId, "manageAdmins");
      if (!allowed.ok) return allowed.response;
      const subject = request.pathParameters?.accountId;
      const role = body.role;
      if (!subject || (role !== "admin" && role !== "member")) {
        return json(400, { error: "no role" });
      }
      /**
       * **The last-admin guard is an assertion inside the write, not a check
       * out here.** Reading "is there another admin?" and then writing is
       * something two people can both pass — two admins demoting each other
       * each see the other and each proceed, leaving the group unmanageable.
       *
       * So the *name* of another admin goes into the transaction, which asserts
       * they are still one. Exactly one of two simultaneous demotions wins.
       */
      const guarantor =
        role === "member"
          ? (anotherAdmin(await store.members(groupId), subject)?.accountId ?? null)
          : null;
      if (role === "member" && !guarantor) {
        return json(409, {
          status: "conflict",
          reason: "a group needs at least one admin",
        });
      }
      const outcome = await store.setRole(subject, groupId, role, guarantor);
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

/**
 * Removing the Cognito user, which is the one step that cannot be undone.
 *
 * `AdminDeleteUser` rather than the client's own `DeleteUser`: by the time this
 * runs the server is doing the deleting, and it has already removed the data
 * the token would have been needed to authenticate against.
 */
let cognito: ((accountId: string) => Promise<void>) | null = null;
const deleteUser = (): ((accountId: string) => Promise<void>) => {
  if (cognito) return cognito;
  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) throw new Error("USER_POOL_ID is not set");
  cognito = async (accountId: string) => {
    const client = new CognitoIdentityProviderClient({});
    await client.send(
      new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: accountId }),
    );
  };
  return cognito;
};

/** For tests, so nothing here ever reaches a real user pool. */
export const useUserDeleter = (
  replacement: ((accountId: string) => Promise<void>) | null,
): void => {
  cognito = replacement;
};
