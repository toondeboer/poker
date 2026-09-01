import { describe, expect, it } from "vitest";
import type { GameResult, Player } from "@poker/core";
import {
  boardFrom,
  claimKey,
  groupItem,
  groupKey,
  heirTo,
  inviteKey,
  isTombstone,
  may,
  memberFrom,
  membershipItem,
  membershipKey,
  playerItem,
  playerKey,
  resultItem,
  resultKey,
  MAX_STAMP,
  stampSegment,
  tombstone,
  anotherAdmin,
  type MemberItem,
} from "../lib/lambda/groupKeys";

const result = (id: string, playedAt: number): GameResult => ({
  id,
  playedAt,
  playerIds: ["p1", "p2"],
  placings: [{ playerId: "p1", place: 1, winnings: 20 }],
  buyIn: 10,
  bounty: 0,
});

const member = (
  accountId: string,
  role: "admin" | "member",
  joinedAt: number,
): MemberItem => membershipItem(accountId, "g1", role, joinedAt);

describe("keys", () => {
  it("puts a whole board in one partition", () => {
    // The reason for the whole shape: group, players and results come back
    // together, so rendering a board is a query rather than three.
    const partitions = new Set([
      groupKey("g1").pk,
      playerKey("g1", "p1").pk,
      resultKey("g1", "r1").pk,
    ]);
    expect([...partitions]).toEqual(["GROUP#g1"]);
  });

  it("puts everything about a person in one partition", () => {
    // What makes account deletion a query instead of a scan over every group.
    const partitions = new Set([
      membershipKey("acc", "g1").pk,
      claimKey("acc", "g1").pk,
    ]);
    expect([...partitions]).toEqual(["ACCOUNT#acc"]);
  });

  it("makes one seat per board the shape of the key", () => {
    // The previous shape carried the player id here and needed a separate
    // `SEAT#` row to enforce the same rule — a second item to create, delete
    // and remember everywhere a claim was touched.
    expect(claimKey("acc", "g1").sk).toBe("CLAIM#g1");
  });

  it("looks an invite up by its token alone", () => {
    // Its own partition because whoever is redeeming it does not know the group
    // id yet — that is what being invited means. Any other keying is a scan.
    expect(inviteKey("tok").pk).toBe("INVITE#tok");
  });
});

describe("result ordering", () => {
  it("makes a game's id its identity", () => {
    // **The key is the id alone.** `RESULT#<playedAt>#<id>` reads better and
    // makes the identity `(playedAt, id)` — so the same id re-posted with a
    // different date writes a *second* row, standings count the night twice,
    // and deleting removes only the copy that matches. `attribute_not_exists`
    // cannot make an id unique when the id is not the key.
    expect(resultKey("g1", "r1").sk).toBe("RESULT#r1");
  });

  it("orders a backdated game correctly when the board is assembled", () => {
    // Ordering moved out of the key and into `boardFrom`, which costs a sort
    // over a season of game nights — tens of rows.
    const board = boardFrom("g1", [
      groupItem("g1", { name: "T", createdAt: 1 }),
      resultItem("g1", result("recent", 1_788_180_000_000)),
      resultItem("g1", result("old", 999_999_999_999)),
    ]);
    expect(board?.results.map((r) => r.id)).toEqual(["old", "recent"]);
  });

  it("keeps every stamp the same width", () => {
    expect(stampSegment(0)).toHaveLength(13);
    expect(stampSegment(1_788_180_000_000)).toHaveLength(13);
  });

  it("refuses to build a negative stamp", () => {
    // A negative epoch would produce a leading "-" and sort before everything
    // forever. Clamped rather than thrown: a bad date is not worth failing a
    // write that is otherwise fine.
    expect(stampSegment(-1)).toBe("0".repeat(13));
  });
});

