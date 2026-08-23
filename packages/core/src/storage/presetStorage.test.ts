import { describe, it, expect } from "vitest";
import { createPresetStorage } from "./presetStorage";
import { createFailingAdapter, createMemoryAdapter } from "./testAdapters";
import type { BlindPreset } from "../presets/preset";

const preset: BlindPreset = {
  id: "p1",
  name: "Home game",
  timerDuration: 900,
  blindLevels: [
    { small: 25, big: 50 },
    { small: 50, big: 100 },
  ],
  createdAt: 1_700_000_000_000,
};

describe("createPresetStorage", () => {
  it("returns an empty list when nothing is stored", async () => {
    const storage = createPresetStorage(createMemoryAdapter());
    expect(await storage.loadPresets()).toEqual([]);
  });

  it("round-trips presets, including their blind levels", async () => {
    const storage = createPresetStorage(createMemoryAdapter());
    await storage.savePresets([preset]);
    expect(await storage.loadPresets()).toEqual([preset]);
  });

  it("overwrites rather than appends, so saving is a snapshot of the whole list", async () => {
    const storage = createPresetStorage(createMemoryAdapter());
    await storage.savePresets([preset]);
    await storage.savePresets([]);
    expect(await storage.loadPresets()).toEqual([]);
  });

  it("falls back to an empty list when the stored value is not valid JSON", async () => {
    // An upgrade or a half-written value leaves garbage under the key. The
    // presets are lost either way; what matters is that Settings still opens.
    const storage = createPresetStorage(
      createMemoryAdapter({ blind_presets: "{not json" }),
    );
    expect(await storage.loadPresets()).toEqual([]);
  });

  it("falls back to an empty list when storage itself throws", async () => {
    const storage = createPresetStorage(createFailingAdapter());
    expect(await storage.loadPresets()).toEqual([]);
  });

  it("clears the stored presets", async () => {
    const adapter = createMemoryAdapter();
    const storage = createPresetStorage(adapter);
    await storage.savePresets([preset]);
    await storage.clearPresets();
    expect(adapter.store.size).toBe(0);
    expect(await storage.loadPresets()).toEqual([]);
  });
});
