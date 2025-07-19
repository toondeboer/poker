import React, { createContext, ReactNode, useEffect, useState } from "react";
import { Audio } from "expo-av";

type TimerContextType = {
  timeLeft: number;
  timerDuration: number;
  setTimerDuration: (duration: number) => void;
  paused: boolean;
  togglePause: () => void;
  resetTimer: () => void;
  setAlarmSound: (sound: Audio.Sound | null) => void;
};

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [timerDuration, setTimerDuration] = useState(60);
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const [paused, setPaused] = useState(false);
  const [alarmSound, setAlarmSound] = useState<Audio.Sound | null>(null);

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
      alarmSound?.replayAsync();
    }
  }, [timeLeft, alarmSound]);

  return (
    <TimerContext
      value={{
        timeLeft,
        timerDuration,
        setTimerDuration,
        paused,
        togglePause,
        resetTimer,
        setAlarmSound,
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
