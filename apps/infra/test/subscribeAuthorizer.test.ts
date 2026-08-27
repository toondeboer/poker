import { describe, expect, it } from "vitest";
import {
  authorize,
  tableFromChannel,
  type SubscribeEvent,
} from "../lib/lambda/subscribeAuthorizer";
import type { TableStore } from "../lib/lambda/tableStore";
import type { StoredTable } from "../lib/lambda/tableAction";
import { tableChannel, playerChannel } from "@poker/core";

const hand = { seats: [] } as unknown as StoredTable["hand"];

const storeWith = (table: StoredTable | null): TableStore => ({
  async read() {
    return table;
  },
  async write() {
    return true;
  },
});

const storeThatThrows = (): TableStore => ({
  async read() {
    throw new Error("DynamoDB is having a day");
  },
  async write() {
    return true;
  },
});

const subscribing = (sub: string, channel: string): SubscribeEvent => ({
  info: { channel: { path: channel } },
  identity: { sub },
});

const seated = (members: string[]): StoredTable => ({
  hand,
  version: 1,
  members,
});

describe("which table a channel is about", () => {
  it("reads the id out of the path", () => {
    expect(tableFromChannel(tableChannel("t-1"))).toBe("t-1");
  });

  it("refuses anything that is not a table channel", () => {
    // A guard that mis-parses a path checks the wrong table, and reads exactly
    // like a working one.
    const failures = [
      playerChannel("u-1", "t-1"),
      "/table",
      "/table/",
      "/table/t-1/extra",
      "table/t-1",
      "/other/t-1",
      "",
      undefined,
    ].filter((path) => tableFromChannel(path) !== null);
    expect(failures).toEqual([]);
  });
});

describe("who may watch a table", () => {
  it("lets a member subscribe", async () => {
    // `null` allows it. Not `true` — that is the contract AppSync defines.
    expect(
      await authorize(
        subscribing("u-1", tableChannel("t-1")),
        storeWith(seated(["u-1", "u-2"])),
      ),
    ).toBeNull();
  });

  it("refuses somebody who is merely signed in", async () => {
    // The whole hole: sign-up is open, so "authenticated" is anybody at all,
    // and a table id was the only thing standing between a stranger and every
    // bet, board and showdown of somebody else's game.
    const denial = await authorize(
      subscribing("stranger", tableChannel("t-1")),
      storeWith(seated(["u-1", "u-2"])),
    );
    expect(denial).toEqual({ error: "not a member of this table" });
  });
});

describe("failing closed", () => {
  const cases: [string, () => Promise<unknown>][] = [
    [
      "a caller with no subject",
      () =>
        authorize(
          { info: { channel: { path: tableChannel("t-1") } }, identity: null },
          storeWith(seated(["u-1"])),
        ),
    ],
    [
      "a channel that cannot be parsed",
      () => authorize(subscribing("u-1", "/nonsense"), storeWith(seated(["u-1"]))),
    ],
    [
      "a table that does not exist",
      () => authorize(subscribing("u-1", tableChannel("t-1")), storeWith(null)),
    ],
    [
      "a read that throws",
      () =>
        authorize(subscribing("u-1", tableChannel("t-1")), storeThatThrows()),
    ],
    [
      "a table with no membership list at all",
      () =>
        authorize(
          subscribing("u-1", tableChannel("t-1")),
          storeWith({ hand, version: 1 }),
        ),
    ],
    [
      "a table with an empty membership list",
      () =>
        authorize(subscribing("u-1", tableChannel("t-1")), storeWith(seated([]))),
    ],
  ];

  it("refuses every one of them", async () => {
    // There is no branch here that returns success because it ran out of
    // reasons to say no, which is the shape authorization bugs actually take.
    const allowed: string[] = [];
    for (const [name, run] of cases) {
      if ((await run()) === null) allowed.push(name);
    }
    expect(allowed).toEqual([]);
  });

  it("refuses rather than throwing, so a denial is not a broken function", async () => {
    // A thrown exception is an *invocation* failure, which AppSync reports
    // differently — and which would make a denial indistinguishable from an
    // outage.
    await expect(
      authorize(subscribing("u-1", tableChannel("t-1")), storeThatThrows()),
    ).resolves.toEqual({ error: "not a member of this table" });
  });

  it("says the same thing however it refused", async () => {
    // A caller learns whether they are a member. It should not also learn
    // whether the table exists, or whether the database is up.
    const reasons = new Set<string>();
    for (const [, run] of cases) {
      const result = (await run()) as { error?: string } | null;
      if (result?.error) reasons.add(result.error);
    }
    expect(reasons.size).toBe(1);
  });
});
