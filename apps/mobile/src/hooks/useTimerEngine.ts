// src/hooks/useTimerEngine.ts
import { useEffect, useRef, useState } from "react";
import {
  BlindLevel,
  DEFAULT_TIMER_DURATION,
  calculateTimeLeft,
  computeEndTime,
} from "@poker/core";
import { TimerState, TimerStorage } from "@/src/services/TimerStorage";
import { liveActivityService } from "@/src/services/LiveActivityService";
import { useAppState } from "@/src/contexts/AppStateContext";

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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasHandledTimerCompleteRef = useRef(false); // Track if we've already handled timer completion
  // Keep the latest callbacks in a ref so effects don't depend on their
  // (unstable) identity and tear down the interval on every render.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

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
        callbacksRef.current.onTimerComplete();

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
      const newEndTime = computeEndTime(timeLeft);
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

    // Persist the reset state explicitly. saveCurrentState() reads timeLeft and
    // endTime from this render's closure (the setters above haven't applied
    // yet), so it would save the pre-reset timeLeft — which a foreground reload
    // then restores, making "reset" appear to do nothing.
    await TimerStorage.saveTimerState({
      endTime: undefined,
      timerDuration,
      paused: true,
      timeLeft: timerDuration,
    });
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

  // Timer countdown effect. Recomputes timeLeft from the absolute endTime each
  // second. It does NOT persist per tick: while running, timeLeft is derived
  // from endTime on load, so the save effect below only fires on meaningful
  // state changes.
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!paused && endTime && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        const newTimeLeft = calculateTimeLeft(endTime);
        setTimeLeft(newTimeLeft);

        // Call optional time update callback
        callbacksRef.current.onTimeUpdate?.(newTimeLeft);

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
  }, [paused, endTime]);

  // Handle timer completion
  useEffect(() => {
    if (
      timeLeft === 0 &&
      !paused &&
      endTime &&
      !hasHandledTimerCompleteRef.current
    ) {
      hasHandledTimerCompleteRef.current = true;
      callbacksRef.current.onTimerComplete();
      resetTimer();
    }
  }, [timeLeft, paused, endTime]);

  // Persist on meaningful state changes only (start/resume/pause/reset/duration).
  // timeLeft is intentionally excluded: it ticks every second while running but
  // is recomputed from endTime on load, so persisting per tick would hammer
  // AsyncStorage for no benefit. Pausing flips paused/endTime, so the frozen
  // timeLeft is still captured here.
  useEffect(() => {
    if (!isLoading) {
      saveCurrentState();
    }
  }, [endTime, timerDuration, paused, isLoading]);

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
