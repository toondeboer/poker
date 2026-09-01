import { describe, expect, it, vi } from "vitest";
import {
  claimParts,
  deleteAccount,
  groupIdOf,
  succession,
} from "../lib/lambda/deleteAccount";
import { membershipItem, type MembershipItem } from "../lib/lambda/groupKeys";
import type { GroupStore, WriteOutcome } from "../lib/lambda/groupStore";

const member = (
  accountId: string,
  role: "admin" | "member",
  joinedAt: number,
): MembershipItem => membershipItem(accountId, "g1", role, joinedAt);

const ok: WriteOutcome = { status: "ok" };

const store = (overrides: Partial<GroupStore> = {}) => {
  const calls: string[] = [];
  const base = {
    belongings: async () => [
      { pk: "ACCOUNT#me", sk: "GROUP#g1" },
      { pk: "ACCOUNT#me", sk: "CLAIM#g1#p1" },
    ],
    members: async () => [member("me", "member", 1)],
    releaseClaim: async () => {
      calls.push("releaseClaim");
      return ok;
    },
    setRole: async () => {
      calls.push("setRole");
      return ok;
    },
    promoteHeir: async () => {
      calls.push("promoteHeir");
      return ok;
    },
    adjustAdminCount: async (_g: string, delta: number) => {
      calls.push(`adminCount${delta > 0 ? "+" : ""}${delta}`);
      return ok;
    },
    forget: async () => {
      calls.push("forget");
    },
    ...overrides,
  } as unknown as GroupStore;
  return { store: base, calls };
};

describe("reading the account's own rows", () => {
  it("splits a claim back into its group and player", () => {
    expect(claimParts("CLAIM#g1#p1")).toEqual({ groupId: "g1", playerId: "p1" });
  });

  it("is not confused by a membership", () => {
    expect(claimParts("GROUP#g1")).toBeNull();
    expect(groupIdOf("CLAIM#g1#p1")).toBeNull();
    expect(groupIdOf("GROUP#g1")).toBe("g1");
  });

  it("refuses a malformed claim rather than guessing half of it", () => {
    expect(claimParts("CLAIM#g1")).toBeNull();
    expect(claimParts("CLAIM#")).toBeNull();
  });
});

describe("what happens to a group somebody leaves", () => {
  it("does nothing when another admin remains", () => {
    // The common case, and the reason several admins was worth having.
    const members = [member("me", "admin", 1), member("you", "admin", 2)];
    expect(succession(members, "me")).toEqual({ action: "none" });
  });

  it("does nothing when the leaver was only a member", () => {
    const members = [member("me", "member", 1), member("you", "admin", 2)];
    expect(succession(members, "me")).toEqual({ action: "none" });
  });

  it("promotes the longest-standing member when the last admin goes", () => {
    // A group with nobody who can manage it can never be renamed or have a
    // player removed, and there is no support channel to fix that.
    const members = [
      member("me", "admin", 1),
      member("late", "member", 30),
      member("early", "member", 20),
    ];
    expect(succession(members, "me")).toEqual({
      action: "promote",
      accountId: "early",
    });
  });

  it("does not destroy a group even when nobody else is in it", () => {
    // **It used to.** The decision came from the eventually consistent index,
    // and a stale read there destroys a group that still has people in it. An
    // irreversible action on a maybe-stale read is the wrong trade against
    // leaving a few rows behind.
    expect(succession([member("me", "admin", 1)], "me")).toEqual({
      action: "none",
    });
  });
});

