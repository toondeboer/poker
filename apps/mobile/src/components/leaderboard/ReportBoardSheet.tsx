// src/components/leaderboard/ReportBoardSheet.tsx
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  MAX_REPORT_DETAIL,
  REPORT_REASONS,
  labelForReportReason,
  type ReportReason,
} from "@poker/core";
import { colors, space, text } from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { Sheet } from "@/src/components/ui/Sheet";
import { TextField } from "@/src/components/ui/TextField";

/**
 * Report what is on a shared board.
 *
 * **Reachable from the board itself, not from a support page.** A board is the
 * only place somebody sees the name that upset them, and a report that has to
 * be composed somewhere else is one nobody sends — which is the difference
 * between satisfying Apple's guideline 1.2 and appearing to.
 *
 * Reason first, then optional detail: picking from a short list is one tap, and
 * a report with no free text at all is still worth having. The detail is what
 * actually gets acted on, so it is offered rather than required.
 */
export function ReportBoardSheet({
  visible,
  boardName,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  boardName: string;
  onClose: () => void;
  /** Resolves `false` when it could not be sent, which this says out loud. */
  onSubmit: (reason: ReportReason, detail: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<"sent" | "failed" | null>(null);

  /**
   * Start clean every time this opens.
   *
   * Reopening on a different board must not show the previous one's answers, or
   * somebody sends a report they wrote about something else while reading the
   * right board's name.
   *
   * Adjusted during render rather than in an effect — the same pattern
   * `DurationField` uses, and for the same reason: `setState` in an effect body
   * is a lint error here, and React re-runs the component immediately without
   * committing the intermediate result, so the sheet never paints one frame of
   * the previous board's report.
   */
  const [openedFor, setOpenedFor] = useState(visible);
  if (openedFor !== visible) {
    setOpenedFor(visible);
    if (visible) {
      setReason(null);
      setDetail("");
      setSending(false);
      setOutcome(null);
    }
  }

  const send = async () => {
    if (!reason || sending) return;
    setSending(true);
    const ok = await onSubmit(reason, detail.trim());
    setSending(false);
    setOutcome(ok ? "sent" : "failed");
  };

  if (outcome === "sent") {
    return (
      <Sheet visible={visible} onClose={onClose} title="Report sent">
        <Text style={styles.body}>
          Thanks — we&apos;ve got it, and somebody will look at it. If the board
          is the problem rather than one name on it, you can also leave it from
          the boards list.
        </Text>
        <Button label="Done" onPress={onClose} />
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={`Report ${boardName}`}>
      <Text style={styles.body}>
        Tell us what&apos;s wrong with this board and we&apos;ll review it.
        Reports are read by a person, not a filter.
      </Text>

      <Text style={styles.label}>What&apos;s the problem?</Text>
      <View style={styles.reasons}>
        {REPORT_REASONS.map((option) => (
          <Button
            key={option}
            label={labelForReportReason(option)}
            variant={reason === option ? "primary" : "secondary"}
            onPress={() => setReason(option)}
          />
        ))}
      </View>

      <TextField
        label="Anything else? (optional)"
        value={detail}
        onChangeText={setDetail}
        placeholder="Which name, or what happened"
        multiline
        maxLength={MAX_REPORT_DETAIL}
        style={styles.detail}
      />

      {outcome === "failed" ? (
        <Text style={styles.problem}>
          That couldn&apos;t be sent — check your connection and try again.
          Nothing has been reported yet.
        </Text>
      ) : null}

      <Button
        label={sending ? "Sending…" : "Send report"}
        icon="flag-outline"
        onPress={() => void send()}
        disabled={!reason || sending}
      />
      <Button label="Cancel" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { ...text.body, color: colors.textMuted, marginBottom: space.md },
  label: { ...text.label, marginBottom: space.sm },
  reasons: { gap: space.sm, marginBottom: space.md },
  detail: { minHeight: 88, textAlignVertical: "top" },
  problem: { ...text.meta, color: colors.danger, marginBottom: space.sm },
});
