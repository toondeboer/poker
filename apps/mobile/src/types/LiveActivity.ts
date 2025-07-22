// types/LiveActivity.ts
export interface PokerTimerAttributes {
  tournamentName: string;
}

export interface PokerTimerState {
  currentBlindLevel: number;
  currentSmallBlind: number;
  currentBigBlind: number;
  nextSmallBlind: number;
  nextBigBlind: number;
  endTime: number;
  isBreak: boolean;
  breakName?: string;
}
