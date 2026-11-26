// src/hooks/useRoundChangeInterstitial.ts
import { useEffect } from "react";
import { shouldShowAds } from "@poker/core";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useAdsConsent } from "@/src/hooks/useAdsConsent";
import {
  onRoundChanged,
  preloadInterstitial,
} from "@/src/services/interstitial";

/**
 * The end-of-round alert fades out; presenting a full-screen ad while its
 * modal is still dismissing can be refused on iOS ("already presenting").
 * Comfortably longer than the fade.
 */
const AFTER_ALERT_CLOSES_MS = 500;

/**
 * Full-screen ads at round changes. Wrap the end-of-round alert's buttons with
 * the returned function: the button's own action runs first and unchanged (so
 * "next round" starts the clock before any ad), then an ad may follow over it.
 * Whether one does is `shouldShowInterstitial` in @poker/core.
 */
export function useRoundChangeInterstitial() {
  const { isPremium } = usePremium();
  const { consentResolved } = useAdsConsent();
  const adsAllowed = shouldShowAds({ isPremium, consentResolved });

  useEffect(() => {
    if (adsAllowed) preloadInterstitial();
  }, [adsAllowed]);

  return (action: () => void | Promise<void>) => () => {
    void action();
    setTimeout(
      () => onRoundChanged({ isPremium, consentResolved }),
      AFTER_ALERT_CLOSES_MS,
    );
  };
}
