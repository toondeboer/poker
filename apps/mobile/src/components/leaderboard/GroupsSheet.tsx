// src/components/leaderboard/GroupsSheet.tsx
import { useRef, useState } from "react";
import { Alert, Keyboard, Share, StyleSheet, Text, View } from "react-native";
import { MAX_GROUPS, inviteUrlFor } from "@poker/core";
import { useLeaderboard } from "@/src/contexts/LeaderboardContext";
import { accountsAreReal, useAuth } from "@/src/contexts/AuthContext";
import { INVITE_BASE } from "@/src/services/backendConfig";
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
    inviteToBoard,
  } = useLeaderboard();
  const { account } = useAuth();
  const [sharingId, setSharingId] = useState<string | null>(null);
  const sharing = useRef(false);

  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const canCreate = isGroupNameAvailable(newName) && canAddGroup;

  /**
   * Why the name being typed can't be used, or `null`.
   *
   * Shown while editing rather than on commit, because a rename has no Save
   * button — so by the time it is refused the field is gone, and a silent
   * refusal is indistinguishable from a rename that worked.
   */
  const renameProblem = (() => {
    if (renamingId === null) return null;
    if (renameValue.trim().length === 0) return "A group needs a name.";
    if (!isGroupNameAvailable(renameValue, renamingId)) {
      return "You already have a group with that name.";
    }
    return null;
  })();

  /**
   * Finish any rename in progress.
   *
   * Called from every other action in this sheet, not just from blur. The
   * sheet's scroll view keeps taps from dismissing the keyboard
   * (`keyboardShouldPersistTaps="handled"`), so tapping a row, the backdrop, or
   * another row's buttons never blurs the field — it just unmounts it with the
   * modal, and the edit is gone. Committing here instead follows the same
   * commits-on-blur rule the round duration field already uses.
   */
  const commitRename = () => {
    if (!renamingId) return;
    // A name that can't be used leaves the group exactly as it was. Not silent:
    // the reason has been under the field the whole time it was being typed.
    if (isGroupNameAvailable(renameValue, renamingId)) {
      renameGroupById(renamingId, renameValue);
    }
    setRenamingId(null);
    Keyboard.dismiss();
  };

  /** Close, finishing a rename rather than throwing it away. */
  const handleClose = () => {
    commitRename();
    // The create field is a different matter: leaving the sheet is not an
    // instruction to make a group, so it is simply dropped.
    setNewName("");
    onClose();
  };

  const handleCreate = () => {
    commitRename();
    if (!canCreate) return;
    createNewGroup(newName);
    setNewName("");
    Keyboard.dismiss();
    // Creating a group makes it the active one, so there is nothing else to
    // choose and the sheet has done its job.
    onClose();
  };

  const startRename = (id: string, current: string) => {
    commitRename();
    setRenamingId(id);
    setRenameValue(current);
  };

  /**
   * Make a link and hand it to the system share sheet.
   *
   * **Minted fresh every time, and that is deliberate** — the server treats
   * creating and revoking as one operation, because a link that never expires
   * can only be taken back by replacing it. So sharing again invalidates the
   * last link, which is the behaviour somebody wants when they shared it with
   * the wrong person; it is worth saying out loud rather than surprising them.
   */
  const share = async (id: string, name: string) => {
    /**
     * **A ref, because state is not set until the next render.** Two taps in
     * the same frame both pass a state-based guard, and minting is *also*
     * revoking — so the second link would quietly kill the first, which is the
     * one already on its way into somebody's chat app.
     */
    if (sharing.current) return;
    sharing.current = true;
    setSharingId(id);
    try {
      const token = await inviteToBoard(id);
      if (!token) {
        Alert.alert(
          "Could not make a link",
          "Only an admin of a board can invite people to it, and the board has to have reached the server. Try again when you have signal.",
        );
        return;
      }
      const link = inviteUrlFor(token, INVITE_BASE);
      try {
        await Share.share({
          message: `Join "${name}" on Poker Blinds Buzzer: ${link}`,
        });
      } catch {
        /**
         * **The link exists whether or not the share sheet opened**, and it has
         * already replaced whatever link this board had — minting is how the old
         * one is revoked. Saying nothing would leave somebody with the previous
         * link dead and no new one to send, so the link goes on screen where it
         * can at least be copied.
         */
        Alert.alert("Here is the link", link);
      }
    } finally {
      sharing.current = false;
      setSharingId(null);
    }
  };

  const confirmDelete = (id: string, name: string, gameCount: number) => {
    commitRename();
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
    <Sheet visible={visible} onClose={handleClose} title="Groups">
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
              helper={renameProblem ?? undefined}
              accessibilityLabel={`Rename ${group.name}`}
            />
          ) : (
            <ListRow
              key={group.id}
              title={group.name}
              meta={describeGroup(group.playerCount, group.gameCount)}
              selected={group.id === activeGroupId}
              onPress={() => {
                commitRename();
                selectGroup(group.id);
                onClose();
              }}
              right={
                <View style={styles.rowActions}>
                  {/* Only while signed in: a board nobody can be invited *to*
                      is a board with no server copy, and the call would be
                      refused. Better to not offer it than to offer it and
                      fail. */}
                  {accountsAreReal && account ? (
                    <IconButton
                      icon={sharingId === group.id ? "hourglass-outline" : "share-outline"}
                      onPress={() => void share(group.id, group.name)}
                      accessibilityLabel={`Share ${group.name}`}
                    />
                  ) : null}
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
