// src/services/revenueCatProvider.ts
import { Platform } from "react-native";
import Constants from "expo-constants";
import { logger } from "@/src/utils/logger";
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import {
  ENTITLEMENT_PRO,
  type EntitlementProvider,
  type Entitlements,
} from "@poker/core";

/**
 * Mobile billing surface: the read-only entitlement contract from @poker/core
 * plus the purchase/restore actions and the localized price the paywall needs.
 * The web app implements only the read side; mobile layers billing on top.
 */
export interface BillingProvider extends EntitlementProvider {
  /** Start the Pro purchase flow. Resolves with the resulting entitlements. */
  purchasePro(): Promise<Entitlements>;
  /** Restore prior purchases (Apple-required). Resolves with entitlements. */
  restore(): Promise<Entitlements>;
  /** Localized price string for the Pro package, or null if unavailable. */
  getProPriceString(): Promise<string | null>;
}

// Public RevenueCat SDK keys are safe to ship in the client (set in app.json
// `extra`). Android key is added when the Play app is published.
const extra = Constants.expoConfig?.extra as
  | { revenueCatAppleKey?: string; revenueCatGoogleKey?: string }
  | undefined;

const API_KEY = Platform.select({
  ios: extra?.revenueCatAppleKey,
  android: extra?.revenueCatGoogleKey,
});

let configured = false;

/** Configure the RevenueCat SDK once at startup. Safe to call repeatedly. */
export function configurePurchases() {
  if (configured || !API_KEY) return;
  Purchases.configure({ apiKey: API_KEY });
  configured = true;
}

const toEntitlements = (info: CustomerInfo): Entitlements => ({
  isPremium: info.entitlements.active[ENTITLEMENT_PRO] !== undefined,
});

async function getProPackage(): Promise<PurchasesPackage> {
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages[0];
  if (!pkg) {
    throw new Error(
      "No Pro package available — check the RevenueCat offering and store product.",
    );
  }
  return pkg;
}

export const revenueCatProvider: BillingProvider = {
  getEntitlements: async () => {
    if (!API_KEY) return { isPremium: false };
    configurePurchases();
    return toEntitlements(await Purchases.getCustomerInfo());
  },

  onChange: (callback) => {
    if (!API_KEY) return () => {};
    configurePurchases();
    const listener = (info: CustomerInfo) => callback(toEntitlements(info));
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => Purchases.removeCustomerInfoUpdateListener(listener);
  },

  getProPriceString: async () => {
    if (!API_KEY) return null;
    configurePurchases();
    try {
      const pkg = await getProPackage();
      return pkg.product.priceString;
    } catch (error) {
      // Deliberately non-fatal — the paywall falls back to a price-less label
      // rather than refusing to open. But it must not be *silent*: swallowing
      // this bare was why a real device shipped "Unlock Pro · one-time" with
      // nothing to say why, when the very same offering fetch succeeds a moment
      // later from purchasePro().
      logger.warn("Could not load the Pro price:", error);
      return null;
    }
  },

  purchasePro: async () => {
    configurePurchases();
    if (!configured) {
      throw new Error("Purchases aren't available on this platform yet.");
    }
    const pkg = await getProPackage();
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return toEntitlements(customerInfo);
    } catch (e) {
      // A user cancelling isn't an error — report current (unchanged) state.
      if (e && typeof e === "object" && "userCancelled" in e && e.userCancelled) {
        return toEntitlements(await Purchases.getCustomerInfo());
      }
      throw e;
    }
  },

  restore: async () => {
    configurePurchases();
    if (!configured) {
      throw new Error("Purchases aren't available on this platform yet.");
    }
    return toEntitlements(await Purchases.restorePurchases());
  },
};
