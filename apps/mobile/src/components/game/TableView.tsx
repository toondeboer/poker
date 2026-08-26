// src/components/game/TableView.tsx
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  formatPlace,
  handCategory,
  type BettingAction,
  type GameSession,
  type LegalActions,
} from "@poker/core";
import { colors, radius, space, text } from "@/src/theme";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { NumberField } from "@/src/components/ui/NumberField";
import { PlayingCard } from "./PlayingCard";

const STREET_LABEL: Record<string, string> = {
  preflop: "Pre-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  complete: "Hand over",
};

/**
 * The table: the board, the pot, everybody's stack, and whose turn it is.
 *
 * **Hole cards stay hidden until the player to act asks for them**, because one
 * phone is going round the table. Showing them automatically would mean the
 * previous player sees the next one's hand every time they hand the phone over,
 * which is the whole game.
 */
export function TableView({
  session,
  legal,
  onAct,
  nameFor,
}: {
  session: GameSession;
  legal: LegalActions | null;
  onAct: (playerId: string, action: BettingAction) => void;
  /** Player ids travel; names are for reading. */
  nameFor: (id: string) => string;
}) {
  const hand = session.hand ?? session.lastHand;
  const [revealed, setRevealed] = useState(false);
  const [raiseTo, setRaiseTo] = useState(legal?.minRaiseTo ?? 0);

  // A new player to act means the phone has changed hands: hide the cards
  // again, and drop any half-built raise. Tracked during render against the
  // previous value rather than in an effect — the same pattern DurationField
  // and GenerateStructureSheet use, and the repo's lint rules require.
  const [lastToAct, setLastToAct] = useState(legal?.playerId ?? null);
  if (lastToAct !== (legal?.playerId ?? null)) {
    setLastToAct(legal?.playerId ?? null);
    setRevealed(false);
    // Seed the amount at the minimum legal raise: the commonest choice, and
    // the one that cannot be out of range.
    setRaiseTo(legal?.minRaiseTo ?? 0);
  }

  if (!hand) return null;

  // While a hand runs, the pot is what is in front of people. Once it is over
  // the chips have already been pushed back into the stacks, so adding the
  // committed totals again would show a pot that no longer exists — and each
  // seat's "N in" alongside a stack that already includes their winnings.
  const settled = hand.street === "complete";
  const pot = settled
    ? hand.pots.reduce((sum, entry) => sum + entry.amount, 0)
    : hand.seats.reduce((sum, seat) => sum + seat.committed, 0);
  const acting = legal
    ? hand.seats.find((seat) => seat.playerId === legal.playerId)
    : undefined;

  /**
   * A pot-sized raise: call first, then raise by what is in the middle after
   * that — the reference size players actually name at a table.
   *
   * `null` when it lands on or outside the two ends, because a "Pot" button
   * that quietly means "min" or "all in" lies about what it does, and both of
   * those already have their own.
   */
  const potRaiseTo = (() => {
    if (!legal?.canRaise || !hand.round) return null;
    const target = hand.round.currentBet + pot + legal.callAmount;
    if (target <= legal.minRaiseTo || target >= legal.maxRaiseTo) return null;
    return target;
  })();

  return (
    <>
      <Card>
        <CardHeader
          icon="grid"
          title={STREET_LABEL[hand.street] ?? hand.street}
          right={<Badge label={settled ? `Pot was ${pot}` : `Pot ${pot}`} />}
        />
        <CardContent>
          <View style={styles.board}>
            {hand.board.map((card, index) => (
              <PlayingCard key={index} card={card} />
            ))}
            {Array.from({ length: 5 - hand.board.length }).map((_, index) => (
              <View key={`gap-${index}`} style={styles.slot} />
            ))}
          </View>

          <View style={styles.seats}>
            {hand.seats.map((seat) => {
              const isActing = seat.playerId === legal?.playerId;
              const shown = hand.showdown?.find(
                (entry) => entry.playerId === seat.playerId,
              );
              return (
                <View
                  key={seat.playerId}
                  style={[styles.seat, isActing && styles.seatActing]}
                >
                  <View style={styles.seatInfo}>
                    <Text style={styles.seatName} numberOfLines={1}>
                      {nameFor(seat.playerId)}
                      {seat.status === "folded" ? " · folded" : ""}
                      {seat.status === "all-in" ? " · all in" : ""}
                    </Text>
                    <Text style={styles.seatMeta}>
                      {seat.stack} behind
                      {!settled && seat.committed > 0
                        ? ` · ${seat.committed} in`
                        : ""}
                      {shown ? ` · ${handCategory(shown.hand.value).replace(/-/g, " ")}` : ""}
                    </Text>
                  </View>
                  {shown ? (
                    <View style={styles.hole}>
                      {seat.hole.map((card, index) => (
                        <PlayingCard key={index} card={card} size="sm" />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          {hand.awards.length > 0 ? (
            <View style={styles.awards}>
              {hand.awards.map((award) => (
                <Text key={award.playerId} style={styles.award}>
                  {nameFor(award.playerId)} wins {award.amount}
                </Text>
              ))}
            </View>
          ) : null}
        </CardContent>
      </Card>

      {legal && acting ? (
        <Card>
          <CardHeader icon="person" title={`${nameFor(legal.playerId)} to act`} />
          <CardContent>
            {revealed ? (
              <View style={styles.hole}>
                {acting.hole.map((card, index) => (
                  <PlayingCard key={index} card={card} />
                ))}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.peek}
                onPress={() => setRevealed(true)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${nameFor(legal.playerId)}'s cards`}
              >
                <View style={styles.hole}>
                  <PlayingCard faceDown />
                  <PlayingCard faceDown />
                </View>
                <Text style={styles.peekLabel}>
                  Tap to see your cards — make sure nobody else can.
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.actions}>
              <Button
                label="Fold"
                variant="danger"
                size="sm"
                onPress={() => onAct(legal.playerId, { type: "fold" })}
              />
              {legal.canCheck ? (
                <Button
                  label="Check"
                  variant="secondary"
                  size="sm"
                  onPress={() => onAct(legal.playerId, { type: "check" })}
                />
              ) : (
                <Button
                  label={`Call ${legal.callAmount}`}
                  variant="secondary"
                  size="sm"
                  onPress={() => onAct(legal.playerId, { type: "call" })}
                />
              )}
            </View>

            {legal.canRaise ? (
              <View style={styles.raise}>
                <NumberField
                  label="Raise to"
                  value={raiseTo}
                  onChangeValue={setRaiseTo}
                  min={legal.minRaiseTo}
                  helper={`Between ${legal.minRaiseTo} and ${legal.maxRaiseTo}`}
                />
                {/* Quick sizes **set the amount**; they do not act. Raising is
                    always a second, deliberate tap — an all-in reached by a
                    mis-tap is not something a table forgives, and this is the
                    one control here that can end somebody's night. */}
                <View style={styles.quickSizes}>
                  <Button
                    label="Min"
                    variant="secondary"
                    size="sm"
                    onPress={() => setRaiseTo(legal.minRaiseTo)}
                  />
                  {potRaiseTo !== null ? (
                    <Button
                      label="Pot"
                      variant="secondary"
                      size="sm"
                      onPress={() => setRaiseTo(potRaiseTo)}
                    />
                  ) : null}
                  <Button
                    label="All in"
                    variant="secondary"
                    size="sm"
                    onPress={() => setRaiseTo(legal.maxRaiseTo)}
                  />
                </View>
                <Button
                  label={
                    raiseTo >= legal.maxRaiseTo
                      ? `All in for ${legal.maxRaiseTo}`
                      : `Raise to ${raiseTo}`
                  }
                  variant="pro"
                  onPress={() =>
                    onAct(legal.playerId, { type: "raise", to: raiseTo })
                  }
                  disabled={
                    raiseTo < legal.minRaiseTo || raiseTo > legal.maxRaiseTo
                  }
                />
              </View>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

/** Standings for a finished game, winner first. */
export function FinishingOrder({
  order,
  nameFor,
}: {
  order: string[];
  nameFor: (id: string) => string;
}) {
  return (
    <View style={styles.seats}>
      {order.map((playerId, index) => (
        <View key={playerId} style={styles.seat}>
          <Text style={styles.seatName}>
            {formatPlace(index + 1)}  {nameFor(playerId)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "center",
    marginBottom: space.md,
  },
  slot: {
    width: 46,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  seats: { gap: space.sm },
  seat: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent",
    padding: space.md,
  },
  seatActing: { borderColor: colors.accent },
  seatInfo: { flex: 1 },
  seatName: { ...text.rowTitle },
  seatMeta: { ...text.meta },
  hole: { flexDirection: "row", gap: space.sm },
  peek: { alignItems: "center", gap: space.sm },
  peekLabel: { ...text.meta, textAlign: "center" },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  raise: { marginTop: space.sm, gap: space.sm },
  quickSizes: { flexDirection: "row", gap: space.sm },
  awards: { marginTop: space.md, gap: space.xs },
  award: { ...text.rowTitle, color: colors.accent },
});
