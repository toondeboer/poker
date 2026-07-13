import { describe, it, expect } from "vitest";
import {
  shouldRequestReview,
  MIN_ROUNDS_BEFORE_REVIEW,
  REVIEW_PROMPT_COOLDOWN_MS,
  ReviewPromptState,
} from "./reviewPolicy";

const NOW = 1_700_000_000_000;

const state = (over: Partial<ReviewPromptState> = {}): ReviewPromptState => ({
  roundsPlayed: MIN_ROUNDS_BEFORE_REVIEW,
  lastPromptedAt: null,
  ...over,
});

describe("shouldRequestReview", () => {
  it("asks once enough rounds are played and we've never prompted", () => {
    expect(
      shouldRequestReview({ state: state(), now: NOW, isAvailable: true }),
    ).toBe(true);
  });

  it("never asks when the native API is unavailable", () => {
    expect(
      shouldRequestReview({ state: state(), now: NOW, isAvailable: false }),
    ).toBe(false);
  });

  it("waits until the minimum number of rounds played", () => {
    expect(
      shouldRequestReview({
        state: state({ roundsPlayed: MIN_ROUNDS_BEFORE_REVIEW - 1 }),
        now: NOW,
        isAvailable: true,
      }),
    ).toBe(false);
  });

  it("stays quiet during the cooldown after a prompt", () => {
    expect(
      shouldRequestReview({
        state: state({ lastPromptedAt: NOW - REVIEW_PROMPT_COOLDOWN_MS + 1000 }),
        now: NOW,
        isAvailable: true,
      }),
    ).toBe(false);
  });

  it("asks again once the cooldown has elapsed", () => {
    expect(
      shouldRequestReview({
        state: state({ lastPromptedAt: NOW - REVIEW_PROMPT_COOLDOWN_MS - 1 }),
        now: NOW,
        isAvailable: true,
      }),
    ).toBe(true);
  });
});
