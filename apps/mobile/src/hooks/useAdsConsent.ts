// src/hooks/useAdsConsent.ts
import { useEffect, useState } from "react";

/**
 * Phase 2 placeholder for the privacy/consent gate. Reports whether ads may load
 * yet — its `consentResolved` flag feeds the shared `shouldShowAds` policy. Real
 * Phase 2 wiring replaces the body with Google's UMP (`AdsConsent`) + the iOS ATT
 * request; until then it resolves immediately on mount (and we request only
 * non-personalized ads in {@link BannerAdSlot}, the simplest compliant posture).
 */
export function useAdsConsent() {
  const [consentResolved, setConsentResolved] = useState(false);

  useEffect(() => {
    let active = true;
    // TODO(phase2): request UMP consent + ATT here; resolve once the real
    // async flow returns. Deferred so ads never load before the gate resolves.
    Promise.resolve().then(() => {
      if (active) setConsentResolved(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return { consentResolved };
}
