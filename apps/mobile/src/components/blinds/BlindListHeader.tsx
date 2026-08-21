// src/components/blinds/BlindListHeader.tsx
import { StyleSheet, Text, View } from "react-native";
import { BlindLevel, formatBlindRange } from "@poker/core";
import { colors, radius, space, text } from "@/src/theme";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";

export function BlindListHeader({
  levels,
  isDirty,
  onGenerate,
  onReset,
}: {
  levels: BlindLevel[];
  isDirty: boolean;
  onGenerate: () => void;
  onReset: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.summary}>
        <Badge label={`${levels.length} levels`} />
        <Text style={styles.range} numberOfLines={1}>
          {formatBlindRange(levels)}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Generate"
          icon="sparkles"
          variant="secondary"
          size="sm"
          onPress={onGenerate}
          style={styles.action}
        />
        <Button
          label="Reset to default"
          icon="refresh"
          variant="ghost"
          size="sm"
          onPress={onReset}
          style={styles.action}
        />
      </View>

      <Text style={styles.note}>
        {isDirty
          ? "Unapplied changes — tap-to-jump is available once you apply."
          : "Tap a level number to jump the running tournament to it."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space.md,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  summary: { flexDirection: "row", alignItems: "center", gap: space.md },
  range: { ...text.monoCompact, color: colors.textLabel, flex: 1 },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1 },
  note: {
    ...text.meta,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
