/**
 * Who is on a shared board, and who may be taken off it.
 *
 * **This is the only place an account id is disclosed.** A board strips other
 * people's `accountId` on the way out — nobody at the table needs to know which
 * account holds which player — so `GET /groups/{id}/members` is the only way an
 * admin learns the id that removing somebody needs. The server answers it to
 * members, and about members, and nowhere else.
 *
 * **So this list has no names in it**, and that is a decision rather than an
 * omission: putting one here would undo the stripping above and tell every
 * member which account is which player. A screen showing it identifies people
 * by when they joined and marks the one that is you.
 *
 * The rules live here rather than in the sheet for the reason `clubPolicy`'s do:
 * every mistake available is one somebody meets in an emergency — when a name on
 * a board is the problem and the person who put it there is still on it.
 */

import type { BoardRole } from "../sync/mergeBoard";

/** Somebody on a board, as the server describes them. */
export type BoardMember = {
  accountId: string;
  role: BoardRole;
  /** Epoch milliseconds, from the membership row. */
  joinedAt: number;
};

/**
 * Read the server's answer, keeping everybody it is possible to act on.
 *
 * **An entry that cannot be identified is dropped; one that cannot be
 * classified is not.** Without an `accountId` there is no removal to make, so
 * the row is useless. An unfamiliar `role`, on the other hand, means a server
 * newer than this build — and hiding somebody from a moderation list because
 * their role has a name we do not recognise is the worse failure of the two.
 * They are shown as an ordinary member; the invariant that a board keeps an
 * admin is asserted inside the server's own write, so a client that guesses
 * wrong is refused rather than obeyed.
 */
export const readBoardMembers = (value: unknown): BoardMember[] => {
  if (typeof value !== "object" || value === null) return [];
  const body = value as { members?: unknown };
  if (!Array.isArray(body.members)) return [];
  return body.members.flatMap((entry): BoardMember[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const member = entry as Record<string, unknown>;
    if (typeof member.accountId !== "string" || member.accountId === "") {
      return [];
    }
    return [
      {
        accountId: member.accountId,
        role: member.role === "admin" ? "admin" : "member",
        joinedAt: typeof member.joinedAt === "number" ? member.joinedAt : 0,
      },
    ];
  });
};

/** Admins first, then oldest membership first — a stable order to read down. */
export const sortedMembers = (members: readonly BoardMember[]): BoardMember[] =>
  [...members].sort((a, b) =>
    a.role === b.role ? a.joinedAt - b.joinedAt : a.role === "admin" ? -1 : 1,
  );

/**
 * Why this person cannot be removed, in a sentence, or `null` when they can be.
 *
 * A sentence per case rather than one title over several refusals — the same
 * shape `clubPolicy` settled on, after a single message for three different
 * reasons told a subscriber to buy what they already owned.
 */
export const removalRefusal = ({
  member,
  callerId,
  members,
}: {
  member: BoardMember;
  /** The account doing the removing. */
  callerId: string;
  /** Everybody on the board, this member included. */
  members: readonly BoardMember[];
}): string | null => {
  /**
   * **Removing yourself is leaving**, and it already has a button that also
   * takes the board off this phone. Sending it from here would end the
   * membership and leave the board sitting there, syncing nothing, which reads
   * exactly like the sync being broken.
   */
  if (member.accountId === callerId) {
    return "That's you. Use Leave on the boards list to get off a board.";
  }
  /**
   * **The same invariant the server asserts inside the write.** Checked here
   * too so the answer is a sentence in the sheet rather than a refusal a
   * conflict code has to be translated into.
   */
  if (
    member.role === "admin" &&
    members.filter((other) => other.role === "admin").length <= 1
  ) {
    return "This is the board's only admin. Somebody has to be able to manage it.";
  }
  return null;
};
