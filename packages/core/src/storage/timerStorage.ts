import { StorageAdapter } from "./StorageAdapter";
import { DEFAULT_TIMER_DURATION } from "../constants";

const STORAGE_KEYS = {
  TIMER_END_TIME: "timer_end_time",
  TIMER_DURATION: "timer_duration",
  TIMER_PAUSED: "timer_paused",
  TIMER_TIME_LEFT: "timer_time_left",
  TIMER_COMPLETED: "timer_completed",
} as const;

export interface TimerState {
  endTime?: number;
  timerDuration: number;
  paused: boolean;
  timeLeft: number;
  completed?: boolean;
}

export interface TimerStorage {
  saveTimerState(state: TimerState): Promise<void>;
  loadTimerState(): Promise<TimerState>;
  markTimerCompleted(): Promise<void>;
  clearTimerCompleted(): Promise<void>;
  clearTimerState(): Promise<void>;
}

/**
 * Create a timer-state store backed by any {@link StorageAdapter}.
 * Pure persistence/serialization logic — no platform or UI dependencies.
 */
export function createTimerStorage(storage: StorageAdapter): TimerStorage {
  return {
    async saveTimerState(state: TimerState): Promise<void> {
      await storage.multiSet([
        [STORAGE_KEYS.TIMER_END_TIME, state.endTime?.toString() || ""],
        [STORAGE_KEYS.TIMER_DURATION, state.timerDuration.toString()],
        [STORAGE_KEYS.TIMER_PAUSED, state.paused.toString()],
        [STORAGE_KEYS.TIMER_TIME_LEFT, state.timeLeft.toString()],
        [STORAGE_KEYS.TIMER_COMPLETED, (state.completed || false).toString()],
      ]);
    },

    async loadTimerState(): Promise<TimerState> {
      try {
        const values = await storage.multiGet([
          STORAGE_KEYS.TIMER_END_TIME,
          STORAGE_KEYS.TIMER_DURATION,
          STORAGE_KEYS.TIMER_PAUSED,
          STORAGE_KEYS.TIMER_TIME_LEFT,
          STORAGE_KEYS.TIMER_COMPLETED,
        ]);

        const endTimeStr = values[0][1];
        const durationStr = values[1][1];
        const pausedStr = values[2][1];
        const timeLeftStr = values[3][1];
        const completedStr = values[4][1];

        const timerDuration = durationStr
          ? parseInt(durationStr, 10)
          : DEFAULT_TIMER_DURATION;

        return {
          endTime: endTimeStr ? parseInt(endTimeStr, 10) : undefined,
          timerDuration,
          paused: pausedStr ? pausedStr === "true" : true,
          timeLeft: timeLeftStr ? parseInt(timeLeftStr, 10) : timerDuration,
          completed: completedStr ? completedStr === "true" : false,
        };
      } catch {
        // Fall back to a clean default state if persistence is unavailable.
        return {
          endTime: undefined,
          timerDuration: DEFAULT_TIMER_DURATION,
          paused: true,
          timeLeft: DEFAULT_TIMER_DURATION,
          completed: false,
        };
      }
    },

    async markTimerCompleted(): Promise<void> {
      try {
        await storage.setItem(STORAGE_KEYS.TIMER_COMPLETED, "true");
      } catch {
        // best-effort flag; ignore persistence errors
      }
    },

    async clearTimerCompleted(): Promise<void> {
      try {
        await storage.setItem(STORAGE_KEYS.TIMER_COMPLETED, "false");
      } catch {
        // best-effort flag; ignore persistence errors
      }
    },

    async clearTimerState(): Promise<void> {
      await storage.multiRemove(Object.values(STORAGE_KEYS));
    },
  };
}
