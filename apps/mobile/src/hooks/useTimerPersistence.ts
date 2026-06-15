// src/hooks/useTimerPersistence.ts
import { useCallback, useEffect } from "react";
import type { TimerMachineState } from "@poker/core";
import { TimerState, TimerStorage } from "@/src/services/TimerStorage";

/**
 * Owns timer-state persistence: the AsyncStorage I/O and the auto-save effect.
 * The engine decides *what* the state is; this hook only reads and writes it.
 */
export function useTimerPersistence(
  state: TimerMachineState,
  isLoading: boolean,
) {
  const { endTime, timerDuration, paused, timeLeft } = state;

  // Persist on meaningful state changes only (start/resume/pause/reset/duration).
  // timeLeft is intentionally excluded from the deps: it ticks every second
  // while running but is recomputed from endTime on load, so persisting per tick
  // would hammer AsyncStorage for no benefit. Pausing flips paused/endTime, so
  // the frozen timeLeft is still captured here.
  useEffect(() => {
    if (!isLoading) {
      TimerStorage.saveTimerState({ endTime, timerDuration, paused, timeLeft });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endTime, timerDuration, paused, isLoading]);

  /** Read the raw persisted state; hydration/interpretation belongs to the engine. */
  const load = useCallback(() => TimerStorage.loadTimerState(), []);

  /** Persist an explicit state snapshot (used by reset, which can't wait for the effect). */
  const save = useCallback(
    (next: TimerState) => TimerStorage.saveTimerState(next),
    [],
  );

  return { load, save };
}
