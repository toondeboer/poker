import React, { createContext, ReactNode, useEffect, useState } from "react";
import { Sound, useSounds } from "@/src/hooks/useSounds";
import { useBlinds } from "@/src/contexts/BlindsContext";

type TimerContextType = {
  timeLeft: number;
  timerDuration: number;
  setTimerDuration: (duration: number) => void;
  paused: boolean;
  togglePause: () => void;
  resetTimer: () => void;
};

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [timerDuration, setTimerDuration] = useState(5);
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const [paused, setPaused] = useState(false);
  const { playSound } = useSounds(Sound.ALARM);
  const { increaseBlinds } = useBlinds();

  const togglePause = () => setPaused((prev) => !prev);

  const resetTimer = () => setTimeLeft(timerDuration);

  useEffect(() => {
    setTimeLeft(timerDuration);
  }, [timerDuration]);

  useEffect(() => {
    if (!paused && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, paused]);

  useEffect(() => {
    if (timeLeft === 0) {
      playSound();
      increaseBlinds();
      resetTimer();
    }
  }, [timeLeft]);

  return (
    <TimerContext
      value={{
        timeLeft,
        timerDuration,
        setTimerDuration,
        paused,
        togglePause,
        resetTimer,
      }}
    >
      {children}
    </TimerContext>
  );
}

export function useTimer() {
  const context = React.useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
}
