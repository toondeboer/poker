// src/components/settings/TournamentCard.tsx
import { StyleProp, ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { computePayouts, formatBlindRange, toPayoutOptions } from "@poker/core";
import { useTimer } from "@/src/contexts/TimerContext";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { usePremium } from "@/src/contexts/PremiumContext";
import { usePayouts } from "@/src/contexts/PayoutContext";
import { useLeaderboard } from "@/src/contexts/LeaderboardContext";
import { useFeatures } from "@/src/contexts/FeaturesContext";
import { sessionTransport } from "@/src/services/loopbackSessionTransport";
import { Badge } from "@/src/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { DurationField } from "@/src/components/ui/DurationField";
import { NavRow } from "@/src/components/ui/NavRow";
import { ProPill } from "@/src/components/ui/ProPill";

/** Round length + the entry points into the blind-structure editor and payouts. */
export function TournamentCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const { timerDuration, setTimerDuration } = useTimer();
  const { blindLevels, isDraftDirty } = useBlinds();
  const { isPremium } = usePremium();
  const { settings } = usePayouts();
  const { players, results } = useLeaderboard();
  const features = useFeatures();

  // The row summarises the saved setup even while locked, so the value on
  // offer is visible before paying rather than described in the abstract.
  const payouts = computePayouts(toPayoutOptions(settings));

  return (
    <Card style={style}>
      <CardHeader icon="time" title="Tournament" />
      <CardContent>
        <DurationField seconds={timerDuration} onChange={setTimerDuration} />
        <NavRow
          title="Blind structure"
          // Deliberately the *active* schedule, not the draft — this row should
          // always describe what the timer is actually playing.
          summary={`${blindLevels.length} levels · ${formatBlindRange(blindLevels)}`}
          badge={
            isDraftDirty ? (
              <Badge label="Unapplied changes" tone="warning" />
            ) : undefined
          }
          badgeLabel={isDraftDirty ? "Unapplied changes" : undefined}
          onPress={() => router.navigate("/blinds")}
        />
        {/* **The clock had no way in until this row.** The screen, the
            `/sessions` routes and the polling transport all shipped in 1.2.0;
            the link never did, because the route was registered back when there
            was no transport behind it and a join code nobody can join is worse
            than none. Gated on `features.sharing` as well as on there being a
            transport at all, so the kill switch reaches the clock the way it
            already reaches a shared board — without that, a clock misbehaving
            after release could only be answered with a new binary. */}
        {sessionTransport && features.sharing ? (
          <NavRow
            title="Shared clock"
            summary="One clock on every phone at the table"
            onPress={() => router.navigate("/session")}
          />
        ) : null}
        <NavRow
          title="Payouts"
          summary={
            payouts
              ? `${settings.buyIn} buy-in · ${settings.entrants} players · ${payouts.payouts.length} paid${payouts.bountyPool > 0 ? ` · ${payouts.bountyPerKnockout} bounty` : ""}`
              : "Set a buy-in and split the prize pool"
          }
          badge={isPremium ? undefined : <ProPill />}
          badgeLabel={isPremium ? undefined : "Pro"}
          // Navigates even when locked: the screen shows what the feature does
          // and offers the unlock, which converts better than a row that just
          // refuses to open.
          onPress={() => router.navigate("/payouts")}
        />
        <NavRow
          title="Leaderboard"
          summary={
            results.length > 0
              ? `${results.length} ${results.length === 1 ? "game" : "games"} · ${players.length} ${players.length === 1 ? "player" : "players"}`
              : "Track who wins across game nights"
          }
          badge={isPremium ? undefined : <ProPill />}
          badgeLabel={isPremium ? undefined : "Pro"}
          onPress={() => router.navigate("/leaderboard")}
        />
        <NavRow
          title="Deal a hand"
          summary={
            players.length > 0
              ? `Deal from the phone · ${players.length} on the roster`
              : "Deal from the phone when you have chips but no cards"
          }
          badge={isPremium ? undefined : <ProPill />}
          badgeLabel={isPremium ? undefined : "Pro"}
          onPress={() => router.navigate("/game")}
        />
      </CardContent>
    </Card>
  );
}
