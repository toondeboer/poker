import { StorageAdapter } from "./StorageAdapter";
import { DEFAULT_SOUND_PACK_ID, isValidSoundPackId, SoundPackId } from "../sounds/soundPack";

const STORAGE_KEY = "sound_pack_id";

export interface SoundPackStorage {
  loadSoundPackId(): Promise<SoundPackId>;
  saveSoundPackId(id: SoundPackId): Promise<void>;
}

/**
 * Create a sound-pack preference store backed by any {@link StorageAdapter}.
 * Falls back to {@link DEFAULT_SOUND_PACK_ID} on a missing or invalid stored
 * value. Pure persistence — no platform or UI deps.
 */
export function createSoundPackStorage(
  storage: StorageAdapter,
): SoundPackStorage {
  return {
    async loadSoundPackId(): Promise<SoundPackId> {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        return raw && isValidSoundPackId(raw) ? raw : DEFAULT_SOUND_PACK_ID;
      } catch {
        return DEFAULT_SOUND_PACK_ID;
      }
    },

    async saveSoundPackId(id: SoundPackId): Promise<void> {
      await storage.setItem(STORAGE_KEY, id);
    },
  };
}
