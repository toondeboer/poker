import type { Metadata } from "next";
import { GuideContent } from "./GuideContent";

export const metadata: Metadata = {
  title: "How to Run a Home Poker Tournament",
  description:
    "A step-by-step guide to running a home poker tournament: buy-ins, blind structures, payouts, and keeping the game on schedule with a blinds timer.",
  alternates: {
    canonical: "/guide",
  },
};

export default function GuidePage() {
  return <GuideContent />;
}
