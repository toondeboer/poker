import { BlindLevel } from "../types/BlindLevel";

/**
 * Chip-friendly values a blind should land on: 1, 2, 2.5, 5 × 10^k, integers
 * only (so 2.5 is dropped but 25, 250, 2500 are kept). Ascending.
 */
export const CHIP_DENOMINATIONS: readonly number[] = (() => {
  const values: number[] = [];
  for (let k = 0; k <= 9; k += 1) {
    for (const base of [1, 2, 2.5, 5]) {
      const value = base * 10 ** k;
      if (Number.isInteger(value)) values.push(value);
    }
  }
  return values.sort((a, b) => a - b);
})();

const LARGEST_DENOMINATION = CHIP_DENOMINATIONS[CHIP_DENOMINATIONS.length - 1];

/**
 * Nearest chip denomination to `value`. Ties round up (so 15 → 20, 3.5 → 5),
 * which keeps a schedule climbing rather than stalling. Never returns below 1.
 */
export const roundToChipDenomination = (value: number): number => {
  if (!Number.isFinite(value) || value <= 1) return 1;
  if (value >= LARGEST_DENOMINATION) return LARGEST_DENOMINATION;

  let best = CHIP_DENOMINATIONS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const denomination of CHIP_DENOMINATIONS) {
    const distance = Math.abs(denomination - value);
    // `<=` makes a tie pick the larger denomination, since the list ascends.
    if (distance <= bestDistance) {
      best = denomination;
      bestDistance = distance;
    }
  }
  return best;
};

/** Smallest chip denomination strictly greater than `value`. */
export const nextChipDenominationAbove = (value: number): number => {
  for (const denomination of CHIP_DENOMINATIONS) {
    if (denomination > value) return denomination;
  }
  return Math.floor(value) + 1;
};

export type BlindSpeedId = "slow" | "standard" | "turbo";

/**
 * Blind speeds, expressed as a ladder of "round" mantissas within one power of
 * ten. Walking a ladder and wrapping into the next decade is how real published
 * structures actually work — e.g. a standard casino sheet runs
 * 25/50 → 50/100 → 75/150 → 100/200 → 150/300 → 200/400 → 300/600 → 400/800,
 * whose level-to-level ratios are 2.0, 1.5, 1.33, 1.5, 1.33, 1.5, 1.33 — round
 * numbers first, not a constant percentage.
 *
 * This matters for two reasons a fixed percentage can't deliver:
 *   1. Every blind is a number you can actually make with chips, without a
 *      rounding pass that distorts the growth (and, as an earlier version of
 *      this file proved, can erase the difference between speeds entirely).
 *   2. Steps stay inside a sane band (~20–33% for `slow`) and *ease off* within
 *      each decade, instead of compounding at a flat rate that explodes late.
 *
 * A ladder of length `n` multiplies the blinds by 10 every `n` levels, so the
 * top end is predictable: `slow` needs 10 levels to reach 10×, `turbo` only 4.
 */
export const BLIND_SPEEDS: readonly {
  id: BlindSpeedId;
  label: string;
  /** Mantissas walked within each power of ten. */
  ladder: readonly number[];
}[] = [
  // ~20–33% per level — the band recommended for keeping players from
  // lurching between deep- and short-stacked.
  { id: "slow", label: "Slow", ladder: [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8] },
  // ~33–50% per level, matching the common casino/home-game sheet above.
  { id: "standard", label: "Standard", ladder: [1, 1.5, 2, 3, 4, 6] },
  // ~78% per level — the classic 1-2-3-5 series, for a short session.
  { id: "turbo", label: "Turbo", ladder: [1, 2, 3, 5] },
];

export const DEFAULT_BLIND_SPEED_ID: BlindSpeedId = "standard";

export const MIN_GENERATED_LEVELS = 2;
export const MAX_GENERATED_LEVELS = 60;

const DEFAULT_STARTING_SMALL_BLIND = 5;
const DEFAULT_LEVEL_COUNT = 20;
const DEFAULT_BIG_BLIND_MULTIPLIER = 2;

/** Average per-level multiplier for a speed — a ladder covers one decade. */
export const averageGrowthRate = (speed: BlindSpeedId): number => {
  const ladder = ladderFor(speed);
  return 10 ** (1 / ladder.length);
};

const ladderFor = (speed: BlindSpeedId): readonly number[] =>
  (BLIND_SPEEDS.find((entry) => entry.id === speed) ?? BLIND_SPEEDS[1]).ladder;

/**
 * The next value on `ladder` strictly greater than `value`, searching from the
 * value's own decade upward. Mantissas are rounded to whole chips, so a ladder
 * entry that collides with `value` after rounding is simply skipped.
 */
