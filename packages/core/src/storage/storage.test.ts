import { describe, it, expect } from "vitest";
import { createFailingAdapter, createMemoryAdapter } from "./testAdapters";
import { createTimerStorage } from "./timerStorage";
import { createBlindsStorage } from "./blindsStorage";
import { DEFAULT_TIMER_DURATION } from "../constants";

describe("createTimerStorage", () => {
  it("returns sane defaults when nothing is stored", async () => {
    const storage = createTimerStorage(createMemoryAdapter());
    expect(await storage.loadTimerState()).toEqual({
      endTime: undefined,
      timerDuration: DEFAULT_TIMER_DURATION,
      paused: true,
      timeLeft: DEFAULT_TIMER_DURATION,
      completed: false,
    });
  });

  it("round-trips a running timer state", async () => {
    const storage = createTimerStorage(createMemoryAdapter());
    await storage.saveTimerState({
      endTime: 1_700_000_000_000,
      timerDuration: 300,
      paused: false,
      timeLeft: 120,
    });
    const loaded = await storage.loadTimerState();
    expect(loaded.endTime).toBe(1_700_000_000_000);
    expect(loaded.timerDuration).toBe(300);
    expect(loaded.paused).toBe(false);
    expect(loaded.timeLeft).toBe(120);
    expect(loaded.completed).toBe(false);
  });

  it("tracks the completed flag", async () => {
    const storage = createTimerStorage(createMemoryAdapter());
    await storage.markTimerCompleted();
    expect((await storage.loadTimerState()).completed).toBe(true);
    await storage.clearTimerCompleted();
    expect((await storage.loadTimerState()).completed).toBe(false);
  });

  it("clears stored state back to defaults", async () => {
    const storage = createTimerStorage(createMemoryAdapter());
    await storage.saveTimerState({
      endTime: 123,
      timerDuration: 60,
      paused: false,
      timeLeft: 42,
    });
    await storage.clearTimerState();
    const loaded = await storage.loadTimerState();
    expect(loaded.timerDuration).toBe(DEFAULT_TIMER_DURATION);
    expect(loaded.endTime).toBeUndefined();
  });
});

describe("createBlindsStorage", () => {
  it("defaults to the generated 30-level schedule", async () => {
    const storage = createBlindsStorage(createMemoryAdapter());
    const state = await storage.loadBlindsState();
    expect(state.currentBlindIndex).toBe(0);
    expect(state.blindLevels).toHaveLength(30);
    expect(state.customBlindLevels).toHaveLength(30);
  });

  it("round-trips a custom schedule and index", async () => {
    const storage = createBlindsStorage(createMemoryAdapter());
    const custom = [
      { small: 1, big: 2 },
      { small: 3, big: 6 },
    ];
    await storage.saveBlindsState({
      currentBlindIndex: 1,
      blindLevels: custom,
      customBlindLevels: custom,
    });
    const loaded = await storage.loadBlindsState();
    expect(loaded.currentBlindIndex).toBe(1);
    expect(loaded.blindLevels).toEqual(custom);
    expect(loaded.customBlindLevels).toEqual(custom);
  });

  it("persists the current index independently", async () => {
    const storage = createBlindsStorage(createMemoryAdapter());
    await storage.saveCurrentBlindIndex(7);
    expect((await storage.loadBlindsState()).currentBlindIndex).toBe(7);
  });
});

describe("storage failure paths", () => {
  // Every loader has a catch arm that degrades to defaults. They're unreachable
  // from the happy path, and they're the arms that decide whether a device with
  // broken storage opens the app or shows a blank screen.
  it("createTimerStorage falls back to defaults when storage throws", async () => {
    const storage = createTimerStorage(createFailingAdapter());
    expect(await storage.loadTimerState()).toEqual({
      endTime: undefined,
      timerDuration: DEFAULT_TIMER_DURATION,
      paused: true,
      timeLeft: DEFAULT_TIMER_DURATION,
      completed: false,
    });
  });

  it("createBlindsStorage falls back to a full default schedule when storage throws", async () => {
    const storage = createBlindsStorage(createFailingAdapter());
    const state = await storage.loadBlindsState();
    expect(state.currentBlindIndex).toBe(0);
    expect(state.blindLevels).toHaveLength(30);
    // Both halves must be the *same* default, or the editor opens showing a
    // draft that differs from the running tournament with no edit having
    // happened.
    expect(state.customBlindLevels).toEqual(state.blindLevels);
  });

  it("createBlindsStorage recovers from a corrupt stored schedule", async () => {
    const storage = createBlindsStorage(
      createMemoryAdapter({ blind_levels: "{not json" }),
    );
    const state = await storage.loadBlindsState();
    expect(state.blindLevels).toHaveLength(30);
  });

  it("saveCurrentBlindIndex swallows a storage failure rather than throwing", async () => {
    // Called on every level change; a rejection here would surface as an
    // unhandled promise rejection mid-tournament.
    const storage = createBlindsStorage(createFailingAdapter());
    await expect(storage.saveCurrentBlindIndex(3)).resolves.toBeUndefined();
  });

  it("clearBlindsState removes every key it owns", async () => {
    const adapter = createMemoryAdapter();
    const storage = createBlindsStorage(adapter);
    await storage.saveBlindsState({
      currentBlindIndex: 2,
      blindLevels: [{ small: 1, big: 2 }],
      customBlindLevels: [{ small: 1, big: 2 }],
    });
    await storage.clearBlindsState();
    expect(adapter.store.size).toBe(0);
  });
});
