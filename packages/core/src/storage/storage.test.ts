import { describe, it, expect } from "vitest";
import type { StorageAdapter, StorageKeyValuePair } from "./StorageAdapter";
import { createTimerStorage } from "./timerStorage";
import { createBlindsStorage } from "./blindsStorage";
import { DEFAULT_TIMER_DURATION } from "../constants";

/** An in-memory StorageAdapter, mirroring the contract both apps implement. */
function createMemoryAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    async getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
    async multiGet(keys) {
      return keys.map(
        (key) =>
          [key, store.has(key) ? store.get(key)! : null] as StorageKeyValuePair,
      );
    },
    async multiSet(pairs) {
      for (const [key, value] of pairs) store.set(key, value);
    },
    async multiRemove(keys) {
      for (const key of keys) store.delete(key);
    },
  };
}

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
