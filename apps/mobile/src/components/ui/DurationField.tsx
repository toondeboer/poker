// src/components/ui/DurationField.tsx
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatTime, joinDuration, splitDuration } from "@poker/core";
import { space, text } from "@/src/theme";
import { NumberField } from "./NumberField";

/**
 * Minutes + seconds editor for a round duration, matching the web app's shape.
 *
 * Commits on every edit rather than behind a Save button: core's `withDuration`
 * only re-syncs `timeLeft` on a genuinely reset timer, so changing this mid-round
 * never disturbs a running round.
 */
export function DurationField({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  const [parts, setParts] = useState(() => splitDuration(seconds));

  // Re-sync when the duration changes elsewhere (loading a preset). Adjusting
  // state during render rather than in an effect: React re-runs this component
  // immediately without committing the intermediate result, so there's no
  // cascading render — the effect version showed a stale value for one frame.
  const [syncedSeconds, setSyncedSeconds] = useState(seconds);
  if (syncedSeconds !== seconds) {
    setSyncedSeconds(seconds);
    setParts(splitDuration(seconds));
  }

  const commit = (next: { minutes: number; seconds: number }) => {
    setParts(next);
    onChange(joinDuration(next.minutes, next.seconds));
  };

  return (
    <View style={styles.group}>
      <Text style={styles.label}>Round duration</Text>
      <View style={styles.row}>
        <View style={styles.field}>
          <NumberField
            label="Minutes"
            variant="compact"
            value={parts.minutes}
            onChangeValue={(minutes) => commit({ ...parts, minutes })}
            maxLength={3}
          />
        </View>
        <View style={styles.field}>
          <NumberField
            label="Seconds"
            variant="compact"
            value={parts.seconds}
            onChangeValue={(value) =>
              commit({ ...parts, seconds: Math.min(59, value) })
            }
            maxLength={2}
          />
        </View>
      </View>
      <Text style={styles.helper}>
        Each blind level lasts{" "}
        {formatTime(joinDuration(parts.minutes, parts.seconds))}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  label: { ...text.label },
  row: { flexDirection: "row", gap: space.md },
  field: { flex: 1 },
  helper: { ...text.meta, marginTop: space.xs },
});
