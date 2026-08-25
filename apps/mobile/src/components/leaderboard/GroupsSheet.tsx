// src/components/leaderboard/GroupsSheet.tsx
import { useState } from "react";
import { Alert, Keyboard, StyleSheet, Text, View } from "react-native";
import { MAX_GROUPS } from "@poker/core";
import { useLeaderboard } from "@/src/contexts/LeaderboardContext";
import { colors, space, text } from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { IconButton } from "@/src/components/ui/IconButton";
import { ListRow } from "@/src/components/ui/ListRow";
import { Sheet } from "@/src/components/ui/Sheet";
import { TextField } from "@/src/components/ui/TextField";

/** "4 players · 12 games", skipping the halves that are still zero. */
const describeGroup = (playerCount: number, gameCount: number) => {
  const parts: string[] = [];
  if (playerCount > 0) {
    parts.push(`${playerCount} ${playerCount === 1 ? "player" : "players"}`);
  }
  if (gameCount > 0) {
    parts.push(`${gameCount} ${gameCount === 1 ? "game" : "games"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Nothing recorded yet";
};

/**
 * Switch between boards, and create, rename or delete one.
 *
 * A sheet rather than its own screen: picking a group is a two-tap detour from
 * the board you are looking at, and pushing a screen for it would put the
 * standings a back-press away every time.
 *
 * Renaming happens in place — the row becomes a field — rather than through a
 * prompt. `Alert.prompt` is iOS-only, and a second sheet on top of this one is
 * more machinery than a rename deserves.
 */
export function GroupsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const {
    groups,
    activeGroupId,
    canAddGroup,
    isGroupNameAvailable,
    selectGroup,
    createNewGroup,
    renameGroupById,
    deleteGroup,
  } = useLeaderboard();

  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const canCreate = isGroupNameAvailable(newName) && canAddGroup;

  const handleCreate = () => {
    if (!canCreate) return;
    createNewGroup(newName);
    setNewName("");
    Keyboard.dismiss();
    // Creating a group makes it the active one, so there is nothing else to
    // choose and the sheet has done its job.
    onClose();
  };

  const startRename = (id: string, current: string) => {
    setRenamingId(id);
    setRenameValue(current);
  };

  const commitRename = () => {
    if (!renamingId) return;
    // An unusable name leaves the group as it was rather than clearing it —
    // renameGroup refuses it anyway, and this keeps the two in step.
    if (isGroupNameAvailable(renameValue, renamingId)) {
      renameGroupById(renamingId, renameValue);
    }
    setRenamingId(null);
    Keyboard.dismiss();
  };

  const confirmDelete = (id: string, name: string, gameCount: number) => {
    const played =
      gameCount > 0
        ? ` Its ${gameCount} recorded ${gameCount === 1 ? "game" : "games"} will be deleted with it.`
        : "";
    Alert.alert(
      "Delete group",
      `Delete "${name}"?${played} This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteGroup(id),
        },
      ],
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Groups">
      <Text style={styles.blurb}>
        A separate board for each set of people you play with. Players and games
        belong to the group they were added to.
      </Text>

      <View style={styles.list}>
        {groups.map((group) =>
          renamingId === group.id ? (
            <TextField
              key={group.id}
              value={renameValue}
              onChangeText={setRenameValue}
              onBlur={commitRename}
              onSubmitEditing={commitRename}
              autoFocus
              returnKeyType="done"
              maxLength={40}
              placeholder="Group name"
              accessibilityLabel={`Rename ${group.name}`}
            />
          ) : (
            <ListRow
              key={group.id}
              title={group.name}
              meta={describeGroup(group.playerCount, group.gameCount)}
              selected={group.id === activeGroupId}
              onPress={() => {
                selectGroup(group.id);
                onClose();
              }}
              right={
                <View style={styles.rowActions}>
                  <IconButton
                    icon="pencil"
                    onPress={() => startRename(group.id, group.name)}
                    accessibilityLabel={`Rename ${group.name}`}
                  />
                  <IconButton
                    icon="trash-outline"
                    tone="danger"
                    onPress={() =>
                      confirmDelete(group.id, group.name, group.gameCount)
                    }
                    accessibilityLabel={`Delete ${group.name}`}
                  />
                </View>
              }
            />
          ),
        )}
      </View>

      <TextField
        label="New group"
        value={newName}
        onChangeText={setNewName}
        onSubmitEditing={handleCreate}
        placeholder="e.g. Thursday night"
        returnKeyType="done"
        maxLength={40}
        helper={
          canAddGroup
            ? undefined
            : `You can have up to ${MAX_GROUPS} groups. Delete one to add another.`
        }
      />
      <Button
        label="Create group"
        icon="add"
        onPress={handleCreate}
        disabled={!canCreate}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  blurb: { ...text.body, color: colors.textMuted },
  list: { gap: space.sm },
  rowActions: { flexDirection: "row", gap: space.xs },
});
