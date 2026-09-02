/**
 * Who may do what with a shared board.
 *
 * **The host pays; guests do not.** Somebody sent a board can join it, read it
 * and record on it having bought nothing at all. That is not generosity — an
 * invite that asks five friends to subscribe to a poker timer is a feature
 * nobody ever uses, and a board costs the same whether one person is on it or
 * eight. The person who organises the game night gets the value and pays for
 * it; everyone else is a guest, and every guest is somebody who has now
 * installed the app.
 *
 * So the line is **hosting**, not participating:
 *
 * | | Needs |
 * | --- | --- |
 * | Your own boards, the leaderboard, payouts, dealing a hand | **Pro** (one-time) |
 * | Making a board of your own shareable, and inviting people | **Club** (subscription) |
 * | Joining a board somebody sent you, and reading it | **nothing** |
 *
 * These live here rather than in a screen because the mistakes are all of the
 * same kind — telling somebody to buy what they already own, or to pay when
 * what they need is to sign in — and they are invisible in review and obvious
 * in a store review.
 */

/** Everything a decision here can depend on. */
export type ClubContext = {
  /** Whether there is a session. Anything shared needs one; nothing else does. */
  signedIn: boolean;
  /**
   * Whether the entitlements are the store's answer rather than the default.
   *
   * **Refusing on a default is how somebody who has paid gets told to pay**, and
   * a cold launch lands squarely in that window. Only ever consulted before a
   * refusal — never before *allowing* something, where being briefly wrong
   * costs a moment rather than an insult.
   */
  entitlementsKnown: boolean;
  /** The hosting subscription. */
  hasClub: boolean;
  /** The one-time unlock. */
  isPremium: boolean;
};

/**
 * Why this person cannot join a board, or `null` if they can.
 *
 * **Only a session is required.** Anything else here would be asking the guest
 * to pay for the host's feature, which is the thing that kills it.
 */
export const joinRefusal = (context: Pick<ClubContext, "signedIn">): string | null =>
  context.signedIn ? null : "Sign in to join a board.";

/**
 * Why this person cannot share a board of their own, or `null` if they can.
 *
 * Sharing is the hosting act: it puts a board on the server and keeps it there.
 */
export const hostRefusal = (context: ClubContext): string | null => {
  if (!context.signedIn) return "Sign in to share a board.";
  // Before the refusal, never before the permission — see `entitlementsKnown`.
  if (!context.entitlementsKnown) {
    return "Still checking your purchases. Try again in a moment.";
  }
  if (!context.hasClub) {
    return "Sharing a board is part of Club. Joining one is always free.";
  }
  return null;
};

/**
 * Whether a board should reach the server at all.
 *
 * Two quite different boards qualify, and conflating them was the bug worth
 * naming: **a board somebody shared with you** is already on the server and the
 * host is paying for it, so writing to it costs nothing extra and needs
 * nothing bought. **A board of your own** only belongs there if you host.
 *
 * A local board with no Club is deliberately never announced, which also means
 * its writes must never be queued — they would sit there being refused for a
 * board the server has never heard of.
 */
export const boardSyncs = (context: {
  hasClub: boolean;
  /** Whether the server has told us our role on it, i.e. it is a shared board. */
  isShared: boolean;
}): boolean => context.hasClub || context.isShared;

/**
 * Whether a board can be looked at without Pro.
 *
 * **A shared board is readable by anybody it was shared with**, which has to be
 * true or "guests join free" is a lie: they would join, and land on a paywall
 * looking at the board they were invited to.
 *
 * Your *own* boards are still Pro. The distinction is easy to say out loud —
 * Pro is for keeping your own score, and a board somebody else keeps is theirs.
 * It is also the better funnel: a guest sees what the app does for a season of
 * game nights and then wants one of their own.
 */
export const boardIsVisible = (context: {
  isPremium: boolean;
  isShared: boolean;
}): boolean => context.isPremium || context.isShared;
