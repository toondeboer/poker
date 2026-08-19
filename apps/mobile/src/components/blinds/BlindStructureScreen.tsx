// src/components/blinds/BlindStructureScreen.tsx
import { useCallback, useRef, useState } from "react";
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
import { useKeyboardFocusScroll } from "@/src/hooks/useKeyboardFocusScroll";
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
import { GenerateStructureSheet } from "./GenerateStructureSheet";

/** Below this the schedule can't shrink further (enforced in @poker/core). */
const MIN_LEVELS = 2;

export function BlindStructureScreen({
  generatorVisible,
  onCloseGenerator,
  onOpenGenerator,
}: {
  generatorVisible: boolean;
  onCloseGenerator: () => void;
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
    replaceCustomBlindLevels,
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

  const handleGenerate = useCallback(
    (levels: BlindLevel[]) =>
      structural(() => replaceCustomBlindLevels(levels)),
    [structural, replaceCustomBlindLevels],
  );

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

  // Editing a blind on a row near the bottom of the screen used to put the row
  // under the keypad with no way to reach it — see useKeyboardFocusScroll for
  // why Android stopped handling that itself.
  const listRef = useRef<FlatList<BlindLevel>>(null);
  const scrollOffsetRef = useRef(0);
  const containerRef = useRef<View>(null);
  const { keyboardInset } = useKeyboardFocusScroll({
    scrollBy: (delta) =>
      listRef.current?.scrollToOffset({
        offset: scrollOffsetRef.current + delta,
        animated: true,
      }),
    containerRef,
    bottomInset: insets.bottom,
    topInset: insets.top,
  });

  return (
    <View style={styles.container} ref={containerRef}>
      <FlatList
        ref={listRef}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
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
            // Clear the sticky footer when it's up, the home indicator when it
            // isn't — plus the keypad on Android, which otherwise leaves the
            // last rows with nowhere to scroll to.
            paddingBottom:
              space.xl +
              (footerHeight > 0 ? footerHeight : insets.bottom) +
              keyboardInset,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        // "none", not "on-drag": these rows are a form, and the blind you want
        // to check while editing another is usually a scroll away — throwing the
        // keypad out the moment you drag makes editing a schedule a fight. Same
        // reasoning, and same value, as the sheet's scroller.
        keyboardDismissMode="none"
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

      <GenerateStructureSheet
        visible={generatorVisible}
        onClose={onCloseGenerator}
        currentLevels={customBlindLevels}
        onGenerate={handleGenerate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1 },
  centred: {
    maxWidth: TABLET_MAX_WIDTH_LIST,
    alignSelf: "center",
  },
});
