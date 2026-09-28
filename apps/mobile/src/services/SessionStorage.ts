// src/services/SessionStorage.ts
import { createSessionStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";

/** Shared-clock membership persistence backed by AsyncStorage (logic lives in @poker/core). */
export const SessionStorage = createSessionStorage(asyncStorageAdapter);
