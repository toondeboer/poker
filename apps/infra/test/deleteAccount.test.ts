import { describe, expect, it, vi } from "vitest";
import { claimGroupOf, deleteAccount, groupIdOf } from "../lib/lambda/deleteAccount";
import { anotherAdmin, heirTo, memberItem, type MemberItem } from "../lib/lambda/groupKeys";
import type { GroupStore, WriteOutcome } from "../lib/lambda/groupStore";

const member = (
  accountId: string,
  role: "admin" | "member",
  joinedAt: number,
): MemberItem => memberItem("g1", accountId, role, joinedAt);

const ok: WriteOutcome = { status: "ok" };

const store = (overrides: Partial<GroupStore> = {}) => {
  const calls: string[] = [];
  const base = {
    belongings: async () => [
      { pk: "ACCOUNT#me", sk: "GROUP#g1", role: "member" },
      { pk: "ACCOUNT#me", sk: "CLAIM#g1", playerId: "p1" },
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
    leave: async (_a: string, _g: string, guarantor: string | null) => {
      calls.push(guarantor ? `leave(guaranteed by ${guarantor})` : "leave");
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
  it("reads a claim's group from its key", () => {
    // One seat per board means the key names the group and the *item* names the
    // player — so there is nothing to parse out of the middle of a key.
    expect(claimGroupOf("CLAIM#g1")).toBe("g1");
    expect(claimGroupOf("GROUP#g1")).toBeNull();
    expect(claimGroupOf("CLAIM#")).toBeNull();
  });

  it("is not confused by a membership", () => {
    expect(groupIdOf("CLAIM#g1")).toBeNull();
    expect(groupIdOf("GROUP#g1")).toBe("g1");
  });
});

describe("who guarantees a group still has an admin", () => {
  it("names another admin rather than counting them", () => {
    // **Named, not counted.** A number is a read somebody can invalidate before
    // the write lands; a name becomes a `ConditionCheck` in the same
    // transaction, which cannot be raced.
    const members = [member("me", "admin", 1), member("you", "admin", 2)];
    expect(anotherAdmin(members, "me")?.accountId).toBe("you");
  });

  it("finds nobody when the leaver is the only admin", () => {
    expect(anotherAdmin([member("me", "admin", 1), member("you", "member", 2)], "me")).toBeNull();
  });

  it("hands an orphaned group to the longest-standing member", () => {
    const members = [
      member("me", "admin", 1),
      member("late", "member", 30),
      member("early", "member", 20),
    ];
    expect(heirTo(members, "me")?.accountId).toBe("early");
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

  it("names the remaining admin when leaving a group that has one", async () => {
    // **This is what replaced a counter.** Departing asserts, in the same
    // transaction, that a specific other admin still is one — so a concurrent
    // demotion of that person cannot slip between the decision and the write.
    const { store: s, calls } = store({
      members: async () => [member("me", "admin", 1), member("you", "admin", 2)],
    });
    await deleteAccount("me", s, async () => {});
    expect(calls).toContain("leave(guaranteed by you)");
  });

  it("leaves without a guarantor when it was never an admin", async () => {
    const { store: s, calls } = store({
      members: async () => [member("me", "member", 1), member("you", "admin", 2)],
    });
    await deleteAccount("me", s, async () => {});
    expect(calls).toContain("leave");
  });

  it("promotes an heir when the leaver was the last admin", async () => {
    const { store: s, calls } = store({
      members: async () => [member("me", "admin", 1), member("you", "member", 2)],
    });
    const report = await deleteAccount("me", s, async () => {});
    expect(calls).toContain("setRole");
    expect(report.groupsInherited).toEqual(["g1"]);
  });

  it("does not claim an inheritance the write refused", async () => {
    // Reporting it as inherited anyway would tell somebody a group is looked
    // after when it is not — and the account leaves either way.
    const { store: s } = store({
      members: async () => [member("me", "admin", 1), member("gone", "member", 2)],
      setRole: async () => ({ status: "conflict", reason: "not a member" }),
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
