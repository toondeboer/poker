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
const FORCE_FREE_IN_DEV: boolean = __DEV__ && false;

type PremiumContextValue = {
  /** True once the user has unlocked the Pro (ad-free) tier. */
  isPremium: boolean;
  /**
   * Whether boards can be shared, joined and synced.
   *
   * **Its own purchase, not a tier above Pro.** Pro is one payment and
   * everything it unlocks runs on the phone; this is the only thing with a cost
   * that keeps arriving, so it is the only thing that keeps being paid for. See
   * `ENTITLEMENT_SHARED_BOARDS` for the reasoning, and `ROADMAP.md` for what is
   * still needed in the stores before anybody can buy it.
   */
  hasSharedBoards: boolean;
  /**
   * Whether {@link isPremium} is the store's answer rather than the default.
   *
   * Only worth checking before *refusing* somebody something — see the comment
   * on the state itself.
   */
  entitlementsKnown: boolean;
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
  // Forced alongside Pro in development, because a dev build with no store
  // products configured could otherwise never reach the server features at all.
  const [hasSharedBoards, setHasSharedBoards] = useState(FORCE_PRO_IN_DEV);
  /**
   * Whether the entitlement is the store's answer or still the default.
   *
   * **`isPremium` starts `false`, which is indistinguishable from "not Pro"
   * until RevenueCat replies.** Nothing that merely *renders* cares — a paywall
   * that appears for a moment and goes is a flicker. Anything that makes a
   * decision does: refusing an invite in that window tells somebody who has
   * paid to go and pay, and joining from a cold launch lands exactly there.
   *
   * Forced flags are known immediately: they *are* the answer.
   */
  const [entitlementsKnown, setEntitlementsKnown] = useState(
    FORCE_PRO_IN_DEV || FORCE_FREE_IN_DEV,
  );
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

  /**
   * Take **everything** the store just said, not the one field this used to
   * care about.
   *
   * Reading only `isPremium` here was survivable while there was one
   * entitlement and is not now: somebody reinstalling and tapping "Restore
   * purchases" would get Pro back and silently not sharing — and the Restore
   * button only renders while `!isPremium`, so once Pro came back there was no
   * way left in the app to ask again.
   */
  const applyEntitlements = useCallback((entitlements: Entitlements) => {
    setIsPremium(entitlements.isPremium);
    setHasSharedBoards(entitlements.hasSharedBoards);
    setEntitlementsKnown(true);
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
    revenueCatProvider
      .getEntitlements()
      .then((entitlements: Entitlements) => {
        if (active) applyEntitlements(entitlements);
      })
      // **Known either way.** A store that cannot be reached is not a reason to
      // block somebody out of a decision forever; it answers "not Pro", which
      // is what `isPremium` already says.
      .finally(() => {
        if (active) setEntitlementsKnown(true);
      });
    const unsubscribe = revenueCatProvider.onChange(applyEntitlements);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refreshProPrice, applyEntitlements]);

  const purchasePro = useCallback(async () => {
    setPurchasing(true);
    try {
      applyEntitlements(await revenueCatProvider.purchasePro());
    } finally {
      setPurchasing(false);
    }
  }, [applyEntitlements]);

  const restore = useCallback(async () => {
    setPurchasing(true);
    try {
      applyEntitlements(await revenueCatProvider.restore());
    } finally {
      setPurchasing(false);
    }
  }, [applyEntitlements]);

  return (
    <PremiumContext.Provider
      value={{
        isPremium,
        hasSharedBoards,
        entitlementsKnown,
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
