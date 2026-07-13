import { describe, it, expect } from "vitest";
import {
  createPreset,
  addPreset,
  removePreset,
  isValidPresetName,
  MAX_PRESETS,
  BlindPreset,
} from "./preset";
import { BlindLevel } from "../types/BlindLevel";

const LEVELS: BlindLevel[] = [
  { small: 25, big: 50 },
  { small: 50, big: 100 },
];

const make = (id: string, name: string): BlindPreset =>
  createPreset({ id, name, blindLevels: LEVELS, timerDuration: 600, now: 1 });

describe("createPreset", () => {
  it("trims the name and stamps createdAt from `now`", () => {
    const preset = createPreset({
      id: "a",
      name: "  Friday Game  ",
      blindLevels: LEVELS,
      timerDuration: 900,
      now: 123,
    });
    expect(preset.name).toBe("Friday Game");
    expect(preset.createdAt).toBe(123);
    expect(preset.timerDuration).toBe(900);
  });
});

describe("addPreset", () => {
  it("prepends newest-first", () => {
    const list = addPreset([make("1", "A")], make("2", "B"));
    expect(list.map((p) => p.id)).toEqual(["2", "1"]);
  });

  it("caps the list at MAX_PRESETS, dropping the oldest", () => {
    let list: BlindPreset[] = [];
    for (let i = 0; i < MAX_PRESETS + 5; i++) {
      list = addPreset(list, make(String(i), `P${i}`));
    }
    expect(list).toHaveLength(MAX_PRESETS);
    expect(list[0].id).toBe(String(MAX_PRESETS + 4)); // newest kept
  });
});

describe("removePreset", () => {
  it("removes by id", () => {
    const list = [make("1", "A"), make("2", "B")];
    expect(removePreset(list, "1").map((p) => p.id)).toEqual(["2"]);
  });
});

describe("isValidPresetName", () => {
  const existing = [make("1", "Home Game")];

  it("rejects empty / whitespace names", () => {
    expect(isValidPresetName("   ", existing)).toBe(false);
  });

  it("rejects case-insensitive duplicates", () => {
    expect(isValidPresetName("home game", existing)).toBe(false);
  });

  it("accepts a fresh, non-empty name", () => {
    expect(isValidPresetName("Turbo", existing)).toBe(true);
  });
});
