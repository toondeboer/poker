// src/app/paywall.tsx
import { useReportContentSettledOnMount } from "@/src/components/AppReadyGate";
import { Paywall } from "@/src/components/paywall/Paywall";

export default function PaywallRoute() {
  useReportContentSettledOnMount();
  return <Paywall />;
}
