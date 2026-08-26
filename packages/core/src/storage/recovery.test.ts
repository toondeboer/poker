import { describe, expect, it } from "vitest";
import {
  RECOVERY_CLEARS,
  RECOVERY_KEEPS,
  clearForRecovery,
} from "./recovery";
import { TIMER_KEYS } from "./timerStorage";
import { BLINDS_KEYS } from "./blindsStorage";
import { REVIEW_KEYS } from "./reviewStorage";
import { GAME_KEY } from "./gameStorage";
import { PAYOUT_KEY } from "./payoutStorage";
import { PRESETS_KEY } from "./presetStorage";
import { SOUND_PACK_KEY } from "./soundPackStorage";
import { LEADERBOARD_KEY } from "./leaderboardStorage";
import { createMemoryAdapter } from "./testAdapters";

/**
 * Every key any store in **this package** writes.
 *
 * Hand-maintained, and it has to be: core has no filesystem (`types: []`), so
 * nothing here can enumerate its own modules. What this catches is a key added
 * to a store and to only one of the two lists. What it cannot catch is a whole
 * store nobody added here — and it says nothing at all about keys the *apps*
 * write, which they account for themselves.
 */
const EVERY_KEY = [
  ...Object.values(TIMER_KEYS),
  ...Object.values(BLINDS_KEYS),
  ...Object.values(REVIEW_KEYS),
  GAME_KEY,
  PAYOUT_KEY,
  PRESETS_KEY,
  SOUND_PACK_KEY,
  LEADERBOARD_KEY,
];

describe("what a recovery throws away", () => {
  it("accounts for every key, so nothing is missed by omission", () => {
    // A key added to a store and to neither list would be silently left behind
    // — which, if it is the poisoned one, means the recovery does not recover.
    const accounted = new Set([...RECOVERY_CLEARS, ...RECOVERY_KEEPS]);
    expect(EVERY_KEY.filter((key) => !accounted.has(key))).toEqual([]);
  });

  it("never asks to both clear and keep the same thing", () => {
    const kept = new Set(RECOVERY_KEEPS);
    expect(RECOVERY_CLEARS.filter((key) => kept.has(key))).toEqual([]);
  });

  it("keeps the leaderboard, which is the one thing nobody can recreate", () => {
    // Deleting the app is the alternative a stuck user reaches for, and it
    // takes seasons of results with it. This has to be strictly better.
    expect(RECOVERY_KEEPS).toContain(LEADERBOARD_KEY);
    expect(RECOVERY_CLEARS).not.toContain(LEADERBOARD_KEY);
  });

  it("throws away the game in progress, which is one evening at most", () => {
    expect(RECOVERY_CLEARS).toContain(GAME_KEY);
  });
});

describe("running one", () => {
  it("leaves the leaderboard exactly where it was", async () => {
    const storage = createMemoryAdapter();
    for (const key of EVERY_KEY) await storage.setItem(key, "something");

    await clearForRecovery(storage);

    const survivors: string[] = [];
    for (const key of EVERY_KEY) {
      if ((await storage.getItem(key)) !== null) survivors.push(key);
    }
    expect(survivors).toEqual([...RECOVERY_KEEPS]);
  });

  it("does not mind state that was never there", async () => {
    // The likely case: something broke before most of it was ever written.
    const storage = createMemoryAdapter();
    await expect(clearForRecovery(storage)).resolves.toBeUndefined();
  });
});
