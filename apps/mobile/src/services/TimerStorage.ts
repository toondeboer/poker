// src/services/TimerStorage.ts
import { createTimerStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";

export type { TimerState } from "@poker/core";

/** Timer-state persistence backed by AsyncStorage (logic lives in @poker/core). */
export const TimerStorage = createTimerStorage(asyncStorageAdapter);
