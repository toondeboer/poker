import { describe, it, expect } from "vitest";
import {
  clampBlindIndex,
  nextBlindIndex,
  previousBlindIndex,
  addBlindLevel,
  insertBlindLevel,
  duplicateBlindLevel,
  removeBlindLevel,
  updateBlindLevel,
} from "./mutateBlinds";
import type { BlindLevel } from "../types/BlindLevel";

const sample = (): BlindLevel[] => [
  { small: 5, big: 10 },
  { small: 10, big: 20 },
  { small: 15, big: 30 },
];

describe("clampBlindIndex", () => {
  it("clamps below, within, and above the range", () => {
    expect(clampBlindIndex(-3, 3)).toBe(0);
    expect(clampBlindIndex(1, 3)).toBe(1);
    expect(clampBlindIndex(9, 3)).toBe(2);
  });
});

describe("nextBlindIndex / previousBlindIndex", () => {
  const levels = sample();
  it("advances but never past the last level", () => {
    expect(nextBlindIndex(0, levels)).toBe(1);
    expect(nextBlindIndex(2, levels)).toBe(2);
  });
  it("retreats but never before the first level", () => {
    expect(previousBlindIndex(2)).toBe(1);
    expect(previousBlindIndex(0)).toBe(0);
  });
});

describe("addBlindLevel", () => {
  it("extrapolates the last step when ≥ 2 levels exist", () => {
    const result = addBlindLevel(sample()); // last step is +5 / +10
    expect(result).toHaveLength(4);
    expect(result[3]).toEqual({ small: 20, big: 40 });
  });
  it("doubles the only level when exactly one exists", () => {
    const result = addBlindLevel([{ small: 5, big: 10 }]);
    expect(result[1]).toEqual({ small: 10, big: 20 });
  });
  it("does not mutate the input array", () => {
    const input = sample();
    addBlindLevel(input);
    expect(input).toHaveLength(3);
  });
});

describe("insertBlindLevel", () => {
  it("appending is identical to addBlindLevel", () => {
    const input = sample();
    expect(insertBlindLevel(input, input.length)).toEqual(addBlindLevel(input));
  });

  it("clamps an out-of-range index to an append", () => {
    const input = sample();
    expect(insertBlindLevel(input, 99)).toEqual(addBlindLevel(input));
  });

  it("interpolates between neighbours when inserting in the middle", () => {
    // Between 10/20 and 15/30 — midpoints 12.5 / 25, snapped chip-friendly.
    const result = insertBlindLevel(sample(), 2);
    expect(result).toHaveLength(4);
    expect(result[2].small).toBeGreaterThan(10);
    expect(result[2].small).toBeLessThan(15);
    expect(result[2].big).toBeGreaterThan(20);
    expect(result[2].big).toBeLessThan(30);
    // The rest of the schedule is untouched and shifted down.
    expect(result[3]).toEqual({ small: 15, big: 30 });
  });

  it("keeps the schedule strictly increasing after a middle insert", () => {
    const result = insertBlindLevel(sample(), 1);
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i].small).toBeGreaterThan(result[i - 1].small);
    }
  });

  it("halves the first level when inserting at the front", () => {
    const result = insertBlindLevel(sample(), 0);
    expect(result).toHaveLength(4);
    expect(result[0].small).toBeLessThan(5);
    expect(result[1]).toEqual({ small: 5, big: 10 });
  });

  it("falls back to the lower neighbour when nothing fits between", () => {
    const adjacent: BlindLevel[] = [
      { small: 1, big: 2 },
      { small: 2, big: 3 },
    ];
    expect(insertBlindLevel(adjacent, 1)[1]).toEqual({ small: 1, big: 2 });
  });

  it("does not mutate the input array", () => {
    const input = sample();
    insertBlindLevel(input, 1);
    expect(input).toHaveLength(3);
  });
});

describe("duplicateBlindLevel", () => {
  it("inserts a copy directly after the source level", () => {
    const result = duplicateBlindLevel(sample(), 1);
    expect(result).toHaveLength(4);
    expect(result[1]).toEqual({ small: 10, big: 20 });
    expect(result[2]).toEqual({ small: 10, big: 20 });
    expect(result[3]).toEqual({ small: 15, big: 30 });
  });

  it("copies rather than aliasing the source level", () => {
    const result = duplicateBlindLevel(sample(), 0);
    expect(result[1]).not.toBe(result[0]);
  });

  it("returns the input untouched for a bad index", () => {
    const input = sample();
    expect(duplicateBlindLevel(input, 9)).toBe(input);
    expect(duplicateBlindLevel(input, -1)).toBe(input);
  });

  it("does not mutate the input array", () => {
    const input = sample();
    duplicateBlindLevel(input, 1);
    expect(input).toHaveLength(3);
  });
});

describe("removeBlindLevel", () => {
  it("removes by index when more than two levels remain", () => {
    expect(removeBlindLevel(sample(), 1)).toEqual([
      { small: 5, big: 10 },
      { small: 15, big: 30 },
    ]);
  });
  it("refuses to drop below two levels (returns input untouched)", () => {
    const two: BlindLevel[] = [
      { small: 5, big: 10 },
      { small: 10, big: 20 },
    ];
    expect(removeBlindLevel(two, 0)).toBe(two);
  });
});

describe("updateBlindLevel", () => {
  it("updates a single field immutably", () => {
    const input = sample();
    const result = updateBlindLevel(input, 1, "big", 25);
    expect(result[1]).toEqual({ small: 10, big: 25 });
    expect(input[1]).toEqual({ small: 10, big: 20 }); // original untouched
  });
});

describe("insertBlindLevel at the front with the smallest possible blinds", () => {
  it("clamps to 1 rather than going below a whole chip", () => {
    // Halving normally rounds to a chip-friendly value, but at the very bottom
    // of the ladder there is nowhere below to go: 1 is the smallest blind you
    // can post. So inserting before 1/2 repeats 1/2 rather than inventing a
    // fractional or zero blind. Duplicating the opener is recoverable by
    // editing; a 0 blind is not.
    const result = insertBlindLevel([{ small: 1, big: 2 }], 0);
    expect(result).toHaveLength(2);
    expect(result[0].small).toBe(1);
    expect(result[0].small).toBeLessThanOrEqual(result[1].small);
  });

  it("keeps blinds whole and positive when halving a 2/4 opener", () => {
    const result = insertBlindLevel([{ small: 2, big: 4 }], 0);
    expect(result[0].small).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(result[0].small)).toBe(true);
    expect(result[0].small).toBeLessThan(2);
  });

  it("never produces a zero or negative blind at the floor", () => {
    for (const opener of [
      { small: 1, big: 1 },
      { small: 1, big: 2 },
      { small: 2, big: 3 },
    ]) {
      const [inserted] = insertBlindLevel([opener], 0);
      expect(inserted.small).toBeGreaterThanOrEqual(1);
      expect(inserted.big).toBeGreaterThanOrEqual(1);
    }
  });
});
