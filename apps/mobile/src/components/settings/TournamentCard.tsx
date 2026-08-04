// src/components/settings/TournamentCard.tsx
import { StyleProp, ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { formatBlindRange } from "@poker/core";
import { useTimer } from "@/src/contexts/TimerContext";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { Badge } from "@/src/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { DurationField } from "@/src/components/ui/DurationField";
import { NavRow } from "@/src/components/ui/NavRow";

/** Round length + the entry point into the blind-structure editor. */
export function TournamentCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const { timerDuration, setTimerDuration } = useTimer();
  const { blindLevels, isDraftDirty } = useBlinds();

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
          onPress={() => router.navigate("/blinds")}
        />
      </CardContent>
    </Card>
  );
}
