// src/services/BlindsStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlindLevel } from "@/src/types/BlindLevel";
import { generateBlindLevels } from "@/src/util/generateBlinds";

const STORAGE_KEYS = {
  CURRENT_BLIND_INDEX: "current_blind_index",
  BLIND_LEVELS: "blind_levels",
  CUSTOM_BLIND_LEVELS: "custom_blind_levels",
} as const;

export interface BlindsState {
  currentBlindIndex: number;
  blindLevels: BlindLevel[];
  customBlindLevels: BlindLevel[];
}

export class BlindsStorage {
  static async saveBlindsState(state: BlindsState): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.CURRENT_BLIND_INDEX, state.currentBlindIndex.toString()],
        [STORAGE_KEYS.BLIND_LEVELS, JSON.stringify(state.blindLevels)],
        [
          STORAGE_KEYS.CUSTOM_BLIND_LEVELS,
          JSON.stringify(state.customBlindLevels),
        ],
      ]);
    } catch (error) {
      console.error("Failed to save blinds state:", error);
      throw error;
    }
  }

  static async loadBlindsState(): Promise<BlindsState> {
    try {
      const values = await AsyncStorage.multiGet([
        STORAGE_KEYS.CURRENT_BLIND_INDEX,
        STORAGE_KEYS.BLIND_LEVELS,
        STORAGE_KEYS.CUSTOM_BLIND_LEVELS,
      ]);

      const indexStr = values[0][1];
      const blindLevelsStr = values[1][1];
      const customBlindLevelsStr = values[2][1];

      const savedIndex = indexStr ? parseInt(indexStr, 10) : 0;
      const savedBlindLevels = blindLevelsStr
        ? JSON.parse(blindLevelsStr)
        : generateBlindLevels();
      const savedCustomBlindLevels = customBlindLevelsStr
        ? JSON.parse(customBlindLevelsStr)
        : generateBlindLevels();

      return {
        currentBlindIndex: savedIndex,
        blindLevels: savedBlindLevels,
        customBlindLevels: savedCustomBlindLevels,
      };
    } catch (error) {
      console.error("Failed to load blinds state:", error);
      // Return default values on error
      const defaultLevels = generateBlindLevels();
      return {
        currentBlindIndex: 0,
        blindLevels: defaultLevels,
        customBlindLevels: defaultLevels,
      };
    }
  }

  static async saveCurrentBlindIndex(index: number): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CURRENT_BLIND_INDEX,
        index.toString(),
      );
    } catch (error) {
      console.error("Failed to save current blind index:", error);
    }
  }

  static async clearBlindsState(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (error) {
      console.error("Failed to clear blinds state:", error);
      throw error;
    }
  }
}