describe("tombstones", () => {
  it("strips the payload it is replacing", () => {
    // A tombstone that still carried its game would be a deleted game anybody
    // could read straight out of the table.
    const stone = tombstone(resultKey("g1", "r1"), 1_700_000_000_000);
    expect(Object.keys(stone).sort()).toEqual([
      "deletedAt",
      "expiresAt",
      "pk",
      "sk",
    ]);
  });

  it("expires in seconds, which is what DynamoDB's TTL wants", () => {
    // Milliseconds here is a TTL a thousand times too far away: an item that
    // never expires, and a table that grows for years before anybody notices.
    const now = 1_700_000_000_000;
    const stone = tombstone(groupKey("g1"), now);
    expect(stone.expiresAt).toBeLessThan(now / 1000 + 91 * 24 * 60 * 60);
    expect(stone.expiresAt).toBeGreaterThan(now / 1000);
  });

  it("keeps the key, so the deletion is found where the row was", () => {
    const key = playerKey("g1", "p1");
    const stone = tombstone(key, 1);
    expect({ pk: stone.pk, sk: stone.sk }).toEqual(key);
  });
});

describe("assembling a board", () => {
  const rows = () => [
    groupItem("g1", { name: "Thursday", createdAt: 5 }, 1),
    playerItem("g1", { id: "p1", name: "Ann" }),
    playerItem("g1", { id: "p2", name: "Bo", accountId: "acc" }),
    resultItem("g1", result("r1", 1_700_000_000_000)),
  ];

  it("returns the group, its players and its results together", () => {
    const board = boardFrom("g1", rows());
    expect(board?.group).toEqual({ id: "g1", name: "Thursday", createdAt: 5 });
    expect(board?.players.map((p) => p.name)).toEqual(["Ann", "Bo"]);
    expect(board?.results).toHaveLength(1);
  });

  it("keeps who has claimed a player", () => {
    const board = boardFrom("g1", rows());
    expect(board?.players.find((p) => p.id === "p2")?.accountId).toBe("acc");
    // Absent rather than `undefined`, so an unclaimed player round-trips as one.
    expect(board?.players.find((p) => p.id === "p1")).not.toHaveProperty(
      "accountId",
    );
  });

  it("hides a deleted game", () => {
    // The point of the whole scheme. A caller that filtered these itself would
    // eventually forget, and the symptom is a game somebody deleted coming back.
    //
    // A tombstone is a `Put` over the *same* key, so it replaces the row rather
    // than joining it — which is why this substitutes rather than appends.
    const withDeletion = rows().map((row) =>
      row.sk.startsWith("RESULT#")
        ? tombstone({ pk: row.pk, sk: row.sk }, 2)
        : row,
    );
    expect(boardFrom("g1", withDeletion)?.results).toEqual([]);
  });

  it("hides a removed player", () => {
    const withDeletion = rows().map((row) =>
      row.sk === playerKey("g1", "p1").sk
        ? tombstone({ pk: row.pk, sk: row.sk }, 2)
        : row,
    );
    expect(boardFrom("g1", withDeletion)?.players.map((p) => p.id)).toEqual([
      "p2",
    ]);
  });

  it("keys a game the same however it is reached", () => {
    // The constraint this used to rest on is gone: the key was
    // `RESULT#<playedAt>#<id>`, so deleting meant rebuilding it from a
    // `GameResult` the client still held, which only worked while a recorded
    // game stayed immutable — and made the same id at two dates two rows.
    const game = result("r1", 1_700_000_000_000);
    expect(resultItem("g1", game).sk).toBe(resultKey("g1", game.id).sk);
  });

  it("is nothing at all without the group row", () => {
    // Players and results with no group is a board with no identity, and every
    // caller would have to special-case it.
    const orphans = rows().filter((row) => row.sk !== "META");
    expect(boardFrom("g1", orphans)).toBeNull();
  });

  it("ignores rows it cannot read rather than inventing them", () => {
    const board = boardFrom("g1", [
      ...rows(),
      { pk: "GROUP#g1", sk: "PLAYER#p9" }, // no name
      { pk: "GROUP#g1", sk: "RESULT#x#r9" }, // no payload
      null,
      "not an item",
    ]);
    expect(board?.players).toHaveLength(2);
    expect(board?.results).toHaveLength(1);
  });
});

