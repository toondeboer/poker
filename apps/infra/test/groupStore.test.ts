import { describe, expect, it } from "vitest";
import {
  ConditionalCheckFailedException,
  ProvisionedThroughputExceededException,
  TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { GameResult } from "@poker/core";
import { createGroupStore } from "../lib/lambda/groupStore";
import {
  MEMBERS_INDEX,
  groupItem,
  membershipItem,
  playerItem,
  resultItem,
} from "../lib/lambda/groupKeys";

/**
 * A client that records what it was asked and answers with what it was told.
 *
 * Enough to assert the *shape* of every request — the conditions especially,
 * which are the part that decides whether a half-finished deletion can be run
 * again. Nothing here pretends to be DynamoDB.
 */
const fakeClient = (replies: unknown[] = []) => {
  const sent: Record<string, unknown>[] = [];
  const queue = [...replies];
  const client = {
    send: (command: { input: Record<string, unknown> }) => {
      sent.push(command.input);
      const next = queue.shift();
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next ?? {});
    },
  } as unknown as DynamoDBDocumentClient;
  return { client, sent };
};

const conditionFailed = () =>
  new ConditionalCheckFailedException({ $metadata: {}, message: "no" });

const game = (id = "r1", playedAt = 1_700_000_000_000): GameResult => ({
  id,
  playedAt,
  playerIds: ["p1"],
  placings: [],
  buyIn: 10,
  bounty: 0,
});

describe("reading a board", () => {
  it("asks for one partition and drops tombstones", async () => {
    const { client, sent } = fakeClient([
      {
        Items: [
          groupItem("g1", { name: "Thursday", createdAt: 1 }, 1),
          playerItem("g1", { id: "p1", name: "Ann" }),
          resultItem("g1", game()),
        ],
      },
    ]);
    const board = await createGroupStore("T", client).board("g1");
    expect(sent[0].ExpressionAttributeValues).toEqual({ ":pk": "GROUP#g1" });
    expect(board?.players).toHaveLength(1);
    expect(board?.results).toHaveLength(1);
  });

  it("reads consistently, because the caller is about to act on it", async () => {
    // An eventually consistent read can hand back a player somebody just
    // removed, and the next thing the caller does is decide using it.
    const { client, sent } = fakeClient([{ Items: [] }]);
    await createGroupStore("T", client).board("g1");
    expect(sent[0].ConsistentRead).toBe(true);
  });
});

describe("the permission read", () => {
  it("is strongly consistent and never touches the index", async () => {
    // **The assertion that matters most in this file.** A GSI read is
    // eventually consistent, so authorizing against one lets a demoted admin
    // keep deleting for as long as the index lags.
    const { client, sent } = fakeClient([
      { Item: membershipItem("acc", "g1", "admin", 1) },
    ]);
    const store = createGroupStore("T", client);
    expect(await store.membership("acc", "g1")).toMatchObject({ role: "admin" });
    expect(sent[0].ConsistentRead).toBe(true);
    expect(sent[0].IndexName).toBeUndefined();
  });

  it("is nobody when the row does not parse", async () => {
    const { client } = fakeClient([{ Item: { role: "owner" } }]);
    expect(await createGroupStore("T", client).membership("acc", "g1")).toBeNull();
  });
});

describe("listing members", () => {
  it("is the only thing that reads the index", async () => {
    const { client, sent } = fakeClient([
      { Items: [membershipItem("a", "g1", "admin", 1)] },
    ]);
    const members = await createGroupStore("T", client).members("g1");
    expect(sent[0].IndexName).toBe(MEMBERS_INDEX);
    expect(members).toHaveLength(1);
  });

  it("drops rows it cannot read rather than guessing a role", async () => {
    const { client } = fakeClient([
      { Items: [membershipItem("a", "g1", "admin", 1), { role: "wat" }] },
    ]);
    expect(await createGroupStore("T", client).members("g1")).toHaveLength(1);
  });
});

describe("removing things", () => {
  it("refuses to tombstone a player that is not there", async () => {
    // Without the condition, a tombstone for a mistyped id creates a row saying
    // "a thing that never existed is deleted" while the real player carries on.
    const { client, sent } = fakeClient([conditionFailed()]);
    const outcome = await createGroupStore("T", client).removePlayer("g1", "nope", 1);
    expect(outcome).toEqual({ status: "conflict", reason: "no such player" });
    expect(sent[0].ConditionExpression).toBe("attribute_exists(pk)");
  });

  it("rebuilds a game's key from the result it is given", async () => {
    // The sort key carries `playedAt` and the app deletes by id alone, so this
    // only works while a recorded game is immutable.
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).removeGame("g1", game("r7", 5), 1);
    expect((sent[0].Item as { sk: string }).sk).toBe(
      `RESULT#${"5".padStart(13, "0")}#r7`,
    );
  });

  it("lets a real failure through instead of calling it a conflict", async () => {
    // A throttle is not two people racing. Reporting it as a conflict would
    // tell the caller to decide again when it should simply retry.
    const { client } = fakeClient([
      new ProvisionedThroughputExceededException({ $metadata: {}, message: "slow" }),
    ]);
    await expect(
      createGroupStore("T", client).removePlayer("g1", "p1", 1),
    ).rejects.toThrow();
  });
});

