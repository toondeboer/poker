// src/components/payouts/ChopSheet.tsx
import { useMemo, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { computeChop, PayoutSettings, PayoutStructure } from "@poker/core";
import { colors, space, text } from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { ListRow } from "@/src/components/ui/ListRow";
import { NumberField } from "@/src/components/ui/NumberField";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { Sheet } from "@/src/components/ui/Sheet";

/** Enough of a starting stack to look like chips rather than a placeholder. */
const DEFAULT_STACK = 100;

/**
 * Split the remaining money when the players still in agree to end it there.
 *
 * A sheet rather than a screen because it's a moment, not a setting — you open
 * it at 1am, read the numbers out, and close it. Nothing here is persisted:
 * the stacks are true for about thirty seconds, and a chop the host half-typed
 * last week is worse than an empty form.
 */
export function ChopSheet({
  visible,
  onClose,
  structure,
  settings,
}: {
  visible: boolean;
  onClose: () => void;
  structure: PayoutStructure;
  settings: PayoutSettings;
}) {
  const maxPlayers = structure.payouts.length;
  const [players, setPlayers] = useState(3);
  /**
   * Sparse on purpose: read through {@link stackAt} rather than sized once.
   *
   * This sheet mounts with whatever `structure` exists at first render, which
   * is the *default* settings until the stored ones load. Sizing the array
   * there meant a host with a bigger saved field could pick six players and get
   * three chip fields, a three-way split of the top-three money, and a share
   * message claiming it was between six.
   */
  const [chips, setChips] = useState<number[]>([]);

  /**
   * Clamped rather than stored back, for the same reason the paid-place pin is:
   * the paid places can shrink underneath this sheet (a smaller field, a
   * coarser note size), and a count left pointing past them would ask
   * `computeChop` for a deal involving players who aren't in the money — it
   * would refuse, and the sheet would show nothing with no explanation.
   */
  // Clamped at both ends. The upper bound is the reason above; the lower one is
  // that a sheet first rendered while only one place was paid would otherwise
  // hold `players = 1` forever, and `computeChop` refuses a one-player deal —
  // leaving exactly the unexplained empty state this clamp exists to prevent.
  const activePlayers = Math.max(2, Math.min(players, maxPlayers));

  const stackAt = (index: number) => chips[index] ?? DEFAULT_STACK;

  // Only the first `activePlayers` stacks are in play; the rest are kept so
  // stepping the count down and back up doesn't wipe what was typed.
  const inPlay = Array.from({ length: activePlayers }, (_, i) => stackAt(i));

  const result = useMemo(
    () =>
      computeChop({
        structure,
        // Rebuilt inside the memo from the two things it actually depends on,
        // so the dependency list stays honest and needs no lint exception.
        chips: Array.from(
          { length: activePlayers },
          (_, index) => chips[index] ?? DEFAULT_STACK,
        ),
        denomination: settings.denomination,
      }),
    [structure, settings.denomination, chips, activePlayers],
  );

  const setStack = (index: number, value: number) =>
    setChips((previous) => {
      const next = Array.from(
        { length: Math.max(previous.length, index + 1) },
        (_, i) => previous[i] ?? DEFAULT_STACK,
      );
      next[index] = value;
      return next;
    });

  const handleShare = () => {
    if (!result) return;
    const lines = [
      `Chop — ${result.remainingMoney} between ${activePlayers}`,
      "",
      // Deliberately "Player N", not "1st/2nd": a chop ends the tournament
      // without deciding a finishing order, so ordinals would be inventing a
      // result nobody played out.
      ...result.shares.map(
        (share) =>
          `Player ${share.index + 1} — ${share.chips} chips  →  ${share.amount}`,
      ),
    ];
    Share.share({ message: lines.join("\n") }).catch(() => {});
  };

  const playerOptions = Array.from({ length: maxPlayers - 1 }, (_, index) => ({
    value: index + 2,
    label: String(index + 2),
  }));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Chop the remaining money"
      footer={
        <Button
          label="Share the deal"
          icon="share-social-outline"
          onPress={handleShare}
          disabled={!result}
        />
      }
    >
      <View style={styles.sections}>
        <Text style={styles.hint}>
          Everyone still in keeps the lowest prize left, and whatever is above
          that is split by chip stack. Nobody ends up below the place they had
          already locked up.
        </Text>

        {maxPlayers < 2 ? (
          <Text style={styles.empty}>
            Only one place is paid, so there is nothing to split.
          </Text>
        ) : (
          <>
            <SegmentedControl
              label="Players left"
              options={playerOptions}
              value={activePlayers}
              onChange={setPlayers}
              wrap
            />

            <View style={styles.list}>
              {inPlay.map((stack, index) => (
                <NumberField
                  key={index}
                  label={`Chips — player ${index + 1}`}
                  value={stack}
                  onChangeValue={(value) => setStack(index, value)}
                  min={0}
                />
              ))}
            </View>

            {result && (
              <View style={styles.section}>
                <Text style={styles.heading}>The deal</Text>
                <View style={styles.list}>
                  {result.shares.map((share) => (
                    <ListRow
                      key={share.index}
                      title={`Player ${share.index + 1}`}
                      meta={`${share.chips} chips`}
                      right={
                        <Text style={styles.amount}>{share.amount}</Text>
                      }
                    />
                  ))}
                </View>
                <Text style={styles.hint}>
                  {result.remainingMoney} still to play for ·{" "}
                  {result.guaranteedEach} guaranteed each ·{" "}
                  {result.surplus} split by chips
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.lg },
  section: { gap: space.md },
  heading: text.cardTitle,
  hint: { ...text.meta, lineHeight: 18 },
  empty: { ...text.body, color: colors.textMuted },
  list: { gap: space.md },
  amount: { ...text.mono, minWidth: 64, textAlign: "right" },
});
