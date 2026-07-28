// src/modules/LiveActivityModule.ts
import { NativeModules } from "react-native";

export interface LiveActivityData {
  tournamentName?: string;
  currentBlindLevel: number;
  currentSmallBlind: number;
  currentBigBlind: number;
  nextSmallBlind: number;
  nextBigBlind: number;
  endTime?: number; // Unix timestamp in milliseconds for iOS, seconds for Android
  timeLeft?: number; // Duration in seconds from now
  // Total configured round length in seconds — lets a native pause/resume action recompute a
  // fresh endTime without a JS round-trip.
  timerDuration?: number;
  paused: boolean;
}

export type PendingTimerActionKind = "pause" | "resume" | "stop";

/**
 * What a notification/Live-Activity button tap actually did, at the moment it happened — not
 * just which button. `timeLeft`/`endTime` are the native side's own authoritative values at that
 * instant, needed because reconciling from the action name alone would mean re-deriving
 * `timeLeft` from AsyncStorage's stale, pre-tap `endTime` continuing to count down all the way to
 * "now" (whenever the app happens to reopen) — pausing/resuming at the wrong instant instead of
 * the one actually tapped.
 *
 * Unit note: `endTime` here is in the units the *native side* returns it in — iOS reports
 * seconds (`Date.timeIntervalSince1970`), Android reports milliseconds
 * (`System.currentTimeMillis()`). `LiveActivityService.consumePendingAction()` normalizes this to
 * milliseconds (matching `@poker/core`'s `TimerMachineState.endTime` convention) before handing
 * it to platform-agnostic code — nothing above that layer should have to think about it.
 */
export interface PendingTimerAction {
  action: PendingTimerActionKind;
  paused: boolean;
  timeLeft: number;
  endTime: number;
  /**
   * True only for a "resume" tapped while the round had already expired (as opposed to an
   * ordinary mid-round pause/resume). Neither native side tracks blind levels itself, so it can't
   * decide to advance one — this just reports what happened and lets `TimerContext` decide to
   * advance to the next blind level and start a fresh round, instead of restarting the same one.
   */
  wasExpired: boolean;
}

export interface LiveActivityDataAndroid extends LiveActivityData {
  shouldAlertOnExpiry: boolean;
  /** Sound pack id (matches an Android `res/raw/<soundId>` resource name). */
  soundId: string;
}

interface LiveActivityModule {
  startActivity(data: LiveActivityData): Promise<string | null>;
  updateActivity(activityId: string, data: LiveActivityData): Promise<string>;
  endActivity(activityId: string): Promise<string>;
  areActivitiesEnabled(): Promise<boolean>;
  getActiveActivities(): Promise<string[]>;
  /**
   * Reads and clears the pending notification/Live-Activity-button action, if any — the
   * fallback path for when a button was tapped while JS wasn't reachable (backgrounded/killed
   * app), covering both the Darwin-notification-dropped case and a genuine cold launch.
   */
  consumePendingAction(): Promise<PendingTimerAction | null>;
}

interface ForegroundServiceModule {
  startService(data: LiveActivityDataAndroid): Promise<string>;
  updateService(data: LiveActivityDataAndroid): Promise<string>;
  stopService(): Promise<string>;
  dismissAlert(): Promise<void>;
  isServiceSupported(): Promise<boolean>;
  hasNotificationPermission(): Promise<boolean>;
  isServiceRunning(): Promise<boolean>;
  /** Reads and clears the pending notification-button action, if any (see iOS equivalent above). */
  consumePendingAction(): Promise<PendingTimerAction | null>;
}

// Platform-specific exports
export const LiveActivity: LiveActivityModule = NativeModules.RNLiveActivity;
export const ForegroundService: ForegroundServiceModule =
  NativeModules.RNForegroundService;
