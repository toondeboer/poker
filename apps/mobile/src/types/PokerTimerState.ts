// src/types/PokerTimerState.ts
export interface PokerTimerState {
  tournamentName?: string;
  currentBlindLevel: number;
  currentSmallBlind: number;
  currentBigBlind: number;
  nextSmallBlind: number;
  nextBigBlind: number;
  endTime?: number; // Unix timestamp in milliseconds (JS format)
  timeLeft?: number; // How many seconds the timer should run
  paused: boolean;
}
