// src/services/BlindsStorage.ts
import { createBlindsStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";

export type { BlindsState } from "@poker/core";

/** Blinds-state persistence backed by AsyncStorage (logic lives in @poker/core). */
export const BlindsStorage = createBlindsStorage(asyncStorageAdapter);
