import { describe, it, expect } from "vitest";
import {
  DEFAULT_SOUND_PACK_ID,
  isValidSoundPackId,
  SOUND_PACKS,
} from "./soundPack";

describe("isValidSoundPackId", () => {
  it("accepts every id in SOUND_PACKS", () => {
    for (const pack of SOUND_PACKS) {
      expect(isValidSoundPackId(pack.id)).toBe(true);
    }
  });

  it("rejects ids we don't ship", () => {
    expect(isValidSoundPackId("airhorn")).toBe(false);
    expect(isValidSoundPackId("")).toBe(false);
    expect(isValidSoundPackId("ALARM")).toBe(false);
  });
});

describe("SOUND_PACKS", () => {
  it("includes the default, so the fallback is always playable", () => {
    expect(SOUND_PACKS.map((p) => p.id)).toContain(DEFAULT_SOUND_PACK_ID);
  });

  it("has unique ids", () => {
    const ids = SOUND_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps ids filename-safe", () => {
    // Ids double as the asset filename stem on all three platforms (JS require,
    // Android res/raw/<id>.wav, iOS <id>.wav). Android resource names in
    // particular must be lowercase alphanumeric + underscore, so a pack added
    // with a hyphen or capital would fail to resolve at runtime, on one
    // platform only.
    for (const pack of SOUND_PACKS) {
      expect(pack.id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("gives every pack a label", () => {
    for (const pack of SOUND_PACKS) {
      expect(pack.label.trim().length).toBeGreaterThan(0);
    }
  });
});
