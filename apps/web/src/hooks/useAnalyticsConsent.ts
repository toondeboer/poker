"use client";

import { useCallback, useEffect, useState } from "react";

export const CONSENT_STORAGE_KEY = "analytics-consent";
const CONSENT_EVENT = "analytics-consent-change";

export type Consent = "accepted" | "declined";

const isConsent = (value: string | null): value is Consent =>
  value === "accepted" || value === "declined";

/**
 * Reads the visitor's analytics/advertising consent choice and keeps every
 * consumer in sync. The banner, the analytics script, and the ad components all
 * use this, so accepting in the banner immediately unblocks the others (via a
 * same-document event) without a page reload, and a choice made in another tab
 * propagates through the native `storage` event.
 */
export function useAnalyticsConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const read = () => {
      const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      setConsent(isConsent(stored) ? stored : null);
    };
    queueMicrotask(() => {
      read();
      setHydrated(true);
    });
    window.addEventListener(CONSENT_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(CONSENT_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const choose = useCallback((value: Consent) => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    setConsent(value);
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }, []);

  return { consent, hydrated, choose };
}
