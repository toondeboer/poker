import { useState } from "react";

export const useBlinds = () => {
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

  return { smallBlind, bigBlind, increaseBlinds, decreaseBlinds, setBlinds };
};
