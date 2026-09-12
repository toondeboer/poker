// src/components/leaderboard/BoardMembersSheet.tsx
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { removalRefusal, sortedMembers, type BoardMember } from "@poker/core";
import { colors, space, text } from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { IconButton } from "@/src/components/ui/IconButton";
import { ListRow } from "@/src/components/ui/ListRow";
import { Sheet } from "@/src/components/ui/Sheet";

/** "Joined 3 Sept 2026", or an honest shrug when the server did not say. */
const describeMember = (member: BoardMember, isYou: boolean) => {
  const joined =
    member.joinedAt > 0
      ? `Joined ${new Date(member.joinedAt).toLocaleDateString()}`
      : "Join date unknown";
  return isYou ? `${joined} · this phone` : joined;
};

/**
 * Who is on a board, and the way to take somebody off it.
 *
 * **This is the "block abusive users" half of guideline 1.2.** The rest was
 * already here — names are filtered on the way in, a board can be reported from
 * the board itself, and anybody can leave one — but leaving is the wrong tool
 * when the board is yours and somebody else is the problem. The server has
 * always been able to do this (`DELETE /groups/{id}/members/{accountId}` needs
 * `manageAdmins`); nothing in the app ever called it.
 *
 * **There are no names in this list, deliberately.** A board strips other
 * people's `accountId` before it leaves the server, so the app cannot say which
 * account holds which player — see `members.ts`. People are identified by when
 * they joined and by the tail of their account id, which is the most this can
 * show without undoing that. It is enough for the case this exists for: a small
 * board where somebody has just put something on it that the others want gone.
 *
 * **Removing somebody also replaces the board's invite code**, because removal
 * on its own is not revocation: the code they were sent keeps working, and they
 * would simply rejoin.
 */
export function BoardMembersSheet({
  visible,
  boardName,
  callerId,
  onClose,
  load,
  onRemove,
}: {
  visible: boolean;
  boardName: string;
  /** The account doing the looking, so its own row can say so. */
  callerId: string | null;
  onClose: () => void;
  /** `null` when the list could not be fetched, which is not an empty board. */
  load: () => Promise<BoardMember[] | null>;
  onRemove: (
    accountId: string,
  ) => Promise<
    { ok: true; codeReplaced: boolean } | { ok: false; reason: string }
  >;
}) {
  const [members, setMembers] = useState<BoardMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /**
   * Fetched when the sheet opens, and again after a removal.
   *
   * A counter rather than a boolean, so asking again is a state change even
   * when the sheet never closed — the same trick `pullsWanted` uses for the
   * same reason.
   */
  const [asks, setAsks] = useState(0);

  /**
   * Start clean on each open, adjusted during render rather than in an effect —
   * the pattern `ReportBoardSheet` and `DurationField` use, because `setState`
   * in an effect body is a lint error here.
   */
  const [openedFor, setOpenedFor] = useState(visible);
  if (openedFor !== visible) {
    setOpenedFor(visible);
    if (visible) {
      setMembers(null);
      setFailed(false);
      setBusyId(null);
      setNote(null);
      setAsks((n) => n + 1);
    }
  }

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void load().then((list) => {
      if (!active) return;
      setMembers(list ?? []);
      setFailed(list === null);
    });
    return () => {
      active = false;
    };
  }, [visible, asks, load]);

  const remove = (member: BoardMember) => {
    const refusal = removalRefusal({
      member,
      callerId: callerId ?? "",
      members: members ?? [],
    });
    if (refusal) {
      Alert.alert("Can't remove this member", refusal);
      return;
    }
    Alert.alert(
      "Remove from board",
      `Remove this member from "${boardName}"? They stop getting its updates, and the board's invite code is replaced so the one they have can't be used to rejoin.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyId(member.accountId);
              const result = await onRemove(member.accountId);
              setBusyId(null);
              if (!result.ok) {
                Alert.alert("Couldn't remove them", result.reason);
                return;
              }
              setNote(
                result.codeReplaced
                  ? "Removed, and the invite code has been replaced. Share the board again to invite anybody else."
                  : "Removed — but the old invite code could not be replaced, so the code they already have still works. Share the board again to replace it.",
              );
              setAsks((n) => n + 1);
            })();
          },
        },
      ],
    );
  };

  const list = sortedMembers(members ?? []);

  return (
    <Sheet visible={visible} onClose={onClose} title={`Who's on ${boardName}`}>
      <Text style={styles.blurb}>
        Everyone signed in to this board. The app never says which account holds
        which player, so people are listed by when they joined.
      </Text>

      {note ? <Text style={styles.note}>{note}</Text> : null}

      {members === null ? (
        <Text style={styles.blurb}>Loading…</Text>
      ) : failed ? (
        <Text style={styles.problem}>
          That list couldn&apos;t be loaded — check your connection and try
          again. Nobody has been removed.
        </Text>
      ) : list.length === 0 ? (
        <Text style={styles.blurb}>Nobody else has joined this board yet.</Text>
      ) : (
        <View style={styles.list}>
          {list.map((member) => {
            const isYou = member.accountId === callerId;
            return (
              <ListRow
                key={member.accountId}
                title={`${member.role === "admin" ? "Admin" : "Member"}${isYou ? " · you" : ` · #${member.accountId.slice(-4)}`}`}
                meta={describeMember(member, isYou)}
                right={
                  isYou ? undefined : (
                    <IconButton
                      icon={
                        busyId === member.accountId
                          ? "hourglass-outline"
                          : "person-remove-outline"
                      }
                      tone="danger"
                      onPress={() => remove(member)}
                      accessibilityLabel={`Remove the member who joined ${describeMember(member, false)}`}
                    />
                  )
                }
              />
            );
          })}
        </View>
      )}

      <Button label="Done" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  blurb: { ...text.body, color: colors.textMuted },
  note: { ...text.meta, color: colors.textMuted },
  problem: { ...text.meta, color: colors.danger },
  list: { gap: space.sm },
});
