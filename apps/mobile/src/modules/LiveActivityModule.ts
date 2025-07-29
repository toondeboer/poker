// src/modules/LiveActivityModule.ts
import { NativeModules } from "react-native";

export interface LiveActivityData {
  tournamentName?: string;
  currentBlindLevel: number;
  currentSmallBlind: number;
  currentBigBlind: number;
  nextSmallBlind: number;
  nextBigBlind: number;
  endTime?: number; // Unix timestamp in seconds
  timeLeft?: number; // Duration in seconds from now
  paused: boolean;
}

interface LiveActivityModule {
  startActivity(data: LiveActivityData): Promise<string | null>;
  updateActivity(activityId: string, data: LiveActivityData): Promise<string>;
  endActivity(activityId: string): Promise<string>;
  areActivitiesEnabled(): Promise<boolean>;
  getActiveActivities(): Promise<string[]>;
}

export const LiveActivity: LiveActivityModule = NativeModules.RNLiveActivity;
