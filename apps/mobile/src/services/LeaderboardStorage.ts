// src/services/LeaderboardStorage.ts
import { createLeaderboardStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";

/** Leaderboard persistence backed by AsyncStorage (logic lives in @poker/core). */
export const LeaderboardStorage = createLeaderboardStorage(asyncStorageAdapter);
