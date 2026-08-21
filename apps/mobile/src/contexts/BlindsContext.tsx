// src/contexts/BlindsContext.tsx
import { logger } from "@/src/utils/logger";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import {
  BlindLevel,
  BlindScheduleChange,
  clampBlindIndex,
  describeScheduleChange,
  generateBlindLevels,
  nextBlindIndex,
  previousBlindIndex,
  addBlindLevel as appendBlindLevel,
  insertBlindLevel as spliceBlindLevel,
  duplicateBlindLevel as copyBlindLevel,
  removeBlindLevel as deleteBlindLevel,
  updateBlindLevel as setBlindLevelField,
} from "@poker/core";
import { BlindsStorage } from "@/src/services/BlindsStorage";

type BlindsContextType = {
  /** The schedule the timer is actually playing. */
  blindLevels: BlindLevel[];
  /** The editor's working copy, applied to `blindLevels` explicitly. */
  customBlindLevels: BlindLevel[];
  currentBlindIndex: number;
  increaseBlinds: () => void;
  decreaseBlinds: () => void;
  /** Jump the running tournament to an arbitrary level. */
  selectBlind: (index: number) => void;
  addBlindLevel: () => void;
  insertBlindLevel: (index: number) => void;
  duplicateBlindLevel: (index: number) => void;
  removeBlindLevel: (index: number) => void;
  updateBlindLevel: (
    index: number,
    field: "small" | "big",
    value: number,
  ) => void;
  /** Wholesale draft replacement — used by the structure generator. */
  replaceCustomBlindLevels: (levels: BlindLevel[]) => void;
  /** Throw the draft away and re-seed it from the active schedule. */
  discardCustomBlindLevels: () => void;
  applyCustomBlindLevels: () => void;
  loadBlindLevels: (levels: BlindLevel[]) => void;
  resetToDefaultBlinds: () => void;
  /** True when the draft differs from the active schedule. */
  isDraftDirty: boolean;
  /** What applying the draft would do to the current level. */
  draftChange: BlindScheduleChange;
  isLoading: boolean;
};

const BlindsContext = createContext<BlindsContextType | null>(null);

