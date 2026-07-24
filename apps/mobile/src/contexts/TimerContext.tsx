// src/contexts/TimerContext.tsx
import { logger } from "@/src/utils/logger";
import React, {
  createContext,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { DEFAULT_SOUND_PACK_ID } from "@poker/core";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { useTimerNotification } from "@/src/hooks/useTimerNotification";
import { useTimerEngine } from "@/src/hooks/useTimerEngine";
import { useNativeTimerActionSync } from "@/src/hooks/useNativeTimerActionSync";
import { useTimerAlert } from "@/src/hooks/useTimerAlert";
import { useSoundPack } from "@/src/contexts/SoundPackContext";
import { useNotificationPermission } from "@/src/hooks/useNotificationPermission";
import { usePremium } from "@/src/contexts/PremiumContext";
import { liveActivityService } from "@/src/services/LiveActivityService";
import { recordRoundPlayed } from "@/src/services/reviewService";
import { useAppState } from "./AppStateContext";

type TimerContextType = {
  endTime?: number;
  timeLeft: number;
  timerDuration: number;
  setTimerDuration: (duration: number) => void;
  paused: boolean;
  togglePause: () => void;
  resetTimer: () => void;
  isLoading: boolean;
  // Alert state
  showTimerAlert: boolean;
  dismissTimerAlert: () => void;
  handleNextBlinds: () => void;
  // Permission state
  hasNotificationPermission: boolean | null;
  requestNotificationPermission: () => Promise<boolean>;
  showPermissionAlert: () => void;
  // Background activity state
  isBackgroundActivitySupported: boolean;
};

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { increaseBlinds, currentBlindIndex, blindLevels } = useBlinds();
  const { scheduleNotification, cancelNotification } = useTimerNotification();
  const { isActive, isBackground, isInactive } = useAppState();

  // Sound pack selection is a Pro feature — non-Pro users always get the
  // free default, regardless of what's persisted from a lapsed Pro session.
  const { isPremium } = usePremium();
  const { soundPackId } = useSoundPack();
  const effectiveSoundPackId = isPremium ? soundPackId : DEFAULT_SOUND_PACK_ID;

  // Expiry alert + alarm sound (own concern; see useTimerAlert).
  const { showTimerAlert, isAlarmLoaded, showAlert, clearAlert } =
    useTimerAlert(effectiveSoundPackId);

  const [isBackgroundActivitySupported, setIsBackgroundActivitySupported] =
    useState(false);

  // Permission handling
  const {
    hasPermission: hasNotificationPermission,
    requestPermission: requestNotificationPermission,
    showPermissionAlert,
  } = useNotificationPermission();

  // Handle timer completion
  const handleTimerComplete = async () => {
    try {
      // Only play sound and show alert if app is active (in foreground)
      if (isActive && isAlarmLoaded) {
        await showAlert(true);
        logger.log("Timer completed - showing alert and playing alarm");
      } else {
        logger.log(
          "App in background, skipping alarm sound and alert (background service will handle audio)",
        );
        // Auto-advance if in background
        increaseBlinds();
      }
    } catch (error) {
      logger.error("Failed to play completion sound:", error);
      // Still show alert even if sound fails
      if (isActive) {
        await showAlert(false);
      }
    } finally {
      // A blind level just ran out = one round played. Count it and, once
      // enough rounds are in, ask for a review. Foreground only (isActive) —
      // the OS won't show the sheet while backgrounded. Gated + throttled in
      // @poker/core.
      void recordRoundPlayed(isActive);
    }
  };

  const handleNotificationScheduling = async (
    paused: boolean,
    timeLeft: number,
  ) => {
    // Only handle notifications for iOS
    if (Platform.OS !== "ios") {
      logger.log(
        "Skipping notification scheduling on Android - handled by foreground service",
      );
      return;
    }

    if (paused) {
      await cancelNotification();
    } else {
      const nextBlindLevel = blindLevels[currentBlindIndex + 1];
      await scheduleNotification(timeLeft, nextBlindLevel, effectiveSoundPackId);
    }
  };

  // Use the timer engine
  const {
    timerDuration,
    setTimerDuration,
    endTime,
    timeLeft,
    paused,
    togglePause: engineTogglePause,
    pause: enginePause,
    resume: engineResume,
    resetTimer: engineResetTimer,
    isLoading,
    loadTimerState,
  } = useTimerEngine(currentBlindIndex, blindLevels, effectiveSoundPackId, {
    onTimerComplete: handleTimerComplete,
  });

  // Enhanced toggle pause with notification handling
  const togglePause = async () => {
    const newPaused = !paused; // Calculate before state change
    await engineTogglePause();
    // Handle notifications after pause state changes (iOS only)
    await handleNotificationScheduling(newPaused, timeLeft);
  };

  // Enhanced reset timer with notification handling
  const resetTimer = async () => {
    await engineResetTimer();
    // Only cancel notifications on iOS
    if (Platform.OS === "ios") {
      await cancelNotification();
    }
    // End background activity when timer is reset
    await liveActivityService.endActivity();
    // Dismiss alert and stop sound if active
    await clearAlert();
  };

  // Apply a pause/resume/stop action that originated from the Android foreground-service
  // notification or the iOS Live Activity/Dynamic Island, rather than the in-app UI. Uses the
  // absolute pause()/resume() (not togglePause) since these arrive out-of-band and must not
  // risk flipping the wrong way if they race against an in-app state change. Shared by both the
  // live-event fast path (below) and the sequenced persisted-flag reconciliation
  // (`reconcileNativeAction`).
  const applyNativeAction = (action?: "pause" | "resume" | "stop" | null) => {
    switch (action) {
      case "pause":
        void enginePause().then(() => handleNotificationScheduling(true, timeLeft));
        break;
      case "resume":
        void engineResume().then(() => handleNotificationScheduling(false, timeLeft));
        break;
      case "stop":
        void resetTimer();
        break;
    }
  };

  useNativeTimerActionSync({
    onPause: () => applyNativeAction("pause"),
    onResume: () => applyNativeAction("resume"),
    onStop: () => applyNativeAction("stop"),
  });

  // Persisted-flag reconciliation for a native action that arrived while the app was
  // backgrounded or fully killed (the live-event listener above only catches one that arrives
  // while JS is already running). Deliberately sequenced *after* `loadTimerState()` finishes,
  // not raced against it — `loadTimerState()` reads AsyncStorage, a separate, stale data source
  // a native button tap never touches, and it reliably resolves *after* a native action check
  // (AsyncStorage I/O is consistently slower), so racing them let it silently clobber the
  // reconciled action back to whatever was persisted before backgrounding.
  const reconcileNativeAction = async () => {
    const pendingAction = await liveActivityService.consumePendingAction();
    applyNativeAction(pendingAction);
  };

  // Dismiss timer alert (advance to next blind level, keep timer paused, stop sound)
  const dismissTimerAlert = async () => {
    await clearAlert();

    // Advance to next blind level but keep timer paused
    increaseBlinds();
    // Timer will remain paused - user needs to manually start it
  };

  // Handle next blinds (advance blinds, start new timer, stop sound)
  const handleNextBlinds = async () => {
    await clearAlert();

    // Advance to next blind level and start timer
    increaseBlinds();

    // Start the new timer after a short delay to ensure blind level is updated
    setTimeout(async () => {
      await engineTogglePause(); // This will start the timer if it's paused
      await handleNotificationScheduling(false, timerDuration);
    }, 100);
  };

  // Check if background activities are supported
  useEffect(() => {
    const checkBackgroundSupport = async () => {
      const isSupported = liveActivityService.isDeviceSupported();
      setIsBackgroundActivitySupported(isSupported);

      if (isSupported && Platform.OS === "android") {
        // Actually prompt for POST_NOTIFICATIONS on Android 13+ — not just check.
        // The foreground service shows the timer notification and plays the
        // expiry alarm/vibration while backgrounded, and it refuses to start
        // without this permission (see LiveActivityService.isEnabled).
        const granted = await requestNotificationPermission();
        if (!granted) {
          logger.warn(
            "Background activity available but notification permission denied",
          );
        }
      }
    };

    checkBackgroundSupport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle app state changes. `loadTimerState` has an unstable identity (it's
  // recreated every render), so this effect re-runs every second while the timer
  // ticks. Only reload on an actual background→foreground transition — otherwise
  // we'd reload timer state from storage once per second, which (among other
  // things) clobbers a just-applied reset with the previously persisted value.
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    const cameToForeground = isActive && !wasActiveRef.current;
    wasActiveRef.current = isActive;

    if (cameToForeground) {
      // App has come to the foreground: reload persisted state, THEN reconcile any native
      // action on top of it (not in parallel — see reconcileNativeAction).
      loadTimerState().then(reconcileNativeAction);
      liveActivityService.syncActivityState();
    }

    // If app goes to background while alert is showing, auto-dismiss and advance
    if ((isBackground || isInactive) && showTimerAlert) {
      logger.log("App is going to background, auto-dismiss timer alert");
      // Reacting to an AppState transition (app backgrounded while the alert is
      // visible); clearing the alert here is intentional. The alert's setState
      // now lives inside useTimerAlert, so no set-state-in-effect suppression is
      // needed.
      dismissTimerAlert();
    }
  }, [isActive, isBackground, isInactive, loadTimerState, showTimerAlert]);

  // Load initial state on mount, then reconcile any native action left pending from before
  // this launch (see reconcileNativeAction — sequenced, not raced, against the load).
  useEffect(() => {
    loadTimerState().then(reconcileNativeAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // End background activity when component unmounts (the alarm sound is
      // stopped by useTimerAlert's own unmount cleanup).
      liveActivityService.endActivity();
    };
  }, []);

  return (
    <TimerContext.Provider
      value={{
        endTime,
        timeLeft,
        timerDuration,
        setTimerDuration,
        paused,
        togglePause,
        resetTimer,
        isLoading,
        showTimerAlert,
        dismissTimerAlert,
        handleNextBlinds,
        hasNotificationPermission,
        requestNotificationPermission,
        showPermissionAlert,
        isBackgroundActivitySupported,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = React.useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
}
