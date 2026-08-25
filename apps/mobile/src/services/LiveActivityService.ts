// src/services/LiveActivityService.ts
import { logger } from "@/src/utils/logger";
import { Platform } from "react-native";
import {
  LiveActivity,
  ForegroundService,
  LiveActivityData,
  LiveActivityDataAndroid,
} from "../modules/LiveActivityModule";
import {
  DEFAULT_SOUND_PACK_ID,
  PokerTimerState,
  SoundPackId,
  reconcileActivities,
} from "@poker/core";

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
        logger.warn("Error checking Live Activity status:", error);
        return false;
      }
    } else if (Platform.OS === "android") {
      try {
        const isSupported = await ForegroundService.isServiceSupported();
        const hasPermission =
          await ForegroundService.hasNotificationPermission();
        return isSupported && hasPermission;
      } catch (error) {
        logger.warn("Error checking Foreground Service status:", error);
        return false;
      }
    }

    return false;
  }

  async startOrUpdateActivity(
    state: PokerTimerState,
    shouldAlertOnExpiry: boolean,
    soundPackId: SoundPackId = DEFAULT_SOUND_PACK_ID,
  ): Promise<string | null> {
    if (Platform.OS === "ios") {
      return this.handleiOSLiveActivity(state);
    } else if (Platform.OS === "android") {
      return this.handleAndroidForegroundService(
        state,
        shouldAlertOnExpiry,
        soundPackId,
      );
    }

    logger.warn("Platform not supported for background activities");
    return null;
  }

  private async handleiOSLiveActivity(
    state: PokerTimerState,
  ): Promise<string | null> {
    if (!this.isIOSSupported) {
      logger.warn("Live Activities not supported on this device");
      return null;
    }

    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        logger.warn("Live Activities are not enabled");
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
        timerDuration: state.timerDuration,
      };

      // Handle timing - iOS expects milliseconds
      if (state.endTime && !state.paused) {
        activityData.endTime = Math.floor(state.endTime / 1000);
      } else if (state.timeLeft) {
        activityData.timeLeft = state.timeLeft;
      }

      // Reduce however many activities exist to exactly one *before* touching
      // any of them. `activityId` lives in memory only, so a force-quit
      // mid-round leaves iOS running a card this session knows nothing about;
      // the old code went straight to `startActivity` and stacked a second one
      // on top, which is how Notification Centre filled up with stale rounds.
      const plan = reconcileActivities({
        activeIds: await this.getActiveActivities(),
        currentId: this.activityId,
      });
      await this.endActivities(plan.endIds);

      if (plan.adoptId) {
        try {
          await LiveActivity.updateActivity(plan.adoptId, activityData);
          this.activityId = plan.adoptId;
          logger.log("Live Activity updated successfully");
          return this.activityId;
        } catch (updateError) {
          logger.error("Failed to update Live Activity:", updateError);
          // End it before replacing it. An activity we can't update is already
          // useless, and leaving it live is exactly the stacking this fix is
          // about.
          await this.endActivities([plan.adoptId]);
          this.activityId = null;
        }
      }

      this.activityId = await LiveActivity.startActivity(activityData);
      if (this.activityId) {
        logger.log("Live Activity started:", this.activityId);
        return this.activityId;
      } else {
        logger.warn("Failed to start Live Activity - no ID returned");
        return null;
      }
    } catch (error) {
      logger.error("Failed to start/update Live Activity:", error);
      this.activityId = null;
      return null;
    }
  }

  private async handleAndroidForegroundService(
    state: PokerTimerState,
    shouldAlertOnExpiry: boolean,
    soundPackId: SoundPackId,
  ): Promise<string | null> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        logger.warn("Foreground Service not available or permission denied");
        return null;
      }

      // Convert to the format expected by Android
      const serviceData: LiveActivityDataAndroid = {
        tournamentName: state.tournamentName || "Poker Tournament",
        currentBlindLevel: state.currentBlindLevel,
        currentSmallBlind: state.currentSmallBlind,
        currentBigBlind: state.currentBigBlind,
        nextSmallBlind: state.nextSmallBlind,
        nextBigBlind: state.nextBigBlind,
        paused: state.paused,
        timerDuration: state.timerDuration,
        shouldAlertOnExpiry,
        soundId: soundPackId,
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
        logger.log("Foreground Service updated successfully");
        return "android_service"; // Return a consistent ID for Android
      } else {
        // Start new service
        await ForegroundService.startService(serviceData);
        logger.log("Foreground Service started successfully");
        return "android_service";
      }
    } catch (error) {
      logger.error("Failed to start/update Foreground Service:", error);
      return null;
    }
  }

  /**
   * Ends the given activities, one failure never stopping the rest. Ids come
   * from a {@link reconcileActivities} plan, which guarantees they are live and
   * that none of them is the one being kept.
   */
  private async endActivities(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      try {
        await LiveActivity.endActivity(id);
        logger.log("Ended stray Live Activity:", id);
      } catch (error) {
        logger.warn("Failed to end stray Live Activity:", id, error);
      }
    }
  }

  async endActivity(): Promise<void> {
    if (Platform.OS === "ios") {
      if (!this.isIOSSupported) {
        return;
      }

      // Ends everything live, not just the remembered id. Stopping the timer
      // should leave no card behind, and a stray from a previous session is
      // just as stale as ours.
      await this.endActivities(await this.getActiveActivities());
      this.activityId = null;
      logger.log("Live Activity ended");
    } else if (Platform.OS === "android") {
      try {
        await ForegroundService.stopService();
        logger.log("Foreground Service stopped");
      } catch (error) {
        logger.error("Failed to stop Foreground Service:", error);
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
        logger.warn("Error getting active activities:", error);
        return [];
      }
    } else if (Platform.OS === "android") {
      try {
        const isRunning = await ForegroundService.isServiceRunning();
        return isRunning ? ["android_service"] : [];
      } catch (error) {
        logger.warn("Error checking service status:", error);
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
    return (
      this.isIOSSupported ||
      (Platform.OS === "android" && this.isAndroidSupported)
    );
  }

  // New method to check and sync the current activity state
  async syncActivityState(): Promise<void> {
    if (Platform.OS === "ios") {
      if (!this.isIOSSupported) return;

      try {
        // Same one-card invariant as the start path. The old version adopted
        // `activeActivities[0]` — ActivityKit documents no ordering for that
        // array, so it could keep a stale card and end the live one.
        const plan = reconcileActivities({
          activeIds: await this.getActiveActivities(),
          currentId: this.activityId,
        });
        await this.endActivities(plan.endIds);
        this.activityId = plan.adoptId;
      } catch (error) {
        logger.warn("Error syncing activity state:", error);
      }
    } else if (Platform.OS === "android") {
      // For Android, sync is simpler - just check if service is running
      try {
        const isRunning = await ForegroundService.isServiceRunning();
        logger.log("Android service running state:", isRunning);
      } catch (error) {
        logger.warn("Error syncing Android service state:", error);
      }
    }
  }


  // Request notification permission for Android 13+
  async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        return await ForegroundService.hasNotificationPermission();
      } catch (error) {
        logger.warn("Error checking notification permission:", error);
        return false;
      }
    }
    return true; // iOS handles permissions through Live Activity prompts
  }
}

export const liveActivityService = new LiveActivityService();
