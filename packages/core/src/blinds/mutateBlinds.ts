import { BlindLevel } from "../types/BlindLevel";

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
  levels.map((level, i) => (i === index ? { ...level, [field]: value } : level));
