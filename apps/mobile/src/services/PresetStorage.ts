// src/services/PresetStorage.ts
import { createPresetStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";

/** Tournament-preset persistence backed by AsyncStorage (logic lives in @poker/core). */
export const PresetStorage = createPresetStorage(asyncStorageAdapter);
