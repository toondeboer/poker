// src/services/LiveActivityService.ts
import { Platform } from "react-native";
import { LiveActivity, ForegroundService, LiveActivityData } from "../modules/LiveActivityModule";
import { PokerTimerState } from "@/src/types/PokerTimerState";

class LiveActivityService {
  private activityId: string | null = null;
  private isIOSSupported: boolean;
  private isAndroidSupported: boolean = true; // Android foreground services are widely supported

  constructor() {
    // Live Activities require iOS 16.1+
    this.isIOSSupported =
        Platform.OS === "ios" && parseInt(Platform.Version as string, 10) >= 16;
  }

  async isEnabled(): Promise<boolean> {
    if (Platform.OS === "ios") {
      if (!this.isIOSSupported) {
        return false;
      }

      try {
        return await LiveActivity.areActivitiesEnabled();
      } catch (error) {
        console.warn("Error checking Live Activity status:", error);
        return false;
      }
    } else if (Platform.OS === "android") {
      try {
        const isSupported = await ForegroundService.isServiceSupported();
        const hasPermission = await ForegroundService.hasNotificationPermission();
        return isSupported && hasPermission;
      } catch (error) {
        console.warn("Error checking Foreground Service status:", error);
        return false;
      }
    }

    return false;
  }

  async startOrUpdateActivity(state: PokerTimerState): Promise<string | null> {
    if (Platform.OS === "ios") {
      return this.handleiOSLiveActivity(state);
    } else if (Platform.OS === "android") {
      return this.handleAndroidForegroundService(state);
    }

    console.warn("Platform not supported for background activities");
    return null;
  }

  private async handleiOSLiveActivity(state: PokerTimerState): Promise<string | null> {
    if (!this.isIOSSupported) {
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

      // Handle timing - iOS expects milliseconds
      if (state.endTime && !state.paused) {
        activityData.endTime = Math.floor(state.endTime / 1000);
      } else if (state.timeLeft) {
        activityData.timeLeft = state.timeLeft;
      }

      // Check if we have an activity ID and if it's still active
      if (this.activityId) {
        const activeActivities = await this.getActiveActivities();

        if (activeActivities.includes(this.activityId)) {
          // Activity still exists, update it
          try {
            await LiveActivity.updateActivity(this.activityId, activityData);
            console.log("Live Activity updated successfully");
            return this.activityId;
          } catch (updateError) {
            console.error("Failed to update Live Activity:", updateError);
            // If update fails, clear the ID and create a new one
            this.activityId = null;
          }
        } else {
          // Activity no longer exists, clear the local reference
          console.warn("Activity no longer active, clearing local reference");
          this.activityId = null;
        }
      }

      // If we reach here, we need to create a new activity
      this.activityId = await LiveActivity.startActivity(activityData);
      if (this.activityId) {
        console.log("Live Activity started:", this.activityId);
        return this.activityId;
      } else {
        console.warn("Failed to start Live Activity - no ID returned");
        return null;
      }
    } catch (error) {
      console.error("Failed to start/update Live Activity:", error);
      this.activityId = null;
      return null;
    }
  }

