"use client";

import Script from "next/script";
import { useAnalyticsConsent } from "@/hooks/useAnalyticsConsent";
import { ADSENSE_CLIENT } from "@/lib/monetization";

/**
 * Loads the Google AdSense library only after the visitor opts in, mirroring the
 * analytics gate in AnalyticsConsent. Renders nothing until a publisher id is
 * configured (NEXT_PUBLIC_ADSENSE_CLIENT), so the site is unaffected until set up.
 */
export default function AdSenseScript() {
  const { consent } = useAnalyticsConsent();

  if (!ADSENSE_CLIENT || consent !== "accepted") return null;

  return (
    <Script
      id="adsbygoogle-init"
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
    />
  );
}
