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
 * **A different question from who may look at it**, and conflating the two was
 * the bug worth naming — see `boardIsVisible`. This one is about cost and about
 * not stranding other people; that one is about what somebody bought.
 *
 * A purely local board with no Club is deliberately never announced, which also
 * means its writes must never be queued: they would sit there being refused for
 * a board the server has never heard of.
 */
export const boardSyncs = (context: {
  hasClub: boolean;
  /**
   * Whether the server already has this board — **any role at all**, including
   * `admin` on a board of your own.
   *
   * Deliberately not "is it somebody else's": a board that is already up there
   * has members reading it, and quietly cutting it off would leave them looking
   * at a stale board with no idea why. Whether a *lapsed* host should keep
   * syncing is a real question and `ROADMAP.md` says it is open; until it is
   * answered the harmless direction is to keep sending, because the other one
   * silently strands other people's boards.
   */
  isOnServer: boolean;
}): boolean => context.hasClub || context.isOnServer;

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
  /**
   * Whether this is **somebody else's** board — `role === "member"`, and not
   * merely "the server knows about it".
   *
   * The distinction is the whole check. The server answers `admin` for a board
   * you created, so treating any known role as shared would hand the Pro
   * leaderboard to anybody who signed in on a device that had once pulled its
   * own boards — Pro unlocked by syncing, which is not a thing anybody bought.
   */
  isGuestBoard: boolean;
}): boolean => context.isPremium || context.isGuestBoard;