const nextLadderValue = (ladder: readonly number[], value: number): number => {
  const startDecade = value > 0 ? Math.floor(Math.log10(value)) : 0;
  for (let decade = startDecade; decade <= startDecade + 2; decade += 1) {
    for (const mantissa of ladder) {
      const candidate = Math.round(mantissa * 10 ** decade);
      if (candidate > value) return candidate;
    }
  }
  // Unreachable for any sane ladder (one must contain a value ≥ 1), but a
  // schedule that can't advance is worse than one that doubles.
  return value * 2;
};

/**
 * Smallest-chip values offered in the generator. A blind you can't physically
 * make change for is useless at a real table: if the smallest chip on the table
 * is a 5, a level of 6/12 can't be posted.
 */
export const CHIP_UNIT_OPTIONS: readonly number[] = [1, 5, 25, 100];

export const DEFAULT_CHIP_UNIT = 5;

/**
 * The largest offered chip unit that divides every blind in `levels` — i.e. the
 * smallest chip this schedule could actually have been dealt with. Used to seed
 * the generator from the structure being edited instead of guessing.
 */
export const inferSmallestChip = (levels: BlindLevel[]): number => {
  if (levels.length === 0) return DEFAULT_CHIP_UNIT;
  let best = 1;
  for (const unit of CHIP_UNIT_OPTIONS) {
    const divides = levels.every(
      (level) => level.small % unit === 0 && level.big % unit === 0,
    );
    if (divides) best = unit;
  }
  return best;
};

export type BlindStructureOptions = {
  /** Small blind of level 1, snapped to `smallestChip` and floored at it. */
  startingSmallBlind: number;
  /** How many levels to produce. Clamped to [MIN_GENERATED_LEVELS, MAX_GENERATED_LEVELS]. */
  levelCount: number;
  /** How fast the blinds climb. */
  speed: BlindSpeedId;
  /**
   * Smallest chip denomination in play. Every blind is a multiple of this, and
   * consecutive levels differ by at least one of it. Defaults to 1 (unconstrained).
   */
  smallestChip?: number;
  /** big = small × this. Defaults to 2. */
  bigBlindMultiplier?: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const sanitize = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

/**
 * Build a blind schedule from a starting small blind, a level count, a speed and
 * the smallest chip in play.
 *
 * Level 1 is the small blind asked for; every level after it is the next rung of
 * the speed's ladder (see {@link BLIND_SPEEDS}), so the result is always strictly
 * increasing and always made of round numbers.
 *
 * `smallestChip` then constrains every blind to a multiple of itself — a level of
 * 6/12 is unpostable at a table whose smallest chip is a 5. Where the ladder's
 * next rung would round back onto the previous level, the schedule steps up by
 * exactly one chip instead. That's why a slow structure from 5 with 5-chips opens
 * 5 → 10 → 15 rather than 5 → 6 → 8: at those sizes one chip *is* the smallest
 * possible raise, so the early percentage steps are necessarily larger. It
 * settles into the ladder's own pace as soon as the blinds are big enough to
 * express it.
 *
 * This is the *parameterised* generator behind the in-app structure generator.
 * The app's own default schedule stays `generateBlindLevels()` — a hand-tuned
 * fixed ladder — and is deliberately not re-expressed in terms of this one.
 */
export const generateBlindStructure = (
  options: BlindStructureOptions,
): BlindLevel[] => {
  const startingSmallBlind = Math.max(
    1,
    Math.round(
      sanitize(options.startingSmallBlind, DEFAULT_STARTING_SMALL_BLIND),
    ),
  );
  const levelCount = clamp(
    Math.round(sanitize(options.levelCount, DEFAULT_LEVEL_COUNT)),
    MIN_GENERATED_LEVELS,
    MAX_GENERATED_LEVELS,
  );
  const bigBlindMultiplier = Math.max(
    1,
    sanitize(options.bigBlindMultiplier ?? 2, DEFAULT_BIG_BLIND_MULTIPLIER),
  );
  const smallestChip = Math.max(
    1,
    Math.round(sanitize(options.smallestChip ?? 1, 1)),
  );
  const ladder = ladderFor(options.speed);

  /**
   * Put `value` on the chip grid, never landing on or below `previous`. When
   * rounding would collide, advance by exactly one chip — the smallest legal
   * step — rather than skipping a whole ladder rung.
   */
  const snap = (value: number, previous?: number): number => {
    const rounded = Math.max(
      smallestChip,
      Math.round(value / smallestChip) * smallestChip,
    );
    if (previous !== undefined && rounded <= previous) {
      return previous + smallestChip;
    }
    return rounded;
  };

  const levels: BlindLevel[] = [];
  let small = snap(startingSmallBlind);
  for (let i = 0; i < levelCount; i += 1) {
    if (i > 0) small = snap(nextLadderValue(ladder, small), small);
    // Keep the big blind on the grid too — it holds automatically for the
    // default ×2, but not for an arbitrary multiplier.
    const big = Math.max(
      small + smallestChip,
      Math.round((small * bigBlindMultiplier) / smallestChip) * smallestChip,
    );
    levels.push({ small, big });
  }
  return levels;
};
