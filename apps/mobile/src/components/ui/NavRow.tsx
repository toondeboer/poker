// src/components/ui/NavRow.tsx
import { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, text } from "@/src/theme";

/** A tappable row that navigates elsewhere: title, summary, optional badge, chevron. */
export function NavRow({
  title,
  summary,
  badge,
  onPress,
}: {
  title: string;
  summary: string;
  badge?: ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${summary}`}
    >
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {badge}
        </View>
        <Text style={styles.summary} numberOfLines={1}>
          {summary}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  info: { flex: 1, gap: space.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: text.rowTitle,
  summary: { ...text.meta, fontFamily: "monospace" },
});
