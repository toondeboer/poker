import { describe, it, expect } from "vitest";
import {
  clampBlindIndex,
  nextBlindIndex,
  previousBlindIndex,
  addBlindLevel,
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
