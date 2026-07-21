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
export { createReviewStorage } from "./storage/reviewStorage";
export type { ReviewStorage } from "./storage/reviewStorage";
export { createPresetStorage } from "./storage/presetStorage";
export type { PresetStorage } from "./storage/presetStorage";
export { createSoundPackStorage } from "./storage/soundPackStorage";
export type { SoundPackStorage } from "./storage/soundPackStorage";

// Timer state machine
export {
  createTimerState,
  startTimer,
  pauseTimer,
  resetTimer,
  tickTimer,
  advanceRound,
  isExpired,
  withDuration,
  clampToDuration,
  hydrateTimerState,
} from "./timer/timerMachine";
export type { TimerMachineState } from "./timer/timerMachine";

// Monetization
export type {
  Entitlements,
  EntitlementProvider,
} from "./monetization/EntitlementProvider";
export { shouldShowAds } from "./monetization/adPolicy";
export type { AdPolicyInput } from "./monetization/adPolicy";
export {
  ENTITLEMENT_PRO,
  PRODUCT_PRO_LIFETIME,
} from "./monetization/products";

// Reviews
export {
  shouldRequestReview,
  INITIAL_REVIEW_STATE,
  MIN_ROUNDS_BEFORE_REVIEW,
  REVIEW_PROMPT_COOLDOWN_MS,
} from "./reviews/reviewPolicy";
export type {
  ReviewPromptState,
  ReviewPolicyInput,
} from "./reviews/reviewPolicy";

// Presets
export {
  createPreset,
  addPreset,
  removePreset,
  isValidPresetName,
  MAX_PRESETS,
} from "./presets/preset";
export type { BlindPreset } from "./presets/preset";

// Sound packs
export {
  SOUND_PACKS,
  DEFAULT_SOUND_PACK_ID,
  isValidSoundPackId,
} from "./sounds/soundPack";
export type { SoundPackId } from "./sounds/soundPack";

// Share
export { SITE_URL, SHARE_MESSAGE } from "./share/links";
