export interface PokerTimerState {
  tournamentName?: string;
  currentBlindLevel: number;
  currentSmallBlind: number;
  currentBigBlind: number;
  nextSmallBlind: number;
  nextBigBlind: number;
  endTime?: number; // Unix timestamp in milliseconds (JS format)
  timeLeft?: number; // How many seconds the timer should run
  // Total configured round length in seconds. Lets native pause/resume actions recompute a
  // fresh endTime on resume without a JS round-trip, mirroring the timer state machine's own
  // expired-timer fallback (see `startTimer` in timerMachine.ts).
  timerDuration?: number;
  paused: boolean;
}
