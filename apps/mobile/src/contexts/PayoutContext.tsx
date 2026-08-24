// src/contexts/PayoutContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { DEFAULT_PAYOUT_SETTINGS, PayoutSettings } from "@poker/core";
import { PayoutStorage } from "@/src/services/PayoutStorage";
import { logger } from "@/src/utils/logger";

type PayoutContextValue = {
  settings: PayoutSettings;
  isLoading: boolean;
  update: (patch: Partial<PayoutSettings>) => void;
};

const PayoutContext = createContext<PayoutContextValue | null>(null);

/**
 * The host's payout setup (Pro feature), shared across the tree.
 *
 * A context rather than a per-component hook for the same reason as
 * {@link SoundPackProvider}: two screens read it. The Payouts screen writes
 * the settings and Settings' Tournament card summarises them, and a stack push
 * leaves Settings mounted underneath — so with a local copy each, editing the
 * buy-in and going back would show the *old* numbers in the summary row until
 * the next app launch.
 *
 * Writes are fire-and-forget. This is a calculator whose inputs are
 * re-derivable by retyping them, so a failed write costs a few keystrokes next
 * game night rather than anything unrecoverable — blocking the keypad on a disk
 * write would be the worse trade.
 */
export function PayoutProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [settings, setSettings] = useState<PayoutSettings>(
    DEFAULT_PAYOUT_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    PayoutStorage.loadPayoutSettings()
      .then((loaded) => {
        if (active) setSettings(loaded);
      })
      .catch((error) => logger.error("Failed to load payout settings:", error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((patch: Partial<PayoutSettings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      PayoutStorage.savePayoutSettings(next).catch((error) =>
        logger.error("Failed to save payout settings:", error),
      );
      return next;
    });
  }, []);

  return (
    <PayoutContext.Provider value={{ settings, isLoading, update }}>
      {children}
    </PayoutContext.Provider>
  );
}

export function usePayouts() {
  const context = useContext(PayoutContext);
  if (!context) {
    throw new Error("usePayouts must be used within a PayoutProvider");
  }
  return context;
}
