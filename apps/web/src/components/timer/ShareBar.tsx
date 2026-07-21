"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { SITE_URL, SHARE_MESSAGE } from "@poker/core";

const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

export function ShareBar() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Poker Blinds Buzzer",
          text: SHARE_MESSAGE,
          url: SITE_URL,
        });
      } catch {
        // User dismissed the native share sheet — nothing to do.
      }
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(`${SHARE_MESSAGE} ${SITE_URL}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <footer className="mt-6 flex items-center justify-center gap-3 text-xs text-white/40">
      <span>Poker Blinds Buzzer · {SITE_HOST}</span>
      <button
        onClick={handleShare}
        className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-white/60 transition-colors hover:border-white/30 hover:text-white"
      >
        {copied ? (
          <Check className="h-3 w-3" />
        ) : (
          <Share2 className="h-3 w-3" />
        )}
        {copied ? "Copied!" : "Share"}
      </button>
    </footer>
  );
}
