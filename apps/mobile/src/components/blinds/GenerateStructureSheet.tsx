// src/components/blinds/GenerateStructureSheet.tsx
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import {
  averageGrowthRate,
  BLIND_SPEEDS,
  BlindLevel,
  BlindSpeedId,
  CHIP_UNIT_OPTIONS,
  DEFAULT_BLIND_SPEED_ID,
  formatBlindLevel,
  generateBlindStructure,
  inferSmallestChip,
  MAX_GENERATED_LEVELS,
  MIN_GENERATED_LEVELS,
} from "@poker/core";
import { colors, radius, space, text } from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { NumberField } from "@/src/components/ui/NumberField";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
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

const SPEED_OPTIONS = BLIND_SPEEDS.map((speed) => ({
  value: speed.id,
  label: speed.label,
  meta: `+${Math.round((averageGrowthRate(speed.id) - 1) * 100)}%`,
}));

const CHIP_OPTIONS = CHIP_UNIT_OPTIONS.map((unit) => ({
  value: unit,
  label: String(unit),
  meta: unit === 1 ? "any" : undefined,
}));

/**
 * Build a whole blind structure from a few inputs instead of hand-editing rows.
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
  const [smallestChip, setSmallestChip] = useState(5);

  // Seed from the structure being edited each time the sheet opens — including
  // the chip unit, which the existing blinds already imply. Done on the
  // closed→open transition during render rather than in an effect, so the sheet
  // never paints one frame of the previous session's values first.
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) {
      setStartingSmallBlind(currentLevels[0]?.small ?? 5);
      setLevelCount(
        Math.min(
          MAX_GENERATED_LEVELS,
          Math.max(MIN_GENERATED_LEVELS, currentLevels.length || 20),
        ),
      );
      setSmallestChip(inferSmallestChip(currentLevels));
    }
  }

  const preview = useMemo(
    () =>
      generateBlindStructure({
        startingSmallBlind,
        levelCount,
        speed: speedId,
        smallestChip,
      }),
    [startingSmallBlind, levelCount, speedId, smallestChip],
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
          {/* Cancel takes only the width its word needs, so the primary action
              keeps enough room for "Replace structure" + its icon on one line
              even on a 360dp phone. Splitting the row evenly wrapped it. */}
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button
            label="Replace structure"
            variant="success"
            icon="sparkles"
            onPress={handleGenerate}
            style={styles.primaryFooterButton}
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

      <SegmentedControl
        label="Speed"
        options={SPEED_OPTIONS}
        value={speedId}
        onChange={setSpeedId}
      />

      <View style={styles.group}>
        <SegmentedControl
          label="Smallest chip"
          options={CHIP_OPTIONS}
          value={smallestChip}
          onChange={setSmallestChip}
        />
        <Text style={styles.helper}>
          Every blind stays a multiple of this, so each level is one you can
          actually post at the table.
        </Text>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Preview</Text>
        <Text style={styles.preview}>{previewText}</Text>
        <Text style={styles.helper}>
          {preview.length} levels — the blinds reach 10× every{" "}
          {LEVELS_PER_DECADE[speedId]} levels.
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
  primaryFooterButton: { flex: 1 },
});
