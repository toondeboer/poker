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

export type PendingTimerAction = "pause" | "resume" | "stop";

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
