// src/hooks/useAdsConsent.ts
import { useEffect, useSyncExternalStore } from "react";
import { usePremium } from "@/src/contexts/PremiumContext";
import {
  getAdsConsentState,
  startAdsConsent,
  subscribeAdsConsent,
} from "@/src/services/adsConsent";

/**
 * The privacy/consent gate for ads. `consentResolved` feeds the shared
 * `shouldShowAds` policy, and `privacyOptionsRequired` says whether Settings
 * must offer a way back into the consent form.
 *
 * Mounting this is also what starts the consent flow (Google's UMP, through
 * `AdsConsent`), and only once the store has answered "not Pro". `isPremium`
 * starts `false` for everyone, so starting on that alone would put a consent
 * form about ads in front of somebody who has paid to have none.
 */
export function useAdsConsent() {
  const { isPremium, entitlementsKnown } = usePremium();
  const state = useSyncExternalStore(subscribeAdsConsent, getAdsConsentState);

  useEffect(() => {
    if (entitlementsKnown && !isPremium) void startAdsConsent();
  }, [entitlementsKnown, isPremium]);

  return state;
}
