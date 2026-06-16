"use client";

import { useEffect, useRef } from "react";
import { shouldShowAds } from "@poker/core";
import { useAnalyticsConsent } from "@/hooks/useAnalyticsConsent";
import { ADSENSE_CLIENT } from "@/lib/monetization";

type AdSlotProps = {
  /** The AdSense ad unit slot id. When empty the slot renders nothing. */
  slot?: string;
  className?: string;
  /** AdSense ad format; defaults to a responsive auto unit. */
  format?: string;
  responsive?: boolean;
};

/**
 * A single AdSense display unit, gated by the shared `shouldShowAds` policy from
 * @poker/core so it disappears for premium users and before consent — the same
 * gate every ad surface on web and mobile uses. Web has no IAP yet, so isPremium
 * is always false here; flipping it on later (a web Pro purchase) needs no change
 * to this component.
 */
export default function AdSlot({
  slot,
  className = "",
  format = "auto",
  responsive = true,
}: AdSlotProps) {
  const { consent } = useAnalyticsConsent();
  const pushed = useRef(false);

  const show =
    !!ADSENSE_CLIENT &&
    !!slot &&
    shouldShowAds({ isPremium: false, consentResolved: consent === "accepted" });

  useEffect(() => {
    if (!show || pushed.current) return;
    try {
      const w = window as unknown as { adsbygoogle?: Record<string, unknown>[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
      pushed.current = true;
    } catch {
      // adsbygoogle.js not ready yet; it fills queued slots once it loads.
    }
  }, [show]);

  if (!show) return null;

  return (
    <ins
      className={`adsbygoogle block ${className}`}
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}
