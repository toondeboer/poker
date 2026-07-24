// src/hooks/useLiveActivitySync.ts
import { useEffect } from "react";
import type { BlindLevel, SoundPackId, TimerMachineState } from "@poker/core";
import { logger } from "@/src/utils/logger";
import { liveActivityService } from "@/src/services/LiveActivityService";
import { useAppState } from "@/src/contexts/AppStateContext";

/**
 * Mirrors timer + blind state into the iOS Live Activity / Android foreground
 * service. Pure native-sync side effect: it pushes the current state to the
 * platform and asks it to alert on expiry only while the app is backgrounded.
 */
export function useLiveActivitySync(
  state: TimerMachineState,
  currentBlindLevel: number,
  blindLevels: BlindLevel[],
  isLoading: boolean,
  soundPackId: SoundPackId,
) {
  const { endTime, timeLeft, paused, timerDuration } = state;
  const { isActive } = useAppState();

  useEffect(() => {
    if (isLoading) return;

    logger.log(
      isActive
        ? "App is active, updating Live Activity"
        : "App is in background, updating Live Activity with alert on expiry",
    );

    liveActivityService.startOrUpdateActivity(
      {
        endTime,
        timeLeft,
        paused,
        timerDuration,
        currentBlindLevel: currentBlindLevel + 1, // Display as 1-based index
        currentSmallBlind: blindLevels[currentBlindLevel]?.small || 0,
        currentBigBlind: blindLevels[currentBlindLevel]?.big || 0,
        nextSmallBlind: blindLevels[currentBlindLevel + 1]?.small || 0,
        nextBigBlind: blindLevels[currentBlindLevel + 1]?.big || 0,
      },
      !isActive, // shouldAlertOnExpiry — only when backgrounded
      soundPackId,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    endTime,
    paused,
    timerDuration,
    currentBlindLevel,
    blindLevels,
    isLoading,
    isActive,
    soundPackId,
  ]);
}
