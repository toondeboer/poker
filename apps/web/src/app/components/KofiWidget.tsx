"use client";

import Script from "next/script";
import { KOFI_USERNAME } from "@/lib/monetization";

declare global {
  interface Window {
    kofiWidgetOverlay?: {
      draw: (username: string, config: Record<string, string>) => void;
    };
  }
}

/**
 * Floating Ko-fi "Support Me" button, loaded site-wide. Renders nothing until a
 * Ko-fi tip-jar URL is configured (NEXT_PUBLIC_TIP_JAR_URL → {@link KOFI_USERNAME}),
 * so the site is unaffected until set up. Mounted once in the root layout; the
 * widget injects its own floating element, so it persists across navigations.
 */
export default function KofiWidget() {
  const username = KOFI_USERNAME;
  if (!username) return null;

  return (
    <Script
      id="kofi-overlay-widget"
      src="https://storage.ko-fi.com/cdn/scripts/overlay-widget.js"
      strategy="afterInteractive"
      onLoad={() => {
        window.kofiWidgetOverlay?.draw(username, {
          type: "floating-chat",
          "floating-chat.donateButton.text": "Chip in",
          // Brand accent used across the site (feature tiles, mobile FAB).
          "floating-chat.donateButton.background-color": "#C64839",
          "floating-chat.donateButton.text-color": "#fff",
        });
      }}
    />
  );
}
