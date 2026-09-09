/**
 * The shared clock's three routes.
 *
 * Host a session, find one by its code, publish the current state. That is the
 * whole surface — see `sessionStore.ts` for why it is a row rather than a bus.
 *
 * ## Why these are authenticated, having nearly not been
 *
 * The first version of this left them open, on the argument `ROADMAP.md` makes
 * about the shared clock: a session carries a countdown and no cards, so "the
 * worst case is a stranger watching a countdown".
 *
 * **That argument is about subscribing, and it does not cover publishing.** A
 * session is peer-to-peer rather than a broadcast — any participant may send,
 * which is exactly why the protocol breaks version ties on `sender` ("two
 * people can reach for the phone at once"). So the join code is not a read
 * credential, it is a write one, and somebody holding a guessed code could
 * pause a table's clock and jump its blind level rather than merely watch it.
 *
 * Six characters of a 24-letter alphabet is ~191 million, so guessing is not a
 * practical attack. It is still the wrong shape to build: the app already
 * requires an account to join a shared board, so requiring one to join a shared
 * clock costs nothing that has not already been asked for, and it takes a
 * public *polled* route — the worst kind to leave open on a shared throttle —
 * off the API entirely.
 *
 * **The code still scopes the session.** Authentication answers "is this
 * somebody", the code answers "which table", and neither substitutes for the
 * other. There is deliberately no membership check beyond holding the code:
 * a clock is meant to be joinable by whoever is in the room.
 */

import { isValidJoinCode, normaliseJoinCode } from "@poker/core";
import { log } from "./logging";
import { createSessionStore, type SessionStore } from "./sessionStore";

export type SessionRequest = {
  routeKey?: string;
  pathParameters?: Record<string, string | undefined> | null;
  body?: string | null;
  requestContext?: { requestId?: string };
};

export type Response = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const json = (statusCode: number, body: unknown): Response => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    /**
     * **Never cached.** The whole value of a poll is that it reflects the last
     * five seconds; an intermediary holding a response for even a moment shows
     * a paused clock still running, which is the one thing a shared clock must
     * not do.
     */
    "cache-control": "no-store",
  },
  body: JSON.stringify(body),
});

const parse = (
  body: string | null | undefined,
): Record<string, unknown> | null => {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/**
 * The code from the path, normalised and checked.
 *
 * Normalised because it is typed by a person reading it off another screen, and
 * `normaliseJoinCode` already knows how that goes wrong — case, spaces, and the
 * characters the alphabet deliberately excludes.
 */
const codeFrom = (request: SessionRequest): string | null => {
  const raw = request.pathParameters?.code;
  if (!raw) return null;
  const code = normaliseJoinCode(raw);
  return isValidJoinCode(code) ? code : null;
};

export const handle = async (
  request: SessionRequest,
  store: SessionStore,
  now: number,
): Promise<Response> => {
  const route = request.routeKey ?? "";

  if (route.startsWith("POST /sessions ") || route === "POST /sessions") {
    const body = parse(request.body);
    const raw = typeof body?.joinCode === "string" ? body.joinCode : "";
    const code = normaliseJoinCode(raw);
    if (!isValidJoinCode(code)) {
      return json(400, { error: "that is not a usable join code" });
    }
    const claimed = await store.host(code, now);
    if (!claimed) {
      // Not an error the host can do anything about except try again, and the
      // app generates a fresh code rather than showing this to anybody.
      return json(409, { error: "that code is in use" });
    }
    log("info", "session hosted", { code });
    return json(201, { joinCode: code });
  }

  const code = codeFrom(request);
  if (!code) return json(400, { error: "that is not a usable join code" });

  if (route.startsWith("GET /sessions/")) {
    const session = await store.read(code);
    if (!session) return json(404, { error: "no such session" });
    return json(200, { joinCode: session.joinCode, message: session.message });
  }

  if (route.startsWith("POST /sessions/")) {
    const body = parse(request.body);
    const message = body?.message;
    if (typeof message !== "object" || message === null) {
      return json(400, { error: "no message" });
    }
    const published = await store.publish(
      code,
      message as Parameters<SessionStore["publish"]>[1],
      now,
    );
    // 404 rather than 409: from the caller's point of view a session that was
    // never hosted and one that has expired are the same thing, and the app
    // does the same thing about both.
    if (!published) return json(404, { error: "no such session" });
    return json(200, { ok: true });
  }

  return json(404, { error: "no such route" });
};

const TABLE_NAME = process.env.TABLE_NAME ?? "";

export const handler = async (request: SessionRequest): Promise<Response> =>
  handle(request, createSessionStore(TABLE_NAME), Date.now());
