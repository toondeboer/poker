import { afterEach, describe, expect, it } from "vitest";
import {
  handler,
  usePublisher,
  useTableStore,
  type StoredTable,
} from "../lib/lambda/tableAction";
import type { Publication } from "../lib/lambda/tablePublisher";
import {
  createSession,
  startNextHand,
  createRandom,
  legalActions,
} from "@poker/core";
import type { TableStore } from "../lib/lambda/tableStore";

/** A real hand, dealt by the real engine, so the rules are not mocked. */
const dealtTable = (): StoredTable => {
  const session = startNextHand(
    createSession({ players: ["u-1", "u-2", "u-3"], startingStack: 200 }),
    { smallBlind: 1, bigBlind: 2, random: createRandom(4) },
  );
  return { hand: session.hand!, version: 3 };
};

/** Whoever the engine says is to act. */
const toAct = (table: StoredTable) => legalActions(table.hand)!.playerId;

type Written = {
  tableId: string;
  table: StoredTable;
  expectedVersion: number;
};

/** Captures what would have been published, and never reaches a network. */
const publisherThatWorks = (ok = true) => {
  const sent: Publication[][] = [];
  usePublisher({
    async send(publications) {
      sent.push([...publications]);
      return ok;
    },
  });
  return sent;
};

const storeThatWorks = (initial: StoredTable | null) => {
  const writes: Written[] = [];
  const store: TableStore = {
    async read() {
      return initial;
    },
    async write(tableId, table, expectedVersion) {
      writes.push({ tableId, table, expectedVersion });
      return true;
    },
  };
  useTableStore(store);
  return writes;
};

const request = (over: {
  sub?: string;
  tableId?: string;
  body?: Record<string, unknown>;
}) => ({
  pathParameters: { tableId: over.tableId ?? "t-1" },
  requestContext: {
    requestId: "r-1",
    authorizer: { jwt: { claims: { sub: over.sub ?? "u-1" } } },
  },
  body: JSON.stringify(over.body ?? {}),
});

const parsed = (response: { body: string }) =>
  JSON.parse(response.body) as Record<string, unknown>;

afterEach(() => {
  useTableStore(null);
  usePublisher(null);
});

describe("who is allowed to act", () => {
  it("refuses a caller with no verified subject", async () => {
    storeThatWorks(dealtTable());
    const response = await handler({
      pathParameters: { tableId: "t-1" },
      body: "{}",
    });
    expect(response.statusCode).toBe(403);
  });

  it("refuses a request asking to act for somebody else", async () => {
    // The check that stops a stranger with a table id folding a victim's hand.
    storeThatWorks(dealtTable());
    const response = await handler(
      request({ sub: "u-1", body: { playerId: "u-2" } }),
    );
    expect(response.statusCode).toBe(403);
    expect(parsed(response).reason).toContain("another player");
  });

  it("refuses before it reads anything", async () => {
    // Identity is checked first on purpose: an unauthenticated request should
    // not be able to make the backend do work, however cheap.
    let reads = 0;
    useTableStore({
      async read() {
        reads += 1;
        return dealtTable();
      },
      async write() {
        return true;
      },
    });
    await handler({ pathParameters: { tableId: "t-1" }, body: "{}" });
    expect(reads).toBe(0);
  });
});

