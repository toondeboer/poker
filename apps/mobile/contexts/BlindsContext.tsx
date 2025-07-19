import { createContext, ReactNode, useContext, useState } from "react";

type BlindsContextType = {
  smallBlind: number;
  bigBlind: number;
  increaseBlinds: () => void;
  decreaseBlinds: () => void;
  setBlinds: (small: number, big: number) => void;
};

const BlindsContext = createContext<BlindsContextType | null>(null);

export function BlindsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);

  // Function to increase blinds by a fixed increment.
  const increaseBlinds = () => {
    setSmallBlind((prev) => prev + 10);
    setBigBlind((prev) => prev + 20);
  };

  // Function to decrease blinds by a fixed increment.
  const decreaseBlinds = () => {
    setSmallBlind((prev) => Math.max(0, prev - 10));
    setBigBlind((prev) => Math.max(0, prev - 20));
  };

  // Function to set blinds to specific values.
  const setBlinds = (small: number, big: number) => {
    setSmallBlind(small);
    setBigBlind(big);
  };

  return (
    <BlindsContext.Provider
      value={{
        smallBlind,
        bigBlind,
        increaseBlinds,
        decreaseBlinds,
        setBlinds,
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
