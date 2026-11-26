// src/services/interstitial.ts
import { AdEventType, InterstitialAd } from "react-native-google-mobile-ads";
import { shouldShowInterstitial, type AdPolicyInput } from "@poker/core";
import { INTERSTITIAL_AD_UNIT_ID } from "@/src/services/ads";

/**
 * One preloaded full-screen ad, shown at a round change when
 * `shouldShowInterstitial` in @poker/core allows it.
 *
 * Preloaded so that showing it is instant: an ad that has to load first would
 * arrive seconds into the new round, unconnected to the tap that started it.
 * If none is loaded at a round change, that round simply gets no ad, and the
 * count carries over so the next round change gets one.
 *
 * Non-personalized, like the banner: the privacy policy and both store privacy
 * declarations promise exactly that.
 */

/** When this launch began. Module scope is evaluated once per JS launch. */
const launchedAt = Date.now();
let roundsSinceLastAd = 0;
let ad: InterstitialAd | null = null;

function getAd() {
  if (ad || !INTERSTITIAL_AD_UNIT_ID) return ad;
  ad = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true,
  });
  // Have the next one ready for the next round. A failed load is not retried
  // here: the next `preloadInterstitial` call (at the next round change) tries
  // again, which is retry enough for an ad.
  ad.addAdEventListener(AdEventType.CLOSED, () => ad?.load());
  return ad;
}

/**
 * Starts loading an ad if none is loaded or loading. Safe to call repeatedly;
 * the SDK ignores `load()` while one is in flight or ready. Only call it once
 * `shouldShowAds` is true — before the consent gate the SDK isn't initialized.
 */
export function preloadInterstitial() {
  getAd()?.load();
}

/**
 * Call once per round change the user confirmed (the end-of-round alert).
 * Counts it, and shows the preloaded ad if the policy allows one now. Never
 * throws: a missed ad is not worth an error anywhere.
 */
export function onRoundChanged(adPolicy: AdPolicyInput) {
  roundsSinceLastAd += 1;
  const current = getAd();
  if (!current) return;
  if (!current.loaded) {
    // An earlier load failed, or this one is still in flight: try again so the
    // next round change has one.
    current.load();
    return;
  }
  const eligible = shouldShowInterstitial({
    ...adPolicy,
    roundsSinceLastAd,
    now: Date.now(),
    launchedAt,
  });
  if (!eligible) return;
  const counted = roundsSinceLastAd;
  roundsSinceLastAd = 0;
  current.show().catch(() => {
    // Nothing was shown after all; keep the count so the next round is due.
    roundsSinceLastAd = counted;
  });
}