describe("reading a membership back", () => {
  it("refuses a row whose role it does not understand", () => {
    // The branch that matters: defaulting an unreadable role to `member` would
    // be inventing a permission out of a parse failure.
    expect(memberFrom({ ...member("acc", "admin", 1), role: "owner" })).toBeNull();
    expect(memberFrom({ ...member("acc", "admin", 1), role: undefined })).toBeNull();
  });

  it("reads a good row", () => {
    expect(memberFrom(member("acc", "admin", 7))).toMatchObject({
      accountId: "acc",
      groupId: "g1",
      role: "admin",
      joinedAt: 7,
    });
  });
});

describe("who may do what", () => {
  it("lets any member add a player and record a game", () => {
    // Anybody at the table can write down a name. This is also what keeps the
    // permission read off the weekly path.
    const m = { role: "member" as const };
    expect(may(m, "addPlayer")).toBe(true);
    expect(may(m, "recordGame")).toBe(true);
    expect(may(m, "claimPlayer")).toBe(true);
    expect(may(m, "read")).toBe(true);
  });

  it("lets only an admin destroy anything", () => {
    const m = { role: "member" as const };
    for (const action of ["removePlayer", "removeGame", "rename", "manageAdmins"] as const) {
      expect(may(m, action)).toBe(false);
      expect(may({ role: "admin" }, action)).toBe(true);
    }
  });

  it("refuses a non-member everything, including reading", () => {
    // A shared board is readable by the people on it. Anything else makes the
    // group id the only thing protecting it, and ids travel.
    for (const action of ["read", "addPlayer", "recordGame", "removePlayer"] as const) {
      expect(may(null, action)).toBe(false);
    }
  });
});

describe("a group whose last admin leaves", () => {
  it("names another admin rather than counting them", () => {
    // **Named, not counted.** A count is a read somebody can invalidate before
    // the write lands; a name becomes a `ConditionCheck` in the same
    // transaction and cannot be raced.
    const members = [member("a", "admin", 1), member("b", "admin", 2)];
    expect(anotherAdmin(members, "a")?.accountId).toBe("b");
  });

  it("finds nobody when the leaver is the only admin", () => {
    const members = [member("a", "admin", 1), member("b", "member", 2)];
    expect(anotherAdmin(members, "a")).toBeNull();
  });

  it("hands the group to the longest-standing member", () => {
    const members = [
      member("a", "admin", 1),
      member("c", "member", 30),
      member("b", "member", 20),
    ];
    expect(heirTo(members, "a")?.accountId).toBe("b");
  });

  it("breaks a tie without depending on row order", () => {
    // Two people joining in the same millisecond must not make the answer
    // depend on what order DynamoDB happened to return them in.
    const first = [member("z", "member", 5), member("y", "member", 5)];
    const second = [member("y", "member", 5), member("z", "member", 5)];
    expect(heirTo(first, "a")?.accountId).toBe(heirTo(second, "a")?.accountId);
  });

  it("has no heir when the leaver is alone", () => {
    // Caller tombstones the group: nobody else's history is in it.
    expect(heirTo([member("a", "admin", 1)], "a")).toBeNull();
  });
});

describe("stamps at the edges", () => {
  it("does not fall off the end into exponent notation", () => {
    // `String(1e21)` is `"1e+21"` — not a number, sorts nowhere sensible, and
    // defeats the padding this whole key rests on.
    expect(stampSegment(1e21)).toBe(String(MAX_STAMP));
    expect(stampSegment(Number.POSITIVE_INFINITY)).toHaveLength(13);
    expect(stampSegment(Number.NaN)).toBe("0".repeat(13));
  });
});

describe("items", () => {
  it("leaves an unclaimed player without the attribute at all", () => {
    const unclaimed: Player = { id: "p1", name: "Ann" };
    expect(playerItem("g1", unclaimed)).not.toHaveProperty("accountId");
  });

  it("is not a tombstone when it is a real row", () => {
    expect(isTombstone(playerItem("g1", { id: "p1", name: "Ann" }))).toBe(false);
    expect(isTombstone(tombstone(playerKey("g1", "p1"), 1))).toBe(true);
  });
});
