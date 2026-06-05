import { BlindLevel } from "../types/BlindLevel";

/**
 * The default escalating blind schedule shared by both apps.
 *
 * 5–30 (step 5), 40–100 (step 10), 125–250 (step 25), 300–800 (step 50);
 * the big blind is always twice the small blind.
 */
export const generateBlindLevels = (): BlindLevel[] => {
  const levels: BlindLevel[] = [];
  for (let i = 5; i <= 30; i += 5) levels.push({ small: i, big: i * 2 });
  for (let i = 40; i <= 100; i += 10) levels.push({ small: i, big: i * 2 });
  for (let i = 125; i <= 250; i += 25) levels.push({ small: i, big: i * 2 });
  for (let i = 300; i <= 800; i += 50) levels.push({ small: i, big: i * 2 });
  return levels;
};
