import { describe, it, expect } from "vitest";
import { createSoundPackStorage } from "./soundPackStorage";
import { createFailingAdapter, createMemoryAdapter } from "./testAdapters";
import { DEFAULT_SOUND_PACK_ID, SOUND_PACKS } from "../sounds/soundPack";

describe("createSoundPackStorage", () => {
  it("defaults when nothing is stored", async () => {
    const storage = createSoundPackStorage(createMemoryAdapter());
    expect(await storage.loadSoundPackId()).toBe(DEFAULT_SOUND_PACK_ID);
  });

  it("round-trips every pack the app offers", async () => {
    for (const pack of SOUND_PACKS) {
      const storage = createSoundPackStorage(createMemoryAdapter());
      await storage.saveSoundPackId(pack.id);
      expect(await storage.loadSoundPackId()).toBe(pack.id);
    }
  });

  it("falls back to the default when the stored id is not one we ship", async () => {
    // The realistic route here is a downgrade, or a pack being renamed/removed
    // between versions. Falling back keeps the alarm audible instead of trying
    // to play an asset that isn't in the bundle.
    const storage = createSoundPackStorage(
      createMemoryAdapter({ sound_pack_id: "airhorn" }),
    );
    expect(await storage.loadSoundPackId()).toBe(DEFAULT_SOUND_PACK_ID);
  });

  it("falls back to the default when storage throws", async () => {
    const storage = createSoundPackStorage(createFailingAdapter());
    expect(await storage.loadSoundPackId()).toBe(DEFAULT_SOUND_PACK_ID);
  });
});
