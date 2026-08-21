// src/components/ui/TextField.tsx
import { forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { colors, radius, space, text } from "@/src/theme";

export type TextFieldProps = TextInputProps & {
  label?: string;
  /** Small trailing unit rendered inside the field ("seconds"). */
  suffix?: string;
  /** Muted line below the field. */
  helper?: string;
  /** `compact` is the denser style used inside list rows. */
  variant?: "default" | "compact";
};

export const TextField = forwardRef<TextInput, TextFieldProps>(
  function TextField(
    { label, suffix, helper, variant = "default", style, ...inputProps },
    ref,
  ) {
    const compact = variant === "compact";
    return (
      <View style={styles.group}>
        {label && (
          <Text style={compact ? styles.labelCompact : styles.label}>
            {label}
          </Text>
        )}
        <View>
          <TextInput
            ref={ref}
            style={[compact ? styles.inputCompact : styles.input, style]}
            placeholderTextColor={colors.textMuted}
            {...inputProps}
          />
          {suffix && <Text style={styles.suffix}>{suffix}</Text>}
        </View>
        {helper && <Text style={styles.helper}>{helper}</Text>}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  group: { gap: space.sm },
  label: { ...text.label, marginBottom: space.sm },
  labelCompact: { ...text.meta, marginBottom: space.xs },
  input: {
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    textAlign: "center",
    ...text.mono,
  },
  inputCompact: {
    backgroundColor: colors.surfaceInputCompact,
    borderWidth: 1,
    borderColor: colors.borderInputCompact,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    textAlign: "center",
    ...text.monoCompact,
  },
  suffix: {
    position: "absolute",
    right: space.md,
    top: space.lg,
    ...text.meta,
  },
  helper: { ...text.meta, marginTop: space.xs },
});
