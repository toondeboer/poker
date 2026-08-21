import { BlindLevel } from "../types/BlindLevel";

/** One level as "25/50". */
export const formatBlindLevel = (level: BlindLevel): string =>
  `${level.small}/${level.big}`;

/** A whole schedule as "5/10 → 800/1600", for summary rows. */
export const formatBlindRange = (levels: BlindLevel[]): string => {
  if (levels.length === 0) return "—";
  const first = levels[0];
  if (levels.length === 1) return formatBlindLevel(first);
  return `${formatBlindLevel(first)} → ${formatBlindLevel(levels[levels.length - 1])}`;
};
