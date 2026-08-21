// src/components/blinds/ApplyFooter.tsx
import { StyleSheet, Text, View } from "react-native";
import { BlindScheduleChange } from "@poker/core";
import { colors, space, text } from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { StickyFooter } from "@/src/components/ui/StickyFooter";

export function ApplyFooter({
  change,
  currentBlindIndex,
  onApply,
  onDiscard,
  onHeightChange,
  contentStyle,
}: {
  change: BlindScheduleChange;
  currentBlindIndex: number;
  onApply: () => void;
  onDiscard: () => void;
  onHeightChange: (height: number) => void;
  contentStyle?: object;
}) {
  return (
    <StickyFooter onHeightChange={onHeightChange} contentStyle={contentStyle}>
      {change.currentLevelDropped && (
        <Text style={styles.warning}>
          You&apos;re on Level {currentBlindIndex + 1}, which no longer exists —
          the timer will move to Level {change.nextIndex + 1}.
        </Text>
      )}
      <View style={styles.buttons}>
        {/* Discard takes only the width its word needs so the primary action
            keeps room for "Apply changes" + its icon on one line. Splitting the
            row evenly truncated it to "Apply chang…" on a 360dp phone. */}
        <Button label="Discard" variant="ghost" onPress={onDiscard} />
        <Button
          label="Apply changes"
          variant="success"
          icon="checkmark"
          onPress={onApply}
          style={styles.primaryButton}
        />
      </View>
    </StickyFooter>
  );
}

const styles = StyleSheet.create({
  warning: { ...text.meta, color: colors.pro, lineHeight: 17 },
  buttons: { flexDirection: "row", gap: space.md },
  primaryButton: { flex: 1 },
});
