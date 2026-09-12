// src/components/game/TableView.tsx
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { handCategory, type Deal, type DealerSession } from "@poker/core";
import { colors, radius, space, text } from "@/src/theme";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { PlayingCard } from "./PlayingCard";

const STREET_LABEL: Record<string, string> = {
  preflop: "Pre-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

const NEXT_STREET: Record<string, string> = {
  preflop: "Deal the flop",
  flop: "Deal the turn",
  turn: "Deal the river",
  river: "Show the hands",
};

/**
 * The table: the board, who is still in, and each player's own two cards.
 *
 * **Hole cards stay hidden until the player asks for them**, because one phone
 * is going round the table. Showing them automatically would mean whoever holds
 * the phone sees the next player's hand every time it changes hands, which is
 * the whole game.
 *
 * **There is nothing to bet with here.** No stack, no pot, no amount beside a
 * seat, and the control that takes a player out of a hand is *Muck*, not Fold —
 * folding is a betting action and there is no betting. That is a deliberate
 * boundary, not an unfinished screen: see `packages/core/src/poker/deal.ts`.
 */
export function TableView({
  session,
  onAdvance,
  onMuck,
  nameFor,
}: {
  session: DealerSession;
  onAdvance: () => void;
  onMuck: (playerId: string, mucked: boolean) => void;
  /** Player ids travel; names are for reading. */
  nameFor: (id: string) => string;
}) {
  const deal: Deal | null = session.deal ?? session.lastDeal;
  const [shownSeat, setShownSeat] = useState<string | null>(null);

  /**
   * Hide whatever was on screen when the hand changes.
   *
   * Tracked during render against the previous value rather than in an effect —
   * the same pattern `DurationField` uses, and what the repo's lint rules
   * require. Keyed on the board length as well as the street so a fresh deal
   * from the same street still clears.
   */
  const key = deal ? `${deal.street}:${deal.board.length}` : "none";
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setShownSeat(null);
  }

  if (!deal) return null;

  const live = deal.seats.filter((seat) => !seat.mucked);
  const finished = deal.street === "showdown";
  /**
   * Reaching the showdown is not the same as anybody having to show.
   *
   * `deal.showdown` is `null` when one player is left holding cards — see
   * `showdownFor` in `@poker/core` — and an uncontested hand is not revealed,
   * at a real table or here. Keying the reveal on `finished` alone printed
   * "Everyone else mucked — no hand had to be shown" directly under the hand
   * it had just shown, which is the one thing this screen exists to prevent:
   * the phone goes round the table at the showdown, so a hand exposed here is
   * exposed to everybody. Tapping a seat still peeks, which is how the host
   * checks the winner without showing the room.
   */
  const revealAll = finished && deal.showdown !== null;
  const shown = deal.seats.find((seat) => seat.playerId === shownSeat) ?? null;

  return (
    <Card>
      <CardHeader
        icon="grid"
        title={STREET_LABEL[deal.street] ?? deal.street}
        right={<Badge label={`${live.length} in`} />}
      />
      <CardContent>
        {deal.board.length > 0 ? (
          <View style={styles.board}>
            {deal.board.map((card, index) => (
              <PlayingCard
                key={`${card.rank}${card.suit}${index}`}
                card={card}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>
            Nothing on the board yet — everyone has their two cards.
          </Text>
        )}

        {/* One seat's cards at a time. Tapping another hides the previous, so
            the phone can never be handed over showing somebody else's hand. */}
        <View style={styles.seats}>
          {deal.seats.map((seat) => {
            const isShown = seat.playerId === shownSeat;
            return (
              <TouchableOpacity
                key={seat.playerId}
                style={[styles.seat, seat.mucked && styles.seatMucked]}
                onPress={() => setShownSeat(isShown ? null : seat.playerId)}
                accessibilityRole="button"
                accessibilityLabel={
                  isShown
                    ? `Hide ${nameFor(seat.playerId)}'s cards`
                    : `Show ${nameFor(seat.playerId)}'s cards`
                }
              >
                <Text style={styles.seatName}>
                  {nameFor(seat.playerId)}
                  {seat.mucked ? " · mucked" : ""}
                </Text>
                {isShown || revealAll ? (
                  <View style={styles.hole}>
                    {seat.mucked && !isShown ? (
                      <Text style={styles.holeHidden}>—</Text>
                    ) : (
                      seat.hole.map((card, index) => (
                        <PlayingCard
                          key={`${card.rank}${card.suit}${index}`}
                          card={card}
                          size="sm"
                        />
                      ))
                    )}
                  </View>
                ) : (
                  <Text style={styles.holeHidden}>Tap to see</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Warn whenever one hand is deliberately on screen — including at an
            uncontested showdown, where peeking is the only way to see it and
            the phone is most likely to be going round. Not when everything is
            revealed anyway. */}
        {shown && !revealAll ? (
          <Text style={styles.warn}>
            Showing {nameFor(shown.playerId)}&apos;s cards — make sure nobody
            else can see. Tap again to hide.
          </Text>
        ) : null}

        {finished ? (
          <ShowdownList deal={deal} nameFor={nameFor} />
        ) : (
          <>
            <Button
              label={NEXT_STREET[deal.street] ?? "Next"}
              icon="play"
              onPress={onAdvance}
            />
            {/* Muck, never Fold. Nothing here is a bet. */}
            <View style={styles.muckRow}>
              {live.length > 1
                ? live.map((seat) => (
                    <Button
                      key={seat.playerId}
                      label={`Muck ${nameFor(seat.playerId)}`}
                      variant="ghost"
                      size="sm"
                      onPress={() => onMuck(seat.playerId, true)}
                    />
                  ))
                : null}
            </View>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Who showed what, best first. Absent when nobody had to show. */
function ShowdownList({
  deal,
  nameFor,
}: {
  deal: Deal;
  nameFor: (id: string) => string;
}) {
  if (!deal.showdown) {
    return (
      <Text style={styles.empty}>
        Everyone else mucked — no hand had to be shown.
      </Text>
    );
  }
  return (
    <View style={styles.showdown}>
      {deal.showdown.map((entry, index) => (
        <View key={entry.playerId} style={styles.showdownRow}>
          <Text style={styles.showdownName}>
            {index === 0 ? "★ " : ""}
            {nameFor(entry.playerId)}
          </Text>
          <Text style={styles.showdownHand}>
            {handCategory(entry.hand.value).replace(/-/g, " ")}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    justifyContent: "center",
    marginBottom: space.md,
  },
  empty: { ...text.body, color: colors.textMuted, marginBottom: space.md },
  seats: { gap: space.xs, marginBottom: space.md },
  seat: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  seatMucked: { opacity: 0.5 },
  seatName: { ...text.body, flexShrink: 1 },
  hole: { flexDirection: "row", gap: space.xs },
  holeHidden: { ...text.meta, color: colors.textMuted },
  warn: { ...text.meta, color: colors.textMuted, marginBottom: space.md },
  muckRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  showdown: { gap: space.xs },
  showdownRow: { flexDirection: "row", justifyContent: "space-between" },
  showdownName: { ...text.body },
  showdownHand: { ...text.meta, color: colors.textMuted },
});
