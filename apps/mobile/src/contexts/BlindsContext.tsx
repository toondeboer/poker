// src/contexts/BlindsContext.tsx
import {
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
} from "react";
import { BlindLevel } from "@/src/types/BlindLevel";
import { generateBlindLevels } from "@/src/util/generateBlinds";
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
    const newIndex = Math.min(currentBlindIndex + 1, blindLevels.length - 1);
    setCurrentBlindIndex(newIndex);
    // Save index immediately
    BlindsStorage.saveCurrentBlindIndex(newIndex);
  };

  const decreaseBlinds = () => {
    const newIndex = Math.max(currentBlindIndex - 1, 0);
    setCurrentBlindIndex(newIndex);
    // Save index immediately
    BlindsStorage.saveCurrentBlindIndex(newIndex);
  };

  const addBlindLevel = () => {
    setCustomBlindLevels([
      ...customBlindLevels,
      {
        small:
          customBlindLevels[customBlindLevels.length - 1].small +
          (customBlindLevels[customBlindLevels.length - 1].small -
            customBlindLevels[customBlindLevels.length - 2].small),
        big:
          customBlindLevels[customBlindLevels.length - 1].big +
          (customBlindLevels[customBlindLevels.length - 1].big -
            customBlindLevels[customBlindLevels.length - 2].big),
      },
    ]);
  };

  const removeBlindLevel = (index: number) => {
    if (customBlindLevels.length > 2) {
      const newLevels = customBlindLevels.filter((_, i) => i !== index);
      setCustomBlindLevels(newLevels);
    }
  };

  const updateBlindLevel = (
    index: number,
    field: "small" | "big",
    value: number,
  ) => {
    const newLevels = [...customBlindLevels];
    newLevels[index][field] = value;
    setCustomBlindLevels(newLevels);
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
