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
 * - It is a **floating pill on a transparent bar**, not a full-width block. The
 *   keyboard is a rounded, inset panel on current iOS, so a hard-edged opaque
 *   strip pinned above it left a mismatched gap either side of its corners and
 *   read as two unrelated slabs. A transparent bar has no edges to disagree
 *   with, and the pill reads as a control belonging to the keypad below it —
 *   which is also how iOS's own floating keyboard accessories look.
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
  // Transparent: the bar itself is just positioning. Anything opaque here has
  // to line its corners up with whatever shape the current keyboard is, and
  // loses — see the note on the component.
  accessoryBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "transparent",
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  accessoryButton: {
    // A pill, sized to a comfortable tap target on its own rather than relying
    // on the bar's height for it.
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSolid,
  },
  accessoryText: {
    ...text.label,
    color: colors.accent,
    fontWeight: "600",
    fontSize: 16,
  },
});
