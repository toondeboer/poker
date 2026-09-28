// src/app/payouts.tsx
import { useReportContentSettledOnMount } from "@/src/components/AppReadyGate";
import { PayoutScreen } from "@/src/components/payouts/PayoutScreen";

export default function PayoutsRoute() {
  // Like Settings and Blinds: no measure-and-rescale pass here, so mounting is
  // as settled as it gets. Without it a launch restored straight onto this
  // route would sit behind the splash until AppReadyGate's 4s ceiling fired.
  useReportContentSettledOnMount();

  return <PayoutScreen />;
}
