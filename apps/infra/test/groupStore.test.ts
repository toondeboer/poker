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
  groupItem,
  memberItem,
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
      { Item: memberItem("g1", "acc", "admin", 1) },
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
  it("reads only the memberships, not the whole partition", async () => {
    // `DELETE /me` calls this once per group in a sequential loop under a
    // ten-second timeout; reading every player and every game to find the
    // memberships is most of that budget spent on rows it throws away.
    const { client, sent } = fakeClient([{ Items: [] }]);
    await createGroupStore("T", client).members("g1");
    expect(sent[0].KeyConditionExpression).toBe(
      "pk = :pk AND begins_with(sk, :member)",
    );
  });

  it("reads the group's own partition, consistently and with no index", async () => {
    // **The reason membership is written twice.** The previous design read an
    // eventually consistent index here, and every decision resting on it — who
    // inherits a group, whether demoting somebody strands it — was a race.
    const { client, sent } = fakeClient([
      { Items: [memberItem("g1", "a", "admin", 1)] },
    ]);
    const members = await createGroupStore("T", client).members("g1");
    expect(sent[0].IndexName).toBeUndefined();
    expect(sent[0].ConsistentRead).toBe(true);
    expect(members).toHaveLength(1);
  });

  it("drops rows it cannot read rather than guessing a role", async () => {
    const { client } = fakeClient([
      { Items: [memberItem("g1", "a", "admin", 1), { role: "wat" }] },
    ]);
    expect(await createGroupStore("T", client).members("g1")).toHaveLength(1);
  });
});