export function BlindsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [currentBlindIndex, setCurrentBlindIndex] = useState(0);
  const [blindLevels, setBlindLevels] = useState(generateBlindLevels());
  const [customBlindLevels, setCustomBlindLevels] = useState<BlindLevel[]>(
    generateBlindLevels(),
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load blinds state on mount
  useEffect(() => {
    const loadBlindsState = async () => {
      try {
        const savedState = await BlindsStorage.loadBlindsState();
        // Clamp on the way in: PokerTimer indexes `blindLevels[currentBlindIndex]`
        // directly, so a stored index pointing past a stored schedule (from an
        // older build, or a partially-written save) would crash the timer screen.
        setCurrentBlindIndex(
          clampBlindIndex(
            savedState.currentBlindIndex,
            savedState.blindLevels.length,
          ),
        );
        setBlindLevels(savedState.blindLevels);
        setCustomBlindLevels(savedState.customBlindLevels);
      } catch (error) {
        logger.error("Failed to load blinds state:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadBlindsState();
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    if (!isLoading) {
      const saveState = async () => {
        try {
          await BlindsStorage.saveBlindsState({
            currentBlindIndex,
            blindLevels,
            customBlindLevels,
          });
        } catch (error) {
          logger.error("Failed to save blinds state:", error);
        }
      };

      saveState();
    }
  }, [currentBlindIndex, blindLevels, customBlindLevels, isLoading]);

  // The index is saved eagerly (not just via the effect above) because the
  // process can be killed at any moment mid-round.
  const commitIndex = useCallback((newIndex: number) => {
    setCurrentBlindIndex(newIndex);
    BlindsStorage.saveCurrentBlindIndex(newIndex);
  }, []);

  const increaseBlinds = useCallback(() => {
    commitIndex(nextBlindIndex(currentBlindIndex, blindLevels));
  }, [commitIndex, currentBlindIndex, blindLevels]);

  const decreaseBlinds = useCallback(() => {
    commitIndex(previousBlindIndex(currentBlindIndex));
  }, [commitIndex, currentBlindIndex]);

  const selectBlind = useCallback(
    (index: number) => {
      commitIndex(clampBlindIndex(index, blindLevels.length));
    },
    [commitIndex, blindLevels.length],
  );

  const addBlindLevel = useCallback(() => {
    setCustomBlindLevels(appendBlindLevel);
  }, []);

  const insertBlindLevel = useCallback((index: number) => {
    setCustomBlindLevels((levels) => spliceBlindLevel(levels, index));
  }, []);

  const duplicateBlindLevel = useCallback((index: number) => {
    setCustomBlindLevels((levels) => copyBlindLevel(levels, index));
  }, []);

  const removeBlindLevel = useCallback((index: number) => {
    setCustomBlindLevels((levels) => deleteBlindLevel(levels, index));
  }, []);

  const updateBlindLevel = useCallback(
    (index: number, field: "small" | "big", value: number) => {
      setCustomBlindLevels((levels) =>
        setBlindLevelField(levels, index, field, value),
      );
    },
    [],
  );

  const replaceCustomBlindLevels = useCallback((levels: BlindLevel[]) => {
    setCustomBlindLevels([...levels]);
  }, []);

  const discardCustomBlindLevels = useCallback(() => {
    setCustomBlindLevels([...blindLevels]);
  }, [blindLevels]);

  /**
   * Make the draft active.
   *
   * Deliberately *clamps* the current index rather than resetting it to 0: this
   * is an edit to the structure you're already playing, so the host's place in
   * the tournament is real information worth keeping. Only a draft short enough
   * to drop the current level moves them, and then only to the new last level.
   */
  const applyCustomBlindLevels = useCallback(() => {
    const next = [...customBlindLevels];
    setBlindLevels(next);
    setCurrentBlindIndex((index) => clampBlindIndex(index, next.length));
  }, [customBlindLevels]);

  /**
   * Apply a saved preset's structure: make it both the editable and the active
   * schedule, and restart from level 1. Persistence is handled by the save
   * effect that watches these values.
   *
   * This one *does* reset the index (unlike `applyCustomBlindLevels`) because it
   * swaps in a whole different tournament setup — "level 12" of the structure
   * you were playing means nothing in the one you just loaded.
   */
  const loadBlindLevels = useCallback((levels: BlindLevel[]) => {
    setCustomBlindLevels(levels);
    setBlindLevels(levels);
    setCurrentBlindIndex(0);
  }, []);

  /** Also a whole-setup replacement, so it resets the index for the same reason. */
  const resetToDefaultBlinds = useCallback(() => {
    const defaultLevels = generateBlindLevels();
    setCustomBlindLevels(defaultLevels);
    setBlindLevels(defaultLevels);
    setCurrentBlindIndex(0);
  }, []);

  const draftChange = useMemo(
    () =>
      describeScheduleChange(blindLevels, customBlindLevels, currentBlindIndex),
    [blindLevels, customBlindLevels, currentBlindIndex],
  );

  // Memoised so the blinds editor's 30+ memoised rows aren't invalidated by
  // every unrelated provider render.
  const value = useMemo(
    () => ({
      currentBlindIndex,
      blindLevels,
      customBlindLevels,
      increaseBlinds,
      decreaseBlinds,
      selectBlind,
      addBlindLevel,
      insertBlindLevel,
      duplicateBlindLevel,
      removeBlindLevel,
      updateBlindLevel,
      replaceCustomBlindLevels,
      discardCustomBlindLevels,
      applyCustomBlindLevels,
      loadBlindLevels,
      resetToDefaultBlinds,
      isDraftDirty: draftChange.changed,
      draftChange,
      isLoading,
    }),
    [
      currentBlindIndex,
      blindLevels,
      customBlindLevels,
      increaseBlinds,
      decreaseBlinds,
      selectBlind,
      addBlindLevel,
      insertBlindLevel,
      duplicateBlindLevel,
      removeBlindLevel,
      updateBlindLevel,
      replaceCustomBlindLevels,
      discardCustomBlindLevels,
      applyCustomBlindLevels,
      loadBlindLevels,
      resetToDefaultBlinds,
      draftChange,
      isLoading,
    ],
  );

  return (
    <BlindsContext.Provider value={value}>{children}</BlindsContext.Provider>
  );
}

export function useBlinds() {
  const context = useContext(BlindsContext);
  if (!context) {
    throw new Error("useBlinds must be used within a BlindsProvider");
  }
  return context;
}
