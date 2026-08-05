// src/components/ui/SheetHeader.tsx
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, space, text } from "@/src/theme";

/**
 * Title row for a screen presented as a native form sheet.
 *
 * The sheet chrome itself — grabber, backdrop, drag-to-dismiss, corner radius —
 * comes from `react-native-screens` via the route's `presentation: "formSheet"`,
 * so this is only the title and an explicit close affordance. The close button
 * stays despite the drag gesture: Android doesn't render a grabber, so without it
 * there'd be no *visible* way out on that platform.
 */
export function SheetHeader({
  title,
  onClose,
}: {
  /** Omit when the screen already renders its own headline. */
  title?: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.header}>
      {title ? (
        <Text style={styles.title}>{title}</Text>
      ) : (
        <View style={styles.spacer} />
      )}
      <TouchableOpacity
        onPress={onClose}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={22} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  title: { ...text.cardTitle, flex: 1 },
  spacer: { flex: 1 },
});
