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
export { createGameStorage } from "./storage/gameStorage";
export type {
  GameStorage,
  StoredGame,
  StoredGameSetup,
} from "./storage/gameStorage";
export { createLeaderboardStorage } from "./storage/leaderboardStorage";
export {
  RECOVERY_CLEARS,
  RECOVERY_KEEPS,
  clearForRecovery,
} from "./storage/recovery";
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

// Accounts
export {
  MIN_PASSWORD_LENGTH,
  isValidEmail,
  validateCredentials,
} from "./auth/account";
export type {
  Account,
  AuthProvider,
  CredentialError,
  SignUpResult,
} from "./auth/account";
export type {
  CognitoConfig,
  CognitoCall,
  CognitoTokens,
  CognitoError,
} from "./auth/cognito";
export {
  signUpCall,
  confirmSignUpCall,
  resendCodeCall,
  signInCall,
  refreshCall,
  signOutCall,
  deleteAccountCall,
  errorFrom,
  tokensFrom,
  needsRefresh,
  accountFromIdToken,
  decodeBase64Url,
  EXPIRY_SLACK_MS,
} from "./auth/cognito";

// Monetization
export type {
  Entitlements,
  EntitlementProvider,
} from "./monetization/EntitlementProvider";
export { shouldShowAds } from "./monetization/adPolicy";
export type { AdPolicyInput } from "./monetization/adPolicy";
export {
  boardBelongsToAnotherAccount,
  boardOwnershipUnknown,
  boardIsVisible,
  boardSyncs,
  clockHostRefusal,
  clockJoinRefusal,
  entitlementsFrom,
  hostRefusal,
  joinRefusal,
} from "./monetization/clubPolicy";
export type { ClubContext } from "./monetization/clubPolicy";
export {
  ENTITLEMENT_PRO,
  ENTITLEMENT_CLUB,
  PRODUCT_PRO_LIFETIME,
  PRODUCT_CLUB_MONTHLY,
  PRODUCT_CLUB_YEARLY,
} from "./monetization/products";

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

// Poker — the app deals, it does not run a game. See poker/deal.ts.
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
export {
  HOLE_CARDS,
  BOARD_CARDS,
  MAX_SEATS,
  startDeal,
  nextStreet as nextStreetOfDeal,
  muck as muckInDeal,
  unmuck as unmuckInDeal,
  isDealComplete,
  showdownFor,
  stillIn,
} from "./poker/deal";
export type { Deal, DealtSeat, Street, Showdown } from "./poker/deal";
export {
  createDealerSession,
  dealNextHand,
  nextStreet,
  muck,
  unmuck,
  sitOut,
  sitIn,
  canDeal,
} from "./poker/dealerSession";
export type { DealerSession, DealerSeat } from "./poker/dealerSession";

// Leaderboard
export {
  createPlayer,
  isValidPlayerName,
  playerNameRejection,
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
  groupNameRejection,
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
// Who is on a shared board, and who may be taken off it
export {
  readBoardMembers,
  removalRefusal,
  sortedMembers,
} from "./leaderboard/members";
export type { BoardMember } from "./leaderboard/members";

// Syncing a shared board: what this phone has done and not yet sent
export {
  EMPTY_QUEUE,
  dismiss,
  enqueue,
  MAX_REFUSALS,
  dependsOn,
  hasPendingFor,
  refuse,
  settle,
  withPending,
} from "./sync/pendingWrites";
export type {
  PendingWrite,
  QueuedWrite,
  RefusedWrite,
  SyncQueue,
} from "./sync/pendingWrites";
export {
  authorizeUrl,
  hostedTokensFrom,
  isCancellation,
  isValidCodeVerifier,
  readRedirect,
  tokenExchangeCall,
  HOSTED_SCOPES,
} from "./auth/hostedUi";
export type {
  HostedProvider,
  HostedUiConfig,
  RedirectResult,
} from "./auth/hostedUi";
export {
  cancel,
  cancelBoard,
  clearBoardRefusals,
  describeWrite,
} from "./sync/pendingWrites";
export type { WriteSubject } from "./sync/pendingWrites";
export {
  addBoard,
  noteDeleted,
  replaceBoard,
  undismiss,
  wasDismissed,
} from "./leaderboard/groups";
export {
  INVITE_PATH,
  inviteUrlFor,
  isInviteToken,
  readInviteCode,
  tokenFromUrl,
} from "./sync/invites";
export { NO_FEATURES, readFeatures } from "./sync/features";
export type { Features } from "./sync/features";
export {
  NOTHING_DELETED,
  boardFromRemote,
  mergeBoard,
  readRemoteBoard,
} from "./sync/mergeBoard";
export type { BoardRole, Deletions, RemoteBoard } from "./sync/mergeBoard";
export { applyReport, drain } from "./sync/drain";
export {
  createSyncQueueStorage,
  SYNC_QUEUE_KEY,
} from "./storage/syncQueueStorage";
export type { SyncQueueStorage } from "./storage/syncQueueStorage";
export type { DrainReport, SendResult, Sender } from "./sync/drain";
export {
  RETRYABLE_STATUSES,
  reasonFrom as reasonForRefusal,
  requestFor,
  resultForStatus,
} from "./sync/groupRequests";
export type { GroupCall } from "./sync/groupRequests";

// Realtime channels (shared with the backend, deliberately)
export { SESSION_NAMESPACE, sessionChannel } from "./realtime/channels";
export type {
  TimerSyncMessage,
  SharedSession,
  SessionHealth,
  SessionTransport,
} from "./realtime/timerSync";
export {
  EMPTY_SHARED_SESSION,
  toSyncMessage,
  applySyncMessage,
  receiveSyncMessage,
  recordSentMessage,
  shouldApply,
  nextVersion,
  sessionHealth,
  matchesSession,
  HEARTBEAT_MS,
  STALE_AFTER_MS,
} from "./realtime/timerSync";
export {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  createJoinCode,
  normaliseJoinCode,
  isValidJoinCode,
} from "./realtime/joinCode";

// Share
export { SITE_URL, SHARE_MESSAGE } from "./share/links";
export {
  formatPayoutSummary,
  formatStandingsSummary,
  MAX_SHARED_STANDINGS,
} from "./share/summaries";

// Moderation — the filter in front of anything a person types that other
// people will read. See `moderation/textFilter.ts` for why it is a speed bump
// rather than a moderator, and why reporting sits beside it.
export {
  MAX_NAME_LENGTH,
  isObjectionable,
  nameRejection,
  messageForRejection,
  REPORT_REASONS,
  isReportReason,
  labelForReportReason,
  MAX_REPORT_DETAIL,
} from "./moderation/textFilter";
export type { NameRejection, ReportReason } from "./moderation/textFilter";
