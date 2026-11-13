import { describe, it, expect } from "vitest";
import { createReviewStorage } from "./reviewStorage";
import { createFailingAdapter, createMemoryAdapter } from "./testAdapters";
import { INITIAL_REVIEW_STATE } from "../reviews/reviewPolicy";

describe("createReviewStorage", () => {
  it("starts from the initial state when nothing is stored", async () => {
    const storage = createReviewStorage(createMemoryAdapter());
    expect(await storage.loadReviewState()).toEqual(INITIAL_REVIEW_STATE);
  });

  it("round-trips a state that has never prompted", async () => {
    const storage = createReviewStorage(createMemoryAdapter());
    await storage.saveReviewState({ roundsPlayed: 7, lastPromptedAt: null });
    expect(await storage.loadReviewState()).toEqual({
      roundsPlayed: 7,
      lastPromptedAt: null,
    });
  });

  it("round-trips a state that has prompted", async () => {
    const storage = createReviewStorage(createMemoryAdapter());
    const at = 1_700_000_000_000;
    await storage.saveReviewState({ roundsPlayed: 12, lastPromptedAt: at });
    expect(await storage.loadReviewState()).toEqual({
      roundsPlayed: 12,
      lastPromptedAt: at,
    });
  });

  it("keeps `lastPromptedAt: null` distinguishable from a real timestamp", async () => {
    // `null` is persisted as an empty string, which is falsy on the way back
    // out — the round trip only works because of that pairing. If either half
    // changes independently a never-prompted user reads as prompted at epoch 0,
    // which would suppress the prompt forever.
    const adapter = createMemoryAdapter();
    const storage = createReviewStorage(adapter);
    await storage.saveReviewState({ roundsPlayed: 1, lastPromptedAt: null });
    expect(adapter.store.get("review_last_prompted_at")).toBe("");
    expect((await storage.loadReviewState()).lastPromptedAt).toBeNull();
  });

  it("treats a stored timestamp of 0 as a real prompt, not as absent", async () => {
    const storage = createReviewStorage(
      createMemoryAdapter({
        review_rounds_played: "3",
        review_last_prompted_at: "0",
      }),
    );
    expect(await storage.loadReviewState()).toEqual({
      roundsPlayed: 3,
      lastPromptedAt: 0,
    });
  });

  it("falls back to the initial state when storage throws", async () => {
    const storage = createReviewStorage(createFailingAdapter());
    expect(await storage.loadReviewState()).toEqual(INITIAL_REVIEW_STATE);
  });

  it("clears both keys", async () => {
    const adapter = createMemoryAdapter();
    const storage = createReviewStorage(adapter);
    await storage.saveReviewState({ roundsPlayed: 5, lastPromptedAt: 1 });
    await storage.clearReviewState();
    expect(adapter.store.size).toBe(0);
    expect(await storage.loadReviewState()).toEqual(INITIAL_REVIEW_STATE);
  });
});
