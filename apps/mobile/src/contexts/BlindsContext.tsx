import { createContext, ReactNode, useContext, useState } from "react";
import { BlindLevel } from "@/src/types/BlindLevel";
import { generateBlindLevels } from "@/src/util/generateBlinds";

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

  const increaseBlinds = () => {
    setCurrentBlindIndex((prev) => Math.min(prev + 1, blindLevels.length - 1));
  };

  const decreaseBlinds = () => {
    setCurrentBlindIndex((prev) => Math.max(prev - 1, 0));
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
