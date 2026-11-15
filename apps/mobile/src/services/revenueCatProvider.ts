// src/services/revenueCatProvider.ts
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  PRODUCT_PRO_TRIAL,
  proTrialState,
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
  /**
   * The same price as a **number**, in the storefront's currency.
   *
   * **Never rendered** — `priceString` is the only thing that goes on screen,
   * because only the store knows where the currency sign belongs. This exists
   * solely so the two plans can be compared arithmetically for the saving the
   * annual advertises; see `annualSavingPercent`, which is why it is a number
   * rather than something parsed back out of the string above.
   */
  price: number;
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
  /**
   * Whether the Pro trial can be started on this build at all.
   *
   * False on iOS until the free trial product exists in App Store Connect, so
   * the app never shows a button that would fail.
   */
  isProTrialAvailable(): Promise<boolean>;
  /** Start the Pro trial. Resolves with the resulting entitlements. */
  startProTrial(): Promise<Entitlements>;
}

/** Nothing owned — the safe answer in both directions, with no billing wired. */
const NOTHING: Entitlements = {
  isPremium: false,
  hasClub: false,
  ownsProOutright: false,
  proTrial: { status: "unused" },
};

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
/**
 * Where Android keeps the day the Pro trial started.
 *
 * **On the device, because Google Play has nothing to keep it in**: there is no
 * free one-time product to buy. So clearing the app's data or reinstalling
 * offers the trial again. Accepted knowingly; the alternative is a server-side
 * record keyed on a device id, which is more data collected to stop somebody
 * getting a second fortnight of a €2.99 app.
 */
const ANDROID_TRIAL_STARTED_AT = "pro_trial_started_at";

/**
 * When the Pro trial started, as a millisecond timestamp, or `null`.
 *
 * **iOS reads the store's own purchase date** for the free trial product, so it
 * survives a reinstall and comes back with a restore. `allPurchaseDates` rather
 * than an entitlement: a non-consumable's entitlement would never expire, and
 * the trial product deliberately grants none.
 */
async function trialStartedAt(info: CustomerInfo): Promise<number | null> {
  if (Platform.OS === "ios") {
    const purchased = info.allPurchaseDates[PRODUCT_PRO_TRIAL];
    const parsed = purchased ? Date.parse(purchased) : NaN;
    return Number.isNaN(parsed) ? null : parsed;
  }
  const stored = Number(await AsyncStorage.getItem(ANDROID_TRIAL_STARTED_AT));
  return Number.isFinite(stored) && stored > 0 ? stored : null;
}

/** The free trial product from the App Store, or `null` when it is not there. */
async function getTrialProduct() {
  const [product] = await Purchases.getProducts(
    [PRODUCT_PRO_TRIAL],
    Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  );
  return product ?? null;
}

const toEntitlements = async (info: CustomerInfo): Promise<Entitlements> =>
  entitlementsFrom({
    proTrial: proTrialState(await trialStartedAt(info), Date.now()),
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
  /**
   * **Annual first — and this reverses what this line used to do.**
   *
   * It sorted monthly first, on the reasoning that the cheaper number should
   * lead because "a list that opens with the larger one reads as the price of
   * the thing". That was right while the two were offered as equals. They are
   * not any more: the annual is the plan worth selling, it now carries the
   * saving against twelve monthlies, and the badge beside it explains the
   * bigger number that used to need explaining away.
   *
   * The monthly is the trial, which is what `ROADMAP.md` concluded from the
   * prices — €2.99 a month is €35.88 against a €2.99 app, and one month of Club
   * already grants Pro permanently.
   */
  return found.sort((a, b) => (a.period === "annual" ? -1 : 1));
}

export const revenueCatProvider: BillingProvider = {
  getEntitlements: async () => {
    // No billing configured at all: nothing is owned, which is the safe answer
    // in both directions — no paid feature is unlocked, and no purchase is
    // claimed to exist that could be "restored".
    if (!API_KEY) return NOTHING;
    configurePurchases();
    try {
      return await toEntitlements(await Purchases.getCustomerInfo());
    } catch (error) {
      // **An Android trial does not depend on the store, so a store that
      // cannot be reached must not end it.** The start date is on the device;
      // without this, somebody mid-trial who opened the app with no network and
      // no cached customer info would find ads back and everything locked.
      // Purchases still read as not held, which is what a failure already
      // meant. iOS has nowhere else to read the date from, so it rethrows.
      if (Platform.OS === "ios") throw error;
      const stored = Number(
        await AsyncStorage.getItem(ANDROID_TRIAL_STARTED_AT),
      );
      return entitlementsFrom({
        pro: false,
        club: false,
        clubEver: false,
        proTrial: proTrialState(
          Number.isFinite(stored) && stored > 0 ? stored : null,
          Date.now(),
        ),
      });
    }
  },

  onChange: (callback) => {
    if (!API_KEY) return () => {};
    configurePurchases();
    const listener = (info: CustomerInfo) =>
      void toEntitlements(info).then(callback);
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
        price: pkg.product.price,
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

  isProTrialAvailable: async () => {
    if (!API_KEY) return false;
    // Nothing to buy on Android, so nothing that can be missing.
    if (Platform.OS !== "ios") return true;
    configurePurchases();
    try {
      return (await getTrialProduct()) !== null;
    } catch (error) {
      logger.warn("Could not load the Pro trial product:", error);
      return false;
    }
  },

  startProTrial: async () => {
    configurePurchases();
    if (!configured) {
      throw new Error("Purchases aren't available on this platform yet.");
    }
    if (Platform.OS !== "ios") {
      // **Never overwritten.** Starting twice must not restart the clock, and
      // a trial that has ended must stay ended.
      if ((await AsyncStorage.getItem(ANDROID_TRIAL_STARTED_AT)) === null) {
        await AsyncStorage.setItem(
          ANDROID_TRIAL_STARTED_AT,
          String(Date.now()),
        );
      }
      return toEntitlements(await Purchases.getCustomerInfo());
    }
    const product = await getTrialProduct();
    if (!product) {
      throw new Error("The free trial isn't available right now.");
    }
    try {
      const { customerInfo } = await Purchases.purchaseStoreProduct(product);
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
