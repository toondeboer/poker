// src/hooks/useSoundPack.ts
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SOUND_PACK_ID, SoundPackId } from "@poker/core";
import { SoundPackStorage } from "@/src/services/SoundPackStorage";
import { logger } from "@/src/utils/logger";

/**
 * The user's selected alarm sound (Pro feature). Loads once, then keeps the
 * choice in sync with AsyncStorage. Entitlement-agnostic, like `usePresets` —
 * the Pro gate is enforced by callers (UI shows the picker only when
 * `isPremium`; TimerContext falls back to the default sound otherwise).
 */
export function useSoundPack() {
  const [soundPackId, setSoundPackIdState] = useState<SoundPackId>(
    DEFAULT_SOUND_PACK_ID,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    SoundPackStorage.loadSoundPackId()
      .then((loaded) => {
        if (active) setSoundPackIdState(loaded);
      })
      .catch((error) => logger.error("Failed to load sound pack:", error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setSoundPackId = useCallback(async (id: SoundPackId) => {
    setSoundPackIdState(id);
    try {
      await SoundPackStorage.saveSoundPackId(id);
    } catch (error) {
      logger.error("Failed to save sound pack:", error);
    }
  }, []);

  return { soundPackId, isLoading, setSoundPackId };
}
