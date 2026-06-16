// src/services/revenueCatProvider.ts
import type { EntitlementProvider, Entitlements } from "@poker/core";

/**
 * Mobile billing surface: the read-only entitlement contract from @poker/core
 * plus the purchase/restore actions the paywall needs. The web app implements
 * only the read side; mobile layers billing on top.
 */
export interface BillingProvider extends EntitlementProvider {
  /** Start the Pro purchase flow. Resolves with the resulting entitlements. */
  purchasePro(): Promise<Entitlements>;
  /** Restore prior purchases (Apple-required). Resolves with entitlements. */
  restore(): Promise<Entitlements>;
}

/**
 * Phase 3 STUB. Holds entitlement state in memory and emits changes so the full
 * paywall → unlock → ad-removal UX is testable before RevenueCat exists. In a
 * release build purchase/restore throw, so a production app can never fake-unlock
 * Pro — wiring `react-native-purchases` is required before shipping.
 *
 * To make it real, install `react-native-purchases` and replace the bodies below:
 *   startup       → Purchases.configure({ apiKey })
 *   getEntitlements → map (await Purchases.getCustomerInfo()).entitlements.active[ENTITLEMENT_PRO]
 *   onChange      → Purchases.addCustomerInfoUpdateListener(...)
 *   purchasePro   → Purchases.purchasePackage(pkg)
 *   restore       → Purchases.restorePurchases()
 */
let premium = false;
const listeners = new Set<(entitlements: Entitlements) => void>();

const emit = () => {
  for (const listener of listeners) listener({ isPremium: premium });
};

const ensureConfigured = () => {
  if (!__DEV__) {
    throw new Error(
      "Purchases aren't configured yet. Wire react-native-purchases (RevenueCat) before release.",
    );
  }
};

export const revenueCatProvider: BillingProvider = {
  getEntitlements: async () => ({ isPremium: premium }),
  onChange: (callback) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },
  purchasePro: async () => {
    ensureConfigured();
    premium = true;
    emit();
    return { isPremium: premium };
  },
  restore: async () => {
    ensureConfigured();
    emit();
    return { isPremium: premium };
  },
};
