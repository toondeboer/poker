// src/components/leaderboard/RecordResultSheet.tsx
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  computePayouts,
  formatPlace,
  toPayoutOptions,
  Placing,
  Player,
} from "@poker/core";
import { usePayouts } from "@/src/contexts/PayoutContext";
import { colors, space, text } from "@/src/theme";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { ListRow } from "@/src/components/ui/ListRow";
import { Sheet } from "@/src/components/ui/Sheet";

/**
 * Record who played and how it finished.
 *
 * **Two taps per player, no typing.** Tap to mark someone as having played,
 * then tap again in the "finishing order" list to give them the next place.
 * Ranking by tap order avoids a picker per place, which is the interaction this
 * would otherwise need and the one that makes recording a result feel like
 * paperwork at the end of a long evening.
 *
 * Winnings are **not entered** — they come from the payout structure the host
 * already set up, recomputed for the field that actually turned up rather than
 * the one they planned for. That's the whole reason payouts was built first.
 */
export function RecordResultSheet({
  visible,
  onClose,
  players,
  onRecord,
}: {
  visible: boolean;
  onClose: () => void;
  players: Player[];
  onRecord: (params: {
    playerIds: string[];
    placings: Placing[];
    buyIn: number;
    bounty: number;
  }) => void;
}) {
  const { settings } = usePayouts();
  const [playedIds, setPlayedIds] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);

  /**
   * The saved setup, with the field replaced by who actually turned up.
   *
   * Derived from `toPayoutOptions` rather than hand-built: listing the fields
   * out meant that adding rebuys and add-ons silently left them behind here,
   * so recorded winnings came from a smaller pool than the Payouts screen was
   * showing — and got stored that way permanently. Spreading keeps this
   * correct the next time the model grows.
   */
  const structure = useMemo(
    () =>
      computePayouts({
        ...toPayoutOptions(settings),
        entrants: playedIds.length,
      }),
    [settings, playedIds.length],
  );

  const paidPlaces = structure?.payouts.length ?? 0;

  /**
   * How many finishes can be ranked — deliberately **not** just the paid
   * places. Who got paid and who finished where are different questions: a
   * four-player game pays one place, so tying ranking to payouts would make
   * second and third unrecordable and leave the leaderboard's podium tie-break
   * with nothing to work from in exactly the field sizes a home game runs.
   * Places past the paid ones simply win nothing.
   */
  const rankablePlaces = Math.max(paidPlaces, Math.min(playedIds.length, 3));

  const reset = () => {
    setPlayedIds([]);
    setOrder([]);
  };

  const close = () => {
    reset();
    onClose();
  };

  const togglePlayed = (id: string) => {
    setPlayedIds((previous) =>
      previous.includes(id)
        ? previous.filter((playerId) => playerId !== id)
        : [...previous, id],
    );
    // Dropping someone who was already ranked has to drop their place too, or
    // the result would carry a placing for a player who wasn't in the field.
    setOrder((previous) => previous.filter((playerId) => playerId !== id));
  };

  const toggleOrder = (id: string) => {
    setOrder((previous) => {
      if (previous.includes(id)) {
        return previous.filter((playerId) => playerId !== id);
      }
      if (previous.length >= rankablePlaces) return previous;
      return [...previous, id];
    });
  };

  const handleSave = () => {
    if (order.length === 0) return;
    onRecord({
      playerIds: playedIds,
      placings: order.map((playerId, index) => ({
        playerId,
        place: index + 1,
        winnings: structure?.payouts[index]?.amount ?? 0,
      })),
      buyIn: settings.buyIn,
      bounty: settings.bounty,
    });
    reset();
    onClose();
  };

  const playedPlayers = players.filter((player) =>
    playedIds.includes(player.id),
  );

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Record a game"
      footer={
        <Button
          label={
            order.length === 0
              ? "Pick a winner to save"
              : `Save game · ${playedIds.length} played`
          }
          icon="save"
          onPress={handleSave}
          disabled={order.length === 0}
        />
      }
    >
      {players.length === 0 ? (
        <Text style={styles.empty}>
          Add some players first — you can do that on the leaderboard screen.
        </Text>
      ) : (
        <View style={styles.sections}>
          <View style={styles.section}>
            <Text style={styles.heading}>Who played?</Text>
            <View style={styles.list}>
              {players.map((player) => (
                <ListRow
                  key={player.id}
                  title={player.name}
                  selected={playedIds.includes(player.id)}
                  onPress={() => togglePlayed(player.id)}
                  meta={
                    playedIds.includes(player.id) ? "Bought in" : undefined
                  }
                />
              ))}
            </View>
          </View>

          {playedIds.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.heading}>Finishing order</Text>
              <Text style={styles.hint}>
                {paidPlaces > 0
                  ? `Tap players in the order they finished, top ${rankablePlaces}. ${paidPlaces} of them ${paidPlaces === 1 ? "is paid" : "are paid"} from a ${playedIds.length}-player field.`
                  : `Tap players in the order they finished, top ${rankablePlaces}. Set a buy-in on the Payouts screen to work out the winnings.`}
              </Text>
              <View style={styles.list}>
                {playedPlayers.map((player) => {
                  const index = order.indexOf(player.id);
                  const payout = structure?.payouts[index];
                  return (
                    <ListRow
                      key={player.id}
                      title={player.name}
                      selected={index >= 0}
                      onPress={() => toggleOrder(player.id)}
                      meta={
                        index < 0
                          ? "Tap to rank"
                          : payout
                            ? `${formatPlace(index + 1)} · won ${payout.amount}`
                            : `${formatPlace(index + 1)} · no prize`
                      }
                      right={
                        index >= 0 ? (
                          <Badge label={formatPlace(index + 1)} tone="live" />
                        ) : undefined
                      }
                    />
                  );
                })}
              </View>
            </View>
          )}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xl },
  section: { gap: space.md },
  heading: text.cardTitle,
  hint: { ...text.meta, lineHeight: 18 },
  empty: { ...text.body, color: colors.textMuted },
  list: { gap: space.md },
});
