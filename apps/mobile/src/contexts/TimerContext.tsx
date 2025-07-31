import React, {
  createContext,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { Sound, useSounds } from "@/src/hooks/useSounds";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { useTimerNotification } from "@/src/hooks/useTimerNotification";
import { liveActivityService } from "@/src/services/LiveActivityService";

const DEFAULT_TIMER_DURATION = 600; // Default timer duration in seconds
const STORAGE_KEYS = {
  TIMER_END_TIME: "timer_end_time",
  TIMER_DURATION: "timer_duration",
  TIMER_PAUSED: "timer_paused",
  TIMER_TIME_LEFT: "timer_time_left",
};

type TimerContextType = {
  endTime?: number;
  timeLeft: number;
  timerDuration: number;
  setTimerDuration: (duration: number) => void;
  paused: boolean;
  togglePause: () => void;
  resetTimer: () => void;
  isLoading: boolean;
};

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [timerDuration, setTimerDuration] = useState(DEFAULT_TIMER_DURATION);
  const [endTime, setEndTime] = useState<number>();
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMER_DURATION);
  const [paused, setPaused] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const { playSound } = useSounds(Sound.ALARM);
  const { increaseBlinds, currentBlindIndex, blindLevels } = useBlinds();
  const { scheduleNotification, cancelNotification } = useTimerNotification();

  const intervalRef = useRef<number | null>(null);
  const appState = useRef(AppState.currentState);

  // Save timer state to AsyncStorage
  const saveTimerState = async (state: {
    endTime?: number;
    timerDuration: number;
    paused: boolean;
    timeLeft: number;
  }) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.TIMER_END_TIME, state.endTime?.toString() || ""],
        [STORAGE_KEYS.TIMER_DURATION, state.timerDuration.toString()],
        [STORAGE_KEYS.TIMER_PAUSED, state.paused.toString()],
        [STORAGE_KEYS.TIMER_TIME_LEFT, state.timeLeft.toString()],
      ]);
    } catch (error) {
      console.error("Failed to save timer state:", error);
    }
  };

  // Update Live Activity with current state
  const updateLiveActivity = async (state: {
    endTime?: number;
    timeLeft: number;
    paused: boolean;
  }) => {
    if (!liveActivityService.isDeviceSupported()) {
      return;
    }

    try {
      const nextBlindLevel = blindLevels[currentBlindIndex + 1];

      const activityState = {
        tournamentName: "Poker Timer",
        currentBlindLevel: currentBlindIndex + 1, // Display as 1-based
        currentSmallBlind: blindLevels[currentBlindIndex].small,
        currentBigBlind: blindLevels[currentBlindIndex].big,
        nextSmallBlind: nextBlindLevel?.small || 0,
        nextBigBlind: nextBlindLevel?.big || 0,
        endTime: state.endTime,
        durationSeconds: state.paused ? state.timeLeft : undefined,
        paused: state.paused,
      };

      await liveActivityService.startOrUpdateActivity(activityState);
    } catch (error) {
      console.error("Failed to update Live Activity:", error);
    }
  };

  // Load timer state from AsyncStorage
  const loadTimerState = async () => {
    try {
      const values = await AsyncStorage.multiGet([
        STORAGE_KEYS.TIMER_END_TIME,
        STORAGE_KEYS.TIMER_DURATION,
        STORAGE_KEYS.TIMER_PAUSED,
        STORAGE_KEYS.TIMER_TIME_LEFT,
      ]);

      const endTimeStr = values[0][1];
      const durationStr = values[1][1];
      const pausedStr = values[2][1];
      const timeLeftStr = values[3][1];

      const savedEndTime = endTimeStr ? parseInt(endTimeStr, 10) : undefined;
      const savedDuration = durationStr
        ? parseInt(durationStr, 10)
        : DEFAULT_TIMER_DURATION;
      const savedPaused = pausedStr ? pausedStr === "true" : true;
      const savedTimeLeft = timeLeftStr
        ? parseInt(timeLeftStr, 10)
        : savedDuration;

      // Calculate current time left based on end time if timer was running
      let currentTimeLeft = savedTimeLeft;
      if (savedEndTime && !savedPaused) {
        const now = Date.now();
        currentTimeLeft = Math.max(0, Math.ceil((savedEndTime - now) / 1000));

        // If time has expired while app was closed
        if (currentTimeLeft === 0) {
          playSound();
          increaseBlinds();

          // Reset timer after blind increase
          const resetState = {
            endTime: undefined,
            timerDuration: savedDuration,
            paused: true,
            timeLeft: savedDuration,
          };

          await saveTimerState(resetState);
          setPaused(true);
          setEndTime(undefined);
          setTimeLeft(savedDuration);
          setTimerDuration(savedDuration);

          // Update Live Activity for reset state
          await updateLiveActivity({
            endTime: undefined,
            timeLeft: savedDuration,
            paused: true,
          });

          return;
        }
      }

      setTimerDuration(savedDuration);
      setEndTime(savedEndTime);
      setTimeLeft(currentTimeLeft);
      setPaused(savedPaused);

      // Update Live Activity with restored state
      await updateLiveActivity({
        endTime: savedEndTime,
        timeLeft: currentTimeLeft,
        paused: savedPaused,
      });
    } catch (error) {
      console.error("Failed to load timer state:", error);
      // Use default values on error
      setTimerDuration(DEFAULT_TIMER_DURATION);
      setTimeLeft(DEFAULT_TIMER_DURATION);
      setPaused(true);

      // Update Live Activity with default state
      await updateLiveActivity({
        endTime: undefined,
        timeLeft: DEFAULT_TIMER_DURATION,
        paused: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle pause/resume
  const togglePause = async () => {
    const newPaused = !paused;

    if (newPaused) {
      // Pausing the timer
      const newEndTime = undefined;
      setEndTime(newEndTime);
      setPaused(true);

      const newState = {
        endTime: newEndTime,
        timerDuration,
        paused: true,
        timeLeft,
      };

      await saveTimerState(newState);
      await updateLiveActivity({
        endTime: newEndTime,
        timeLeft,
        paused: true,
      });
      await cancelNotification();
    } else {
      // Resuming the timer
      const newEndTime = Date.now() + timeLeft * 1000;
      setEndTime(newEndTime);
      setPaused(false);

      const newState = {
        endTime: newEndTime,
        timerDuration,
        paused: false,
        timeLeft,
      };

      await saveTimerState(newState);
      await scheduleNotification(timeLeft, blindLevels[currentBlindIndex + 1]);
      await updateLiveActivity({
        endTime: newEndTime,
        timeLeft,
        paused: false,
      });
    }
  };

  // Reset timer
  const resetTimer = async () => {
    setPaused(true);
    setEndTime(undefined);
    setTimeLeft(timerDuration);

    const newState = {
      endTime: undefined,
      timerDuration,
      paused: true,
      timeLeft: timerDuration,
    };

    await saveTimerState(newState);
    await cancelNotification();
    await updateLiveActivity({
      endTime: undefined,
      timeLeft: timerDuration,
      paused: true,
    });
  };

  // Handle timer duration changes
  const handleSetTimerDuration = async (duration: number) => {
    setTimerDuration(duration);

    // If timer is paused and we don't have an endTime (truly reset state), update time left
    const newTimeLeft = paused && !endTime ? duration : timeLeft;
    if (paused && !endTime) {
      setTimeLeft(duration);
    }

    const newState = {
      endTime,
      timerDuration: duration,
      paused,
      timeLeft: newTimeLeft,
    };

    await saveTimerState(newState);

    // Update Live Activity if timer is in reset state
    if (paused && !endTime) {
      await updateLiveActivity({
        endTime: undefined,
        timeLeft: duration,
        paused: true,
      });
    }
  };

  // Load initial state on mount
  useEffect(() => {
    loadTimerState();
  }, []);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App has come to the foreground, reload state
        loadTimerState();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, []);

  // Timer countdown effect
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!paused && endTime && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const newTimeLeft = Math.max(0, Math.ceil((endTime - now) / 1000));

        setTimeLeft(newTimeLeft);

        // Save updated time left
        saveTimerState({
          endTime,
          timerDuration,
          paused: false,
          timeLeft: newTimeLeft,
        });

        // Update Live Activity with current countdown (but not too frequently)
        // Only update every 10 seconds to avoid too many updates
        if (newTimeLeft % 10 === 0 || newTimeLeft <= 10) {
          updateLiveActivity({
            endTime,
            timeLeft: newTimeLeft,
            paused: false,
          });
        }

        if (newTimeLeft === 0) {
          clearInterval(intervalRef.current!);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [paused, endTime, timerDuration]);

  // Handle timer completion
  useEffect(() => {
    if (timeLeft === 0 && !paused) {
      playSound();
      increaseBlinds();
      resetTimer();
    }
  }, [timeLeft, paused]);

  // Update Live Activity when blind levels change
  useEffect(() => {
    if (!isLoading) {
      updateLiveActivity({
        endTime,
        timeLeft,
        paused,
      });
    }
  }, [currentBlindIndex, blindLevels]);

  // Only reset time left when timer duration changes and timer is paused AND it's not just a pause action
  useEffect(() => {
    if (paused && endTime === undefined) {
      // Only reset if we don't have an endTime (meaning it's a reset, not just a pause)
      setTimeLeft(timerDuration);
    }
  }, [timerDuration]);

  // Cleanup Live Activity when component unmounts
  useEffect(() => {
    return () => {
      // Only end the activity if the app is truly closing, not just navigating
      // This cleanup will happen naturally when the app is closed
    };
  }, []);

  return (
    <TimerContext.Provider
      value={{
        endTime,
        timeLeft,
        timerDuration,
        setTimerDuration: handleSetTimerDuration,
        paused,
        togglePause,
        resetTimer,
        isLoading,
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
