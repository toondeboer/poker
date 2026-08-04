// src/components/ui/ListRow.tsx
import { ReactNode } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius, space, text } from "@/src/theme";

/** A tinted row on a card surface: title + meta on the left, actions on the right. */
export function ListRow({
  title,
  meta,
  onPress,
  selected = false,
  right,
  style,
}: {
  title: string;
  meta?: string;
  /** Makes the text block itself tappable (selection rows). */
  onPress?: () => void;
  selected?: boolean;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const info = (
    <>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {meta && <Text style={styles.meta}>{meta}</Text>}
    </>
  );

  return (
    <View style={[styles.row, selected && styles.rowSelected, style]}>
      {onPress ? (
        <TouchableOpacity
          style={styles.info}
          onPress={onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          {info}
        </TouchableOpacity>
      ) : (
        <View style={styles.info}>{info}</View>
      )}
      {right}
    </View>
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
    padding: space.md,
  },
  rowSelected: {
    borderColor: colors.pro,
    backgroundColor: colors.proSurfaceSoft,
  },
  info: { flex: 1 },
  title: text.rowTitle,
  meta: { ...text.meta, marginTop: 2 },
});
