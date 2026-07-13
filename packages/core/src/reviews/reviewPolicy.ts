/**
 * Persisted state behind the in-app "rate this app" prompt. Kept tiny and
 * platform-agnostic so the same gating logic runs anywhere @poker/core does.
 */
export type ReviewPromptState = {
  /** How many blind-level timers the player has run to completion ("rounds"). */
  roundsPlayed: number;
  /** Epoch ms of the last time we asked the OS to show the review sheet. */
  lastPromptedAt: number | null;
};

/** A fresh review state for a brand-new install. */
export const INITIAL_REVIEW_STATE: ReviewPromptState = {
  roundsPlayed: 0,
  lastPromptedAt: null,
};

/**
 * Ask after this many rounds. Tied to rounds (not finishing a whole blind
 * schedule) so any actively-playing user reliably hits the prompt.
 */
export const MIN_ROUNDS_BEFORE_REVIEW = 5;

/**
 * Never re-ask within this window. The OS also throttles (iOS caps at ~3
 * prompts / 365 days and may silently show nothing), but this keeps us from
 * calling the API on every subsequent round.
 */
export const REVIEW_PROMPT_COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000; // 120 days

export type ReviewPolicyInput = {
  state: ReviewPromptState;
  /** Current time, epoch ms. */
  now: number;
  /** True only when the platform's native StoreReview API can show a prompt. */
  isAvailable: boolean;
};

/**
 * Single source of truth for whether to ask the OS to show the review prompt.
 * Pure: callers handle the actual native request and persistence.
 */
export function shouldRequestReview({
  state,
  now,
  isAvailable,
}: ReviewPolicyInput): boolean {
  if (!isAvailable) return false;
  if (state.roundsPlayed < MIN_ROUNDS_BEFORE_REVIEW) return false;
  if (
    state.lastPromptedAt !== null &&
    now - state.lastPromptedAt < REVIEW_PROMPT_COOLDOWN_MS
  ) {
    return false;
  }
  return true;
}
