// src/components/ui/NumberField.tsx
import { useEffect, useRef, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, space, text } from "@/src/theme";
import { TextField, TextFieldProps } from "./TextField";

/**
 * iOS's `number-pad` keyboard has no Return key, so a numeric field has no
 * keyboard-native way out — the only escape is tapping somewhere else, which
 * inside a bottom sheet often means tapping the backdrop and losing the sheet
 * along with the keyboard. An `InputAccessoryView` puts a Done bar directly
 * above the keypad instead. Android's IME has its own dismiss affordance in the
 * navigation bar, so this is iOS-only.
 *
 * Rendered only while the field is focused: an accessory per mounted field
 * would mean 60 of them in a 30-row blind editor, all but one inert.
 */
let nextAccessoryId = 0;

/**
 * A numeric field that keeps the *raw string* while you type.
 *
 * The old settings screen bound inputs straight to `Number(text)`, so clearing a
 * field showed a literal `0` you then had to select and overwrite. Here an empty
 * field stays empty; `onChangeValue` fires with the sanitised number as you type
 * (so edits still flow through immediately), and a blur on an empty/garbage
 * field snaps the display back to the last good value.
 */
export function NumberField({
  value,
  onChangeValue,
  min = 0,
  ...fieldProps
}: Omit<TextFieldProps, "value" | "onChangeText" | "keyboardType"> & {
  value: number;
  onChangeValue: (value: number) => void;
  min?: number;
}) {
  const [raw, setRaw] = useState(String(value));
  const editingRef = useRef(false);
  const [focused, setFocused] = useState(false);
  // Plain counter rather than `useId`: the value becomes a native view id, and
  // React's own ids carry delimiter characters that have no business being one.
  const [accessoryId] = useState(
    () => `number-field-done-${nextAccessoryId++}`,
  );

  // Re-sync when the value changes from somewhere else (a preset load, the
  // generator replacing the whole draft, or a row shifting under an insert).
  useEffect(() => {
    if (!editingRef.current) setRaw(String(value));
  }, [value]);

  const handleChangeText = (next: string) => {
    const digitsOnly = next.replace(/[^0-9]/g, "");
    setRaw(digitsOnly);
    if (digitsOnly.length > 0) {
      onChangeValue(Math.max(min, Number(digitsOnly)));
    }
  };

  return (
    <>
      <TextField
        {...fieldProps}
        keyboardType="number-pad"
        inputAccessoryViewID={Platform.OS === "ios" ? accessoryId : undefined}
        value={raw}
        onChangeText={handleChangeText}
        onFocus={(e) => {
          editingRef.current = true;
          setFocused(true);
          fieldProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          editingRef.current = false;
          setFocused(false);
          // `value` is already correct here: every keystroke's onChangeText
          // above already pushed the min-floored number through onChangeValue,
          // and a parent applying its own extra clamp (e.g. DurationField's
          // seconds field capping at 59) has already fed that back as `value`
          // too. Recomputing a clamp from `raw` here — as this used to do —
          // only knows about `min`, not any such parent clamp, so it could
          // overwrite the display with an uncapped number even though the
          // actual app state was already correctly capped.
          setRaw(String(value));
          fieldProps.onBlur?.(e);
        }}
      />
      {Platform.OS === "ios" && focused && (
        <InputAccessoryView nativeID={accessoryId}>
          <View style={styles.accessoryBar}>
            <Pressable
              onPress={() => Keyboard.dismiss()}
              accessibilityRole="button"
              accessibilityLabel="Done editing"
              hitSlop={space.sm}
              style={styles.accessoryButton}
            >
              <Text style={styles.accessoryText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  accessoryBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: colors.surfaceSolid,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  accessoryButton: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
  accessoryText: { ...text.label, color: colors.accent, fontWeight: "600" },
});
