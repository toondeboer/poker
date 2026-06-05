// @poker/core — framework-agnostic poker-timer logic shared by the web and
// mobile apps. No React, React Native, or DOM dependencies belong in here.

// Types
export type { BlindLevel } from "./types/BlindLevel";
export type { PokerTimerState } from "./types/PokerTimerState";

// Constants
export { DEFAULT_TIMER_DURATION } from "./constants";

// Blinds
export { generateBlindLevels } from "./blinds/generateBlinds";
export {
  clampBlindIndex,
  nextBlindIndex,
  previousBlindIndex,
  addBlindLevel,
  removeBlindLevel,
  updateBlindLevel,
  defaultBlindLevels,
} from "./blinds/mutateBlinds";

// Time
export { formatTime } from "./time/format";
export { calculateTimeLeft, computeEndTime, progress } from "./time/timerMath";

// Storage
export type {
  StorageAdapter,
  StorageKeyValuePair,
} from "./storage/StorageAdapter";
export { createTimerStorage } from "./storage/timerStorage";
export type { TimerState, TimerStorage } from "./storage/timerStorage";
export { createBlindsStorage } from "./storage/blindsStorage";
export type { BlindsState, BlindsStorage } from "./storage/blindsStorage";
