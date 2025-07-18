import { useEffect, useState } from "react";
import { Audio } from "expo-av";

const TIMER_DURATION = 5;

export const useTimer = (alarmSound: Audio.Sound | null) => {
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION); // Initial timer value in seconds
  const [paused, setPaused] = useState(false);

  // Function to toggle pause state
  const togglePause = () => {
    setPaused((prev) => !prev);
  };

  // Function to reset the timer
  const resetTimer = () => {
    setTimeLeft(TIMER_DURATION); // Reset timer to initial value
  };

  // Timer logic using useEffect
  useEffect(() => {
    if (!paused && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, paused]);

  // Play alarm when timer expires
  useEffect(() => {
    if (timeLeft === 0) {
      alarmSound?.replayAsync();
    }
  }, [timeLeft, alarmSound]);

  return { timeLeft, TIMER_DURATION, paused, togglePause, resetTimer };
};
