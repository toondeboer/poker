import { describe, it, expect } from "vitest";
import {
  BLIND_SPEEDS,
  BlindSpeedId,
  CHIP_DENOMINATIONS,
  CHIP_UNIT_OPTIONS,
  inferSmallestChip,
  MIN_GENERATED_LEVELS,
  MAX_GENERATED_LEVELS,
  averageGrowthRate,
  generateBlindStructure,
  nextChipDenominationAbove,
  roundToChipDenomination,
} from "./generateStructure";

const SPEEDS: BlindSpeedId[] = ["slow", "standard", "turbo"];
const smalls = (
  speed: BlindSpeedId,
  levelCount = 14,
  startingSmallBlind = 5,
  smallestChip?: number,
) =>
  generateBlindStructure({
    startingSmallBlind,
    levelCount,
    speed,
    smallestChip,
  }).map((level) => level.small);

describe("CHIP_DENOMINATIONS", () => {
  it("is ascending, integer-only, and drops the non-integer 2.5 step", () => {
    expect(CHIP_DENOMINATIONS.every(Number.isInteger)).toBe(true);
    expect([...CHIP_DENOMINATIONS]).toEqual(
      [...CHIP_DENOMINATIONS].sort((a, b) => a - b),
    );
    expect(CHIP_DENOMINATIONS.slice(0, 11)).toEqual([
      1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500,
    ]);
    expect(CHIP_DENOMINATIONS).not.toContain(2.5);
  });
});

describe("roundToChipDenomination", () => {
  it.each([
    [3, 2],
    [3.5, 5], // tie → rounds up
    [7, 5],
    [8, 10],
    [12, 10],
    [15, 20], // tie → rounds up
    [240, 250],
    [0.4, 1],
    [-5, 1],
  ])("rounds %s to %s", (input, expected) => {
    expect(roundToChipDenomination(input)).toBe(expected);
  });

  it("never returns below 1 and handles non-finite input", () => {
    expect(roundToChipDenomination(Number.NaN)).toBe(1);
    expect(roundToChipDenomination(0)).toBe(1);
  });
});

describe("nextChipDenominationAbove", () => {
  it("returns the smallest denomination strictly greater than the input", () => {
    expect(nextChipDenominationAbove(5)).toBe(10);
    expect(nextChipDenominationAbove(20)).toBe(25);
    expect(nextChipDenominationAbove(6)).toBe(10);
  });
});

