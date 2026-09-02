/**
 * Whether somebody can join a shared board, and what to tell them if not.
 *
 * **The order is the whole of it**, and getting it wrong is not a crash — it is
 * a person being told to buy something when what they actually need is to sign
 * in, or being told to buy something they have already bought. That is exactly
 * the kind of mistake nobody notices in review and everybody notices in an app
 * store review, which is why it lives here where it can be tested rather than
 * in a screen where it cannot.
 *
 * Two entitlements are involved and they are genuinely separate purchases:
 *
 * - **Sharing boards** is a subscription, because it is the only thing in the
 *   app with a cost that keeps arriving every month a board exists.
 * - **Pro** is a one-time purchase that unlocks the leaderboard — and a shared
 *   board *is* a leaderboard, so it is no use without one.
 *
 * Somebody can hold either alone, which is why both are named separately rather
 * than collapsed into one "you need to pay" message.
 */

export type JoinContext = {
  /** Whether there is a session. Joining is the one thing here that needs one. */
  signedIn: boolean;
  /**
   * Whether the entitlements below are the store's answer rather than the
   * default. **Refusing on a default is how somebody who has paid gets told to
   * pay**, and a cold launch from an invite link lands squarely in that window.
   */
  entitlementsKnown: boolean;
  hasSharedBoards: boolean;
  isPremium: boolean;
};

/** Why this person cannot join, or `null` if they can. */
export const joinRefusal = (context: JoinContext): string | null => {
  /**
   * **Before anything about money.** The screen offers a "Sign in" button and
   * nothing else in this state, so any other message leaves the words and the
   * only available action disagreeing about what is wrong.
   */
  if (!context.signedIn) return "Sign in to join a board.";

  /**
   * **Before the two checks below, which would otherwise read a default.** This
   * one is temporary rather than a refusal, and says so: there is nothing for
   * the person to do except wait a moment.
   */
  if (!context.entitlementsKnown) {
    return "Still checking your purchases. Try again in a moment.";
  }

  // Named separately, because somebody can be missing either one, and "you need
  // to pay" would be useless to a person who has already paid for the other.
  if (!context.hasSharedBoards) {
    return "Sharing boards is a subscription. You'll need it to join one.";
  }
  if (!context.isPremium) {
    return "The leaderboard is part of Pro, and a shared board is a leaderboard.";
  }
  return null;
};
