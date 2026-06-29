// src/services/reviewService.ts
import * as StoreReview from "expo-store-review";
import { shouldRequestReview } from "@poker/core";
import { ReviewStorage } from "@/src/services/ReviewStorage";
import { logger } from "@/src/utils/logger";

/**
 * Record that the player ran a blind-level timer out (one "round") and, when
 * enough rounds are in, ask the OS to show the native review prompt. The
 * decision lives in `@poker/core` (`shouldRequestReview`); this adapter owns
 * persistence and the native `expo-store-review` call.
 *
 * Pass `canPrompt: false` for rounds that complete while backgrounded — the
 * round still counts, but the OS suppresses the sheet, so we don't want to burn
 * the prompt (set `lastPromptedAt`) on something the user never saw.
 *
 * Best-effort: never throws into the timer flow.
 */
export async function recordRoundPlayed(canPrompt: boolean): Promise<void> {
  try {
    const prev = await ReviewStorage.loadReviewState();
    const state = { ...prev, roundsPlayed: prev.roundsPlayed + 1 };

    if (canPrompt) {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (shouldRequestReview({ state, now: Date.now(), isAvailable })) {
        await StoreReview.requestReview();
        state.lastPromptedAt = Date.now();
        logger.log("Requested in-app review after round", state.roundsPlayed);
      }
    }

    await ReviewStorage.saveReviewState(state);
  } catch (error) {
    // A rating prompt is never worth disrupting gameplay over.
    logger.warn("recordRoundPlayed failed:", error);
  }
}