  private async handleAndroidForegroundService(state: PokerTimerState): Promise<string | null> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        console.warn("Foreground Service not available or permission denied");
        return null;
      }

      // Convert to the format expected by Android
      const serviceData: LiveActivityData = {
        tournamentName: state.tournamentName || "Poker Tournament",
        currentBlindLevel: state.currentBlindLevel,
        currentSmallBlind: state.currentSmallBlind,
        currentBigBlind: state.currentBigBlind,
        nextSmallBlind: state.nextSmallBlind,
        nextBigBlind: state.nextBigBlind,
        paused: state.paused,
      };

      // Handle timing - Android expects milliseconds for endTime
      if (state.endTime && !state.paused) {
        serviceData.endTime = state.endTime;
      } else if (state.timeLeft) {
        serviceData.timeLeft = state.timeLeft;
      }

      // Check if service is already running
      const isRunning = await ForegroundService.isServiceRunning();

      if (isRunning) {
        // Update existing service
        await ForegroundService.updateService(serviceData);
        console.log("Foreground Service updated successfully");
        return "android_service"; // Return a consistent ID for Android
      } else {
        // Start new service
        await ForegroundService.startService(serviceData);
        console.log("Foreground Service started successfully");
        return "android_service";
      }
    } catch (error) {
      console.error("Failed to start/update Foreground Service:", error);
      return null;
    }
  }

  async endActivity(): Promise<void> {
    if (Platform.OS === "ios") {
      if (!this.isIOSSupported || !this.activityId) {
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
    } else if (Platform.OS === "android") {
      try {
        await ForegroundService.stopService();
        console.log("Foreground Service stopped");
      } catch (error) {
        console.error("Failed to stop Foreground Service:", error);
      }
    }
  }

  async getActiveActivities(): Promise<string[]> {
    if (Platform.OS === "ios") {
      if (!this.isIOSSupported) {
        return [];
      }

      try {
        return await LiveActivity.getActiveActivities();
      } catch (error) {
        console.warn("Error getting active activities:", error);
        return [];
      }
    } else if (Platform.OS === "android") {
      try {
        const isRunning = await ForegroundService.isServiceRunning();
        return isRunning ? ["android_service"] : [];
      } catch (error) {
        console.warn("Error checking service status:", error);
        return [];
      }
    }

    return [];
  }

  isActive(): boolean {
    return this.activityId !== null;
  }

  getCurrentActivityId(): string | null {
    return this.activityId;
  }

  isDeviceSupported(): boolean {
    return this.isIOSSupported || (Platform.OS === "android" && this.isAndroidSupported);
  }

  // Helper method to clean up any orphaned activities
  async cleanupActivities(): Promise<void> {
    if (Platform.OS === "ios") {
      if (!this.isIOSSupported) return;

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
    } else if (Platform.OS === "android") {
      // For Android, we can try to stop the service to ensure cleanup
      try {
        await ForegroundService.stopService();
      } catch (error) {
        console.warn("Error during Android service cleanup:", error);
      }
    }
  }

  // New method to check and sync the current activity state
  async syncActivityState(): Promise<void> {
    if (Platform.OS === "ios") {
      if (!this.isIOSSupported) return;

      try {
        const activeActivities = await this.getActiveActivities();

        if (this.activityId && !activeActivities.includes(this.activityId)) {
          // Our stored activity ID is no longer active
          console.log("Stored activity ID is no longer active, clearing it");
          this.activityId = null;
        } else if (!this.activityId && activeActivities.length > 0) {
          // We don't have an activity ID but there are active activities
          // This could happen if the app was restarted while an activity was running
          console.log("Found active activities but no stored ID, syncing...");
          // End all active activities except the first one
          for (let i = 1; i < activeActivities.length; i++) {
            await LiveActivity.endActivity(activeActivities[i]);
            console.log(`Ended orphaned activity: ${activeActivities[i]}`);
          }
          this.activityId = activeActivities[0]; // Adopt the first one
        }
      } catch (error) {
        console.warn("Error syncing activity state:", error);
      }
    } else if (Platform.OS === "android") {
      // For Android, sync is simpler - just check if service is running
      try {
        const isRunning = await ForegroundService.isServiceRunning();
        console.log("Android service running state:", isRunning);
      } catch (error) {
        console.warn("Error syncing Android service state:", error);
      }
    }
  }

  // Request notification permission for Android 13+
  async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        return await ForegroundService.hasNotificationPermission();
      } catch (error) {
        console.warn("Error checking notification permission:", error);
        return false;
      }
    }
    return true; // iOS handles permissions through Live Activity prompts
  }
}

export const liveActivityService = new LiveActivityService();