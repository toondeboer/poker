// src/contexts/FeaturesContext.tsx
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { NO_FEATURES, type Features } from "@poker/core";
import { createGroupApi } from "@/src/services/groupApi";
import { apiToken } from "@/src/contexts/AuthContext";

const api = createGroupApi(apiToken);

/**
 * What the server says the app may do today — the kill switch.
 *
 * **Its own provider rather than a corner of `useGroupSync`, because that is
 * where it was and the circularity was the bug.** The hook derived its own
 * `enabled` from this answer, and the effect that asked for the answer depended
 * on a callback that changed when `enabled` changed. So the ask ran twice on
 * every launch, and the sync it kicked off ran against the stale `enabled` it
 * had closed over before the answer arrived.
 *
 * A provider also puts the answer somewhere the *account* screens can read it,
 * which is the difference between `featureAccounts=off` being a documented
 * switch and being a string in a Lambda's environment that nothing consults.
 *
 * ## Asked again on every foreground, deliberately
 *
 * The first version asked exactly once. `api.features()` answers `NO_FEATURES`
 * for a refusal *and* for an unreachable server, and `NO_FEATURES` is a frozen
 * singleton — so a phone that launched in a lift set state to the same
 * reference React was already holding, re-rendered nothing, and had sharing off
 * for the rest of the process with no path back. Games recorded in that session
 * were dropped rather than queued, and no later foreground or sign-in retried.
 *
 * Re-asking needs no cleverness to be safe: the answer is two booleans behind a
 * 60-second cache, so the cost of asking on every foreground is nothing, and it
 * is the same moment the outbox retries on. There is deliberately no attempt to
 * tell "refused" from "unreachable" — both mean off, and re-asking either way
 * is what makes the switch recoverable in both directions.
 */
const FeaturesContext = createContext<Features>(NO_FEATURES);

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<Features>(NO_FEATURES);

  const ask = useCallback(() => {
    // Never rejects — a failure is `NO_FEATURES`, which is the answer we want
    // anyway. Nothing here has to decide what an error means.
    void api.features().then(setFeatures);
  }, []);

  useEffect(() => {
    ask();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") ask();
    });
    return () => subscription.remove();
  }, [ask]);

  return <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>;
}

/**
 * **Off until the server says otherwise**, including for a component rendered
 * outside the provider. A default of "on" would mean the switch failing open
 * wherever somebody forgot to wrap something.
 */
export const useFeatures = (): Features => useContext(FeaturesContext);
