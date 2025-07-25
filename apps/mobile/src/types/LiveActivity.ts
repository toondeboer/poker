export interface PokerTimerState {
  tournamentName: string;
  currentBlindLevel: number;
  currentSmallBlind: number;
  currentBigBlind: number;
  nextSmallBlind: number;
  nextBigBlind: number;
  endTime: number;
  isBreak: boolean;
  breakName?: string;
}
