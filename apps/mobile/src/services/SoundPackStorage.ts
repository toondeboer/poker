// src/services/SoundPackStorage.ts
import { createSoundPackStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";

/** Sound-pack preference persistence backed by AsyncStorage (logic lives in @poker/core). */
export const SoundPackStorage = createSoundPackStorage(asyncStorageAdapter);
