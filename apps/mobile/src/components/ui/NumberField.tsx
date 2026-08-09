// src/components/ui/NumberField.tsx
import { useEffect, useRef, useState } from "react";
import { TextField, TextFieldProps } from "./TextField";

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
    <TextField
      {...fieldProps}
      keyboardType="number-pad"
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
  );
}
