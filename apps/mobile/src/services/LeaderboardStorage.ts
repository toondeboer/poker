// src/services/LeaderboardStorage.ts
import { createLeaderboardStorage } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";
import { generateId } from "@/src/utils/id";

/**
 * What the single board that shipped before groups gets called once it becomes
 * one. Deliberately plain: it is the name of a board somebody already had, not
 * a name they chose, so it should read as a default rather than as a decision
 * made on their behalf.
 */
export const DEFAULT_GROUP_NAME = "My games";

/** Leaderboard persistence backed by AsyncStorage (logic lives in @poker/core). */
export const LeaderboardStorage = createLeaderboardStorage(asyncStorageAdapter, {
  createGroupId: generateId,
  now: Date.now,
  defaultGroupName: DEFAULT_GROUP_NAME,
});
