import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_TIMER_DURATION,
  calculateTimeLeft,
  computeEndTime,
  createTimerStorage,
} from "@poker/core";
import { localStorageAdapter } from "@/lib/storageAdapter";

const timerStorage = createTimerStorage(localStorageAdapter);

interface UseWebTimerOptions {
  /** Called once each time the round reaches zero (before auto-advancing). */
  onExpire: () => void;
}

/**
 * Countdown engine for the web timer. Derives time left from an absolute
 * `endTime` (robust against tab throttling), auto-advances to the next round on
 * expiry, and persists state to localStorage so a reload restores the timer.
 */
export function useWebTimer({ onExpire }: UseWebTimerOptions) {
  const [timerDuration, setTimerDuration] = useState(DEFAULT_TIMER_DURATION);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMER_DURATION);
  const [endTime, setEndTime] = useState<number | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const durationRef = useRef(timerDuration);
  durationRef.current = timerDuration;
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;

  // Restore persisted timer state on mount.
  useEffect(() => {
    let active = true;
    timerStorage.loadTimerState().then((saved) => {
      if (!active) return;
      setTimerDuration(saved.timerDuration);
      if (saved.endTime && !saved.paused) {
        const left = calculateTimeLeft(saved.endTime);
        if (left > 0) {
          setEndTime(saved.endTime);
          setTimeLeft(left);
          setIsRunning(true);
        } else {
          setTimeLeft(saved.timerDuration);
        }
      } else {
        setTimeLeft(saved.timeLeft || saved.timerDuration);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist whenever timer state changes.
  useEffect(() => {
    if (isLoading) return;
    timerStorage.saveTimerState({
      endTime,
      timerDuration,
      paused: !isRunning,
      timeLeft,
    });
  }, [endTime, timerDuration, timeLeft, isRunning, isLoading]);

  // Countdown loop: recompute from endTime; on expiry advance to next round.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isRunning && endTime !== undefined) {
      intervalRef.current = setInterval(() => {
        const left = calculateTimeLeft(endTime);
        if (left > 0) {
          setTimeLeft(left);
          return;
        }
        if (intervalRef.current) clearInterval(intervalRef.current);
        onExpireRef.current();
        // Auto-advance into the next round and keep running.
        const duration = durationRef.current;
        setTimeLeft(duration);
        setEndTime(computeEndTime(duration));
      }, 250);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, endTime]);

  const start = useCallback(() => {
    const seconds =
      timeLeftRef.current > 0 ? timeLeftRef.current : durationRef.current;
    setEndTime(computeEndTime(seconds));
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
    setEndTime(undefined); // freeze remaining time
  }, []);

  const toggle = useCallback(() => {
    if (isRunning) pause();
    else start();
  }, [isRunning, pause, start]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setEndTime(undefined);
    setTimeLeft(durationRef.current);
  }, []);

  const changeDuration = useCallback((seconds: number) => {
    setTimerDuration(seconds);
    setIsRunning(false);
    setEndTime(undefined);
    setTimeLeft(seconds);
  }, []);

  return {
    timerDuration,
    timeLeft,
    isRunning,
    isLoading,
    start,
    pause,
    toggle,
    reset,
    changeDuration,
  };
}
