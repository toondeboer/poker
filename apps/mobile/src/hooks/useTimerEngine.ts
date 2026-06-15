// src/hooks/useTimerEngine.ts
import { logger } from "@/src/utils/logger";
import { useEffect, useRef, useState } from "react";
import {
  BlindLevel,
  createTimerState,
  hydrateTimerState,
  startTimer,
  pauseTimer,
  resetTimer as resetTimerState,
  tickTimer,
  isExpired,
  withDuration,
  clampToDuration,
  type TimerMachineState,
} from "@poker/core";
import { useTimerPersistence } from "@/src/hooks/useTimerPersistence";
import { useLiveActivitySync } from "@/src/hooks/useLiveActivitySync";

export interface TimerEngineCallbacks {
  onTimerComplete: () => void;
  onTimeUpdate?: (timeLeft: number) => void;
}

/**
 * Mobile countdown engine. A thin adapter over the shared `@poker/core` timer
 * state machine — all start/pause/reset/tick/hydrate transitions come from core.
 * Persistence (`useTimerPersistence`) and native sync (`useLiveActivitySync`)
 * live in their own hooks; this engine owns only the state machine, the tick
 * interval, and mobile's stop-and-acknowledge expiry policy.
 */
export function useTimerEngine(
  currentBlindLevel: number,
  blindLevels: BlindLevel[],
  callbacks: TimerEngineCallbacks,
) {
  const [state, setState] = useState<TimerMachineState>(createTimerState);
  const [isLoading, setIsLoading] = useState(true);
  const { timerDuration, endTime, timeLeft, paused } = state;

  // Side effects: persistence I/O + native (Live Activity) sync.
  const { load, save } = useTimerPersistence(state, isLoading);
  useLiveActivitySync(state, currentBlindLevel, blindLevels, isLoading);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasHandledTimerCompleteRef = useRef(false); // Track if we've already handled timer completion
  // Keep the latest callbacks in a ref so effects don't depend on their
  // (unstable) identity and tear down the interval on every render.
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  // Load timer state from storage
  const loadTimerState = async (): Promise<void> => {
    try {
      const savedState = await load();
      const { state: hydrated, expired } = hydrateTimerState(savedState);

      if (expired && !hasHandledTimerCompleteRef.current) {
        // Timer expired while app was closed. hydrate already produced reset
        // state; fire the completion callback (mobile's reopen-to-expired nudge).
        hasHandledTimerCompleteRef.current = true;
        callbacksRef.current.onTimerComplete();
        setState(hydrated);
      } else {
        // Restore normal state and clear the completion flag.
        setState(hydrated);
        hasHandledTimerCompleteRef.current = false;
      }
    } catch (error) {
      logger.error("Failed to load timer state:", error);
      // Use default values on error
      setState(createTimerState());
      hasHandledTimerCompleteRef.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle pause/resume
  const togglePause = async (): Promise<void> => {
    if (!paused) {
      logger.log("Pausing timer at time left:", timeLeft);
      setState((s) => pauseTimer(s));
    } else {
      logger.log("Resuming timer with time left:", timeLeft);
      setState((s) => startTimer(s));
      // Reset completion flag when starting timer
      hasHandledTimerCompleteRef.current = false;
    }
  };

  // Reset timer
  const resetTimer = async (): Promise<void> => {
    setState((s) => resetTimerState(s));
    hasHandledTimerCompleteRef.current = false;

    // Persist the reset state explicitly. The auto-save effect reads from the
    // post-commit state, but the setState above hasn't applied yet, so saving
    // here keeps the pre-reset timeLeft from being re-persisted — which a
    // foreground reload would otherwise restore, making "reset" appear to do
    // nothing.
    await save({
      endTime: undefined,
      timerDuration,
      paused: true,
      timeLeft: timerDuration,
    });
  };

  // Set timer duration
  const handleSetTimerDuration = async (duration: number): Promise<void> => {
    logger.log("Setting timer duration:", duration);
    // Core withDuration re-syncs timeLeft only when truly reset (paused, no
    // endTime); a running/anchored timer keeps its remaining time.
    setState((s) => withDuration(s, duration));
  };

  // Timer countdown effect. Recomputes timeLeft from the absolute endTime each
  // second. It does NOT persist per tick: while running, timeLeft is derived
  // from endTime on load, so persistence only fires on meaningful state changes.
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!paused && endTime && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setState((s) => {
          const ticked = tickTimer(s);
          callbacksRef.current.onTimeUpdate?.(ticked.timeLeft);
          if (isExpired(ticked)) {
            clearInterval(intervalRef.current!);
          }
          return ticked;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [paused, endTime]);

  // Handle timer completion. Mobile's policy: stop and wait for player
  // acknowledgement (fire the callback, then reset).
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

  useEffect(() => {
    // Clamp a previously-persisted timeLeft down to a newly-lowered duration.
    // This reconciles state in response to a timerDuration change, so the
    // synchronous setState here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => clampToDuration(s));
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
