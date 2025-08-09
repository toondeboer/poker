// src/hooks/useTimerEngine.ts
import { useEffect, useRef, useState } from "react";
import { TimerState, TimerStorage } from "@/src/services/TimerStorage";
import { BlindLevel } from "@/src/types/BlindLevel";
import { liveActivityService } from "@/src/services/LiveActivityService";
import { useAppState } from "@/src/contexts/AppStateContext";

const DEFAULT_TIMER_DURATION = 600;

export interface TimerEngineCallbacks {
  onTimerComplete: () => void;
  onTimeUpdate?: (timeLeft: number) => void;
}

export function useTimerEngine(
  currentBlindLevel: number,
  blindLevels: BlindLevel[],
  callbacks: TimerEngineCallbacks,
) {
  const [timerDuration, setTimerDuration] = useState(DEFAULT_TIMER_DURATION);
  const [endTime, setEndTime] = useState<number>();
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMER_DURATION);
  const [paused, setPaused] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const { isActive } = useAppState();

  const intervalRef = useRef<number | null>(null);
  const hasHandledTimerCompleteRef = useRef(false); // Track if we've already handled timer completion

  // Calculate current time left based on end time
  const calculateTimeLeft = (endTime: number): number => {
    const now = Date.now();
    return Math.max(0, Math.ceil((endTime - now) / 1000));
  };

  // Update Live Activity with current state
  const updateLiveActivity = async (shouldAlertOnExpiry: boolean) => {
    await liveActivityService.startOrUpdateActivity(
      {
        endTime,
        timeLeft,
        paused,
        currentBlindLevel: currentBlindLevel + 1, // Display as 1-based index
        currentSmallBlind: blindLevels[currentBlindLevel]?.small || 0,
        currentBigBlind: blindLevels[currentBlindLevel]?.big || 0,
        nextSmallBlind: blindLevels[currentBlindLevel + 1]?.small || 0,
        nextBigBlind: blindLevels[currentBlindLevel + 1]?.big || 0,
      },
      shouldAlertOnExpiry,
    );
  };

  // Load timer state from storage
  const loadTimerState = async (): Promise<void> => {
    try {
      const savedState = await TimerStorage.loadTimerState();

      // Calculate current time left based on end time if timer was running
      let currentTimeLeft = savedState.timeLeft;
      let hasExpired = false;

      if (savedState.endTime && !savedState.paused) {
        currentTimeLeft = calculateTimeLeft(savedState.endTime);
        hasExpired = currentTimeLeft === 0;
      }

      if (hasExpired && !hasHandledTimerCompleteRef.current) {
        // Timer expired while app was closed
        hasHandledTimerCompleteRef.current = true;
        callbacks.onTimerComplete();

        // Reset timer after completion but don't save state yet
        setPaused(true);
        setEndTime(undefined);
        setTimeLeft(savedState.timerDuration);
        setTimerDuration(savedState.timerDuration);
      } else {
        // Restore normal state
        setTimerDuration(savedState.timerDuration);
        setEndTime(savedState.endTime);
        setTimeLeft(currentTimeLeft);
        setPaused(savedState.paused);

        // Reset the flag when loading normal state
        hasHandledTimerCompleteRef.current = false;
      }
    } catch (error) {
      console.error("Failed to load timer state:", error);
      // Use default values on error
      setTimerDuration(DEFAULT_TIMER_DURATION);
      setTimeLeft(DEFAULT_TIMER_DURATION);
      setPaused(true);
      setEndTime(undefined);
      hasHandledTimerCompleteRef.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  // Save current state to storage
  const saveCurrentState = async (): Promise<void> => {
    const state: TimerState = {
      endTime,
      timerDuration,
      paused,
      timeLeft,
    };
    await TimerStorage.saveTimerState(state);
  };

  // Toggle pause/resume
  const togglePause = async (): Promise<void> => {
    const newPaused = !paused;

    if (newPaused) {
      console.log("Pausing timer at time left:", timeLeft);
      // Pausing the timer
      setEndTime(undefined);
      setPaused(true);
    } else {
      console.log("Resuming timer with time left:", timeLeft);
      // Resuming the timer
      const newEndTime = Date.now() + timeLeft * 1000;
      setEndTime(newEndTime);
      setPaused(false);
      // Reset completion flag when starting timer
      hasHandledTimerCompleteRef.current = false;
    }
  };

  // Reset timer
  const resetTimer = async (): Promise<void> => {
    setPaused(true);
    setEndTime(undefined);
    setTimeLeft(timerDuration);
    hasHandledTimerCompleteRef.current = false;

    await saveCurrentState();
  };

  // Set timer duration
  const handleSetTimerDuration = async (duration: number): Promise<void> => {
    setTimerDuration(duration);

    // If timer is paused and we don't have an endTime (truly reset state), update time left
    if (paused && !endTime) {
      console.log("Setting time left to duration:", duration);
      setTimeLeft(duration);
    }
  };

  // Timer countdown effect
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!paused && endTime && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        const newTimeLeft = calculateTimeLeft(endTime);
        setTimeLeft(newTimeLeft);

        // Call optional time update callback
        callbacks.onTimeUpdate?.(newTimeLeft);

        // Save updated time left periodically
        TimerStorage.saveTimerState({
          endTime,
          timerDuration,
          paused: false,
          timeLeft: newTimeLeft,
        });

        if (newTimeLeft === 0) {
          clearInterval(intervalRef.current!);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [paused, endTime, timerDuration, callbacks]);

  // Handle timer completion
  useEffect(() => {
    if (
      timeLeft === 0 &&
      !paused &&
      endTime &&
      !hasHandledTimerCompleteRef.current
    ) {
      hasHandledTimerCompleteRef.current = true;
      callbacks.onTimerComplete();
      resetTimer();
    }
  }, [timeLeft, paused, endTime]);

  // Save state whenever it changes
  useEffect(() => {
    if (!isLoading) {
      saveCurrentState();
    }
  }, [endTime, timerDuration, paused, timeLeft, isLoading]);

  // Update Live Activity when state changes
  useEffect(() => {
    if (!isLoading) {
      if (isActive) {
        console.log("App is active, updating Live Activity");
        updateLiveActivity(false);
      } else {
        console.log(
          "App is in background, updating Live Activity with alert on expiry",
        );
        updateLiveActivity(true);
      }
    }
  }, [endTime, paused, currentBlindLevel, blindLevels, isLoading, isActive]);

  useEffect(() => {
    if (paused && endTime === undefined && timeLeft > timerDuration) {
      console.log("Resetting time left to new timer duration:", timerDuration);
      setTimeLeft(timerDuration);
    }
  }, [timerDuration, paused, endTime]);

  return {
    timerDuration,
    setTimerDuration: handleSetTimerDuration,
    endTime,
    timeLeft,
    paused,
    togglePause,
    resetTimer,
    isLoading,
    loadTimerState,
  };
}
