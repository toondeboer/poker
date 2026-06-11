import { useCallback, useEffect, useRef, useState } from "react";
import {
  createTimerStorage,
  createTimerState,
  hydrateTimerState,
  startTimer,
  pauseTimer,
  resetTimer as resetTimerState,
  tickTimer,
  advanceRound,
  isExpired,
  withDuration,
  type TimerMachineState,
} from "@poker/core";
import { localStorageAdapter } from "@/lib/storageAdapter";

const timerStorage = createTimerStorage(localStorageAdapter);

interface UseWebTimerOptions {
  /** Called once each time the round reaches zero (before auto-advancing). */
  onExpire: () => void;
}

/**
 * Countdown engine for the web timer. A thin adapter over the shared
 * `@poker/core` timer state machine: it owns the React effects (interval,
 * persistence, restore) while all state transitions come from core. Derives
 * time left from an absolute `endTime` (robust against tab throttling),
 * auto-advances to the next round on expiry, and persists to localStorage so a
 * reload restores the timer.
 */
export function useWebTimer({ onExpire }: UseWebTimerOptions) {
  const [state, setState] = useState<TimerMachineState>(createTimerState);
  const [isLoading, setIsLoading] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  // Mirror the latest state so the interval tick can read it without being
  // torn down and rebuilt every render.
  const stateRef = useRef(state);

  useEffect(() => {
    onExpireRef.current = onExpire;
    stateRef.current = state;
  });

  // Restore persisted timer state on mount. Web ignores the `expired` flag and
  // silently resets (no onExpire on load).
  useEffect(() => {
    let active = true;
    timerStorage.loadTimerState().then((saved) => {
      if (!active) return;
      setState(hydrateTimerState(saved).state);
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
      endTime: state.endTime,
      timerDuration: state.timerDuration,
      paused: state.paused,
      timeLeft: state.timeLeft,
    });
  }, [state, isLoading]);

  // Countdown loop: recompute from endTime; on expiry advance to next round.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!state.paused && state.endTime !== undefined) {
      intervalRef.current = setInterval(() => {
        const ticked = tickTimer(stateRef.current);
        if (!isExpired(ticked)) {
          setState(ticked);
          return;
        }
        if (intervalRef.current) clearInterval(intervalRef.current);
        onExpireRef.current();
        // Auto-advance into the next round and keep running.
        setState((s) => advanceRound(s));
      }, 250);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.paused, state.endTime]);

  const start = useCallback(() => setState((s) => startTimer(s)), []);
  const pause = useCallback(() => setState((s) => pauseTimer(s)), []);
  const reset = useCallback(() => setState((s) => resetTimerState(s)), []);

  const toggle = useCallback(() => {
    if (stateRef.current.paused) start();
    else pause();
  }, [start, pause]);

  const changeDuration = useCallback((seconds: number) => {
    // Full reset to the new duration.
    setState((s) => resetTimerState(withDuration(s, seconds)));
  }, []);

  return {
    timerDuration: state.timerDuration,
    timeLeft: state.timeLeft,
    isRunning: !state.paused,
    isLoading,
    start,
    pause,
    toggle,
    reset,
    changeDuration,
  };
}