describe("claiming a player", () => {
  const claim = async (reply?: unknown) => {
    const { client, sent } = fakeClient(reply ? [reply] : [{}]);
    const outcome = await createGroupStore("T", client).claimPlayer(
      "acc",
      "g1",
      "p1",
      99,
    );
    type Op = {
      Put?: { Item: Record<string, unknown>; ConditionExpression?: string };
      Update?: { ConditionExpression?: string };
    };
    return { outcome, items: (sent[0].TransactItems ?? []) as Op[] };
  };

  it("writes all three items in one transaction", async () => {
    // A claim without the player update shows an account a board it is not on;
    // the player without the claim is invisible to account deletion.
    const { items } = await claim();
    expect(items).toHaveLength(3);
  });

  it("refuses a player somebody already holds", async () => {
    const { items } = await claim();
    const update = items.find((i) => i.Update)?.Update;
    expect(update?.ConditionExpression).toBe(
      "attribute_exists(pk) AND attribute_not_exists(accountId)",
    );
  });

  it("does not demote an admin who claims a player", async () => {
    // Joining by claiming writes a `member` membership. Without the condition,
    // an admin claiming a player would reset their own role.
    const { items } = await claim();
    const membership = items.filter((i) => i.Put).at(-1)?.Put;
    expect(membership?.Item.role).toBe("member");
    expect(membership?.ConditionExpression).toBe("attribute_not_exists(pk)");
  });

  it("reports a cancelled transaction as a refusal, not an error", async () => {
    const { outcome } = await claim(
      new TransactionCanceledException({ $metadata: {}, message: "nope" }),
    );
    expect(outcome).toEqual({ status: "conflict", reason: "already claimed" });
  });
});

describe("releasing a claim", () => {
  it("only clears the account that still holds it", async () => {
    // Between reading the claim and writing this, the player may have been
    // released and re-claimed by somebody else. Clearing unconditionally would
    // unclaim the wrong person.
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).releaseClaim("acc", "g1", "p1");
    expect(sent[0].ConditionExpression).toBe("accountId = :account");
    expect(sent[0].UpdateExpression).toBe("REMOVE accountId");
  });

  it("is a conflict, not a crash, when it was already released", async () => {
    // Account deletion re-runs. A second pass has to be able to find this
    // already done and carry on.
    const { client } = fakeClient([conditionFailed()]);
    expect(await createGroupStore("T", client).releaseClaim("acc", "g1", "p1")).toEqual(
      { status: "conflict", reason: "claim already released" },
    );
  });
});

describe("what account deletion needs", () => {
  it("finds everything about a person in one query", async () => {
    // The reason claims are stored under the account. Any other shape means
    // scanning every group in the table to find what to release.
    const { client, sent } = fakeClient([
      { Items: [{ pk: "ACCOUNT#acc", sk: "GROUP#g1" }] },
    ]);
    await createGroupStore("T", client).belongings("acc");
    expect(sent[0].ExpressionAttributeValues).toEqual({ ":pk": "ACCOUNT#acc" });
    expect(sent[0].ConsistentRead).toBe(true);
  });

  it("deletes without a condition, so a second run still finishes", async () => {
    // The last step of deletion. A conditional delete would fail on a row a
    // previous attempt already removed, and the account could never finish
    // being deleted.
    const { client, sent } = fakeClient([{}, {}]);
    await createGroupStore("T", client).forget("acc", [
      { pk: "ACCOUNT#acc", sk: "GROUP#g1" },
      { pk: "ACCOUNT#acc", sk: "CLAIM#g1#p1" },
    ]);
    expect(sent).toHaveLength(2);
    expect(sent.every((s) => s.ConditionExpression === undefined)).toBe(true);
  });
});

describe("changing a role", () => {
  it("refuses to promote somebody who is not a member", async () => {
    // Would create a membership with no `joinedAt` — the field the heir to a
    // group is chosen by.
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).setRole("acc", "g1", "admin");
    expect(sent[0].ConditionExpression).toBe("attribute_exists(pk)");
  });
});
