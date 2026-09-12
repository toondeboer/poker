import { StorageAdapter } from "./StorageAdapter";
import { BlindLevel } from "../types/BlindLevel";
import { generateBlindLevels } from "../blinds/generateBlinds";

export const BLINDS_KEYS = {
  CURRENT_BLIND_INDEX: "current_blind_index",
  BLIND_LEVELS: "blind_levels",
  CUSTOM_BLIND_LEVELS: "custom_blind_levels",
} as const;

export interface BlindsState {
  currentBlindIndex: number;
  blindLevels: BlindLevel[];
  customBlindLevels: BlindLevel[];
}

export interface BlindsStorage {
  saveBlindsState(state: BlindsState): Promise<void>;
  loadBlindsState(): Promise<BlindsState>;
  saveCurrentBlindIndex(index: number): Promise<void>;
  clearBlindsState(): Promise<void>;
}

/**
 * Create a blinds-state store backed by any {@link StorageAdapter}.
 * Pure persistence/serialization logic — no platform or UI dependencies.
 */
export function createBlindsStorage(storage: StorageAdapter): BlindsStorage {
  return {
    async saveBlindsState(state: BlindsState): Promise<void> {
      await storage.multiSet([
        [BLINDS_KEYS.CURRENT_BLIND_INDEX, state.currentBlindIndex.toString()],
        [BLINDS_KEYS.BLIND_LEVELS, JSON.stringify(state.blindLevels)],
        [
          BLINDS_KEYS.CUSTOM_BLIND_LEVELS,
          JSON.stringify(state.customBlindLevels),
        ],
      ]);
    },

    async loadBlindsState(): Promise<BlindsState> {
      try {
        const values = await storage.multiGet([
          BLINDS_KEYS.CURRENT_BLIND_INDEX,
          BLINDS_KEYS.BLIND_LEVELS,
          BLINDS_KEYS.CUSTOM_BLIND_LEVELS,
        ]);

        const indexStr = values[0][1];
        const blindLevelsStr = values[1][1];
        const customBlindLevelsStr = values[2][1];

        return {
          currentBlindIndex: indexStr ? parseInt(indexStr, 10) : 0,
          blindLevels: blindLevelsStr
            ? (JSON.parse(blindLevelsStr) as BlindLevel[])
            : generateBlindLevels(),
          customBlindLevels: customBlindLevelsStr
            ? (JSON.parse(customBlindLevelsStr) as BlindLevel[])
            : generateBlindLevels(),
        };
      } catch {
        const defaultLevels = generateBlindLevels();
        return {
          currentBlindIndex: 0,
          blindLevels: defaultLevels,
          customBlindLevels: defaultLevels,
        };
      }
    },

    async saveCurrentBlindIndex(index: number): Promise<void> {
      try {
        await storage.setItem(
          BLINDS_KEYS.CURRENT_BLIND_INDEX,
          index.toString(),
        );
      } catch {
        // best-effort; ignore persistence errors
      }
    },

    async clearBlindsState(): Promise<void> {
      await storage.multiRemove(Object.values(BLINDS_KEYS));
    },
  };
}
