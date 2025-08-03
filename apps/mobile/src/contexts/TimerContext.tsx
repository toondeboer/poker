// src/contexts/TimerContext.tsx
import React, {
  createContext,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { Sound, useSounds } from "@/src/hooks/useSounds";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { useTimerNotification } from "@/src/hooks/useTimerNotification";
import { useTimerEngine } from "@/src/hooks/useTimerEngine";
import { liveActivityService } from "@/src/services/LiveActivityService";

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
};

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { playSound, stopSound, isLoaded } = useSounds(Sound.ALARM);
  const { increaseBlinds, currentBlindIndex, blindLevels } = useBlinds();
  const { scheduleNotification, cancelNotification, isAppInForeground } =
    useTimerNotification();

  const [showTimerAlert, setShowTimerAlert] = useState(false);
  const appState = useRef(AppState.currentState);
  const alarmPlayingRef = useRef(false);

  // Handle timer completion
  const handleTimerComplete = async () => {
    try {
      // Only play sound and show alert if app is active (in foreground)
      if (appState.current === "active" && isLoaded) {
        await playSound();
        alarmPlayingRef.current = true;
        setShowTimerAlert(true);
        console.log("Timer completed - showing alert and playing alarm");
      } else {
        console.log(
          "App in background, skipping alarm sound and alert (notification will handle audio)",
        );
        // Auto-advance if in background
        increaseBlinds();
      }
    } catch (error) {
      console.error("Failed to play completion sound:", error);
      // Still show alert even if sound fails
      if (appState.current === "active") {
        setShowTimerAlert(true);
      }
    }
  };

  const handleNotificationScheduling = async (
    paused: boolean,
    timeLeft: number,
  ) => {
    if (paused) {
      await cancelNotification();
    } else {
      const nextBlindLevel = blindLevels[currentBlindIndex + 1];
      await scheduleNotification(timeLeft, nextBlindLevel);
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
    resetTimer: engineResetTimer,
    isLoading,
    loadTimerState,
  } = useTimerEngine(currentBlindIndex, blindLevels, {
    onTimerComplete: handleTimerComplete,
  });

  // Enhanced toggle pause with notification handling
  const togglePause = async () => {
    const newPaused = !paused; // Calculate before state change
    await engineTogglePause();
    // Handle notifications after pause state changes
    await handleNotificationScheduling(newPaused, timeLeft);
  };

  // Enhanced reset timer with notification handling
  const resetTimer = async () => {
    await engineResetTimer();
    await cancelNotification();
    // Dismiss alert and stop sound if active
    if (showTimerAlert) {
      setShowTimerAlert(false);
      if (alarmPlayingRef.current) {
        await stopSound();
        alarmPlayingRef.current = false;
      }
    }
  };

  // Dismiss timer alert (advance to next blind level, keep timer paused, stop sound)
  const dismissTimerAlert = async () => {
    setShowTimerAlert(false);
    if (alarmPlayingRef.current) {
      await stopSound();
      alarmPlayingRef.current = false;
    }

    // Advance to next blind level but keep timer paused
    increaseBlinds();
    // Timer will remain paused - user needs to manually start it
  };

  // Handle next blinds (advance blinds, start new timer, stop sound)
  const handleNextBlinds = async () => {
    setShowTimerAlert(false);
    if (alarmPlayingRef.current) {
      await stopSound();
      alarmPlayingRef.current = false;
    }

    // Advance to next blind level and start timer
    increaseBlinds();

    // Start the new timer after a short delay to ensure blind level is updated
    setTimeout(async () => {
      await engineTogglePause(); // This will start the timer if it's paused
      await handleNotificationScheduling(false, timerDuration);
    }, 100);
  };

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App has come to the foreground, reload timer state
        loadTimerState();
        liveActivityService.syncActivityState();
      }

      // If app goes to background while alert is showing, auto-dismiss and advance
      if (nextAppState === "background" && showTimerAlert) {
        dismissTimerAlert();
        increaseBlinds();
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, [loadTimerState, showTimerAlert]);

  // Load initial state on mount
  useEffect(() => {
    loadTimerState();
  }, []);

  // Cleanup sound when component unmounts
  useEffect(() => {
    return () => {
      if (alarmPlayingRef.current) {
        stopSound();
      }
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
