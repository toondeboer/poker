import { StorageAdapter } from "./StorageAdapter";
import {
  INITIAL_REVIEW_STATE,
  ReviewPromptState,
} from "../reviews/reviewPolicy";

export const REVIEW_KEYS = {
  ROUNDS_PLAYED: "review_rounds_played",
  LAST_PROMPTED_AT: "review_last_prompted_at",
} as const;

export interface ReviewStorage {
  loadReviewState(): Promise<ReviewPromptState>;
  saveReviewState(state: ReviewPromptState): Promise<void>;
  clearReviewState(): Promise<void>;
}

/**
 * Create a review-prompt store backed by any {@link StorageAdapter}.
 * Pure persistence/serialization — no platform or UI dependencies.
 */
export function createReviewStorage(storage: StorageAdapter): ReviewStorage {
  return {
    async loadReviewState(): Promise<ReviewPromptState> {
      try {
        const values = await storage.multiGet([
          REVIEW_KEYS.ROUNDS_PLAYED,
          REVIEW_KEYS.LAST_PROMPTED_AT,
        ]);

        const roundsPlayedStr = values[0][1];
        const lastPromptedAtStr = values[1][1];

        return {
          roundsPlayed: roundsPlayedStr ? parseInt(roundsPlayedStr, 10) : 0,
          lastPromptedAt: lastPromptedAtStr
            ? parseInt(lastPromptedAtStr, 10)
            : null,
        };
      } catch {
        return { ...INITIAL_REVIEW_STATE };
      }
    },

    async saveReviewState(state: ReviewPromptState): Promise<void> {
      await storage.multiSet([
        [REVIEW_KEYS.ROUNDS_PLAYED, state.roundsPlayed.toString()],
        [
          REVIEW_KEYS.LAST_PROMPTED_AT,
          state.lastPromptedAt === null ? "" : state.lastPromptedAt.toString(),
        ],
      ]);
    },

    async clearReviewState(): Promise<void> {
      await storage.multiRemove(Object.values(REVIEW_KEYS));
    },
  };
}
