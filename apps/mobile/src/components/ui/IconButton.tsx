// src/components/ui/IconButton.tsx
import { StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "@/src/theme";

export type IconButtonTone = "danger" | "neutral" | "accent";

/** A square tinted icon button, padded out to a comfortable touch target. */
export function IconButton({
  icon,
  onPress,
  tone = "neutral",
  disabled = false,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: IconButtonTone;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const { background, color } = TONES[tone];
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: background },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      // The visual box is 36pt; extend the touch target past it rather than
      // inflating the button and blowing out the row's height.
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={18} color={color} />
    </TouchableOpacity>
  );
}

const TONES: Record<IconButtonTone, { background: string; color: string }> = {
  danger: { background: colors.dangerSurface, color: colors.danger },
  neutral: { background: colors.surfaceInput, color: colors.textLabel },
  accent: { background: colors.iconTint, color: colors.accent },
};

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    padding: space.sm,
  },
  disabled: { opacity: 0.35 },
});
