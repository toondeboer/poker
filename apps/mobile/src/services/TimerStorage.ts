// src/services/TimerStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_TIMER_DURATION = 600;

const STORAGE_KEYS = {
  TIMER_END_TIME: "timer_end_time",
  TIMER_DURATION: "timer_duration",
  TIMER_PAUSED: "timer_paused",
  TIMER_TIME_LEFT: "timer_time_left",
} as const;

export interface TimerState {
  endTime?: number;
  timerDuration: number;
  paused: boolean;
  timeLeft: number;
}

export class TimerStorage {
  static async saveTimerState(state: TimerState): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.TIMER_END_TIME, state.endTime?.toString() || ""],
        [STORAGE_KEYS.TIMER_DURATION, state.timerDuration.toString()],
        [STORAGE_KEYS.TIMER_PAUSED, state.paused.toString()],
        [STORAGE_KEYS.TIMER_TIME_LEFT, state.timeLeft.toString()],
      ]);
    } catch (error) {
      console.error("Failed to save timer state:", error);
      throw error;
    }
  }

  static async loadTimerState(): Promise<TimerState> {
    try {
      const values = await AsyncStorage.multiGet([
        STORAGE_KEYS.TIMER_END_TIME,
        STORAGE_KEYS.TIMER_DURATION,
        STORAGE_KEYS.TIMER_PAUSED,
        STORAGE_KEYS.TIMER_TIME_LEFT,
      ]);

      const endTimeStr = values[0][1];
      const durationStr = values[1][1];
      const pausedStr = values[2][1];
      const timeLeftStr = values[3][1];

      const savedEndTime = endTimeStr ? parseInt(endTimeStr, 10) : undefined;
      const savedDuration = durationStr
        ? parseInt(durationStr, 10)
        : DEFAULT_TIMER_DURATION;
      const savedPaused = pausedStr ? pausedStr === "true" : true;
      const savedTimeLeft = timeLeftStr
        ? parseInt(timeLeftStr, 10)
        : savedDuration;

      return {
        endTime: savedEndTime,
        timerDuration: savedDuration,
        paused: savedPaused,
        timeLeft: savedTimeLeft,
      };
    } catch (error) {
      console.error("Failed to load timer state:", error);
      // Return default values on error
      return {
        endTime: undefined,
        timerDuration: DEFAULT_TIMER_DURATION,
        paused: true,
        timeLeft: DEFAULT_TIMER_DURATION,
      };
    }
  }

  static async clearTimerState(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (error) {
      console.error("Failed to clear timer state:", error);
      throw error;
    }
  }
}
