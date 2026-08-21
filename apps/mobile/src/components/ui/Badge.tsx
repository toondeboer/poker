// src/components/ui/Badge.tsx
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "@/src/theme";

export type BadgeTone = "neutral" | "live" | "warning" | "stale";

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const { container, color } = TONES[tone];
  return (
    <View style={[styles.badge, container]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const TONES: Record<BadgeTone, { container: object; color: string }> = {
  neutral: {
    container: { backgroundColor: colors.badge },
    color: colors.textMuted,
  },
  live: {
    container: { backgroundColor: colors.success },
    color: colors.textOnAccent,
  },
  warning: {
    container: {
      backgroundColor: colors.proSurface,
      borderWidth: 1,
      borderColor: colors.pro,
    },
    color: colors.pro,
  },
  // A LIVE marker that's gone stale because the draft no longer matches what's
  // playing — shown outlined rather than hidden, so it doesn't quietly lie.
  stale: {
    container: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.borderInputCompact,
    },
    color: colors.textMuted,
  },
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  label: { fontSize: 12, fontWeight: "600" },
});
