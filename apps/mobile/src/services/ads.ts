// src/services/ads.ts
import { Platform } from "react-native";
import mobileAds, { TestIds } from "react-native-google-mobile-ads";

/**
 * Banner ad unit id. Uses Google's always-fill TEST unit in development; swap the
 * placeholders below for your real per-platform AdMob unit ids before a
 * production build (create them in the AdMob console alongside the app ids set in
 * app.json).
 */
export const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : (Platform.select({
      ios: "ca-app-pub-9738048037268359/6329411686",
      android: "ca-app-pub-9738048037268359/5644145279",
      default: TestIds.BANNER,
    }) ?? TestIds.BANNER);

/** Initializes the Google Mobile Ads SDK. Call once at app startup. */
export function initializeAds() {
  return mobileAds().initialize();
}
