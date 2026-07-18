// src/contexts/PremiumContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Entitlements } from "@poker/core";
import { revenueCatProvider } from "@/src/services/revenueCatProvider";

// Flip to true to unlock Pro locally without going through RevenueCat/StoreKit —
// real purchases aren't testable in the Simulator without StoreKit Testing +
// RevenueCat dashboard setup. Never true in a release build since __DEV__ is
// false there regardless of this literal.
const FORCE_PRO_IN_DEV: boolean = __DEV__ && false;

type PremiumContextValue = {
  /** True once the user has unlocked the Pro (ad-free) tier. */
  isPremium: boolean;
  /** True while a purchase or restore is in flight. */
  purchasing: boolean;
  /** Localized Pro price (e.g. "$2.99"), or null until loaded/unavailable. */
  proPriceString: string | null;
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

  useEffect(() => {
    if (FORCE_PRO_IN_DEV) return;
    let active = true;
    revenueCatProvider.getEntitlements().then((entitlements: Entitlements) => {
      if (active) setIsPremium(entitlements.isPremium);
    });
    revenueCatProvider.getProPriceString().then((price) => {
      if (active) setProPriceString(price);
    });
    const unsubscribe = revenueCatProvider.onChange((entitlements) => {
      setIsPremium(entitlements.isPremium);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

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
      value={{ isPremium, purchasing, proPriceString, purchasePro, restore }}
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
