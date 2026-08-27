import { describe, expect, it } from "vitest";
import {
  TABLE_TTL_SECONDS,
  itemFor,
  tableFrom,
  tableKey,
} from "../lib/lambda/tableStore";
import type { Hand } from "@poker/core";

const hand = { street: "preflop", seats: [] } as unknown as Hand;

describe("where a table lives", () => {
  it("is prefixed, because this table holds seasons as well as hands", () => {
    // An unprefixed id is one collision away from a hand overwriting a group's
    // history.
    expect(tableKey("t-1")).toEqual({ pk: "TABLE#t-1", sk: "STATE" });
  });
});

describe("the item that gets written", () => {
  it("carries the hand and the version", () => {
    const item = itemFor("t-1", { hand, version: 4 }, 0);
    expect(item.version).toBe(4);
    expect(item.hand).toBe(hand);
  });

  it("expires in seconds, which is what DynamoDB's TTL wants", () => {
    // Milliseconds here would set a TTL a thousand times too far out: an item
    // that never expires, and a bill that grows for a year before anybody
    // notices. DynamoDB does not validate it, so nothing else would catch this.
    const now = 1_700_000_000_000;
    expect(itemFor("t-1", { hand, version: 1 }, now).expiresAt).toBe(
      1_700_000_000 + TABLE_TTL_SECONDS,
    );
  });

  it("keeps a table for a day, which is longer than any game night", () => {
    expect(TABLE_TTL_SECONDS).toBeGreaterThanOrEqual(12 * 60 * 60);
  });
});

describe("reading one back", () => {
  it("accepts what we wrote", () => {
    expect(tableFrom(itemFor("t-1", { hand, version: 2 }, 0))).toEqual({
      hand,
      version: 2,
    });
  });

  it("refuses an item with no version", () => {
    // The one failure that silently loses somebody's action: without a
    // version, every conditional write becomes unconditional.
    const failures = [
      { hand },
      { hand, version: "2" },
      { hand, version: 1.5 },
      { hand, version: null },
    ].filter((item) => tableFrom(item) !== null);
    expect(failures).toEqual([]);
  });

  it("refuses an item with no hand", () => {
    const failures = [{ version: 1 }, { version: 1, hand: "a hand" }, {}, null, 7].filter(
      (item) => tableFrom(item) !== null,
    );
    expect(failures).toEqual([]);
  });

  it("says nothing is there when nothing is", () => {
    expect(tableFrom(undefined)).toBeNull();
  });
});
