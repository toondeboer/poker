// src/services/TimerLiveActivity.ts
import { liveActivityService } from "./LiveActivityService";

export interface BlindLevel {
  small: number;
  big: number;
}

export interface LiveActivityState {
  endTime?: number;
  timeLeft: number;
  paused: boolean;
  currentBlindIndex: number;
  blindLevels: BlindLevel[];
}

export class TimerLiveActivity {
  static async updateLiveActivity(state: LiveActivityState): Promise<void> {
    if (!liveActivityService.isDeviceSupported()) {
      return;
    }

    try {
      const nextBlindLevel = state.blindLevels[state.currentBlindIndex + 1];

      const activityState = {
        tournamentName: "Poker Timer",
        currentBlindLevel: state.currentBlindIndex + 1, // Display as 1-based
        currentSmallBlind: state.blindLevels[state.currentBlindIndex].small,
        currentBigBlind: state.blindLevels[state.currentBlindIndex].big,
        nextSmallBlind: nextBlindLevel?.small || 0,
        nextBigBlind: nextBlindLevel?.big || 0,
        endTime: state.endTime,
        durationSeconds: state.paused ? state.timeLeft : undefined,
        paused: state.paused,
      };

      await liveActivityService.startOrUpdateActivity(activityState);
    } catch (error) {
      console.error("Failed to update Live Activity:", error);
      throw error;
    }
  }

  static async endLiveActivity(): Promise<void> {
    if (!liveActivityService.isDeviceSupported()) {
      return;
    }

    try {
      await liveActivityService.endActivity();
    } catch (error) {
      console.error("Failed to end Live Activity:", error);
      throw error;
    }
  }
}
