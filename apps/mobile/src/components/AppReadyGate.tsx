// src/components/AppReadyGate.tsx
import { useEffect, useRef, type ReactNode } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { useSoundPack } from "@/src/contexts/SoundPackContext";
import { useTimer } from "@/src/contexts/TimerContext";

// PokerTimer's auto-fit-to-screen pass (onLayout -> setScale) takes a
// handful of native-layout round trips to converge on first mount. This
// buffer gives it time to settle behind the splash screen instead of in
// the already-visible app.
const LAYOUT_SETTLE_MS = 300;
// Upper bound so a stuck context load can never hold the splash screen up
// indefinitely.
const MAX_WAIT_MS = 4000;

export default function AppReadyGate({ children }: { children: ReactNode }) {
  const { isLoading: isBlindsLoading } = useBlinds();
  const { isLoading: isSoundPackLoading } = useSoundPack();
  const { isLoading: isTimerLoading } = useTimer();
  const hiddenRef = useRef(false);

  const contextsReady = !isBlindsLoading && !isSoundPackLoading && !isTimerLoading;

  const hideOnce = () => {
    if (hiddenRef.current) return;
    hiddenRef.current = true;
    void SplashScreen.hideAsync();
  };

  // Fallback ceiling: fires once, independent of context-loading state.
  useEffect(() => {
    const maxWaitTimeout = setTimeout(hideOnce, MAX_WAIT_MS);
    return () => clearTimeout(maxWaitTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!contextsReady) return;
    const settleTimeout = setTimeout(hideOnce, LAYOUT_SETTLE_MS);
    return () => clearTimeout(settleTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextsReady]);

  return <>{children}</>;
}
