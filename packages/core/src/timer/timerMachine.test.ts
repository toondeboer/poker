import { describe, it, expect } from "vitest";
import {
  advanceRound,
  clampToDuration,
  createTimerState,
  hydrateTimerState,
  isExpired,
  pauseTimer,
  resetTimer,
  startTimer,
  tickTimer,
  withDuration,
  TimerMachineState,
} from "./timerMachine";

const NOW = 1_000_000;

describe("createTimerState", () => {
  it("is a fresh, paused round of the given duration", () => {
    expect(createTimerState(120)).toEqual({
      timerDuration: 120,
      endTime: undefined,
      timeLeft: 120,
      paused: true,
    });
  });

  it("defaults to DEFAULT_TIMER_DURATION (600)", () => {
    expect(createTimerState().timerDuration).toBe(600);
  });
});

describe("startTimer", () => {
  it("anchors endTime from the remaining time and runs", () => {
    const state = createTimerState(120);
    const next = startTimer(state, NOW);
    expect(next.paused).toBe(false);
    expect(next.endTime).toBe(NOW + 120_000);
    expect(next.timeLeft).toBe(120);
  });

  it("resumes from a partially-elapsed round without resetting timeLeft", () => {
    const state: TimerMachineState = {
      timerDuration: 120,
      endTime: undefined,
      timeLeft: 45,
      paused: true,
    };
    const next = startTimer(state, NOW);
    expect(next.endTime).toBe(NOW + 45_000);
    expect(next.timeLeft).toBe(45);
  });

  it("falls back to a full round when nothing is left, syncing timeLeft too", () => {
    const state: TimerMachineState = {
      timerDuration: 120,
      endTime: undefined,
      timeLeft: 0,
      paused: true,
    };
    const next = startTimer(state, NOW);
    expect(next.endTime).toBe(NOW + 120_000);
    // Regression: timeLeft must be set in the same update as endTime/paused, not left at 0 for
    // tickTimer to recompute a second later — a transient timeLeft === 0 with paused === false
    // reads as "just expired" to callers' completion-detection effects, which would immediately
    // reset the timer that was only just resumed.
    expect(next.timeLeft).toBe(120);
  });
});

describe("pauseTimer", () => {
  it("drops the anchor and marks paused, freezing timeLeft", () => {
    const running = startTimer(createTimerState(120), NOW);
    const ticked = tickTimer(running, NOW + 30_000); // 90s left
    const paused = pauseTimer(ticked);
    expect(paused).toEqual({
      timerDuration: 120,
      endTime: undefined,
      timeLeft: 90,
      paused: true,
    });
  });
});

describe("resetTimer", () => {
  it("returns a fresh paused round of timerDuration", () => {
    const running = startTimer(createTimerState(120), NOW);
    expect(resetTimer(running)).toEqual({
      timerDuration: 120,
      endTime: undefined,
      timeLeft: 120,
      paused: true,
    });
  });
});

describe("tickTimer", () => {
  it("recomputes timeLeft from endTime mid-round", () => {
    const running = startTimer(createTimerState(120), NOW);
    expect(tickTimer(running, NOW + 30_000).timeLeft).toBe(90);
  });

  it("reaches zero at expiry", () => {
    const running = startTimer(createTimerState(120), NOW);
    expect(tickTimer(running, NOW + 120_000).timeLeft).toBe(0);
  });

  it("is a no-op when not running (no endTime)", () => {
    const state = createTimerState(120);
    expect(tickTimer(state, NOW)).toBe(state);
  });
});

describe("advanceRound", () => {
  it("rolls into a full new round, staying running", () => {
    const expired: TimerMachineState = {
      timerDuration: 120,
      endTime: NOW,
      timeLeft: 0,
      paused: false,
    };
    const next = advanceRound(expired, NOW);
    expect(next).toEqual({
      timerDuration: 120,
      endTime: NOW + 120_000,
      timeLeft: 120,
      paused: false,
    });
  });
});

describe("isExpired", () => {
  it("is true only at zero", () => {
    expect(isExpired({ ...createTimerState(120), timeLeft: 0 })).toBe(true);
    expect(isExpired({ ...createTimerState(120), timeLeft: 1 })).toBe(false);
  });
});

describe("withDuration", () => {
  it("re-syncs timeLeft when the timer is truly reset (paused, no anchor)", () => {
    const next = withDuration(createTimerState(120), 300);
    expect(next).toEqual({
      timerDuration: 300,
      endTime: undefined,
      timeLeft: 300,
      paused: true,
    });
  });

  it("leaves a running timer's timeLeft untouched", () => {
    const running = startTimer(createTimerState(120), NOW);
    const next = withDuration(running, 300);
    expect(next.timerDuration).toBe(300);
    expect(next.timeLeft).toBe(running.timeLeft);
    expect(next.endTime).toBe(running.endTime);
  });

  it("re-syncs a paused timer (pause clears the anchor, so it counts as reset)", () => {
    const paused: TimerMachineState = {
      timerDuration: 120,
      endTime: undefined,
      timeLeft: 45,
      paused: true,
    };
    expect(withDuration(paused, 300).timeLeft).toBe(300);
  });
});

describe("clampToDuration", () => {
  it("clamps a stale higher timeLeft down to a lowered duration when reset", () => {
    const state: TimerMachineState = {
      timerDuration: 60,
      endTime: undefined,
      timeLeft: 120,
      paused: true,
    };
    expect(clampToDuration(state).timeLeft).toBe(60);
  });

  it("leaves timeLeft below the duration alone", () => {
    const state: TimerMachineState = {
      timerDuration: 120,
      endTime: undefined,
      timeLeft: 45,
      paused: true,
    };
    expect(clampToDuration(state)).toBe(state);
  });

  it("does nothing while running", () => {
    const running: TimerMachineState = {
      timerDuration: 60,
      endTime: NOW,
      timeLeft: 120,
      paused: false,
    };
    expect(clampToDuration(running)).toBe(running);
  });
});

describe("hydrateTimerState", () => {
  it("restores a running timer with recomputed timeLeft", () => {
    const result = hydrateTimerState(
      { endTime: NOW + 120_000, timerDuration: 120, paused: false, timeLeft: 0 },
      NOW,
    );
    expect(result).toEqual({
      state: {
        timerDuration: 120,
        endTime: NOW + 120_000,
        timeLeft: 120,
        paused: false,
      },
      expired: false,
    });
  });

  it("flags an expired running timer and returns reset state", () => {
    const result = hydrateTimerState(
      { endTime: NOW, timerDuration: 120, paused: false, timeLeft: 0 },
      NOW + 5_000,
    );
    expect(result).toEqual({
      state: {
        timerDuration: 120,
        endTime: undefined,
        timeLeft: 120,
        paused: true,
      },
      expired: true,
    });
  });

  it("restores a paused timer with its stored timeLeft", () => {
    const result = hydrateTimerState(
      { endTime: undefined, timerDuration: 120, paused: true, timeLeft: 45 },
      NOW,
    );
    expect(result).toEqual({
      state: {
        timerDuration: 120,
        endTime: undefined,
        timeLeft: 45,
        paused: true,
      },
      expired: false,
    });
  });

  it("falls back to timerDuration when a paused timer has no stored timeLeft", () => {
    const result = hydrateTimerState(
      { endTime: undefined, timerDuration: 120, paused: true, timeLeft: 0 },
      NOW,
    );
    expect(result.state.timeLeft).toBe(120);
    expect(result.expired).toBe(false);
  });
});
