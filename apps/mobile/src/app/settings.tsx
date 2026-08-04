// src/app/settings.tsx
import { useReportContentSettledOnMount } from "@/src/components/AppReadyGate";
import { SettingsScreen } from "@/src/components/settings/SettingsScreen";

export default function Settings() {
  // Settings has no measure-and-rescale pass to wait on, so it's ready as soon
  // as it mounts. Reporting matters for the case where this is the first route
  // shown (deep link / restored route) — see the hook for the full reasoning.
  useReportContentSettledOnMount();

  return <SettingsScreen />;
}
