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
  calculateTimeLeft,
  type SoundPackId,
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
  soundPackId: SoundPackId,
  callbacks: TimerEngineCallbacks,
) {
  const [state, setState] = useState<TimerMachineState>(createTimerState);
  const [isLoading, setIsLoading] = useState(true);
  const { timerDuration, endTime, timeLeft, paused } = state;

  // Side effects: persistence I/O + native (Live Activity) sync.
  const { load, save } = useTimerPersistence(state, isLoading);
  useLiveActivitySync(
    state,
    currentBlindLevel,
    blindLevels,
    isLoading,
    soundPackId,
  );

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

  // Absolute pause/resume — unlike togglePause, these don't assume the current `paused` value,
  // which matters for a native-triggered action (notification/Live-Activity button) racing
  // against in-app state: an unconditional toggle could flip the wrong way if they land at
  // nearly the same time.
  //
  // Both accept an optional exact override, used when reconciling a native-originated
  // pause/resume: the native side (foreground service / Live Activity) is the authoritative
  // source for *when* it actually paused/resumed, since JS may not have been running at that
  // moment at all. Applying pauseTimer/startTimer to whatever JS's own (possibly long-stale)
  // state currently is would silently re-derive the wrong instant — e.g. a pause reconciled this
  // way would freeze at "now" instead of freezing at the moment the button was actually tapped,
  // since core's `pauseTimer` just keeps whatever `timeLeft` the current state happens to have.
  const pause = async (timeLeftOverride?: number): Promise<void> => {
    logger.log("Pausing timer at time left:", timeLeftOverride ?? timeLeft);
    setState((s) => {
      const next = pauseTimer(s);
      return timeLeftOverride !== undefined
        ? { ...next, timeLeft: timeLeftOverride }
        : next;
    });
  };

  const resume = async (endTimeOverride?: number): Promise<void> => {
    logger.log("Resuming timer with endTime override:", endTimeOverride);
    setState((s) =>
      endTimeOverride !== undefined
        ? {
            // Recompute timeLeft from the override endTime in the same update, rather than
            // leaving whatever (possibly 0, if reconciling a native resume-from-expired) timeLeft
            // the state already had — same failure mode as core's startTimer: a transient
            // timeLeft === 0 with paused === false reads as "just expired" to the completion
            // effect below and immediately resets the timer that was only just resumed.
            ...s,
            endTime: endTimeOverride,
            timeLeft: calculateTimeLeft(endTimeOverride),
            paused: false,
          }
        : startTimer(s),
    );
    // Reset completion flag when starting timer
    hasHandledTimerCompleteRef.current = false;
  };

  // Toggle pause/resume
  const togglePause = async (): Promise<void> => {
    if (!paused) {
      await pause();
    } else {
      await resume();
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
    pause,
    resume,
    resetTimer,
    isLoading,
    loadTimerState,
  };
}
