import { BlindLevel } from "../types/BlindLevel";
import { roundToChipDenomination } from "./generateStructure";

/** Clamp a blind index into the valid range for a schedule of `levelCount` levels. */
export const clampBlindIndex = (index: number, levelCount: number): number =>
  Math.max(0, Math.min(index, levelCount - 1));

/** Index of the next blind level, clamped to the last level. */
export const nextBlindIndex = (index: number, levels: BlindLevel[]): number =>
  clampBlindIndex(index + 1, levels.length);

/** Index of the previous blind level, clamped to the first level. */
export const previousBlindIndex = (index: number): number =>
  Math.max(0, index - 1);

/**
 * Append a new blind level, extrapolating the last step so the schedule keeps its
 * progression. Falls back to doubling the final level when only one level exists.
 */
export const addBlindLevel = (levels: BlindLevel[]): BlindLevel[] => {
  const last = levels[levels.length - 1];
  const prev = levels[levels.length - 2];
  const next: BlindLevel = prev
    ? {
        small: last.small + (last.small - prev.small),
        big: last.big + (last.big - prev.big),
      }
    : { small: last.small * 2, big: last.big * 2 };
  return [...levels, next];
};

/**
 * Pick a value strictly between two neighbours, preferring a chip-friendly one.
 * Falls back to the plain midpoint, and finally to the lower neighbour when the
 * two are adjacent integers and nothing fits between them.
 */
const interpolateField = (lower: number, upper: number): number => {
  const midpoint = (lower + upper) / 2;
  const rounded = roundToChipDenomination(midpoint);
  if (rounded > lower && rounded < upper) return rounded;
  const plain = Math.round(midpoint);
  if (plain > lower && plain < upper) return plain;
  return lower;
};

/** Pick a chip-friendly value strictly below `value`, for inserting a new first level. */
const halveField = (value: number): number => {
  const rounded = roundToChipDenomination(value / 2);
  return rounded < value ? rounded : Math.max(1, Math.floor(value / 2));
};

/**
 * Insert a new blind level *at* `index`, shifting the rest down. The new level
 * is interpolated from its neighbours: inserting at the end extrapolates the
 * last step (identical to `addBlindLevel`), inserting at the front halves the
 * first level, and inserting in the middle takes the neighbour midpoint. The
 * index is clamped into `[0, levels.length]`.
 */
export const insertBlindLevel = (
  levels: BlindLevel[],
  index: number,
): BlindLevel[] => {
  if (levels.length === 0) return levels;
  const at = Math.max(0, Math.min(Math.round(index), levels.length));

  // Delegate rather than duplicate, so appending can never drift from `addBlindLevel`.
  if (at === levels.length) return addBlindLevel(levels);

  const next = levels[at];
  const previous = levels[at - 1];
  const inserted: BlindLevel = previous
    ? {
        small: interpolateField(previous.small, next.small),
        big: interpolateField(previous.big, next.big),
      }
    : { small: halveField(next.small), big: halveField(next.big) };

  return [...levels.slice(0, at), inserted, ...levels.slice(at)];
};

/** Insert a verbatim copy of `levels[index]` directly after it. No-op on a bad index. */
export const duplicateBlindLevel = (
  levels: BlindLevel[],
  index: number,
): BlindLevel[] => {
  const level = levels[index];
  if (!level) return levels;
  return [
    ...levels.slice(0, index + 1),
    { ...level },
    ...levels.slice(index + 1),
  ];
};

/** Remove a blind level by index, keeping at least two levels. */
export const removeBlindLevel = (
  levels: BlindLevel[],
  index: number,
): BlindLevel[] =>
  levels.length > 2 ? levels.filter((_, i) => i !== index) : levels;

/** Update one field of one blind level, returning a new array. */
export const updateBlindLevel = (
  levels: BlindLevel[],
  index: number,
  field: keyof BlindLevel,
  value: number,
): BlindLevel[] =>
  levels.map((level, i) =>
    i === index ? { ...level, [field]: value } : level,
  );
