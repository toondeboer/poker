import { DEFAULT_TIMER_DURATION } from "../constants";
import { calculateTimeLeft, computeEndTime } from "../time/timerMath";
import { TimerState } from "../storage/timerStorage";

/**
 * Shared, framework-agnostic timer state machine.
 *
 * Both the web (`useWebTimer`) and mobile (`useTimerEngine`) hooks adapt this
 * one machine, so the start/pause/reset/tick/hydrate logic can't drift between
 * platforms. The transitions are pure — they take a state (and an optional
 * `now` for testability) and return the next state. React effects, persistence,
 * side-effect callbacks, and the few genuine platform policy decisions (expiry
 * behavior, duration-change behavior) stay in each hook.
 */
export interface TimerMachineState {
  /** Round length in seconds. */
  timerDuration: number;
  /** Absolute expiry instant (ms epoch) while running; `undefined` when paused. */
  endTime?: number;
  /** Seconds remaining in the current round. */
  timeLeft: number;
  paused: boolean;
}

/** Fresh, paused state for a round of `duration` seconds. */
export function createTimerState(
  duration: number = DEFAULT_TIMER_DURATION,
): TimerMachineState {
  return {
    timerDuration: duration,
    endTime: undefined,
    timeLeft: duration,
    paused: true,
  };
}

/**
 * Start or resume: anchor an absolute `endTime` from the remaining time (falling
 * back to a full round if nothing is left) and run. `timeLeft` is set to the same
 * `seconds` value immediately, not left for {@link tickTimer} to recompute a second
 * later — resuming from an expired (`timeLeft === 0`) state falls back to a full
 * `timerDuration` in `endTime`, but if `timeLeft` were left at 0 in the interim, the
 * very next render would see `timeLeft === 0 && !paused && endTime`, which callers'
 * completion-detection effects read as "just expired" and immediately reset the
 * timer that was only just started.
 */
export function startTimer(
  state: TimerMachineState,
  now: number = Date.now(),
): TimerMachineState {
  const seconds = state.timeLeft > 0 ? state.timeLeft : state.timerDuration;
  return {
    ...state,
    timeLeft: seconds,
    endTime: computeEndTime(seconds, now),
    paused: false,
  };
}

/** Pause: drop the anchor (freezing the current `timeLeft`) and mark paused. */
export function pauseTimer(state: TimerMachineState): TimerMachineState {
  return { ...state, endTime: undefined, paused: true };
}

/** Reset to a fresh, paused round of `timerDuration` seconds. */
export function resetTimer(state: TimerMachineState): TimerMachineState {
  return {
    ...state,
    endTime: undefined,
    timeLeft: state.timerDuration,
    paused: true,
  };
}

/** Recompute `timeLeft` from the absolute `endTime`. No-op when not running. */
export function tickTimer(
  state: TimerMachineState,
  now: number = Date.now(),
): TimerMachineState {
  if (state.endTime === undefined) return state;
  return { ...state, timeLeft: calculateTimeLeft(state.endTime, now) };
}

/**
 * Auto-advance into the next round, staying in whatever run state we were in.
 * Web's expiry policy: reaching zero rolls straight into a full round.
 */
export function advanceRound(
  state: TimerMachineState,
  now: number = Date.now(),
): TimerMachineState {
  return {
    ...state,
    timeLeft: state.timerDuration,
    endTime: computeEndTime(state.timerDuration, now),
  };
}

/** True once the round has run down to zero. */
export function isExpired(state: TimerMachineState): boolean {
  return state.timeLeft === 0;
}

/**
 * Change the round length. Mobile's conservative policy: only re-sync `timeLeft`
 * to the new duration when the timer is truly reset (paused with no anchor),
 * leaving a running or mid-round-paused timer's remaining time untouched.
 */
export function withDuration(
  state: TimerMachineState,
  duration: number,
): TimerMachineState {
  if (state.paused && state.endTime === undefined) {
    return { ...state, timerDuration: duration, timeLeft: duration };
  }
  return { ...state, timerDuration: duration };
}

/**
 * Reconcile a previously-persisted `timeLeft` that exceeds a newly-lowered
 * duration down to the duration (only meaningful in a truly reset state).
 */
export function clampToDuration(state: TimerMachineState): TimerMachineState {
  if (
    state.paused &&
    state.endTime === undefined &&
    state.timeLeft > state.timerDuration
  ) {
    return { ...state, timeLeft: state.timerDuration };
  }
  return state;
}

export interface HydratedTimerState {
  state: TimerMachineState;
  /** The stored round had already run out by `now`. */
  expired: boolean;
  /**
   * How many *further* whole rounds would have run out since that first expiry,
   * had anything been counting them. Zero unless `expired`.
   *
   * Nothing advances rounds while the app isn't running — mobile suspends its
   * JS the moment it's backgrounded, and neither the Live Activity nor the
   * foreground-service notification knows what a blind level is — so exactly one
   * level advances on the way back in, no matter how long the app was away. This
   * is what lets the caller *say* that rather than presenting a 40-minute
   * absence as an ordinary round change: it's the count the player is owed an
   * explanation for, not a count to advance by.
   */
  missedRounds: number;
}

/**
 * Rebuild machine state from persisted {@link TimerState}. When the timer was
 * running, `timeLeft` is recomputed from the stored `endTime`; if that has
 * already elapsed, the returned state is reset and `expired` is `true` so the
 * caller can apply its own expiry policy (mobile fires its completion callback;
 * web ignores the flag and silently resets).
 */
export function hydrateTimerState(
  stored: TimerState,
  now: number = Date.now(),
): HydratedTimerState {
  const { timerDuration } = stored;

  if (stored.endTime && !stored.paused) {
    const left = calculateTimeLeft(stored.endTime, now);
    if (left > 0) {
      return {
        state: {
          timerDuration,
          endTime: stored.endTime,
          timeLeft: left,
          paused: false,
        },
        expired: false,
        missedRounds: 0,
      };
    }
    // Guarded against a zero/negative duration, which would otherwise divide to
    // Infinity and report an absurd number of missed rounds.
    const missedRounds =
      timerDuration > 0
        ? Math.floor((now - stored.endTime) / (timerDuration * 1000))
        : 0;
    return {
      state: {
        timerDuration,
        endTime: undefined,
        timeLeft: timerDuration,
        paused: true,
      },
      expired: true,
      missedRounds,
    };
  }

  return {
    state: {
      timerDuration,
      endTime: stored.endTime,
      timeLeft: stored.timeLeft || timerDuration,
      paused: stored.paused,
    },
    expired: false,
    missedRounds: 0,
  };
}
