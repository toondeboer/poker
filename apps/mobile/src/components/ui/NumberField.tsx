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
        const parsed = Number(raw);
        if (raw.length === 0 || !Number.isFinite(parsed)) {
          setRaw(String(value));
        } else {
          const clamped = Math.max(min, parsed);
          setRaw(String(clamped));
          if (clamped !== value) onChangeValue(clamped);
        }
        fieldProps.onBlur?.(e);
      }}
    />
  );
}
