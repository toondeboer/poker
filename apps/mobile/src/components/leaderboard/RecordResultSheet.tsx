// src/components/leaderboard/RecordResultSheet.tsx
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatPlace, Placing, Player } from "@poker/core";
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
 * **No money is entered or recorded.** The board keeps who played and who
 * finished where; the payout calculator works out what each place wins on the
 * night, and the two no longer touch. See the Gambling classification section
 * in `ROADMAP.md`.
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
  /**
   * Record the game, saying whether it was actually taken.
   *
   * **Returns the answer, because this sheet is about to clear the evening's
   * entry.** `recordResult` refuses for reasons invisible from out here — a
   * duplicate placing, a place out of range — and closing on a refusal loses
   * every tap with nothing on screen saying why.
   */
  onRecord: (params: { playerIds: string[]; placings: Placing[] }) => boolean;
}) {
  const [playedIds, setPlayedIds] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [refused, setRefused] = useState<string | null>(null);

  /**
   * How many finishes can be ranked: the podium, or fewer in a tiny field.
   *
   * This used to stretch to however many places the prize table paid, because
   * who got paid and who finished where were different questions. With no
   * money on the board there is only the second question, and the podium is
   * what the leaderboard's tie-break works from.
   */
  const rankablePlaces = Math.min(playedIds.length, 3);

  const reset = () => {
    setPlayedIds([]);
    setOrder([]);
    setRefused(null);
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
    const saved = onRecord({
      playerIds: playedIds,
      placings: order.map((playerId, index) => ({
        playerId,
        place: index + 1,
      })),
    });
    // **Only clear the evening's entry if it was actually recorded.** Closing
    // on a refusal wipes every tap and puts nothing on the board, with no way
    // to tell that from a save that worked. `GameScreen` already handles this
    // return value; this path used to discard it.
    if (!saved) {
      setRefused("That game couldn't be saved. Nothing has been recorded.");
      return;
    }
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
          {refused !== null && <Text style={styles.refused}>{refused}</Text>}
          <View style={styles.section}>
            <Text style={styles.heading}>Who played?</Text>
            <View style={styles.list}>
              {players.map((player) => (
                <ListRow
                  key={player.id}
                  title={player.name}
                  selected={playedIds.includes(player.id)}
                  onPress={() => togglePlayed(player.id)}
                  meta={playedIds.includes(player.id) ? "Bought in" : undefined}
                />
              ))}
            </View>
          </View>

          {playedIds.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.heading}>Finishing order</Text>
              <Text style={styles.hint}>
                {`Tap players in the order they finished, top ${rankablePlaces}.`}
              </Text>
              <View style={styles.list}>
                {playedPlayers.map((player) => {
                  const index = order.indexOf(player.id);
                  return (
                    <ListRow
                      key={player.id}
                      title={player.name}
                      selected={index >= 0}
                      onPress={() => toggleOrder(player.id)}
                      meta={index < 0 ? "Tap to rank" : formatPlace(index + 1)}
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
  refused: { ...text.body, color: colors.danger },
  list: { gap: space.md },
});
