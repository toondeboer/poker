// src/components/blinds/BlindStructureScreen.tsx
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlindLevel } from "@poker/core";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { useUnsavedChangesGuard } from "@/src/hooks/useUnsavedChangesGuard";
import {
  colors,
  isTabletWidth,
  space,
  TABLET_MAX_WIDTH_LIST,
} from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { ApplyFooter } from "./ApplyFooter";
import { BlindLevelRow } from "./BlindLevelRow";
import { BlindListHeader } from "./BlindListHeader";

/** Below this the schedule can't shrink further (enforced in @poker/core). */
const MIN_LEVELS = 2;

export function BlindStructureScreen({
  onOpenGenerator,
}: {
  onOpenGenerator: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = isTabletWidth(width);

  const {
    customBlindLevels,
    currentBlindIndex,
    updateBlindLevel,
    addBlindLevel,
    insertBlindLevel,
    duplicateBlindLevel,
    removeBlindLevel,
    discardCustomBlindLevels,
    applyCustomBlindLevels,
    resetToDefaultBlinds,
    selectBlind,
    isDraftDirty,
    draftChange,
  } = useBlinds();

  const [footerHeight, setFooterHeight] = useState(0);

  useUnsavedChangesGuard({
    enabled: isDraftDirty,
    onApply: applyCustomBlindLevels,
    onDiscard: discardCustomBlindLevels,
  });

  // Every structural edit dismisses the keyboard first. Rows are keyed by index
  // (BlindLevel has no id, and adding one would mean a storage migration on both
  // platforms), so a focused field would otherwise stay put on screen while the
  // level under it shifts.
  const structural = useCallback((mutate: () => void) => {
    Keyboard.dismiss();
    mutate();
  }, []);

  const handleAdd = useCallback(
    (index: number) => {
      Alert.alert("Add a level", `Around level ${index + 1}`, [
        {
          text: "Insert below",
          onPress: () => structural(() => insertBlindLevel(index + 1)),
        },
        {
          text: "Duplicate this level",
          onPress: () => structural(() => duplicateBlindLevel(index)),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [structural, insertBlindLevel, duplicateBlindLevel],
  );

  const handleRemove = useCallback(
    (index: number) => structural(() => removeBlindLevel(index)),
    [structural, removeBlindLevel],
  );

  const handleJump = useCallback(
    (index: number) => {
      Keyboard.dismiss();
      Alert.alert(
        `Jump to Level ${index + 1}?`,
        "The blinds change immediately. The running round keeps its remaining time.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Jump", onPress: () => selectBlind(index) },
        ],
      );
    },
    [selectBlind],
  );

  const handleReset = useCallback(() => {
    Alert.alert(
      "Reset to default?",
      "This replaces your structure with the built-in one and restarts the tournament at Level 1.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => structural(resetToDefaultBlinds),
        },
      ],
    );
  }, [structural, resetToDefaultBlinds]);

  const renderItem = useCallback(
    ({ item, index }: { item: BlindLevel; index: number }) => (
      <BlindLevelRow
        index={index}
        small={item.small}
        big={item.big}
        isCurrent={index === currentBlindIndex}
        jumpEnabled={!isDraftDirty}
        isStale={isDraftDirty}
        canRemove={customBlindLevels.length > MIN_LEVELS}
        onChangeField={updateBlindLevel}
        onJump={handleJump}
        onAdd={handleAdd}
        onRemove={handleRemove}
      />
    ),
    [
      currentBlindIndex,
      isDraftDirty,
      customBlindLevels.length,
      updateBlindLevel,
      handleJump,
      handleAdd,
      handleRemove,
    ],
  );

  const centred = isTablet && styles.centred;

  return (
    <View style={styles.container}>
      <FlatList
        data={customBlindLevels}
        keyExtractor={(_, index) => String(index)}
        renderItem={renderItem}
        ListHeaderComponent={
          <BlindListHeader
            levels={customBlindLevels}
            isDirty={isDraftDirty}
            onGenerate={onOpenGenerator}
            onReset={handleReset}
          />
        }
        ListFooterComponent={
          <Button
            label="Add level"
            icon="add"
            variant="success"
            onPress={() => structural(addBlindLevel)}
          />
        }
        contentContainerStyle={[
          styles.content,
          centred,
          {
            paddingLeft: space.lg + insets.left,
            paddingRight: space.lg + insets.right,
            // Clear the sticky footer when it's up, the home indicator when it isn't.
            paddingBottom:
              space.xl + (footerHeight > 0 ? footerHeight : insets.bottom),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        // Clipped rows containing TextInputs misbehave on Android.
        removeClippedSubviews={false}
        initialNumToRender={12}
        windowSize={7}
      />

      {isDraftDirty && (
        <ApplyFooter
          change={draftChange}
          currentBlindIndex={currentBlindIndex}
          onApply={() => structural(applyCustomBlindLevels)}
          onDiscard={() => structural(discardCustomBlindLevels)}
          onHeightChange={setFooterHeight}
          contentStyle={centred || undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1 },
  centred: {
    maxWidth: TABLET_MAX_WIDTH_LIST,
    alignSelf: "center",
    width: "100%",
  },
});
