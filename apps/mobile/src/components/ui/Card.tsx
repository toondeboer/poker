// src/components/ui/Card.tsx
import { ReactNode } from "react";
import { StyleSheet, Text, View, ViewStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, text } from "@/src/theme";

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardHeader({
  icon,
  title,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** Trailing slot — a Badge, a ProPill, an action. */
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerIcon}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {right}
    </View>
  );
}

export function CardContent({ children }: { children: ReactNode }) {
  return <View style={styles.content}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xl,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: space.xl,
  },
  headerIcon: {
    width: 40,
    height: 40,
    backgroundColor: colors.iconTint,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: space.md,
  },
  title: {
    ...text.cardTitle,
    flex: 1,
  },
  content: {
    gap: space.lg,
  },
});
