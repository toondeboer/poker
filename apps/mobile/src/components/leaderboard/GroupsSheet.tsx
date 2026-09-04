// src/components/leaderboard/GroupsSheet.tsx
import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Keyboard, Share, StyleSheet, Text, View } from "react-native";
import {
  hostRefusal,
  joinRefusal,
  MAX_GROUPS,
  readInviteCode,
} from "@poker/core";
import { useLeaderboard } from "@/src/contexts/LeaderboardContext";
import { accountsAreReal, useAuth } from "@/src/contexts/AuthContext";
import { useFeatures } from "@/src/contexts/FeaturesContext";
import { usePremium } from "@/src/contexts/PremiumContext";
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
    joinBoard,
  } = useLeaderboard();
  const { account } = useAuth();
  const router = useRouter();
  const { isPremium, hasClub, entitlementsKnown } = usePremium();
  /**
   * **Shown while the store has not answered yet**, the same call `hostRefusal`
   * makes and for the same reason: the entitlement starts `false`, and a
   * subscriber would otherwise watch their own share button be absent for the
   * first seconds of every cold launch — or for a whole session wherever the
   * fetch fails and `onChange` never corrects it. Tapping it in that window
   * says "still checking", which is true and recoverable; a missing button
   * explains nothing and cannot be retried.
   */
  /**
   * **And the server's own switch**, which nothing here consulted.
   *
   * `featureSharing=off` gated the requests but left both controls on screen,
   * so the documented behaviour — a cold launch showing no share button and no
   * join field — was not what the app did. Offering a button whose only
   * possible outcome is a refusal is the exact thing `mayShare` above already
   * argues against.
   */
  const features = useFeatures();
  const mayShare = features.sharing && (hasClub || !entitlementsKnown);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const sharing = useRef(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinProblem, setJoinProblem] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

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
        // The refusal that is somebody's to act on comes first; anything else
        // here is a board that is not on the server, or no signal.
        const refusal = hostRefusal({
          signedIn: account !== null,
          entitlementsKnown,
          hasClub,
          isPremium,
        });
        /**
         * **One title for three different refusals was the bug.** "Sharing is
         * part of Club" was shown for "sign in first" and for "still checking
         * your purchases" too — which tells a subscriber to buy what they
         * already own, the exact thing `clubPolicy` is tested to prevent. The
         * message carries the meaning, so the title stays neutral.
         */
        Alert.alert(
          refusal ? "Cannot share this board" : "Could not make a link",
          refusal ??
            "Only an admin of a board can invite people to it, and the board has to have reached the server. Try again when you have signal.",
        );
        return;
      }
      /**
       * **The code, not a link.** A `pokerkit://` link only opens for somebody
       * who already has the app, which is most of the point of an invite gone —
       * and an `https://` one needs a domain, universal links and a page to
       * catch the tap. The code needs none of that and gives up no entropy: it
       * is the same 32-character token either way.
       */
      /**
       * **The name the stores actually use**, which is neither the name on the
       * home screen ("Poker Timer") nor the one the marketing copy uses
       * ("Poker Blinds Buzzer"). This message is read by somebody who does not
       * have the app: it has to name something they can search for and find.
       * `STORE_LISTING.md` is the source of truth for it.
       */
      const message =
        `Join "${name}" on Poker Blinds Timer & Buzzer.\n\n` +
        `Paste this code into Leaderboard → Groups → Join a board:\n\n${token}`;
      try {
        await Share.share({ message });
      } catch {
        /**
         * **The code exists whether or not the share sheet opened**, and it has
         * already replaced whatever code this board had — minting is how the old
         * one is revoked. Saying nothing would leave somebody with the previous
         * code dead and no new one to send, so it goes on screen where it can at
         * least be copied.
         */
        Alert.alert("Here is the code", token);
      }
    } finally {
      sharing.current = false;
      setSharingId(null);
    }
  };

  /**
   * Redeem a pasted code.
   *
   * **Not queued, and this is the one place that is right.** Every other write
   * the app makes can wait in the outbox because nobody is watching it happen;
   * somebody who has just pasted a code is watching, and "it will go through
   * eventually" does not answer "am I on the board?".
   */
  const handleJoin = async () => {
    if (joining) return;
    // **Like every other way out of this sheet.** `keyboardShouldPersistTaps`
    // means tapping the button does not blur the rename field, so without this
    // an in-progress rename is silently thrown away by joining.
    commitRename();
    // Whatever they pasted: the bare code, the whole message it came in, or a
    // link if they happen to have one. See `readInviteCode`.
    const code = readInviteCode(joinCode);
    if (!code) {
      setJoinProblem("That does not look like an invite code.");
      return;
    }
    setJoining(true);
    setJoinProblem(null);
    try {
      const result = await joinBoard(code);
      if (!result.ok) {
        setJoinProblem(result.reason);
        return;
      }
      setJoinCode("");
      Keyboard.dismiss();
      // Joining selects the board, so there is nothing left to choose here.
      onClose();
    } finally {
      setJoining(false);
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
                  {/* Hidden on a board this account is only a *member* of:
                      minting is admin-only, so the button could never do
                      anything but explain itself. Shown while the role is
                      unknown — see `canInvite`. */}
                  {accountsAreReal && account && mayShare && group.canInvite ? (
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

      {/* **Making a board of your own is still Pro.** A guest can reach this
          sheet now, because a board somebody shared with them is visible
          without Pro — so without this check the leaderboard could be had for
          nothing by joining anything. */}
      {isPremium ? (
        <>
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
        </>
      ) : null}

      {/* **Joining needs nothing bought — the host pays**, so this sits
          outside the Pro block above and asks for no entitlement of its own.
          Requiring anything here would be asking a guest to buy something
          before they can see a board somebody sent them, which is how the
          feature ends up unused. See `joinRefusal`.

          Still hidden with no backend or no account: in a shipped build
          `backendConfig` is `null`, and a field that can only answer "this
          build cannot join boards" is a dead feature in the app store. */}
      {/* **Signed out is a state with a way out of it, not a hidden field.**
          The invited guest this whole feature exists for arrives here having
          never made an account, and hiding the section left them looking at a
          sheet with nothing in it — `joinRefusal`'s "Sign in to join a board."
          was unreachable from the one screen a guest ever sees. */}
      {accountsAreReal && !account ? (
        <>
          <Text style={styles.blurb}>
            {joinRefusal({ signedIn: false })} Joining is free — the person who
            shares a board is the one who pays for it.
          </Text>
          <Button
            label="Sign in"
            icon="log-in-outline"
            variant="secondary"
            onPress={() => {
              onClose();
              router.push("/account");
            }}
          />
        </>
      ) : null}

      {accountsAreReal && account && features.sharing ? (
        <>
          <TextField
            label="Join a board"
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="Paste an invite code"
            returnKeyType="go"
            onSubmitEditing={handleJoin}
            autoCapitalize="none"
            autoCorrect={false}
            helper={
              joinProblem ??
              "Somebody on the board can send you one from their Groups list. Joining is free."
            }
          />
          <Button
            label={joining ? "Joining…" : "Join board"}
            icon="enter-outline"
            variant="secondary"
            onPress={() => void handleJoin()}
            disabled={joining || joinCode.trim().length === 0}
          />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  blurb: { ...text.body, color: colors.textMuted },
  list: { gap: space.sm },
  rowActions: { flexDirection: "row", gap: space.xs },
});
