// src/services/ads.ts
import { Platform } from "react-native";
import mobileAds, {
  MaxAdContentRating,
  TestIds,
} from "react-native-google-mobile-ads";

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

/**
 * Initializes the Google Mobile Ads SDK. Call once at app startup.
 *
 * **The content cap is the point of this function doing anything at all.**
 * With no request configuration the SDK's default admits `MA` inventory, which
 * Google's own docs describe as including "alcohol, **gambling**, sexual content
 * and weapons" — gambling ads served into a poker app asking to be rated 4+ is
 * the worst combination available, and it is what shipped before this line
 * existed. `G` matches the rating the app is asking for; anything looser is a
 * decision to serve ads the store listing does not lead you to expect.
 *
 * **`tagForChildDirectedTreatment` is deliberately not set.** This is not a
 * child-directed app — it is a tool for adults running a poker night that
 * happens to contain nothing objectionable — and the SDK warns that abusing that
 * flag can terminate the Google account. A 4+ rating is a statement about
 * content, not about the audience.
 *
 * Awaited rather than fired and forgotten: the configuration has to be in place
 * before the first request, or the first banner of a cold launch is the one that
 * ignores it.
 */
export async function initializeAds() {
  await mobileAds().setRequestConfiguration({
    maxAdContentRating: MaxAdContentRating.G,
  });
  return mobileAds().initialize();
}
