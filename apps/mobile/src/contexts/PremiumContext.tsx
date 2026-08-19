// src/contexts/PremiumContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Entitlements } from "@poker/core";
import { revenueCatProvider } from "@/src/services/revenueCatProvider";

// Flip to true to unlock Pro locally without going through RevenueCat/StoreKit —
// real purchases aren't testable in the Simulator without StoreKit Testing +
// RevenueCat dashboard setup. Never true in a release build since __DEV__ is
// false there regardless of this literal.
const FORCE_PRO_IN_DEV: boolean = __DEV__ && false;
// Flip to true to force the free/ad experience locally, bypassing the real
// RevenueCat entitlement check — useful when the Apple/Google account signed
// into the test device already owns `pro_lifetime` (a one-time purchase, so
// it persists across reinstalls) and you want to see the ad-supported UI
// anyway. Only one of these two should be true at a time.
const FORCE_FREE_IN_DEV: boolean = __DEV__ && true;

type PremiumContextValue = {
  /** True once the user has unlocked the Pro (ad-free) tier. */
  isPremium: boolean;
  /** True while a purchase or restore is in flight. */
  purchasing: boolean;
  /** Localized Pro price (e.g. "$2.99"), or null until loaded/unavailable. */
  proPriceString: string | null;
  /**
   * Re-attempt the price fetch. Safe to call repeatedly and a no-op once a price
   * is in hand — the paywall calls it every time it opens, so a fetch that lost
   * a race with SDK configuration or a cold network at launch doesn't leave the
   * sheet price-less for the rest of the session.
   */
  refreshProPrice: () => void;
  /** Start the Pro purchase flow. Throws on failure for the caller to surface. */
  purchasePro: () => Promise<void>;
  /** Restore a previous purchase. Throws on failure for the caller to surface. */
  restore: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

/**
 * Exposes entitlement state and the purchase/restore actions to the tree, backed
 * by RevenueCat. Every ad surface reads `isPremium` through {@link usePremium},
 * so unlocking Pro removes ads everywhere at once.
 */
export function PremiumProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [isPremium, setIsPremium] = useState(FORCE_PRO_IN_DEV);
  const [purchasing, setPurchasing] = useState(false);
  const [proPriceString, setProPriceString] = useState<string | null>(null);

  // Guards against overlapping fetches (mount + a paywall opened immediately
  // after) firing two offering requests for the same answer. Not state: nothing
  // renders from it, and it must be readable synchronously at call time.
  const priceFetchInFlightRef = useRef(false);

  // Deliberately NOT skipped under either FORCE_* flag. Fetching the price is a
  // read-only store lookup that grants nothing, and the whole point of
  // FORCE_FREE_IN_DEV is to look at the paywall you'd otherwise never see on a
  // device whose account already owns Pro — a paywall with no price in it is not
  // that paywall. Skipping it here (which is what the flags used to do, via the
  // effect below returning early) is why the price looked unfetchable in local
  // development and sent us looking at TestFlight.
  const refreshProPrice = useCallback(() => {
    if (priceFetchInFlightRef.current) return;
    priceFetchInFlightRef.current = true;
    revenueCatProvider
      .getProPriceString()
      .then((price) => {
        // Never overwrite a good price with null: a later failed refresh (flaky
        // network on a reopened paywall) must not blank out a price already on
        // screen.
        if (price) setProPriceString(price);
      })
      .finally(() => {
        priceFetchInFlightRef.current = false;
      });
  }, []);

  useEffect(() => {
    // The price is fetched either way (see refreshProPrice). Only the
    // *entitlement* is forced: the initial state above already reflects
    // FORCE_PRO_IN_DEV, and FORCE_FREE_IN_DEV implies false, which is the same
    // default — so skip the real check and the change listener that would
    // overwrite it a moment later.
    refreshProPrice();
    if (FORCE_PRO_IN_DEV || FORCE_FREE_IN_DEV) return;
    let active = true;
    revenueCatProvider.getEntitlements().then((entitlements: Entitlements) => {
      if (active) setIsPremium(entitlements.isPremium);
    });
    const unsubscribe = revenueCatProvider.onChange((entitlements) => {
      setIsPremium(entitlements.isPremium);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refreshProPrice]);

  const purchasePro = useCallback(async () => {
    setPurchasing(true);
    try {
      const entitlements = await revenueCatProvider.purchasePro();
      setIsPremium(entitlements.isPremium);
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restore = useCallback(async () => {
    setPurchasing(true);
    try {
      const entitlements = await revenueCatProvider.restore();
      setIsPremium(entitlements.isPremium);
    } finally {
      setPurchasing(false);
    }
  }, []);

  return (
    <PremiumContext.Provider
      value={{
        isPremium,
        purchasing,
        proPriceString,
        refreshProPrice,
        purchasePro,
        restore,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error("usePremium must be used within a PremiumProvider");
  }
  return context;
}
