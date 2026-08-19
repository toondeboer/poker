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
import { colors, space, text } from "@/src/theme";
import { TextField, TextFieldProps } from "./TextField";

/**
 * Per-instance id for the Done bar below. A plain counter rather than `useId`:
 * the value becomes a native view id, and React's own ids carry delimiter
 * characters that have no business being one.
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
 *
 * **The Done bar.** iOS's `number-pad` has no Return key — there is no native
 * key that dismisses it, and `inputAccessoryView` (which this is) is UIKit's own
 * answer to that, the same one Apple's apps use. Two things about it are load-
 * bearing:
 *
 * - It is rendered **unconditionally**, not only while focused. UIKit attaches
 *   the accessory when the keyboard is *presented*, so a view that only mounts
 *   in response to focus does not exist yet the first time — which is exactly
 *   the "only shows up the second time you open the keypad" flakiness. By the
 *   second focus it's still mounted from the first, so it works, which makes the
 *   bug look intermittent rather than ordered.
 * - The id is per instance rather than one shared bar mounted at the root.
 *   That's a few extra offscreen views on a screen full of fields, and it buys
 *   certainty: this field's accessory is always in the same React tree — and on
 *   iOS the same `UIWindow` — as the input it belongs to, including inside a
 *   `Modal`, where a root-mounted one would have to resolve across windows.
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
        // Dark keypad to match the app and the bar above it — the default light
        // keypad under a dark accessory bar is what made the pair look bolted
        // together.
        keyboardAppearance="dark"
        inputAccessoryViewID={Platform.OS === "ios" ? accessoryId : undefined}
        value={raw}
        onChangeText={handleChangeText}
        onFocus={(e) => {
          editingRef.current = true;
          fieldProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          editingRef.current = false;
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
      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={accessoryId}>
          <View style={styles.accessoryBar}>
            <Pressable
              onPress={() => Keyboard.dismiss()}
              accessibilityRole="button"
              accessibilityLabel="Done editing"
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
  // Sized and weighted like UIKit's own keyboard toolbar: 44pt tall, hairline
  // separator on top, single right-aligned action.
  accessoryBar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: colors.surfaceSolid,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: space.md,
  },
  accessoryButton: {
    // Padding rather than hitSlop: this is the full-height tap target, and it
    // needs to look like a comfortably-sized button, not just behave as one.
    paddingHorizontal: space.md,
    justifyContent: "center",
    alignSelf: "stretch",
  },
  accessoryText: {
    ...text.label,
    color: colors.accent,
    fontWeight: "600",
    fontSize: 17,
  },
});
