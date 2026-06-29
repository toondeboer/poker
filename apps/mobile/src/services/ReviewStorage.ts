// src/services/ReviewStorage.ts
import { createReviewStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";

/** Review-prompt persistence backed by AsyncStorage (logic lives in @poker/core). */
export const ReviewStorage = createReviewStorage(asyncStorageAdapter);
