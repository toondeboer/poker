import { BlindLevel } from "../types/BlindLevel";
import { clampBlindIndex } from "./mutateBlinds";

/** Structural + value equality for two blind schedules. */
export const blindLevelsEqual = (a: BlindLevel[], b: BlindLevel[]): boolean =>
  a.length === b.length &&
  a.every(
    (level, index) =>
      level.small === b[index].small && level.big === b[index].big,
  );

export type BlindScheduleChange = {
  /** The draft differs from the active schedule in any way. */
  changed: boolean;
  /** Where the live blind index lands once the draft is applied. */
  nextIndex: number;
  /**
   * The level the tournament is currently on no longer exists in the draft —
   * the only case that warrants confirming before applying.
   */
  currentLevelDropped: boolean;
  /** The blinds of the level being played changed value (but the level survives). */
  currentLevelValuesChanged: boolean;
};

/**
 * Describe what applying `draft` over `active` would do to a tournament sitting
 * at `currentIndex`. Applying clamps the index rather than resetting it, so the
 * host keeps their place; this reports whether that clamp actually moves them.
 */
export const describeScheduleChange = (
  active: BlindLevel[],
  draft: BlindLevel[],
  currentIndex: number,
): BlindScheduleChange => {
  const nextIndex = clampBlindIndex(currentIndex, draft.length);
  const currentLevelDropped = currentIndex > draft.length - 1;
  const activeLevel = active[currentIndex];
  const draftLevel = draft[nextIndex];

  return {
    changed: !blindLevelsEqual(active, draft),
    nextIndex,
    currentLevelDropped,
    currentLevelValuesChanged:
      !currentLevelDropped &&
      !!activeLevel &&
      !!draftLevel &&
      (activeLevel.small !== draftLevel.small ||
        activeLevel.big !== draftLevel.big),
  };
};
