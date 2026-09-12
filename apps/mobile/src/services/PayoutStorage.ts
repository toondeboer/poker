// src/services/PayoutStorage.ts
import { createPayoutStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";

/** Payout-settings persistence backed by AsyncStorage (logic lives in @poker/core). */
export const PayoutStorage = createPayoutStorage(asyncStorageAdapter);
