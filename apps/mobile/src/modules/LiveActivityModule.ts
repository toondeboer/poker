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
  paused: boolean;
}

export interface LiveActivityDataAndroid extends LiveActivityData {
  shouldAlertOnExpiry: boolean;
}

interface LiveActivityModule {
  startActivity(data: LiveActivityData): Promise<string | null>;
  updateActivity(activityId: string, data: LiveActivityData): Promise<string>;
  endActivity(activityId: string): Promise<string>;
  areActivitiesEnabled(): Promise<boolean>;
  getActiveActivities(): Promise<string[]>;
}

interface ForegroundServiceModule {
  startService(data: LiveActivityDataAndroid): Promise<string>;
  updateService(data: LiveActivityDataAndroid): Promise<string>;
  stopService(): Promise<string>;
  dismissAlert(): Promise<void>;
  isServiceSupported(): Promise<boolean>;
  hasNotificationPermission(): Promise<boolean>;
  isServiceRunning(): Promise<boolean>;
}

// Platform-specific exports
export const LiveActivity: LiveActivityModule = NativeModules.RNLiveActivity;
export const ForegroundService: ForegroundServiceModule =
  NativeModules.RNForegroundService;
