// src/services/revenueCatProvider.ts
import { Platform } from "react-native";
import Constants from "expo-constants";
import { logger } from "@/src/utils/logger";
import Purchases, {
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import {
  ENTITLEMENT_PRO,
  ENTITLEMENT_CLUB,
  entitlementsFrom,
  PRODUCT_PRO_LIFETIME,
  type EntitlementProvider,
  type Entitlements,
} from "@poker/core";

/**
 * Mobile billing surface: the read-only entitlement contract from @poker/core
 * plus the purchase/restore actions and the localized price the paywall needs.
 * The web app implements only the read side; mobile layers billing on top.
 */
/**
 * One Club plan, as the paywall needs to show it.
 *
 * **The price and the period travel together, because Apple requires both to
 * be on screen** — guideline 3.1.2 wants the title, the length of the period
 * and the price shown in the app, not only in the store. A price with no period
 * beside it is the version that gets rejected.
 */
export type ClubPlan = {
  /** RevenueCat's package identifier, which is what buys it. */
  id: string;
  /** "Monthly" or "Annual", for the row's label. */
  period: "monthly" | "annual";
  /** Localised and store-correct — never built by hand from a number. */
  priceString: string;
};

export interface BillingProvider extends EntitlementProvider {
  /** Start the Pro purchase flow. Resolves with the resulting entitlements. */
  purchasePro(): Promise<Entitlements>;
  /** Restore prior purchases (Apple-required). Resolves with entitlements. */
  restore(): Promise<Entitlements>;
  /** Localized price string for the Pro package, or null if unavailable. */
  getProPriceString(): Promise<string | null>;
  /**
   * The Club plans on sale, or `[]` when there are none.
   *
   * Empty rather than throwing: until the subscriptions exist in both stores
   * this is the ordinary state, and a paywall that refused to open because one
   * product was missing would take Pro down with it.
   */
  getClubPlans(): Promise<ClubPlan[]>;
  /** Buy one of them, by the id from `getClubPlans`. */
  purchaseClub(planId: string): Promise<Entitlements>;
}

// Public RevenueCat SDK keys are safe to ship in the client (set in app.json
// `extra`). Android key is added when the Play app is published.
const extra = Constants.expoConfig?.extra as
  { revenueCatAppleKey?: string; revenueCatGoogleKey?: string } | undefined;

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

/**
 * **Both read independently, then combined by `entitlementsFrom`.**
 *
 * They are separate purchases and RevenueCat is asked about each on its own —
 * inferring one from the other *here* is how somebody ends up with what they
 * did not buy. The one direction that is a product rule, Club including Pro,
 * is applied in `@poker/core` where it is written down and tested, rather than
 * being an undocumented `||` in a mapping function.
 */
const toEntitlements = (info: CustomerInfo): Entitlements =>
  entitlementsFrom({
    pro: info.entitlements.active[ENTITLEMENT_PRO] !== undefined,
    club: info.entitlements.active[ENTITLEMENT_CLUB] !== undefined,
    // **`all`, not `active`** — every entitlement the receipt has ever carried,
    // lapsed ones included. Reading it from the receipt rather than a flag on
    // the device is what makes "Pro, once granted, stays granted" survive a
    // reinstall, which is the only way it means anything.
    clubEver: info.entitlements.all[ENTITLEMENT_CLUB] !== undefined,
  });

/**
 * The Pro package, **found by its product id rather than by being first**.
 *
 * `availablePackages[0]` was fine while the offering held one product and
 * becomes a live bug the moment it holds two: the shared-boards subscription is
 * going into the same offering, and whichever RevenueCat happened to order
 * first would then be what the Pro price showed and what the Pro button bought.
 * A person tapping "Unlock Pro · one-time" and being charged monthly is not a
 * mistake that gets a second chance.
 */
async function getProPackage(): Promise<PurchasesPackage> {
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const pkg = packages.find(
    (candidate) => candidate.product.identifier === PRODUCT_PRO_LIFETIME,
  );
  if (!pkg) {
    throw new Error(
      `No package for ${PRODUCT_PRO_LIFETIME} in the current offering — check RevenueCat and the store product.`,
    );
  }
  return pkg;
}

/**
 * The Club packages in the current offering.
 *
 * **Found by billing period rather than by product id**, unlike Pro. The two
 * stores disagree about what a Club product is called — App Store Connect has
 * `club_monthly`, and Play has one subscription with base plans, which
 * RevenueCat identifies as `club:monthly`. Matching on either name would work
 * on one platform and silently return nothing on the other.
 *
 * `packageType` is RevenueCat's own normalisation of exactly that difference,
 * so it is the thing to match on.
 */
async function getClubPackages(): Promise<
  { pkg: PurchasesPackage; period: "monthly" | "annual" }[]
> {
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const found: { pkg: PurchasesPackage; period: "monthly" | "annual" }[] = [];
  for (const pkg of packages) {
    if (pkg.packageType === PACKAGE_TYPE.MONTHLY) {
      found.push({ pkg, period: "monthly" });
    } else if (pkg.packageType === PACKAGE_TYPE.ANNUAL) {
      found.push({ pkg, period: "annual" });
    }
  }
  // Monthly first: it is the cheaper number, and a list that opens with the
  // larger one reads as the price of the thing.
  return found.sort((a, b) => (a.period === "monthly" ? -1 : 1));
}

export const revenueCatProvider: BillingProvider = {
  getEntitlements: async () => {
    // No billing configured at all: nothing is owned, which is the safe answer
    // in both directions — no paid feature is unlocked, and no purchase is
    // claimed to exist that could be "restored".
    if (!API_KEY) {
      return { isPremium: false, hasClub: false, ownsProOutright: false };
    }
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
      if (
        e &&
        typeof e === "object" &&
        "userCancelled" in e &&
        e.userCancelled
      ) {
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

  getClubPlans: async () => {
    if (!API_KEY) return [];
    configurePurchases();
    try {
      return (await getClubPackages()).map(({ pkg, period }) => ({
        id: pkg.identifier,
        period,
        priceString: pkg.product.priceString,
      }));
    } catch (error) {
      // Same posture as the Pro price: a paywall that cannot price Club still
      // has to open, because Pro is on it. Warned rather than swallowed, so a
      // missing product is visible in a log instead of being deduced from an
      // absent section.
      logger.warn("Could not load the Club plans:", error);
      return [];
    }
  },

  purchaseClub: async (planId: string) => {
    configurePurchases();
    if (!configured) {
      throw new Error("Purchases aren't available on this platform yet.");
    }
    const match = (await getClubPackages()).find(
      ({ pkg }) => pkg.identifier === planId,
    );
    if (!match) {
      throw new Error(
        `No Club package ${planId} in the current offering — check RevenueCat and the store products.`,
      );
    }
    try {
      const { customerInfo } = await Purchases.purchasePackage(match.pkg);
      return toEntitlements(customerInfo);
    } catch (e) {
      // Cancelling is not an error, exactly as for Pro.
      if (
        e &&
        typeof e === "object" &&
        "userCancelled" in e &&
        e.userCancelled
      ) {
        return toEntitlements(await Purchases.getCustomerInfo());
      }
      throw e;
    }
  },
};
