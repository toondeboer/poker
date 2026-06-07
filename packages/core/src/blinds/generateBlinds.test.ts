import { describe, it, expect } from "vitest";
import { generateBlindLevels } from "./generateBlinds";

describe("generateBlindLevels", () => {
  const levels = generateBlindLevels();

  it("produces the documented 30-level schedule", () => {
    expect(levels).toHaveLength(30);
    expect(levels[0]).toEqual({ small: 5, big: 10 });
    expect(levels[levels.length - 1]).toEqual({ small: 800, big: 1600 });
  });

  it("keeps big = 2 × small for every level", () => {
    for (const level of levels) {
      expect(level.big).toBe(level.small * 2);
    }
  });

  it("is strictly increasing in the small blind", () => {
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].small).toBeGreaterThan(levels[i - 1].small);
    }
  });

  it("returns a fresh array each call (no shared mutable state)", () => {
    const a = generateBlindLevels();
    const b = generateBlindLevels();
    expect(a).not.toBe(b);
    a[0].small = 999;
    expect(generateBlindLevels()[0].small).toBe(5);
  });
});
