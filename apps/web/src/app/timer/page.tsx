import type { Metadata } from "next";
import { SITE_URL } from "@poker/core";
import PokerTimer from "@/components/timer/PokerTimer";
import { TimerSeoContent } from "./TimerSeoContent";

export const metadata: Metadata = {
  title: "Free Online Poker Timer",
  description:
    "A free, full-screen poker tournament timer with customizable blind levels — right in your browser, no download required.",
  alternates: {
    canonical: "/timer",
  },
};

const webApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Poker Blinds Buzzer — Poker Timer",
  applicationCategory: "SportsApplication",
  operatingSystem: "Any (web browser)",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  url: `${SITE_URL}/timer`,
};

export default function TimerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static, hand-written JSON — not user input.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webApplicationJsonLd),
        }}
      />
      <PokerTimer />
      <TimerSeoContent />
    </>
  );
}
