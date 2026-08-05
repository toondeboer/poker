// src/components/blinds/GenerateStructureScreen.tsx
import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  averageGrowthRate,
  BLIND_SPEEDS,
  BlindSpeedId,
  CHIP_UNIT_OPTIONS,
  DEFAULT_BLIND_SPEED_ID,
  formatBlindLevel,
  generateBlindStructure,
  inferSmallestChip,
  MAX_GENERATED_LEVELS,
  MIN_GENERATED_LEVELS,
} from "@poker/core";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { colors, radius, space, text } from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { NumberField } from "@/src/components/ui/NumberField";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { SheetHeader } from "@/src/components/ui/SheetHeader";

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
 * Presented as a native form sheet (see the route's options in `_layout.tsx`),
 * so the grabber, backdrop, drag-to-dismiss and corner radius all come from the
 * platform rather than being hand-rolled.
 *
 * Writes the **draft** only — the sticky Apply footer on the editor is still what
 * makes it live, so this inherits the whole apply/clamp/confirm story for free.
 */
export function GenerateStructureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { customBlindLevels, replaceCustomBlindLevels } = useBlinds();

  // Seeded once, on mount. As a route this screen is created fresh every time
  // it's opened, so there's no "reset when it reopens" problem to solve.
  const [startingSmallBlind, setStartingSmallBlind] = useState(
    () => customBlindLevels[0]?.small ?? 5,
  );
  const [levelCount, setLevelCount] = useState(() =>
    Math.min(
      MAX_GENERATED_LEVELS,
      Math.max(MIN_GENERATED_LEVELS, customBlindLevels.length || 20),
    ),
  );
  const [speedId, setSpeedId] = useState<BlindSpeedId>(DEFAULT_BLIND_SPEED_ID);
  const [smallestChip, setSmallestChip] = useState(() =>
    inferSmallestChip(customBlindLevels),
  );

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
      `This replaces all ${customBlindLevels.length} levels in the editor with ${preview.length}. Your active structure isn't changed until you apply.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replace",
          style: "destructive",
          onPress: () => {
            replaceCustomBlindLevels(preview);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: space.lg + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SheetHeader title="Generate structure" onClose={() => router.back()} />

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

        <View style={styles.footer}>
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() => router.back()}
          />
          <Button
            label="Replace structure"
            variant="success"
            icon="sparkles"
            onPress={handleGenerate}
            style={styles.primaryFooterButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSolid },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    gap: space.lg,
  },
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
  footer: { flexDirection: "row", gap: space.md, marginTop: space.xs },
  primaryFooterButton: { flex: 1 },
});
