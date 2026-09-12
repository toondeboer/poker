// src/app/leaderboard.tsx
import { useReportContentSettledOnMount } from "@/src/components/AppReadyGate";
import { LeaderboardScreen } from "@/src/components/leaderboard/LeaderboardScreen";

export default function LeaderboardRoute() {
  // Like Settings, Blinds and Payouts: no measure-and-rescale pass, so mounting
  // is as settled as it gets.
  useReportContentSettledOnMount();

  return <LeaderboardScreen />;
}
