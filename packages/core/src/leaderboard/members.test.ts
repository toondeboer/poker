import { describe, expect, it } from "vitest";
import {
  readBoardMembers,
  removalRefusal,
  sortedMembers,
  type BoardMember,
} from "./members";

const member = (
  accountId: string,
  role: BoardMember["role"] = "member",
  joinedAt = 0,
): BoardMember => ({ accountId, role, joinedAt });

describe("reading who is on a board", () => {
  it("reads every member the server named", () => {
    expect(
      readBoardMembers({
        members: [
          { accountId: "a", role: "admin", joinedAt: 10 },
          { accountId: "b", role: "member", joinedAt: 20 },
        ],
      }),
    ).toEqual([member("a", "admin", 10), member("b", "member", 20)]);
  });

  it("is empty for an answer that is not one", () => {
    // Not a reason to guess at a membership list: an unreachable server, an
    // error page from something in front of the API, a version mismatch.
    expect(readBoardMembers(null)).toEqual([]);
    expect(readBoardMembers(undefined)).toEqual([]);
    expect(readBoardMembers("nonsense")).toEqual([]);
    expect(readBoardMembers({})).toEqual([]);
    expect(readBoardMembers({ members: "everybody" })).toEqual([]);
  });

  it("drops anybody there is no removal to make for", () => {
    // Without an id there is nothing to send, so the row could only ever be a
    // button that fails.
    expect(
      readBoardMembers({
        members: [null, "somebody", {}, { accountId: "" }, { accountId: "a" }],
      }),
    ).toEqual([member("a", "member", 0)]);
  });

  it("keeps somebody whose role it does not recognise", () => {
    // A server newer than this build. Hiding them from a moderation list is
    // worse than showing them as an ordinary member: the board's own invariant
    // is asserted in the server's write, so a wrong guess is refused there.
    expect(
      readBoardMembers({ members: [{ accountId: "a", role: "owner" }] }),
    ).toEqual([member("a", "member", 0)]);
  });

  it("treats a missing join time as the beginning of time, not as absent", () => {
    // The list is sorted by it, and `undefined` would sort unpredictably.
    expect(
      readBoardMembers({ members: [{ accountId: "a", joinedAt: "Tuesday" }] }),
    ).toEqual([member("a", "member", 0)]);
  });
});

describe("the order they are read in", () => {
  it("puts admins first, then oldest first", () => {
    const members = [
      member("c", "member", 30),
      member("a", "admin", 20),
      member("b", "member", 10),
      member("d", "admin", 5),
    ];
    expect(sortedMembers(members).map((m) => m.accountId)).toEqual([
      "d",
      "a",
      "b",
      "c",
    ]);
  });

  it("leaves the list it was given alone", () => {
    // Sorting in place would reorder whatever state this came from, which is
    // the kind of thing that shows up two screens away.
    const members = [member("b", "member", 2), member("a", "admin", 1)];
    sortedMembers(members);
    expect(members.map((m) => m.accountId)).toEqual(["b", "a"]);
  });
});

describe("who may be removed", () => {
  const admin = member("me", "admin", 1);
  const guest = member("them", "member", 2);

  it("allows an admin to remove an ordinary member", () => {
    expect(
      removalRefusal({
        member: guest,
        callerId: "me",
        members: [admin, guest],
      }),
    ).toBeNull();
  });

  it("sends you to Leave rather than removing yourself", () => {
    // Removing yourself here would end the membership and leave the board on
    // this phone syncing nothing, which reads as the sync being broken.
    expect(
      removalRefusal({
        member: admin,
        callerId: "me",
        members: [admin, guest],
      }),
    ).toBe("That's you. Use Leave on the boards list to get off a board.");
  });

  it("refuses to leave a board with nobody in charge", () => {
    const other = member("other", "admin", 3);
    expect(
      removalRefusal({
        member: other,
        callerId: "me",
        members: [other, guest],
      }),
    ).toBe(
      "This is the board's only admin. Somebody has to be able to manage it.",
    );
    // With a second admin there, the same removal is fine.
    expect(
      removalRefusal({
        member: other,
        callerId: "me",
        members: [admin, other, guest],
      }),
    ).toBeNull();
  });
});
