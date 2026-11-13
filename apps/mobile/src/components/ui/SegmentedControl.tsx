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
  wrap = false,
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * Let the segments flow onto more than one row instead of splitting the
   * width evenly across all of them.
   *
   * Off by default, so every existing caller keeps its single even row. Turn it
   * on when the option count can grow past about five: with `flex: 1` each
   * segment gets `1/n` of the width, and past that point even a four-character
   * label ("Auto") wraps mid-word. Payouts hits this at eight players — seven
   * segments — which is its *default*, not an edge case.
   */
  wrap?: boolean;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.segments, wrap && styles.segmentsWrap]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={String(option.value)}
              style={[
                styles.segment,
                wrap && styles.segmentWrapped,
                selected && styles.segmentSelected,
              ]}
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
  segmentsWrap: { flexWrap: "wrap" },
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
  /**
   * Wide enough for a short word at the theme's label size, and allowed to grow
   * into whatever room is left on its row. `flex: 1` has to be cleared
   * explicitly — it would otherwise still force everything onto one line.
   */
  segmentWrapped: { flex: 0, flexGrow: 1, flexBasis: 72 },
  segmentSelected: {
    borderColor: colors.success,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  segmentLabel: { ...text.label, color: colors.textLabel },
  segmentLabelSelected: { color: colors.text },
  segmentMeta: text.meta,
});
