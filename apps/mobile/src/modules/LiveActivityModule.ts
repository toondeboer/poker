// src/modules/LiveActivityModule.ts
import { NativeModules } from "react-native";

interface LiveActivityData {
  currentBlindLevel: number;
  currentSmallBlind: number;
  currentBigBlind: number;
  nextSmallBlind: number;
  nextBigBlind: number;
  endTime: number;
  isBreak: boolean;
  breakName?: string;
}

interface LiveActivityModule {
  startActivity(data: LiveActivityData): Promise<string | null>;
  updateActivity(activityId: string, data: LiveActivityData): Promise<string>;
  endActivity(activityId: string): Promise<string>;
  areActivitiesEnabled(): Promise<boolean>;
}

export const LiveActivity: LiveActivityModule = NativeModules.RNLiveActivity;