describe("removing things", () => {
  it("refuses to tombstone a player that is not there", async () => {
    // Without the condition, a tombstone for a mistyped id creates a row saying
    // "a thing that never existed is deleted" while the real player carries on.
    const { client, sent } = fakeClient([
      { Item: undefined },
      new TransactionCanceledException({
        $metadata: {},
        message: "no",
        CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
      }),
    ]);
    const outcome = await createGroupStore("T", client).removePlayer("g1", "nope", 1);
    expect(outcome).toEqual({
      status: "conflict",
      reason: "the player changed while it was being removed",
    });
    const ops = sent[1].TransactItems as { Put?: { ConditionExpression?: string } }[];
    expect(ops[0].Put?.ConditionExpression).toBe(
      "attribute_exists(pk) AND attribute_not_exists(accountId)",
    );
  });

  it("takes the claim with a removed player", async () => {
    // A claim outliving its player locks that account out of ever claiming a
    // replacement, since one seat per board is now the key.
    const { client, sent } = fakeClient([{ Item: { accountId: "acc" } }, {}]);
    await createGroupStore("T", client).removePlayer("g1", "p1", 1);
    const ops = sent[1].TransactItems as { Delete?: { Key: { sk: string } } }[];
    expect(ops.filter((o) => o.Delete).map((o) => o.Delete!.Key.sk)).toEqual(["CLAIM#g1"]);
  });

  it("refuses if the player was claimed between the read and the write", async () => {
    // Otherwise a claim landing in that window is silently discarded: the
    // player is tombstoned and the claimer keeps a seat pointing at nothing.
    const { client, sent } = fakeClient([{ Item: { playerId: "p1" } }, {}]);
    await createGroupStore("T", client).removePlayer("g1", "p1", 1);
    const ops = sent[1].TransactItems as { Put?: { ConditionExpression?: string } }[];
    expect(ops[0].Put?.ConditionExpression).toBe(
      "attribute_exists(pk) AND attribute_not_exists(accountId)",
    );
  });

  it("removes an unclaimed player without deleting anything else", async () => {
    const { client, sent } = fakeClient([{ Item: { playerId: "p1" } }, {}]);
    await createGroupStore("T", client).removePlayer("g1", "p1", 1);
    const ops = sent[1].TransactItems as { Delete?: unknown }[];
    expect(ops.filter((o) => o.Delete)).toHaveLength(0);
  });

  it("rotates an invite so two cannot be live at once", async () => {
    // Rotation is the only revocation a link that never expires has. The old
    // token is deleted in the same transaction, and the group row is updated
    // conditional on still carrying the token the caller read — so two
    // concurrent rotations cannot both win.
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).setInvite("g1", "new", "old", 1);
    const ops = sent[0].TransactItems as {
      Update?: { ConditionExpression?: string };
      Delete?: { Key: { pk: string } };
    }[];
    expect(ops.find((o) => o.Update)?.Update?.ConditionExpression).toBe(
      "inviteToken = :previous",
    );
    expect(ops.find((o) => o.Delete)?.Delete?.Key.pk).toBe("INVITE#old");
  });

  it("removes a game by its id alone", async () => {
    // It used to need the whole game, because the key carried `playedAt` and
    // only the client had it — which also meant a body naming a different game
    // could tombstone the wrong row.
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).removeGame("g1", "r7", 1);
    expect((sent[0].Item as { sk: string }).sk).toBe("RESULT#r7");
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
      Update?: { ConditionExpression?: string; UpdateExpression?: string };
    };
    return { outcome, items: (sent[0].TransactItems ?? []) as Op[] };
  };

  it("writes the claim, the player and both memberships in one transaction", async () => {
    // A claim without the player update shows an account a board it is not on;
    // the player without the claim is invisible to account deletion.
    const { items } = await claim();
    expect(items).toHaveLength(4);
  });

  it("makes a second seat on the same board collide with the first", async () => {
    // **The rule is the key now.** It used to need a separate `SEAT#` row, which
    // then had to be created, deleted and remembered everywhere a claim was
    // touched — and was forgotten in two places.
    const { items } = await claim();
    const seat = items.find((i) => i.Put?.Item.sk === "CLAIM#g1")?.Put;
    expect(seat?.ConditionExpression).toBe("attribute_not_exists(pk)");
    expect(seat?.Item.playerId).toBe("p1");
  });

  it("refuses a player somebody already holds, or one that was removed", async () => {
    const { items } = await claim();
    const update = items.find((i) => i.Update?.ConditionExpression)?.Update;
    expect(update?.ConditionExpression).toBe(
      "attribute_exists(pk) AND attribute_not_exists(accountId) AND attribute_not_exists(deletedAt)",
    );
  });

  it("joins the board without demoting an admin already on it", async () => {
    // **This was a conditional `Put` and it was wrong.** Guarded by
    // `attribute_not_exists(pk)` it failed for anybody already a member — which
    // is almost everybody claiming a player — and a transaction is
    // all-or-nothing, so it cancelled the whole claim. Live testing found it:
    // creating a group and then claiming a player in it always answered
    // "already claimed".
    //
    // `if_not_exists` gives both halves: the row appears for somebody joining
    // by claiming, and an existing admin keeps their role and `joinedAt`.
    const { items } = await claim();
    const membership = items.find((i) => i.Update && !i.Update.ConditionExpression)
      ?.Update;
    expect(membership?.UpdateExpression).toContain("if_not_exists(#role, :member)");
    expect(membership?.UpdateExpression).toContain("if_not_exists(joinedAt, :now)");
    // No condition, or it can fail the transaction for an existing member.
    expect(membership?.ConditionExpression).toBeUndefined();
  });

  it("says which rule refused, not just that something did", async () => {
    // All four cancellations used to collapse into "already claimed", so "you
    // already hold a seat here" read as *somebody else took this person* — a
    // different problem with a different fix.
    const at = async (index: number) => {
      const reasons = [{}, {}, {}, {}];
      reasons[index] = { Code: "ConditionalCheckFailed" };
      const { outcome } = await claim(
        new TransactionCanceledException({
          $metadata: {},
          message: "nope",
          CancellationReasons: reasons,
        }),
      );
      return outcome.status === "conflict" ? outcome.reason : "";
    };
    expect(await at(0)).toBe("you already hold a seat on this board");
    expect(await at(1)).toBe("somebody else has claimed that player");
  });

  it("does not call a throttled transaction a conflict", async () => {
    // **`TransactionCanceledException` is not a synonym for "somebody got there
    // first".** DynamoDB also cancels for `TransactionConflict` and throttling,
    // all retryable — and telling the caller "already claimed" sends them to
    // resolve a conflict that does not exist.
    const { client } = fakeClient([
      new TransactionCanceledException({
        $metadata: {},
        message: "slow down",
        CancellationReasons: [{ Code: "ThrottlingError" }],
      }),
    ]);
    await expect(
      createGroupStore("T", client).claimPlayer("acc", "g1", "p1", 1),
    ).rejects.toThrow();
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
  it("asserts a named admin is still one, rather than counting them", async () => {
    // **This is what replaced `adminCount`.** Reading "is there another admin?"
    // and then writing is something two people can both pass — two admins
    // demoting each other each see the other and each proceed. Naming one and
    // asserting it inside the transaction means exactly one of them wins, and
    // there is no counter for four separate paths to keep in step.
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).setRole("acc", "g1", "member", "keeper");
    const check = (sent[0].TransactItems as { ConditionCheck?: { Key: { sk: string }; ConditionExpression: string } }[])
      .find((o) => o.ConditionCheck);
    expect(check?.ConditionCheck?.Key.sk).toBe("MEMBER#keeper");
    expect(check?.ConditionCheck?.ConditionExpression).toBe("#role = :admin");
  });

  it("writes both copies of a membership together", async () => {
    // Two rows in one transaction is what replaced a counter, a sparse index
    // attribute and a read that might be stale. They cannot drift.
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).setRole("acc", "g1", "admin", null);
    const keys = (sent[0].TransactItems as { Update?: { Key: { pk: string } } }[])
      .filter((o) => o.Update)
      .map((o) => o.Update!.Key.pk);
    expect(keys).toEqual(["GROUP#g1", "ACCOUNT#acc"]);
  });

  it("needs no guarantor to promote", async () => {
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).setRole("acc", "g1", "admin", null);
    expect(JSON.stringify(sent[0])).not.toContain("ConditionCheck");
  });
});

