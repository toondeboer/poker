import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

interface AppStateHook {
  appState: AppStateStatus;
  isActive: boolean;
  isBackground: boolean;
  isInactive: boolean;
}

export const useAppState = (): AppStateHook => {
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      appStateRef.current = nextAppState;
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  return {
    appState,
    isActive: appState === "active",
    isBackground: appState === "background",
    isInactive: appState === "inactive",
  };
};
