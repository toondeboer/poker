import type { Metadata } from "next";
import PokerTimer from "@/components/timer/PokerTimer";

export const metadata: Metadata = {
  title: "Poker Timer — Poker Blinds Buzzer",
  description:
    "A free, full-screen poker tournament timer with customizable blind levels — right in your browser.",
};

export default function TimerPage() {
  return <PokerTimer />;
}