describe("not resurrecting what somebody deleted", () => {
  it("refuses an add that lands on a tombstone", async () => {
    // The app queues writes offline and replays them, and a replayed add on a
    // row somebody has since deleted brings it back — the exact failure the
    // whole tombstone scheme exists to prevent.
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).addPlayer("g1", { id: "p1", name: "Ann" });
    expect(sent[0].ConditionExpression).toBe("attribute_not_exists(deletedAt)");
  });

  it("does not let adding a player double as renaming one", async () => {
    // The add route is open to every member; an unconditional `SET` would let
    // anybody rename anybody, including a player somebody else has claimed.
    // Renaming is not in the permission table.
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).addPlayer("g1", { id: "p1", name: "New" });
    expect(sent[0].UpdateExpression).toContain("if_not_exists(#name, :name)");
  });

  it("adds a player without wiping whoever claimed them", async () => {
    // A `Put` replaces the row, so a replayed offline add — the thing this is
    // written to tolerate — cleared the claimer's `accountId`, orphaned their
    // seat, and locked them out of claiming again. An `Update` touches the name
    // and nothing else.
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).addPlayer("g1", { id: "p1", name: "Ann" });
    expect(sent[0].UpdateExpression).toBe(
      "SET #name = if_not_exists(#name, :name), playerId = :id",
    );
    expect(JSON.stringify(sent[0])).not.toContain("accountId");
  });

  it("will not let a member overwrite a recorded game", async () => {
    // `id` and `playedAt` are both handed to every member by the board, so a
    // condition on the tombstone alone let anybody re-POST an existing game
    // with an emptier one — deleting it in all but name, straight around the
    // admin-only removal rule.
    const { client, sent } = fakeClient([{}]);
    await createGroupStore("T", client).recordGame("g1", game());
    expect(sent[0].ConditionExpression).toBe("attribute_not_exists(pk)");
  });
});

describe("reading more than one page", () => {
  it("follows the cursor rather than stopping at 1 MB", async () => {
    // The place this hurt most is `DELETE /me`: rows a truncated query did not
    // return are rows nobody deletes, *after* the Cognito user is gone and no
    // token exists to ask again with.
    const { client, sent } = fakeClient([
      { Items: [{ pk: "ACCOUNT#a", sk: "GROUP#g1" }], LastEvaluatedKey: { pk: "x" } },
      { Items: [{ pk: "ACCOUNT#a", sk: "CLAIM#g1#p1" }] },
    ]);
    const rows = await createGroupStore("T", client).belongings("a");
    expect(sent).toHaveLength(2);
    expect(rows).toHaveLength(2);
  });
});
