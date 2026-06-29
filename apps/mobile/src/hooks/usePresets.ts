// src/hooks/usePresets.ts
import { useCallback, useEffect, useState } from "react";
import {
  BlindLevel,
  BlindPreset,
  addPreset,
  createPreset,
  removePreset,
} from "@poker/core";
import { PresetStorage } from "@/src/services/PresetStorage";
import { logger } from "@/src/utils/logger";

/** Short, collision-resistant id — core stays clock/crypto-free, so we mint it here. */
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/**
 * Saved tournament presets (Pro feature). Loads once, then keeps the list in
 * sync with AsyncStorage. The model/serialization lives in @poker/core; this
 * hook owns React state, the id/clock, and persistence I/O.
 */
export function usePresets() {
  const [presets, setPresets] = useState<BlindPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    PresetStorage.loadPresets()
      .then((loaded) => {
        if (active) setPresets(loaded);
      })
      .catch((error) => logger.error("Failed to load presets:", error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback(async (next: BlindPreset[]) => {
    setPresets(next);
    try {
      await PresetStorage.savePresets(next);
    } catch (error) {
      logger.error("Failed to save presets:", error);
    }
  }, []);

  const savePreset = useCallback(
    (name: string, blindLevels: BlindLevel[], timerDuration: number) => {
      const preset = createPreset({
        id: generateId(),
        name,
        blindLevels,
        timerDuration,
        now: Date.now(),
      });
      return persist(addPreset(presets, preset));
    },
    [presets, persist],
  );

  const deletePreset = useCallback(
    (id: string) => persist(removePreset(presets, id)),
    [presets, persist],
  );

  return { presets, isLoading, savePreset, deletePreset };
}
