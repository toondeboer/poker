import { StorageAdapter } from "./StorageAdapter";
import { TIMER_KEYS } from "./timerStorage";
import { BLINDS_KEYS } from "./blindsStorage";
import { REVIEW_KEYS } from "./reviewStorage";
import { GAME_KEY } from "./gameStorage";
import { PAYOUT_KEY } from "./payoutStorage";
import { PRESETS_KEY } from "./presetStorage";
import { SOUND_PACK_KEY } from "./soundPackStorage";
import { LEADERBOARD_KEY } from "./leaderboardStorage";

/**
 * The last resort, when the app cannot get past its own saved state.
 *
 * Every store here is validated on the way in, so this should never be needed —
 * but "should never" is exactly the situation that leaves somebody with an app
 * that fails the same way on every launch, because the thing that broke it is
 * loaded again each time. A person in that position needs a way out that does
 * not involve deleting the app, and deleting the app is the *worst* available
 * option: it takes the leaderboard with it.
 *
 * So this clears what can be recreated in a minute — the round in progress, the
 * blind schedule, the payout setup, saved presets — and deliberately keeps the
 * one thing that cannot be: seasons of recorded results. That asymmetry is the
 * whole point. Losing tonight's game is an inconvenience; losing two years of
 * game nights is not something to offer behind a button somebody presses while
 * frustrated.
 */
export const RECOVERY_CLEARS: readonly string[] = [
  ...Object.values(TIMER_KEYS),
  ...Object.values(BLINDS_KEYS),
  ...Object.values(REVIEW_KEYS),
  GAME_KEY,
  PAYOUT_KEY,
  PRESETS_KEY,
  SOUND_PACK_KEY,
];

/**
 * What survives, and why it is a list rather than an omission.
 *
 * Written down so that "the leaderboard is kept" is a decision with a test
 * behind it, not something that happens to be true because nobody added it to
 * the other list.
 */
export const RECOVERY_KEEPS: readonly string[] = [LEADERBOARD_KEY];

/** Throw away everything recoverable. The leaderboard is not touched. */
export const clearForRecovery = async (
  storage: StorageAdapter,
): Promise<void> => {
  await storage.multiRemove([...RECOVERY_CLEARS]);
};