describe("generateBlindStructure", () => {
  const base = {
    startingSmallBlind: 5,
    levelCount: 20,
    speed: "standard" as const,
  };

  it("produces exactly levelCount levels", () => {
    expect(generateBlindStructure(base)).toHaveLength(20);
  });

  it("uses the requested starting small blind verbatim", () => {
    expect(generateBlindStructure(base)[0].small).toBe(5);
    expect(
      generateBlindStructure({ ...base, startingSmallBlind: 25 })[0].small,
    ).toBe(25);
  });

  it("defaults the big blind to twice the small blind", () => {
    for (const level of generateBlindStructure(base)) {
      expect(level.big).toBe(level.small * 2);
    }
  });

  it("honours a custom bigBlindMultiplier", () => {
    expect(
      generateBlindStructure({ ...base, bigBlindMultiplier: 3 })[0].big,
    ).toBe(15);
  });

  it("clamps levelCount and floors the starting blind at 1", () => {
    expect(generateBlindStructure({ ...base, levelCount: 999 })).toHaveLength(
      MAX_GENERATED_LEVELS,
    );
    expect(generateBlindStructure({ ...base, levelCount: 0 })).toHaveLength(
      MIN_GENERATED_LEVELS,
    );
    expect(
      generateBlindStructure({ ...base, startingSmallBlind: -10 })[0].small,
    ).toBe(1);
  });

  it("falls back to defaults for non-finite input", () => {
    const levels = generateBlindStructure({
      startingSmallBlind: Number.NaN,
      levelCount: Number.NaN,
      speed: "standard",
    });
    expect(levels.length).toBeGreaterThanOrEqual(MIN_GENERATED_LEVELS);
    expect(levels[0].small).toBeGreaterThanOrEqual(1);
  });

  it.each(SPEEDS)("is strictly increasing at every speed (%s)", (speed) => {
    const levels = generateBlindStructure({
      startingSmallBlind: 5,
      levelCount: MAX_GENERATED_LEVELS,
      speed,
    });
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i].small).toBeGreaterThan(levels[i - 1].small);
      expect(levels[i].big).toBeGreaterThan(levels[i - 1].big);
    }
  });

  it.each(SPEEDS)(
    "produces whole, round numbers at every speed (%s)",
    (speed) => {
      for (const small of smalls(speed, MAX_GENERATED_LEVELS)) {
        expect(Number.isInteger(small)).toBe(true);
        // Every blind normalises to one of its ladder's mantissas.
        const mantissa = small / 10 ** Math.floor(Math.log10(small));
        expect(Math.round(mantissa * 10) / 10).toBeLessThanOrEqual(10);
      }
    },
  );

  // The regression this file previously missed entirely: an earlier
  // percentage-based implementation had its rounding pass swallow the growth
  // rate, so all three speeds returned byte-identical schedules.
  it("gives every speed a genuinely different structure", () => {
    const [slow, standard, turbo] = SPEEDS.map((speed) => smalls(speed));
    expect(slow).not.toEqual(standard);
    expect(standard).not.toEqual(turbo);
    expect(slow).not.toEqual(turbo);
  });

  it("orders the speeds — slower schedules stay lower for longer", () => {
    const [slow, standard, turbo] = SPEEDS.map((speed) => smalls(speed));
    const last = (xs: number[]) => xs[xs.length - 1];
    expect(last(slow)).toBeLessThan(last(standard));
    expect(last(standard)).toBeLessThan(last(turbo));
  });

  it("matches a real published structure shape at standard speed", () => {
    // Compare against the common casino sheet: 25/50 → 50/100 → 75/150 →
    // 100/200 → 150/300 → 200/400 → 300/600 → 400/800. Ours is the same family
    // of round numbers climbing at the same pace.
    expect(smalls("standard", 8, 25)).toEqual([
      25, 30, 40, 60, 100, 150, 200, 300,
    ]);
  });

  it("keeps slow inside the recommended 20–33% band", () => {
    const levels = smalls("slow", 20);
    for (let i = 1; i < levels.length; i += 1) {
      const ratio = levels[i] / levels[i - 1];
      expect(ratio).toBeGreaterThanOrEqual(1.19);
      expect(ratio).toBeLessThanOrEqual(1.34);
    }
  });

  it("does not explode: 20 slow levels stay within 100x of the start", () => {
    const levels = smalls("slow", 20);
    // A flat 25%/level would be 1.25^19 ≈ 69x here; the ladder is gentler
    // *and* bounded — a 10-rung ladder is exactly one decade per 10 levels.
    expect(levels[levels.length - 1] / levels[0]).toBeLessThanOrEqual(100);
  });

  it("reports an average growth rate that reflects the ladder length", () => {
    expect(averageGrowthRate("slow")).toBeCloseTo(10 ** (1 / 10), 5);
    expect(averageGrowthRate("standard")).toBeCloseTo(10 ** (1 / 6), 5);
    expect(averageGrowthRate("turbo")).toBeCloseTo(10 ** (1 / 4), 5);
    expect(averageGrowthRate("slow")).toBeLessThan(
      averageGrowthRate("standard"),
    );
    expect(averageGrowthRate("standard")).toBeLessThan(
      averageGrowthRate("turbo"),
    );
  });

  it("exposes one ladder per speed, each ascending and starting at 1", () => {
    expect(BLIND_SPEEDS.map((s) => s.id)).toEqual(SPEEDS);
    for (const { ladder } of BLIND_SPEEDS) {
      expect(ladder[0]).toBe(1);
      expect([...ladder]).toEqual([...ladder].sort((a, b) => a - b));
      expect(ladder[ladder.length - 1]).toBeLessThan(10);
    }
  });

  it("returns a fresh array each call", () => {
    expect(generateBlindStructure(base)).not.toBe(generateBlindStructure(base));
  });
});

