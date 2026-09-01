/**
 * Deleting an account, and everything it is allowed to take with it.
 *
 * **The order is the whole design.** Cognito goes last, because once the user
 * is gone the client holds no valid token and nothing can authenticate a retry
 * — so every step before it must be re-runnable, and every write it makes is
 * conditional on the state it expects. A deletion that fails halfway has to be
 * finishable by asking again, or it leaves an account that cannot be deleted
 * *because* it is half deleted.
 *
 * Split from the route so every branch is testable without a DynamoDB or a
 * Cognito — and these are branches worth testing, because the expensive ones
 * only happen to somebody who is already leaving.
 */

import { log } from "./logging";
import { heirTo, type MembershipItem } from "./groupKeys";
import type { GroupStore } from "./groupStore";

/** What was done, for the log line and for the response. */
export type DeletionReport = {
  claimsReleased: number;
  groupsInherited: string[];
  /**
   * Groups this left with no admin, because the heir was gone by the time we
   * tried. Reported rather than swallowed: it is rare, it is not recoverable by
   * the person leaving, and somebody has to know.
   */
  groupsStranded: string[];
};

const CLAIM_PREFIX = "CLAIM#";
const GROUP_PREFIX = "GROUP#";

/**
 * `CLAIM#<groupId>#<playerId>` back into its two halves.
 *
 * A player id cannot contain `#` — ids are generated, not typed — so splitting
 * on it is safe. Parsed rather than stored as separate attributes because the
 * key is the only thing `belongings` projects, and projecting more would mean
 * reading more of every row during a deletion that is already the widest read
 * this system does.
 */
export const claimParts = (
  sk: string,
): { groupId: string; playerId: string } | null => {
  if (!sk.startsWith(CLAIM_PREFIX)) return null;
  const [groupId, playerId] = sk.slice(CLAIM_PREFIX.length).split("#");
  if (!groupId || !playerId) return null;
  return { groupId, playerId };
};

export const groupIdOf = (sk: string): string | null =>
  sk.startsWith(GROUP_PREFIX) ? sk.slice(GROUP_PREFIX.length) || null : null;

/**
 * What has to happen to a group its admin is leaving.
 *
 * Split out because it is the only branching decision in the whole sequence,
 * and each answer is a different write.
 */
export const succession = (
  members: readonly MembershipItem[],
  leaving: string,
): { action: "none" } | { action: "promote"; accountId: string } => {
  const leavingIsAdmin = members.some(
    (m) => m.accountId === leaving && m.role === "admin",
  );
  // Not an admin, so nothing about who can manage this group changes.
  if (!leavingIsAdmin) return { action: "none" };
  // Another admin remains. **The common case**, now that a group has several.
  if (members.some((m) => m.accountId !== leaving && m.role === "admin")) {
    return { action: "none" };
  }
  const heir = heirTo(members, leaving);
  return heir ? { action: "promote", accountId: heir.accountId } : { action: "none" };
};

export const deleteAccount = async (
  accountId: string,
  store: GroupStore,
  deleteUser: (accountId: string) => Promise<void>,
  requestId?: string,
): Promise<DeletionReport> => {
  const report: DeletionReport = {
    claimsReleased: 0,
    groupsInherited: [],
    groupsStranded: [],
  };

  const rows = await store.belongings(accountId);

  // 1. Let go of every player this account claimed. **The player and every game
  //    they played stay.** A board refers to the person rather than the
  //    account, so a season survives the person who recorded it leaving, and
  //    nobody else at that table loses anything.
  for (const row of rows) {
    const claim = claimParts(row.sk);
    if (!claim) continue;
    const outcome = await store.releaseClaim(accountId, claim.groupId, claim.playerId);
    // A conflict here means it was already released — by a previous attempt at
    // this same deletion, most likely. That is a success for our purposes.
    if (outcome.status === "ok") report.claimsReleased += 1;
  }

  // 2. Make sure no group is left with nobody who can manage it.
  //
  // **This never deletes a group**, and that is a deliberate retreat. It used
  // to tombstone one whose last member was leaving — decided from
  // `store.members`, which reads the *eventually consistent* index. A stale
  // read there destroys a group that still has people in it, and an
  // irreversible action taken on a maybe-stale read is the wrong trade against
  // leaving a few rows behind. What survives is an empty group nobody can see;
  // see SYNC.md for the cleanup that still owes.
  //
  // The same staleness is safe for *promotion* because the write is conditional
  // on the heir still being a member: a stale index names somebody who has
  // left, the condition fails, and the group is no worse off than before.
  for (const row of rows) {
    const groupId = groupIdOf(row.sk);
    if (!groupId) continue;
    const members = await store.members(groupId);
    const leavingIsAdmin = members.some(
      (m) => m.accountId === accountId && m.role === "admin",
    );
    const next = succession(members, accountId);

    if (next.action !== "promote") {
      /**
       * An admin is leaving and nobody is replacing them, so the count has to
       * come down with them.
       *
       * **This is the path that was missing**, and the failure it caused is
       * exactly what SYNC.md warned about: with two admins and one deleting
       * their account, the count stayed at two while one admin remained, and
       * `setRole`'s `adminCount > 1` guard then permitted demoting the last
       * real admin. The guard was reading a number that no longer described
       * the group.
       *
       * Not reached when an heir is promoted — one admin leaves, one arrives,
       * and the count is already right.
       */
      if (leavingIsAdmin) await store.adjustAdminCount(groupId, -1);
      continue;
    }
    const promoted = await store.promoteHeir(next.accountId, groupId);
    // Reported only when it actually happened. Claiming an inheritance that a
    // condition refused would tell somebody a group is looked after when it is
    // not — and step 3 removes this account either way.
    if (promoted.status === "ok") {
      report.groupsInherited.push(groupId);
    } else {
      // The heir was gone by the time we tried, so nobody replaced the admin
      // who is leaving — the count comes down after all.
      await store.adjustAdminCount(groupId, -1);
      log("warn", "group left without an admin", {
        requestId,
        groupId,
        reason: promoted.reason,
      });
      report.groupsStranded.push(groupId);
    }
  }

  // 3. Then the account's own rows. Unconditional, so a second attempt at a
  //    half-finished deletion still gets to the end.
  await store.forget(accountId, rows);

  // 4. Cognito, last. Everything above can be retried; this cannot be undone,
  //    and after it there is no token to retry anything with.
  await deleteUser(accountId);

  log("info", "account deleted", {
    requestId,
    accountId,
    claimsReleased: report.claimsReleased,
    groupsInherited: report.groupsInherited.length,
    groupsStranded: report.groupsStranded.length,
  });
  return report;
};
