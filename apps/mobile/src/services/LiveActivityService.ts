// src/services/LiveActivityService.ts
import { Platform } from "react-native";
import { LiveActivity, LiveActivityData } from "../modules/LiveActivityModule";
import { PokerTimerState } from "@/src/types/PokerTimerState";

class LiveActivityService {
  private activityId: string | null = null;
  private isSupported: boolean;

  constructor() {
    // Live Activities require iOS 16.1+
    this.isSupported =
      Platform.OS === "ios" && parseInt(Platform.Version as string, 10) >= 16;
  }

  async isEnabled(): Promise<boolean> {
    if (!this.isSupported) {
      return false;
    }

    try {
      return await LiveActivity.areActivitiesEnabled();
    } catch (error) {
      console.warn("Error checking Live Activity status:", error);
      return false;
    }
  }

  async startOrUpdateActivity(state: PokerTimerState): Promise<string | null> {
    if (!this.isSupported) {
      console.warn("Live Activities not supported on this device");
      return null;
    }

    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        console.warn("Live Activities are not enabled");
        return null;
      }

      // Convert to the format expected by Swift
      const activityData: LiveActivityData = {
        tournamentName: state.tournamentName || "Poker Tournament",
        currentBlindLevel: state.currentBlindLevel,
        currentSmallBlind: state.currentSmallBlind,
        currentBigBlind: state.currentBigBlind,
        nextSmallBlind: state.nextSmallBlind,
        nextBigBlind: state.nextBigBlind,
        paused: state.paused,
      };

      // Handle timing - convert from JS milliseconds to seconds for Swift
      if (state.endTime && !state.paused) {
        activityData.endTime = Math.floor(state.endTime / 1000);
      } else if (state.durationSeconds) {
        activityData.timeLeft = state.durationSeconds;
      }

      if (this.activityId) {
        // Update existing activity
        await LiveActivity.updateActivity(this.activityId, activityData);
        console.log("Live Activity updated successfully");
        return this.activityId;
      } else {
        // Start new activity
        this.activityId = await LiveActivity.startActivity(activityData);
        if (this.activityId) {
          console.log("Live Activity started:", this.activityId);
        } else {
          console.warn("Failed to start Live Activity - no ID returned");
        }
        return this.activityId;
      }
    } catch (error) {
      console.error("Failed to start/update Live Activity:", error);

      // If it's an update error, the activity might have been dismissed
      if (this.activityId) {
        const activeActivities = await this.getActiveActivities();
        if (!activeActivities.includes(this.activityId)) {
          console.warn("Activity no longer active, clearing local reference");
          this.activityId = null;
        }
      }

      return null;
    }
  }

  async endActivity(): Promise<void> {
    if (!this.isSupported || !this.activityId) {
      return;
    }

    try {
      await LiveActivity.endActivity(this.activityId);
      console.log("Live Activity ended");
    } catch (error) {
      console.error("Failed to end Live Activity:", error);
    } finally {
      this.activityId = null;
    }
  }

  async getActiveActivities(): Promise<string[]> {
    if (!this.isSupported) {
      return [];
    }

    try {
      return await LiveActivity.getActiveActivities();
    } catch (error) {
      console.warn("Error getting active activities:", error);
      return [];
    }
  }

  isActive(): boolean {
    return this.activityId !== null;
  }

  getCurrentActivityId(): string | null {
    return this.activityId;
  }

  isDeviceSupported(): boolean {
    return this.isSupported;
  }

  // Helper method to clean up any orphaned activities
  async cleanupActivities(): Promise<void> {
    if (!this.isSupported) return;

    try {
      const activeActivities = await this.getActiveActivities();

      // If we think we have an active activity but it's not in the list, clear it
      if (this.activityId && !activeActivities.includes(this.activityId)) {
        console.log("Clearing orphaned activity ID");
        this.activityId = null;
      }
    } catch (error) {
      console.warn("Error during cleanup:", error);
    }
  }
}

export const liveActivityService = new LiveActivityService();
