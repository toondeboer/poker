// src/components/ui/ProPill.tsx
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "@/src/theme";

export function ProPill() {
  return (
    <View style={styles.pill}>
      <Text style={styles.label}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.proSurface,
    borderWidth: 1,
    borderColor: colors.pro,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.pro,
    letterSpacing: 0.5,
    paddingHorizontal: space.xs / 2,
  },
});
