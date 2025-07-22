import React, { createContext, ReactNode, useEffect, useState } from "react";
import { Sound, useSounds } from "@/src/hooks/useSounds";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { useTimerNotification } from "@/src/hooks/useTimerNotification";
import { liveActivityService } from "@/src/services/LiveActivityService";

const DEFAULT_TIMER_DURATION = 600; // Default timer duration in seconds

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
  const [timerDuration, setTimerDuration] = useState(DEFAULT_TIMER_DURATION);
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const [paused, setPaused] = useState(true);
  const { playSound } = useSounds(Sound.ALARM);
  const { increaseBlinds, currentBlindIndex, blindLevels } = useBlinds();
  const { scheduleNotification } = useTimerNotification();

  const togglePause = () =>
    setPaused((prev) => {
      const isPaused = !prev;

      if (!isPaused) {
        scheduleNotification(timeLeft, blindLevels[currentBlindIndex + 1]);
        liveActivityService.startActivity("Poker Tournament", {
          currentBlindLevel: currentBlindIndex,
          currentSmallBlind: blindLevels[currentBlindIndex].small,
          currentBigBlind: blindLevels[currentBlindIndex].big,
          nextSmallBlind: blindLevels[currentBlindIndex + 1]?.small || 0,
          nextBigBlind: blindLevels[currentBlindIndex + 1]?.big || 0,
          endTime: new Date(Date.now() + timerDuration * 1000).getTime(),
          isBreak: false,
        });
      }

      return isPaused;
    });

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
