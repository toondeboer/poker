import { useCallback, useEffect, useState } from "react";
import {
  BlindLevel,
  generateBlindLevels,
  nextBlindIndex,
  previousBlindIndex,
  addBlindLevel as appendBlindLevel,
  removeBlindLevel as deleteBlindLevel,
  updateBlindLevel as setBlindLevelField,
  clampBlindIndex,
  createBlindsStorage,
} from "@poker/core";
import { localStorageAdapter } from "@/lib/storageAdapter";

const blindsStorage = createBlindsStorage(localStorageAdapter);

/** Blind schedule state for the web timer, persisted to localStorage. */
export function useWebBlinds() {
  const [currentBlindIndex, setCurrentBlindIndex] = useState(0);
  const [blindLevels, setBlindLevels] =
    useState<BlindLevel[]>(generateBlindLevels);
  const [customBlindLevels, setCustomBlindLevels] =
    useState<BlindLevel[]>(generateBlindLevels);
  const [isLoading, setIsLoading] = useState(true);

  // Restore persisted blinds on mount.
  useEffect(() => {
    let active = true;
    blindsStorage.loadBlindsState().then((saved) => {
      if (!active) return;
      setCurrentBlindIndex(saved.currentBlindIndex);
      setBlindLevels(saved.blindLevels);
      setCustomBlindLevels(saved.customBlindLevels);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist whenever blinds state changes.
  useEffect(() => {
    if (isLoading) return;
    blindsStorage.saveBlindsState({
      currentBlindIndex,
      blindLevels,
      customBlindLevels,
    });
  }, [currentBlindIndex, blindLevels, customBlindLevels, isLoading]);

  const goToNextBlind = useCallback(
    () => setCurrentBlindIndex((i) => nextBlindIndex(i, blindLevels)),
    [blindLevels],
  );
  const goToPreviousBlind = useCallback(
    () => setCurrentBlindIndex((i) => previousBlindIndex(i)),
    [],
  );
  const selectBlind = useCallback(
    (index: number) =>
      setCurrentBlindIndex(clampBlindIndex(index, blindLevels.length)),
    [blindLevels.length],
  );

  const addLevel = useCallback(
    () => setCustomBlindLevels((levels) => appendBlindLevel(levels)),
    [],
  );
  const removeLevel = useCallback(
    (index: number) =>
      setCustomBlindLevels((levels) => deleteBlindLevel(levels, index)),
    [],
  );
  const updateLevel = useCallback(
    (index: number, field: "small" | "big", value: number) =>
      setCustomBlindLevels((levels) =>
        setBlindLevelField(levels, index, field, value),
      ),
    [],
  );
  const applyCustomBlindLevels = useCallback(() => {
    setCustomBlindLevels((levels) => {
      setBlindLevels([...levels]);
      return levels;
    });
    setCurrentBlindIndex(0);
  }, []);
  const resetToDefaultBlinds = useCallback(() => {
    const defaults = generateBlindLevels();
    setCustomBlindLevels(defaults);
    setBlindLevels(defaults);
    setCurrentBlindIndex(0);
  }, []);

  return {
    currentBlindIndex,
    blindLevels,
    customBlindLevels,
    isLoading,
    goToNextBlind,
    goToPreviousBlind,
    selectBlind,
    addLevel,
    removeLevel,
    updateLevel,
    applyCustomBlindLevels,
    resetToDefaultBlinds,
  };
}
