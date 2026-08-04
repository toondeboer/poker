// src/components/blinds/BlindLevelRow.tsx
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, text } from "@/src/theme";
import { Badge } from "@/src/components/ui/Badge";
import { IconButton } from "@/src/components/ui/IconButton";
import { NumberField } from "@/src/components/ui/NumberField";

export type BlindLevelRowProps = {
  index: number;
  small: number;
  big: number;
  /** This is the level the tournament is currently on. */
  isCurrent: boolean;
  /** Jumping is only meaningful against the *active* schedule, so it's off while dirty. */
  jumpEnabled: boolean;
  /** The draft no longer matches what's playing, so the LIVE marker is stale. */
  isStale: boolean;
  canRemove: boolean;
  onChangeField: (index: number, field: "small" | "big", value: number) => void;
  onJump: (index: number) => void;
  onAdd: (index: number) => void;
  onRemove: (index: number) => void;
};

function BlindLevelRowComponent({
  index,
  small,
  big,
  isCurrent,
  jumpEnabled,
  isStale,
  canRemove,
  onChangeField,
  onJump,
  onAdd,
  onRemove,
}: BlindLevelRowProps) {
  const canJump = jumpEnabled && !isCurrent;

  return (
    <View style={[styles.row, isCurrent && styles.rowCurrent]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.levelChip, canJump && styles.levelChipTappable]}
          onPress={() => onJump(index)}
          disabled={!canJump}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            canJump
              ? `Jump the tournament to level ${index + 1}`
              : `Level ${index + 1}`
          }
        >
          <Text style={styles.levelChipText}>L{index + 1}</Text>
          {canJump && <Ionicons name="play" size={11} color={colors.accent} />}
        </TouchableOpacity>

        {isCurrent && <Badge label="LIVE" tone={isStale ? "stale" : "live"} />}

        <View style={styles.spacer} />

        <IconButton
          icon="add"
          tone="accent"
          onPress={() => onAdd(index)}
          accessibilityLabel={`Add a level around level ${index + 1}`}
        />
        <IconButton
          icon="trash"
          tone="danger"
          onPress={() => onRemove(index)}
          disabled={!canRemove}
          accessibilityLabel={`Delete level ${index + 1}`}
        />
      </View>

      <View style={styles.inputs}>
        <View style={styles.input}>
          <NumberField
            label="Small blind"
            variant="compact"
            min={1}
            value={small}
            onChangeValue={(value) => onChangeField(index, "small", value)}
          />
        </View>
        <View style={styles.input}>
          <NumberField
            label="Big blind"
            variant="compact"
            min={1}
            value={big}
            onChangeValue={(value) => onChangeField(index, "big", value)}
          />
        </View>
      </View>
    </View>
  );
}

// The list renders 30+ of these; without this every keystroke in one row would
// re-render all of them.
export const BlindLevelRow = React.memo(BlindLevelRowComponent);

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
    gap: space.md,
  },
  rowCurrent: {
    borderColor: colors.success,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceInput,
  },
  levelChipTappable: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  levelChipText: {
    ...text.monoCompact,
    fontWeight: "600",
  },
  spacer: { flex: 1 },
  inputs: { flexDirection: "row", gap: space.md },
  input: { flex: 1 },
});