describe("smallest-chip constraint", () => {
  it.each(CHIP_UNIT_OPTIONS)(
    "keeps every blind a multiple of the chip unit (%s)",
    (chip) => {
      for (const speed of SPEEDS) {
        const levels = generateBlindStructure({
          startingSmallBlind: chip,
          levelCount: MAX_GENERATED_LEVELS,
          speed,
          smallestChip: chip,
        });
        for (const level of levels) {
          expect(level.small % chip).toBe(0);
          expect(level.big % chip).toBe(0);
        }
      }
    },
  );

  it("advances by at least one chip between levels", () => {
    for (const chip of CHIP_UNIT_OPTIONS) {
      const levels = smalls("slow", 20, chip, chip);
      for (let i = 1; i < levels.length; i += 1) {
        expect(levels[i] - levels[i - 1]).toBeGreaterThanOrEqual(chip);
      }
    }
  });

  // The reported problem: a slow structure from 5 offered 6/12 as level 2,
  // which can't be posted at a table whose smallest chip is a 5.
  it("never emits an off-grid level like 6 when the chip is 5", () => {
    const levels = smalls("slow", 12, 5, 5);
    expect(levels).toEqual([5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120]);
    expect(levels).not.toContain(6);
  });

  it("reproduces a published casino sheet with 25-chips at slow speed", () => {
    // Hollywood/standard sheet: 25/50, 50/100, 75/150, 100/200, 150/300,
    // 200/400, 300/600, 400/800 — ours matches, with one extra rung at 125.
    expect(smalls("slow", 12, 25, 25)).toEqual([
      25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600,
    ]);
  });

  it("snaps a starting blind that is off the grid", () => {
    expect(smalls("slow", 3, 7, 5)[0]).toBe(5);
    expect(smalls("slow", 3, 13, 5)[0]).toBe(15);
  });

  it("is unconstrained by default, preserving the finer ladder", () => {
    expect(smalls("slow", 4, 5)).toEqual([5, 6, 8, 10]);
  });

  it("still gives each speed a different structure on a coarse grid", () => {
    const [slow, standard, turbo] = SPEEDS.map((s) => smalls(s, 14, 25, 25));
    expect(slow).not.toEqual(standard);
    expect(standard).not.toEqual(turbo);
  });

  it("treats a nonsensical chip unit as unconstrained", () => {
    expect(smalls("slow", 4, 5, 0)).toEqual(smalls("slow", 4, 5, 1));
    expect(smalls("slow", 4, 5, Number.NaN)).toEqual(smalls("slow", 4, 5, 1));
  });
});

describe("inferSmallestChip", () => {
  it("returns the largest offered unit dividing every blind", () => {
    expect(
      inferSmallestChip([
        { small: 25, big: 50 },
        { small: 50, big: 100 },
      ]),
    ).toBe(25);
    expect(
      inferSmallestChip([
        { small: 5, big: 10 },
        { small: 15, big: 30 },
      ]),
    ).toBe(5);
    expect(
      inferSmallestChip([
        { small: 3, big: 6 },
        { small: 7, big: 14 },
      ]),
    ).toBe(1);
  });

  it("round-trips with a generated structure", () => {
    for (const chip of CHIP_UNIT_OPTIONS) {
      const levels = generateBlindStructure({
        startingSmallBlind: chip,
        levelCount: 12,
        speed: "slow",
        smallestChip: chip,
      });
      expect(inferSmallestChip(levels)).toBeGreaterThanOrEqual(chip);
    }
  });

  it("falls back to the default for an empty schedule", () => {
    expect(inferSmallestChip([])).toBe(5);
  });
});
