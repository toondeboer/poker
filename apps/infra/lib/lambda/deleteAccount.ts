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
  groupsRemoved: string[];
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
): { action: "none" } | { action: "promote"; accountId: string } | { action: "remove" } => {
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
  // Nobody else is in it at all, so there is no history but this account's.
  return heir ? { action: "promote", accountId: heir.accountId } : { action: "remove" };
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
    groupsRemoved: [],
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
  for (const row of rows) {
    const groupId = groupIdOf(row.sk);
    if (!groupId) continue;
    const members = await store.members(groupId);
    const next = succession(members, accountId);
    if (next.action === "promote") {
      await store.setRole(next.accountId, groupId, "admin");
      report.groupsInherited.push(groupId);
    } else if (next.action === "remove") {
      await store.removeGroup(groupId, Date.now());
      report.groupsRemoved.push(groupId);
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
    groupsRemoved: report.groupsRemoved.length,
  });
  return report;
};
