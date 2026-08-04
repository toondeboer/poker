// src/app/settings.tsx
import { useEffect } from "react";
import PokerSettings from "@/src/components/PokerSettings";
import { useAppReady } from "@/src/components/AppReadyGate";

export default function Settings() {
  const { reportContentSettled } = useAppReady();

  // Settings has no measure-and-rescale pass to wait on, so it's ready as soon
  // as it mounts. Reporting matters for the case where this is the first route
  // shown (deep link / restored route): without it nothing would ever report and
  // the splash would sit there until AppReadyGate's ceiling fired.
  useEffect(() => {
    reportContentSettled();
  }, [reportContentSettled]);

  return <PokerSettings />;
}
