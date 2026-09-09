import { describe, expect, it } from "vitest";
import type { TimerSyncMessage } from "@poker/core";
import { handle, type SessionRequest } from "../lib/lambda/sessions";
import type { SessionStore, StoredSession } from "../lib/lambda/sessionStore";

const message = (over: Partial<TimerSyncMessage> = {}): TimerSyncMessage => ({
  version: 1,
  sender: "phone-a",
  remaining: 540,
  duration: 600,
  paused: false,
  blindIndex: 2,
  ...over,
});

/** A store that remembers, so the handler's decisions are what is under test. */
const fakeStore = (seed: Record<string, StoredSession> = {}) => {
  const rows = new Map<string, StoredSession>(Object.entries(seed));
  const calls: string[] = [];
  const store: SessionStore = {
    async host(joinCode, now) {
      calls.push(`host:${joinCode}`);
      if (rows.has(joinCode)) return false;
      rows.set(joinCode, { joinCode, message: null, hostedAt: now });
      return true;
    },
    async read(joinCode) {
      calls.push(`read:${joinCode}`);
      return rows.get(joinCode) ?? null;
    },
    async publish(joinCode, published, now) {
      calls.push(`publish:${joinCode}`);
      if (!rows.has(joinCode)) return false;
      rows.set(joinCode, { joinCode, message: published, hostedAt: now });
      return true;
    },
  };
  return { store, rows, calls };
};

const call = async (
  request: SessionRequest,
  store: SessionStore,
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const response = await handle(request, store, 1_000);
  return {
    status: response.statusCode,
    body: JSON.parse(response.body) as Record<string, unknown>,
  };
};

describe("hosting a session", () => {
  it("claims the code the app generated", async () => {
    const { store, rows } = fakeStore();
    const result = await call(
      {
        routeKey: "POST /sessions",
        body: JSON.stringify({ joinCode: "CDFGHJ" }),
      },
      store,
    );
    expect(result.status).toBe(201);
    expect(result.body.joinCode).toBe("CDFGHJ");
    expect(rows.get("CDFGHJ")?.message).toBeNull();
  });

  it("normalises what it is given, because a code is typed by a person", async () => {
    const { store, rows } = fakeStore();
    await call(
      {
        routeKey: "POST /sessions",
        body: JSON.stringify({ joinCode: " cdfghj " }),
      },
      store,
    );
    expect(rows.has("CDFGHJ")).toBe(true);
  });

  it("refuses a code that is not in the alphabet", async () => {
    // The alphabet drops the characters that get misheard across a table, so a
    // code containing one was never generated here and is a typo.
    const { store } = fakeStore();
    const result = await call(
      {
        routeKey: "POST /sessions",
        body: JSON.stringify({ joinCode: "ABCDEF" }),
      },
      store,
    );
    expect(result.status).toBe(400);
  });

  it("refuses a second claim on a code somebody holds", async () => {
    // Two phones generating the same code in the same moment must not both
    // believe they own it — one silently joining the other's table is worse
    // than being told to try again.
    const { store } = fakeStore({
      CDFGHJ: { joinCode: "CDFGHJ", message: null, hostedAt: 0 },
    });
    const result = await call(
      {
        routeKey: "POST /sessions",
        body: JSON.stringify({ joinCode: "CDFGHJ" }),
      },
      store,
    );
    expect(result.status).toBe(409);
  });
});

describe("reading a session", () => {
  it("gives back the last snapshot published", async () => {
    const { store } = fakeStore({
      CDFGHJ: { joinCode: "CDFGHJ", message: message(), hostedAt: 0 },
    });
    const result = await call(
      { routeKey: "GET /sessions/{code}", pathParameters: { code: "CDFGHJ" } },
      store,
    );
    expect(result.status).toBe(200);
    expect(result.body.message).toEqual(message());
  });

  it("is 404 for a code nobody hosted", async () => {
    const { store } = fakeStore();
    const result = await call(
      { routeKey: "GET /sessions/{code}", pathParameters: { code: "CDFGHJ" } },
      store,
    );
    expect(result.status).toBe(404);
  });

  it("never lets a response be cached", async () => {
    // A cached clock shows a paused timer still running, which is the one
    // thing this must not do.
    const { store } = fakeStore({
      CDFGHJ: { joinCode: "CDFGHJ", message: message(), hostedAt: 0 },
    });
    const response = await handle(
      { routeKey: "GET /sessions/{code}", pathParameters: { code: "CDFGHJ" } },
      store,
      1_000,
    );
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});

describe("publishing", () => {
  it("overwrites the row, because only the latest state matters", async () => {
    const { store, rows } = fakeStore({
      CDFGHJ: { joinCode: "CDFGHJ", message: message(), hostedAt: 0 },
    });
    const next = message({ version: 2, remaining: 480 });
    const result = await call(
      {
        routeKey: "POST /sessions/{code}",
        pathParameters: { code: "CDFGHJ" },
        body: JSON.stringify({ message: next }),
      },
      store,
    );
    expect(result.status).toBe(200);
    expect(rows.get("CDFGHJ")?.message).toEqual(next);
  });

  it("does not arbitrate versions, because the clients already do", async () => {
    // `shouldApply` resolves conflicts identically on every device. A server
    // that also decided would be a second opinion, and the two could disagree.
    const { store, rows } = fakeStore({
      CDFGHJ: {
        joinCode: "CDFGHJ",
        message: message({ version: 9 }),
        hostedAt: 0,
      },
    });
    const stale = message({ version: 2 });
    await call(
      {
        routeKey: "POST /sessions/{code}",
        pathParameters: { code: "CDFGHJ" },
        body: JSON.stringify({ message: stale }),
      },
      store,
    );
    expect(rows.get("CDFGHJ")?.message).toEqual(stale);
  });

  it("refuses a session nobody hosted, so a typo does not make a table of one", async () => {
    const { store } = fakeStore();
    const result = await call(
      {
        routeKey: "POST /sessions/{code}",
        pathParameters: { code: "CDFGHJ" },
        body: JSON.stringify({ message: message() }),
      },
      store,
    );
    expect(result.status).toBe(404);
  });

  it("refuses a body with no message in it", async () => {
    const { store } = fakeStore({
      CDFGHJ: { joinCode: "CDFGHJ", message: null, hostedAt: 0 },
    });
    const result = await call(
      {
        routeKey: "POST /sessions/{code}",
        pathParameters: { code: "CDFGHJ" },
        body: JSON.stringify({}),
      },
      store,
    );
    expect(result.status).toBe(400);
  });
});

describe("what it refuses before touching the store", () => {
  it("rejects a malformed code without a read", async () => {
    // A polled route: every viewer asks all evening, so the cheapest possible
    // answer to nonsense is the one that never reaches DynamoDB.
    const { store, calls } = fakeStore();
    const result = await call(
      { routeKey: "GET /sessions/{code}", pathParameters: { code: "nope" } },
      store,
    );
    expect(result.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("is 404 for a route it does not serve", async () => {
    const { store } = fakeStore();
    const result = await call(
      {
        routeKey: "DELETE /sessions/{code}",
        pathParameters: { code: "CDFGHJ" },
      },
      store,
    );
    expect(result.status).toBe(404);
  });
});
