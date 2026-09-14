// src/services/GameStorage.ts
import { createGameStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";

/** The game in progress, backed by AsyncStorage (logic lives in @poker/core). */
export const GameStorage = createGameStorage(asyncStorageAdapter);