describe("the sequence", () => {
  it("releases claims, settles groups, forgets rows, then deletes the user", async () => {
    // **The order is the whole design.** Cognito last, because after it there
    // is no token to authenticate a retry with.
    const order: string[] = [];
    const { store: s } = store({
      releaseClaim: async () => {
        order.push("releaseClaim");
        return ok;
      },
      forget: async () => {
        order.push("forget");
      },
    });
    await deleteAccount("me", s, async () => {
      order.push("deleteUser");
    });
    expect(order).toEqual(["releaseClaim", "forget", "deleteUser"]);
  });

  it("leaves the player and their games behind", async () => {
    // A board refers to the person, not the account. Somebody leaving must not
    // take a season of somebody else's game nights with them.
    const released: string[] = [];
    const { store: s } = store({
      releaseClaim: async (_a, _g, playerId) => {
        released.push(playerId);
        return ok;
      },
    });
    const report = await deleteAccount("me", s, async () => {});
    // Released, never deleted — there is no call that removes a player here.
    expect(released).toEqual(["p1"]);
    expect(report.claimsReleased).toBe(1);
  });

  it("brings the admin count down when an admin leaves and nobody replaces them", async () => {
    // **The path that was missing.** With two admins and one deleting their
    // account, the count stayed at two while one admin remained — and
    // `setRole`'s `adminCount > 1` guard then permitted demoting the last real
    // admin, because it was reading a number that no longer described the
    // group.
    const { store: s, calls } = store({
      members: async () => [member("me", "admin", 1), member("you", "admin", 2)],
    });
    await deleteAccount("me", s, async () => {});
    expect(calls).toContain("adminCount-1");
  });

  it("leaves the count alone when an heir takes over", async () => {
    // One admin leaves, one arrives. Decrementing here would strand the group
    // just as surely as never decrementing strands it elsewhere.
    const { store: s, calls } = store({
      members: async () => [member("me", "admin", 1), member("you", "member", 2)],
    });
    await deleteAccount("me", s, async () => {});
    expect(calls).not.toContain("adminCount-1");
  });

  it("leaves the count alone when a plain member leaves", async () => {
    const { store: s, calls } = store({
      members: async () => [member("me", "member", 1), member("you", "admin", 2)],
    });
    await deleteAccount("me", s, async () => {});
    expect(calls).not.toContain("adminCount-1");
  });

  it("promotes an heir when the leaver was the last admin", async () => {
    const { store: s, calls } = store({
      members: async () => [member("me", "admin", 1), member("you", "member", 2)],
    });
    const report = await deleteAccount("me", s, async () => {});
    expect(calls).toContain("promoteHeir");
    expect(report.groupsInherited).toEqual(["g1"]);
  });

  it("does not claim an inheritance the write refused", async () => {
    // A stale index can name an heir who has since left. The write is
    // conditional so it fails rather than inventing a membership — and
    // reporting it as inherited anyway would tell somebody a group is looked
    // after when it is not.
    const { store: s } = store({
      members: async () => [member("me", "admin", 1), member("gone", "member", 2)],
      promoteHeir: async () => ({ status: "conflict", reason: "heir is no longer a member" }),
    });
    const report = await deleteAccount("me", s, async () => {});
    expect(report.groupsInherited).toEqual([]);
    expect(report.groupsStranded).toEqual(["g1"]);
  });

  it("finishes a deletion that was already half done", async () => {
    // The property everything else rests on. A second attempt sees claims that
    // are already released — a conflict, not an error — and still has to reach
    // Cognito, or the account can never finish being deleted.
    const deleted = vi.fn(async () => {});
    const { store: s } = store({
      releaseClaim: async () => ({ status: "conflict", reason: "already released" }),
    });
    const report = await deleteAccount("me", s, deleted);
    expect(report.claimsReleased).toBe(0);
    expect(deleted).toHaveBeenCalledWith("me");
  });

  it("does not delete the user when the data could not be cleared", async () => {
    // The other direction of the same rule: if this throws before Cognito, the
    // account still exists and the whole thing can be asked for again. Deleting
    // the user first would leave rows nobody holds a credential for.
    const deleted = vi.fn(async () => {});
    const { store: s } = store({
      forget: async () => {
        throw new Error("dynamo is having a day");
      },
    });
    await expect(deleteAccount("me", s, deleted)).rejects.toThrow();
    expect(deleted).not.toHaveBeenCalled();
  });
});
