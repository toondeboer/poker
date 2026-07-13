import { StorageAdapter } from "./StorageAdapter";
import { BlindPreset } from "../presets/preset";

const STORAGE_KEY = "blind_presets";

export interface PresetStorage {
  loadPresets(): Promise<BlindPreset[]>;
  savePresets(presets: BlindPreset[]): Promise<void>;
  clearPresets(): Promise<void>;
}

/**
 * Create a preset store backed by any {@link StorageAdapter}. Presets live under
 * a single JSON key. Pure persistence/serialization — no platform or UI deps.
 */
export function createPresetStorage(storage: StorageAdapter): PresetStorage {
  return {
    async loadPresets(): Promise<BlindPreset[]> {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as BlindPreset[]) : [];
      } catch {
        return [];
      }
    },

    async savePresets(presets: BlindPreset[]): Promise<void> {
      await storage.setItem(STORAGE_KEY, JSON.stringify(presets));
    },

    async clearPresets(): Promise<void> {
      await storage.multiRemove([STORAGE_KEY]);
    },
  };
}
