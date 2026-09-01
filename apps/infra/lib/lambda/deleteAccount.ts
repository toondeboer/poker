/**
 * Deleting an account, and everything it is allowed to take with it.
 *
 * **The order is the whole design.** Cognito goes last, because once the user is
 * gone the client holds no valid token and nothing can authenticate a retry —
 * so every step before it must be re-runnable, and every write it makes is
 * conditional on the state it expects. A deletion that fails halfway has to be
 * finishable by asking again, or it leaves an account that cannot be deleted
 * *because* it is half deleted.
 *
 * Split from the route so every branch is testable without a DynamoDB or a
 * Cognito, and these are branches worth testing: the expensive ones only happen
 * to somebody who is already leaving.
 */

import { log } from "./logging";
import { anotherAdmin, heirTo } from "./groupKeys";
import type { AccountRow, GroupStore } from "./groupStore";

/** What was done, for the log line and for the response. */
export type DeletionReport = {
  claimsReleased: number;
  groupsInherited: string[];
  /**
   * Groups this left with no admin, because whoever was going to take over was
   * gone by the time we tried. Reported rather than swallowed: rare, not
   * recoverable by the person leaving, and somebody has to know.
   */
  groupsStranded: string[];
};

const CLAIM_PREFIX = "CLAIM#";
const GROUP_PREFIX = "GROUP#";

/** The group a `CLAIM#<groupId>` row is about. */
export const claimGroupOf = (sk: string): string | null =>
  sk.startsWith(CLAIM_PREFIX) ? sk.slice(CLAIM_PREFIX.length) || null : null;

export const groupIdOf = (sk: string): string | null =>
  sk.startsWith(GROUP_PREFIX) ? sk.slice(GROUP_PREFIX.length) || null : null;

/**
 * Leave anyway, once a guaranteed departure has failed.
 *
 * **A membership must never outlive its account.** The account-side copy goes
 * with everything else under `ACCOUNT#`, and Cognito goes after that — so a
 * group-side `MEMBER#` row left behind is a ghost that `anotherAdmin` and
 * `heirTo` will keep naming, and that nobody can ever remove, because the
 * account it belongs to no longer exists.
 *
 * So the unguaranteed departure is the fallback rather than the failure: the
 * group may be left with no admin, which is recoverable and is reported, where
 * a ghost admin is neither.
 */
const depart = async (
  store: GroupStore,
  accountId: string,
  groupId: string,
  report: DeletionReport,
  requestId: string | undefined,
  reason: string,
): Promise<void> => {
  log("warn", "leaving without a guarantor", { requestId, groupId, reason });
  await store.leave(accountId, groupId, null);
  if (!report.groupsStranded.includes(groupId)) report.groupsStranded.push(groupId);
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

  const rows: AccountRow[] = await store.belongings(accountId);

  // 1. Let go of every player this account claimed. **The player and every game
  //    they played stay.** A board refers to the person rather than the account,
  //    so a season survives whoever recorded it leaving.
  for (const row of rows) {
    const groupId = claimGroupOf(row.sk);
    // The player comes from the row rather than the key — one seat per board
    // means the key names the group and the item names the player.
    if (!groupId || !row.playerId) continue;
    const outcome = await store.releaseClaim(accountId, groupId, row.playerId);
    // A conflict means it was already released, most likely by a previous
    // attempt at this same deletion. That is a success for our purposes.
    if (outcome.status === "ok") report.claimsReleased += 1;
  }

  // 2. Leave, and make sure no group is left with nobody who can manage it.
  //
  // **This never deletes a group.** An emptied one survives with its players
  // and results; cleaning those up wants a deliberate path rather than a
  // decision made during somebody else's deletion.
  for (const row of rows) {
    const groupId = groupIdOf(row.sk);
    if (!groupId) continue;

    // Consistent — the group's own partition, which is the reason membership is
    // written twice.
    const members = await store.members(groupId);
    const leavingIsAdmin = members.some(
      (m) => m.accountId === accountId && m.role === "admin",
    );

    if (!leavingIsAdmin) {
      await store.leave(accountId, groupId, null);
      continue;
    }

    const other = anotherAdmin(members, accountId);
    if (other) {
      // Somebody else is already in charge. Asserted in the same transaction as
      // the departure, so they cannot stop being an admin in between.
      const left = await store.leave(accountId, groupId, other.accountId);
      if (left.status !== "ok") await depart(store, accountId, groupId, report, requestId, left.reason);
      continue;
    }

    const heir = heirTo(members, accountId);
    if (!heir) {
      // Nobody else is here at all, so there is nobody to hand it to and
      // nothing of anybody else's to protect.
      await store.leave(accountId, groupId, null);
      continue;
    }

    // Promote first, then leave asserting the new admin is one. Either order
    // has a window; this one's window leaves the group with *two* admins rather
    // than none, which is the survivable direction.
    const promoted = await store.setRole(heir.accountId, groupId, "admin", null);
    if (promoted.status !== "ok") {
      log("warn", "group left without an admin", {
        requestId,
        groupId,
        reason: promoted.reason,
      });
      report.groupsStranded.push(groupId);
      await store.leave(accountId, groupId, null);
      continue;
    }
    const left = await store.leave(accountId, groupId, heir.accountId);
    // Recorded only once the departure lands. Otherwise a group appears in both
    // `groupsInherited` and `groupsStranded`, which cannot both be true.
    if (left.status === "ok") report.groupsInherited.push(groupId);
    // Checked, unlike before. An unreported failure here leaves the group-side
    // `MEMBER#` row behind while everything else about the account goes — a
    // ghost admin that `anotherAdmin` and `heirTo` keep naming forever.
    if (left.status !== "ok") await depart(store, accountId, groupId, report, requestId, left.reason);
  }

  // 3. Then whatever is left under the account. Unconditional, so a second
  //    attempt at a half-finished deletion still reaches the end.
  await store.forget(
    accountId,
    rows.map((row) => ({ pk: row.pk, sk: row.sk })),
  );

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
