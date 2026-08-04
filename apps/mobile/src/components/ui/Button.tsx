// src/components/ui/Button.tsx
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "@/src/theme";

export type ButtonVariant =
  "primary" | "success" | "secondary" | "pro" | "ghost" | "danger";

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  fullWidth = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = TONES[variant];
  return (
    <TouchableOpacity
      style={[
        styles.base,
        size === "sm" ? styles.sizeSm : styles.sizeMd,
        tone.container,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={size === "sm" ? 14 : 18}
          color={tone.label.color}
        />
      )}
      <Text style={[styles.label, size === "sm" && styles.labelSm, tone.label]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Coloured shadow matching the fill, as the original buttons had. */
const glow = (color: string) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 12,
  elevation: 6,
});

const TONES: Record<
  ButtonVariant,
  { container: ViewStyle; label: { color: string } }
> = {
  primary: {
    container: { backgroundColor: colors.accent, ...glow(colors.accent) },
    label: { color: colors.textOnAccent },
  },
  success: {
    container: { backgroundColor: colors.success, ...glow(colors.success) },
    label: { color: colors.textOnAccent },
  },
  secondary: {
    container: { backgroundColor: colors.neutral },
    label: { color: colors.textOnAccent },
  },
  pro: {
    container: { backgroundColor: colors.pro, ...glow(colors.pro) },
    label: { color: colors.textOnPro },
  },
  ghost: {
    container: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.borderInput,
    },
    label: { color: colors.textLabel },
  },
  danger: {
    container: {
      backgroundColor: colors.dangerSurface,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    label: { color: colors.danger },
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    gap: space.sm,
  },
  sizeMd: { paddingVertical: space.md, paddingHorizontal: space.lg },
  sizeSm: { paddingVertical: space.sm, paddingHorizontal: space.md },
  fullWidth: { alignSelf: "stretch" },
  disabled: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: "500" },
  labelSm: { fontSize: 14, fontWeight: "600" },
});
