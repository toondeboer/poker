// src/components/ui/SegmentedControl.tsx
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius, space, text } from "@/src/theme";

export type SegmentOption<T> = {
  value: T;
  label: string;
  /** Small second line — a rate, a unit, anything qualifying the label. */
  meta?: string;
};

/** A row of mutually-exclusive choices, sized evenly across the width. */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segments}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={String(option.value)}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  selected && styles.segmentLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              {option.meta && (
                <Text style={styles.segmentMeta}>{option.meta}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  label: text.label,
  segments: { flexDirection: "row", gap: space.sm },
  segment: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderInput,
    backgroundColor: colors.surfaceInput,
  },
  segmentSelected: {
    borderColor: colors.success,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  segmentLabel: { ...text.label, color: colors.textLabel },
  segmentLabelSelected: { color: colors.text },
  segmentMeta: text.meta,
});