describe("what is being acted on", () => {
  it("refuses a body naming a different table from the path", async () => {
    storeThatWorks(dealtTable());
    const response = await handler(
      request({ body: { tableId: "somewhere-else" } }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("says so when there is no such table", async () => {
    storeThatWorks(null);
    const table = dealtTable();
    const response = await handler(
      request({
        sub: toAct(table),
        body: { action: { type: "fold" }, expectedVersion: 3 },
      }),
    );
    expect(response.statusCode).toBe(404);
  });

  it("refuses a request with no action or no version", async () => {
    storeThatWorks(dealtTable());
    const failures: string[] = [];
    for (const body of [
      {},
      { action: { type: "fold" } },
      { expectedVersion: 3 },
      { action: "fold", expectedVersion: 3 },
    ]) {
      const response = await handler(request({ body }));
      if (response.statusCode !== 400) failures.push(JSON.stringify(body));
    }
    expect(failures).toEqual([]);
  });
});

describe("acting", () => {
  it("applies it and writes it back one version on", async () => {
    const table = dealtTable();
    const writes = storeThatWorks(table);
    publisherThatWorks();
    const response = await handler(
      request({
        sub: toAct(table),
        body: { action: { type: "fold" }, expectedVersion: 3 },
      }),
    );

    expect(response.statusCode).toBe(202);
    expect(parsed(response).version).toBe(4);
    expect(writes).toHaveLength(1);
    expect(writes[0].expectedVersion).toBe(3);
    expect(writes[0].table.version).toBe(4);
  });

  it("tells the caller nothing about the table", async () => {
    // Every player learns what happened from the channel, including the one
    // who acted. Two paths for the same state is two things that can disagree.
    const table = dealtTable();
    storeThatWorks(table);
    publisherThatWorks();
    const response = await handler(
      request({
        sub: toAct(table),
        body: { action: { type: "fold" }, expectedVersion: 3 },
      }),
    );
    expect(response.body).not.toContain("hole");
    expect(response.body).not.toContain("deck");
  });

  it("says whether the publish worked, rather than assuming it did", async () => {
    // A 202 that means "half of this worked" is worse than an error. A client
    // told the publish failed can ask for the table again instead of waiting
    // for an event that is not coming.
    const table = dealtTable();
    storeThatWorks(table);
    publisherThatWorks(false);
    const response = await handler(
      request({
        sub: toAct(table),
        body: { action: { type: "fold" }, expectedVersion: 3 },
      }),
    );
    expect(response.statusCode).toBe(202);
    expect(parsed(response).published).toBe(false);
  });

  it("writes before it publishes", async () => {
    // The only safe order. Publishing first announces a hand that might not be
    // stored, and every phone is then ahead of the authority with no way to
    // find out.
    const table = dealtTable();
    const order: string[] = [];
    useTableStore({
      async read() {
        return table;
      },
      async write() {
        order.push("write");
        return true;
      },
    });
    usePublisher({
      async send() {
        order.push("publish");
        return true;
      },
    });

    await handler(
      request({
        sub: toAct(table),
        body: { action: { type: "fold" }, expectedVersion: 3 },
      }),
    );
    expect(order).toEqual(["write", "publish"]);
  });

  it("publishes nothing when the write did not land", async () => {
    // Otherwise a stale action is announced to every phone at the table.
    const table = dealtTable();
    useTableStore({
      async read() {
        return table;
      },
      async write() {
        return false;
      },
    });
    const sent = publisherThatWorks();
    await handler(
      request({
        sub: toAct(table),
        body: { action: { type: "fold" }, expectedVersion: 3 },
      }),
    );
    expect(sent).toEqual([]);
  });

  it("rejects an action from somebody whose turn it is not", async () => {
    const table = dealtTable();
    storeThatWorks(table);
    const waiting = ["u-1", "u-2", "u-3"].find((id) => id !== toAct(table))!;
    const response = await handler(
      request({
        sub: waiting,
        body: { action: { type: "fold" }, expectedVersion: 3 },
      }),
    );
    expect(response.statusCode).toBe(422);
    expect(parsed(response).reason).toContain("turn");
  });
});

describe("two people acting at once", () => {
  it("tells a client acting on an old version to look again", async () => {
    const table = dealtTable();
    storeThatWorks(table);
    const response = await handler(
      request({
        sub: toAct(table),
        body: { action: { type: "fold" }, expectedVersion: 2 },
      }),
    );
    expect(response.statusCode).toBe(409);
    expect(parsed(response)).toEqual({ status: "stale", version: 3 });
  });

  it("does not retry a decision made against cards that have moved", async () => {
    // The subtle one. Re-running a fold against the new state is not a retry;
    // it applies a choice to a situation the player never saw.
    const table = dealtTable();
    let writes = 0;
    useTableStore({
      async read() {
        return table;
      },
      async write() {
        writes += 1;
        return false; // somebody else got there first
      },
    });

    const response = await handler(
      request({
        sub: toAct(table),
        body: { action: { type: "fold" }, expectedVersion: 3 },
      }),
    );
    expect(writes).toBe(1);
    expect(response.statusCode).toBe(409);
  });
});

describe("a hand that plays out", () => {
  it("keeps working over several actions, version by version", async () => {
    // Not a mock of the rules: the engine deals, the handler applies, and the
    // stored version walks forward one at a time.
    let table = dealtTable();
    publisherThatWorks();
    useTableStore({
      async read() {
        return table;
      },
      async write(_id, next) {
        table = next;
        return true;
      },
    });

    const versions: number[] = [];
    for (let turn = 0; turn < 3; turn += 1) {
      const legal = legalActions(table.hand);
      if (!legal) break;
      const response = await handler(
        request({
          sub: legal.playerId,
          body: {
            action: legal.canCheck ? { type: "check" } : { type: "call" },
            expectedVersion: table.version,
          },
        }),
      );
      expect(response.statusCode).toBe(202);
      versions.push(table.version);
    }
    expect(versions).toEqual([4, 5, 6]);
  });
});
