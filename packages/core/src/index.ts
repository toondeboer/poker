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
  insertBlindLevel,
  duplicateBlindLevel,
  removeBlindLevel,
  updateBlindLevel,
} from "./blinds/mutateBlinds";
export {
  CHIP_DENOMINATIONS,
  CHIP_UNIT_OPTIONS,
  DEFAULT_CHIP_UNIT,
  BLIND_SPEEDS,
  DEFAULT_BLIND_SPEED_ID,
  MIN_GENERATED_LEVELS,
  MAX_GENERATED_LEVELS,
  roundToChipDenomination,
  nextChipDenominationAbove,
  inferSmallestChip,
  averageGrowthRate,
  generateBlindStructure,
} from "./blinds/generateStructure";
export type {
  BlindSpeedId,
  BlindStructureOptions,
} from "./blinds/generateStructure";
export {
  blindLevelsEqual,
  describeScheduleChange,
} from "./blinds/scheduleDiff";
export type { BlindScheduleChange } from "./blinds/scheduleDiff";
export { formatBlindLevel, formatBlindRange } from "./blinds/formatBlinds";

// Time
export { formatTime } from "./time/format";
export {
  MIN_ROUND_DURATION_SECONDS,
  MAX_ROUND_DURATION_SECONDS,
  clampRoundDuration,
  splitDuration,
  joinDuration,
} from "./time/duration";
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
export {
  createPayoutStorage,
  toPayoutOptions,
  DEFAULT_PAYOUT_SETTINGS,
} from "./storage/payoutStorage";
export type { PayoutStorage, PayoutSettings } from "./storage/payoutStorage";
export { createLeaderboardStorage } from "./storage/leaderboardStorage";
export type {
  LeaderboardStorage,
  LeaderboardState,
} from "./storage/leaderboardStorage";

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
export { ENTITLEMENT_PRO, PRODUCT_PRO_LIFETIME } from "./monetization/products";

// Live Activity reconciliation
export { reconcileActivities } from "./liveActivity/activityReconciliation";
export type {
  ActivityReconciliation,
  ActivityReconciliationInput,
} from "./liveActivity/activityReconciliation";

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

// Payouts
export {
  computePayouts,
  defaultPaidPlaces,
  suggestedBounty,
  validatePayoutOptions,
  formatPlace,
  PAYOUT_SPLITS,
  MAX_PAID_PLACES,
} from "./payouts/payoutStructure";
export type {
  Payout,
  PayoutStructure,
  PayoutOptions,
  PayoutValidationError,
} from "./payouts/payoutStructure";
export { computeChop, validateChop } from "./payouts/chop";
export type {
  ChopResult,
  ChopShare,
  ChopOptions,
  ChopValidationError,
} from "./payouts/chop";

// Poker (multiplayer)
export {
  SUITS,
  MIN_RANK,
  MAX_RANK,
  DECK_SIZE,
  createRandom,
  createDeck,
  shuffle,
  cardToString,
} from "./poker/cards";
export type { Card, Rank, Suit, RandomSource } from "./poker/cards";
export {
  HAND_CATEGORIES,
  HAND_SIZE,
  packHandValue,
  handCategory,
  evaluateFive,
} from "./poker/handValue";
export type { HandCategory, HandValue } from "./poker/handValue";
export { evaluateHand, rankHands } from "./poker/evaluate";
export type { EvaluatedHand } from "./poker/evaluate";
export { buildPots, awardPots, totalPotAmount } from "./poker/pots";
export type { Contribution, Pot, Award } from "./poker/pots";
export {
  createBettingRound,
  legalActions as roundLegalActions,
  applyAction,
  isRoundComplete,
} from "./poker/bettingRound";
export type {
  BettingRound,
  BettingAction,
  RoundSeat,
  SeatStatus,
  LegalActions,
} from "./poker/bettingRound";
export {
  HOLE_CARDS,
  BOARD_CARDS,
  MAX_SEATS,
  startHand,
  act,
  legalActions,
  isHandComplete,
} from "./poker/table";
export type { Hand, HandSeat, Street, Showdown } from "./poker/table";
export {
  createSession,
  startNextHand,
  act as actOnSession,
  isSessionComplete,
  finishingOrder,
  toGameResult,
} from "./poker/session";
export type { GameSession, SessionSeat } from "./poker/session";

// Leaderboard
export {
  createPlayer,
  isValidPlayerName,
  addPlayer,
  removePlayer,
  createGameResult,
  validateGameResult,
  addGameResult,
  removeGameResult,
  MAX_GAME_RESULTS,
  MAX_PLAYERS,
} from "./leaderboard/gameResult";
export type {
  Player,
  Placing,
  GameResult,
  GameResultValidationError,
} from "./leaderboard/gameResult";
export { computeStandings } from "./leaderboard/standings";
export {
  MAX_GROUPS,
  EMPTY_LEADERBOARD,
  createGroup,
  isValidGroupName,
  addGroup,
  removeGroup,
  renameGroup,
  setActiveGroup,
  activeGroup,
  updateGroup,
  claimPlayer,
  unclaimPlayer,
  playerForAccount,
  migrateToGroups,
} from "./leaderboard/groups";
export type {
  Group,
  GroupState,
  GroupedLeaderboard,
  ClaimError,
  ClaimResult,
} from "./leaderboard/groups";
export type { LeaderboardStanding } from "./leaderboard/standings";

// Share
export { SITE_URL, SHARE_MESSAGE } from "./share/links";
export {
  formatPayoutSummary,
  formatStandingsSummary,
  MAX_SHARED_STANDINGS,
} from "./share/summaries";
