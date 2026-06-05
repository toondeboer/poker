// src/contexts/BlindsContext.tsx
import {
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
} from "react";
import {
  BlindLevel,
  generateBlindLevels,
  nextBlindIndex,
  previousBlindIndex,
  addBlindLevel as appendBlindLevel,
  removeBlindLevel as deleteBlindLevel,
  updateBlindLevel as setBlindLevelField,
} from "@poker/core";
import { BlindsStorage } from "@/src/services/BlindsStorage";

type BlindsContextType = {
  blindLevels: BlindLevel[];
  customBlindLevels: BlindLevel[];
  currentBlindIndex: number;
  increaseBlinds: () => void;
  decreaseBlinds: () => void;
  addBlindLevel: () => void;
  removeBlindLevel: (index: number) => void;
  updateBlindLevel: (
    index: number,
    field: "small" | "big",
    value: number,
  ) => void;
  applyCustomBlindLevels: () => void;
  resetToDefaultBlinds: () => void;
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
        setCurrentBlindIndex(savedState.currentBlindIndex);
        setBlindLevels(savedState.blindLevels);
        setCustomBlindLevels(savedState.customBlindLevels);
      } catch (error) {
        console.error("Failed to load blinds state:", error);
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
          console.error("Failed to save blinds state:", error);
        }
      };

      saveState();
    }
  }, [currentBlindIndex, blindLevels, customBlindLevels, isLoading]);

  const increaseBlinds = () => {
    const newIndex = nextBlindIndex(currentBlindIndex, blindLevels);
    setCurrentBlindIndex(newIndex);
    // Save index immediately
    BlindsStorage.saveCurrentBlindIndex(newIndex);
  };

  const decreaseBlinds = () => {
    const newIndex = previousBlindIndex(currentBlindIndex);
    setCurrentBlindIndex(newIndex);
    // Save index immediately
    BlindsStorage.saveCurrentBlindIndex(newIndex);
  };

  const addBlindLevel = () => {
    setCustomBlindLevels(appendBlindLevel(customBlindLevels));
  };

  const removeBlindLevel = (index: number) => {
    setCustomBlindLevels(deleteBlindLevel(customBlindLevels, index));
  };

  const updateBlindLevel = (
    index: number,
    field: "small" | "big",
    value: number,
  ) => {
    setCustomBlindLevels(
      setBlindLevelField(customBlindLevels, index, field, value),
    );
  };

  const applyCustomBlindLevels = () => {
    setBlindLevels([...customBlindLevels]);
    setCurrentBlindIndex(0);
  };

  const resetToDefaultBlinds = () => {
    const defaultLevels = generateBlindLevels();
    setCustomBlindLevels(defaultLevels);
    setBlindLevels(defaultLevels);
    setCurrentBlindIndex(0);
  };

  return (
    <BlindsContext.Provider
      value={{
        currentBlindIndex,
        blindLevels,
        customBlindLevels,
        increaseBlinds,
        decreaseBlinds,
        addBlindLevel,
        removeBlindLevel,
        updateBlindLevel,
        applyCustomBlindLevels,
        resetToDefaultBlinds,
        isLoading,
      }}
    >
      {children}
    </BlindsContext.Provider>
  );
}

export function useBlinds() {
  const context = useContext(BlindsContext);
  if (!context) {
    throw new Error("useBlinds must be used within a BlindsProvider");
  }
  return context;
}
