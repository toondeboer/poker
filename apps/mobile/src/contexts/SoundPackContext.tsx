// src/contexts/SoundPackContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { DEFAULT_SOUND_PACK_ID, SoundPackId } from "@poker/core";
import { SoundPackStorage } from "@/src/services/SoundPackStorage";
import { logger } from "@/src/utils/logger";

type SoundPackContextValue = {
  soundPackId: SoundPackId;
  isLoading: boolean;
  setSoundPackId: (id: SoundPackId) => Promise<void>;
};

const SoundPackContext = createContext<SoundPackContextValue | null>(null);

/**
 * The user's selected alarm sound (Pro feature), shared across the tree —
 * Settings writes it, TimerContext reads it to decide what to play, and both
 * need to see the same value the moment it changes (unlike presets, which
 * are read/written only within Settings itself). A plain per-component hook
 * doesn't work here: each call site would get its own local copy, so a
 * change in Settings wouldn't reach TimerContext until next app launch.
 */
export function SoundPackProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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

  return (
    <SoundPackContext.Provider
      value={{ soundPackId, isLoading, setSoundPackId }}
    >
      {children}
    </SoundPackContext.Provider>
  );
}

export function useSoundPack() {
  const context = useContext(SoundPackContext);
  if (!context) {
    throw new Error("useSoundPack must be used within a SoundPackProvider");
  }
  return context;
}
