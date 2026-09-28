// src/components/ui/ClubPill.tsx
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "@/src/theme";

/**
 * Marks a row as needing Club, the way {@link ProPill} marks one as needing Pro.
 *
 * **Two pills because there are two purchases.** Everything sharing-shaped wore
 * no marker at all — the share control simply vanished for somebody without the
 * subscription — so the only way to discover Club existed was to not have it and
 * notice nothing was there. A pill says which of the two a row wants before it
 * is tapped, which is the whole reason the Pro one exists.
 */
export function ClubPill() {
  return (
    <View style={styles.pill}>
      <Text style={styles.label}>CLUB</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.clubSurface,
    borderWidth: 1,
    borderColor: colors.club,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.club,
    letterSpacing: 0.5,
    paddingHorizontal: space.xs / 2,
  },
});
