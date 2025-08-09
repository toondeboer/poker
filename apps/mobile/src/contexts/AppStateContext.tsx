// src/contexts/AppStateContext.tsx

import { AppState, AppStateStatus } from "react-native";
import { createContext, useContext, useEffect, useState } from "react";

type AppStateContext = {
  appState: AppStateStatus;
  isActive: boolean;
  isBackground: boolean;
  isInactive: boolean;
};

const AppStateContext = createContext<AppStateContext | null>(null);

export function AppStateProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const [isActive, setIsActive] = useState(true);
  const [isBackground, setIsBackground] = useState(false);
  const [isInactive, setIsInactive] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      console.log(
        "[App State Context] AppState changed from",
        appState,
        "to",
        nextAppState,
      );
      setAppState(nextAppState);
      setIsActive(nextAppState === "active");
      setIsBackground(nextAppState === "background");
      setIsInactive(nextAppState === "inactive");
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <AppStateContext.Provider
      value={{ isActive, isBackground, isInactive, appState }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
}
