// src/components/AppReadyGate.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as SplashScreen from "expo-splash-screen";

// PokerTimer sizes itself by measuring its own rendered height and rescaling to
// fit (see its `handleColumnLayout`), which takes several onLayout -> setScale
// round trips to converge — and converges non-monotonically, so the intermediate
// passes read as the card visibly resizing a few times. Rather than racing that
// with a timer, the screen stays hidden behind the native splash until it
// reports that its layout has actually settled, then the splash and the content
// swap in the same commit.
type AppReadyValue = {
  /** False until the first screen reports a settled layout (or the ceiling below fires). */
  revealed: boolean;
  /** Called by the first screen once its layout has converged and its data has loaded. */
  reportContentSettled: () => void;
};

const AppReadyContext = createContext<AppReadyValue>({
  // Default keeps content visible for any screen rendered outside the gate, so
  // forgetting the provider can never leave a screen permanently invisible.
  revealed: true,
  reportContentSettled: () => {},
});

export function useAppReady() {
  return useContext(AppReadyContext);
}

/**
 * For screens that have no measure-and-rescale pass of their own: mounted is as
 * settled as they get.
 *
 * Every route needs to report *something*, because expo-router can restore the
 * last route on relaunch and the app is deep-linkable — a launch landing on a
 * screen that never reports would sit behind the splash until the ceiling below
 * fires. Only PokerTimer needs the real convergence-based report.
 */
export function useReportContentSettledOnMount() {
  const { reportContentSettled } = useAppReady();
  useEffect(() => {
    reportContentSettled();
  }, [reportContentSettled]);
}

// Ceiling so a screen that never reports (slow/failed data load, or a route that
// doesn't participate at all) can't hold the splash — or its own content —
// hidden indefinitely.
const MAX_WAIT_MS = 4000;

export default function AppReadyGate({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setRevealed(true);
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const ceiling = setTimeout(reveal, MAX_WAIT_MS);
    return () => clearTimeout(ceiling);
  }, [reveal]);

  return (
    <AppReadyContext.Provider
      value={{ revealed, reportContentSettled: reveal }}
    >
      {children}
    </AppReadyContext.Provider>
  );
}
