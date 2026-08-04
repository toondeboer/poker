// src/components/blinds/GenerateStructureSheet.tsx
import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  BlindLevel,
  formatBlindLevel,
  generateBlindStructure,
  BLIND_SPEEDS,
  BlindSpeedId,
  DEFAULT_BLIND_SPEED_ID,
  averageGrowthRate,
  MAX_GENERATED_LEVELS,
  MIN_GENERATED_LEVELS,
} from "@poker/core";
import { colors, radius, space, text } from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { NumberField } from "@/src/components/ui/NumberField";
import { Sheet } from "@/src/components/ui/Sheet";

const PREVIEW_HEAD = 4;

/**
 * How many levels each speed takes to multiply the blinds by ten — the ladder
 * length from `BLIND_SPEEDS`. Stated in the UI because it's the number that
 * actually tells you whether a structure will run away from your stacks.
 */
const LEVELS_PER_DECADE: Record<BlindSpeedId, number> = Object.fromEntries(
  BLIND_SPEEDS.map((speed) => [speed.id, speed.ladder.length]),
) as Record<BlindSpeedId, number>;

/**
 * Build a whole blind structure from three inputs instead of hand-editing rows.
 *
 * Writes the **draft** only — the sticky Apply footer is still what makes it
 * live, so the generator inherits the whole apply/clamp/confirm story for free.
 */
export function GenerateStructureSheet({
  visible,
  onClose,
  currentLevels,
  onGenerate,
}: {
  visible: boolean;
  onClose: () => void;
  currentLevels: BlindLevel[];
  onGenerate: (levels: BlindLevel[]) => void;
}) {
  const [startingSmallBlind, setStartingSmallBlind] = useState(5);
  const [levelCount, setLevelCount] = useState(20);
  const [speedId, setSpeedId] = useState<BlindSpeedId>(DEFAULT_BLIND_SPEED_ID);

  // Seed from the structure being edited each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setStartingSmallBlind(currentLevels[0]?.small ?? 5);
    setLevelCount(
      Math.min(
        MAX_GENERATED_LEVELS,
        Math.max(MIN_GENERATED_LEVELS, currentLevels.length || 20),
      ),
    );
  }, [visible, currentLevels]);

  const preview = useMemo(
    () =>
      generateBlindStructure({
        startingSmallBlind,
        levelCount,
        speed: speedId,
      }),
    [startingSmallBlind, levelCount, speedId],
  );

  const previewText = [
    ...preview.slice(0, PREVIEW_HEAD).map(formatBlindLevel),
    ...(preview.length > PREVIEW_HEAD + 1
      ? ["…", formatBlindLevel(preview[preview.length - 1])]
      : preview.slice(PREVIEW_HEAD).map(formatBlindLevel)),
  ].join("  ·  ");

  const handleGenerate = () => {
    Alert.alert(
      "Replace structure?",
      `This replaces all ${currentLevels.length} levels in the editor with ${preview.length}. Your active structure isn't changed until you apply.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replace",
          style: "destructive",
          onPress: () => {
            onGenerate(preview);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Generate structure"
      footer={
        <>
          <Button
            label="Cancel"
            variant="ghost"
            onPress={onClose}
            style={styles.footerButton}
          />
          <Button
            label="Replace structure"
            variant="success"
            icon="sparkles"
            onPress={handleGenerate}
            style={styles.footerButton}
          />
        </>
      }
    >
      <View style={styles.row}>
        <View style={styles.field}>
          <NumberField
            label="Starting small blind"
            variant="compact"
            min={1}
            value={startingSmallBlind}
            onChangeValue={setStartingSmallBlind}
            maxLength={6}
          />
        </View>
        <View style={styles.field}>
          <NumberField
            label="Number of levels"
            variant="compact"
            min={MIN_GENERATED_LEVELS}
            value={levelCount}
            onChangeValue={(value) =>
              setLevelCount(Math.min(MAX_GENERATED_LEVELS, value))
            }
            maxLength={2}
          />
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Speed</Text>
        <View style={styles.segments}>
          {BLIND_SPEEDS.map((preset) => {
            const selected = preset.id === speedId;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[styles.segment, selected && styles.segmentSelected]}
                onPress={() => setSpeedId(preset.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    selected && styles.segmentLabelSelected,
                  ]}
                >
                  {preset.label}
                </Text>
                <Text style={styles.segmentMeta}>
                  +{Math.round((averageGrowthRate(preset.id) - 1) * 100)}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Preview</Text>
        <Text style={styles.preview}>{previewText}</Text>
        <Text style={styles.helper}>
          {preview.length} levels of round, chip-friendly numbers — the blinds
          reach 10× every {LEVELS_PER_DECADE[speedId]} levels.
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md },
  field: { flex: 1 },
  group: { gap: space.sm },
  label: text.label,
  segments: { flexDirection: "row", gap: space.sm },
  segment: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: space.sm,
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
  preview: {
    ...text.monoCompact,
    lineHeight: 22,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    padding: space.md,
  },
  helper: text.meta,
  footerButton: { flex: 1 },
});
