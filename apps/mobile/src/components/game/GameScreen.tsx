// src/components/game/GameScreen.tsx
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MAX_SEATS } from "@poker/core";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useLeaderboard } from "@/src/contexts/LeaderboardContext";
import {
  colors,
  isTabletWidth,
  space,
  text,
  TABLET_MAX_WIDTH_SETTINGS,
} from "@/src/theme";
import { Paywall } from "@/src/components/paywall/Paywall";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { ListRow } from "@/src/components/ui/ListRow";
import { useGame } from "@/src/contexts/GameContext";
import { TableView } from "./TableView";

const MIN_PLAYERS = 2;

/**
 * A hand of poker dealt by the phone, for a table that has chips but no cards.
 *
 * **One device, passed round.** Everyone can see the board and the stacks; only
 * the player to act can see their own two cards, and only after asking. That is
 * the whole reason the reveal is a tap rather than automatic — the phone
 * changes hands between actions.
 *
 * The rules are entirely `@poker/core`'s. Nothing here decides who acts, what
 * is legal, or where the chips go.
 */
export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = isTabletWidth(width);
  const { isPremium } = usePremium();
  const { players } = useLeaderboard();
  const game = useGame();

  const [showPaywall, setShowPaywall] = useState(false);
  const [seated, setSeated] = useState<string[]>([]);

  const canStart = seated.length >= MIN_PLAYERS;

  /**
   * Seats hold player **ids**, not names.
   *
   * The engine only ever echoes back what it was given, and the leaderboard is
   * keyed by id — so seating by name would produce a result that matches no
   * player on the board, quietly breaking the very integration the copy above
   * promises. Names are for reading; ids are what travel.
   */
  const toggleSeat = (id: string) =>
    setSeated((current) => {
      if (current.includes(id)) return current.filter((seat) => seat !== id);
      if (current.length >= MAX_SEATS) return current;
      return [...current, id];
    });

  const nameFor = (id: string) =>
    players.find((player) => player.id === id)?.name ?? id;

  // Nothing renders until the stored game has been read back. Without this the
  // setup form is interactive over an evening that is still loading, and
  // starting a new game in that window writes over it.
  const setup = game.isLoading ? null : game.session === null ? (
    <>
      <Card>
        <CardHeader
          icon="people"
          title="Who's playing"
          right={
            seated.length > 0 ? (
              <Badge label={`${seated.length} seated`} />
            ) : undefined
          }
        />
        <CardContent>
          {players.length === 0 ? (
            <Text style={styles.empty}>
              Add the people you play with on the Leaderboard screen first —
              this deals to the same names, so the result can go on the board
              afterwards.
            </Text>
          ) : (
            <View style={styles.list}>
              {players.map((player) => (
                <ListRow
                  key={player.id}
                  title={player.name}
                  selected={seated.includes(player.id)}
                  onPress={() => toggleSeat(player.id)}
                  meta={
                    seated.includes(player.id)
                      ? `Seat ${seated.indexOf(player.id) + 1}`
                      : seated.length >= MAX_SEATS
                        ? `Table full — ${MAX_SEATS} is all one deck can deal`
                        : "Tap to seat"
                  }
                />
              ))}
            </View>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {/* No stack, no blinds. The table has chips in front of them; the
              app is only the deck. */}
          <Button
            label="Deal the first hand"
            icon="play"
            onPress={() => game.startGame({ players: seated })}
            disabled={!canStart}
          />
          {!canStart ? (
            <Text style={styles.empty}>
              Seat at least {MIN_PLAYERS} players to deal.
            </Text>
          ) : null}
        </CardContent>
      </Card>
    </>
  ) : null;

  const content = game.isLoading ? null : !isPremium ? (
    <Card>
      <CardHeader icon="grid" title="Deal a hand" />
      <CardContent>
        <Text style={styles.empty}>
          Deal a real hand of hold&apos;em from the phone, for a table with
          chips but no cards. Everyone sees the board; each player&apos;s own
          two cards stay hidden until they tap.
        </Text>
        <Button
          label="Unlock with Pro"
          variant="pro"
          icon="star"
          onPress={() => setShowPaywall(true)}
        />
      </CardContent>
    </Card>
  ) : (
    (setup ?? <ActiveGame nameFor={nameFor} />)
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isTablet && styles.contentTablet,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {content}
      </ScrollView>
      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

/** A table in progress. All of its state lives in {@link GameProvider}. */
function ActiveGame({ nameFor }: { nameFor: (id: string) => string }) {
  const {
    session,
    handInProgress,
    canDealNext,
    deal,
    advanceStreet,
    toggleMuck,
    endGame,
  } = useGame();

  if (!session) return null;

  /**
   * **Nothing here records a result.**
   *
   * The app used to price every finish from the host's buy-in and write the
   * amounts onto the leaderboard — that is what made it a money tracker. It
   * cannot know who finished where now either: busting is a chip event and the
   * chips are on the table. A night goes on the board through the record-a-game
   * sheet, by hand, the same way a game the app did not deal always did. See
   * the Gambling classification section in `ROADMAP.md`.
   */
  const confirmEndGame = () => {
    if (session.handsPlayed === 0) {
      endGame();
      return;
    }
    Alert.alert(
      "End this game?",
      "The cards on screen go with it. Nothing else is lost — the leaderboard is recorded separately, from the Leaderboard screen.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "End the game", style: "destructive", onPress: endGame },
      ],
    );
  };

  return (
    <>
      {/* The table stays drawn after the showdown. Returning early here hid the
          hand that decided it, which is the one everybody wants to look at. */}
      <TableView
        session={session}
        onAdvance={advanceStreet}
        onMuck={toggleMuck}
        nameFor={nameFor}
      />
      {!handInProgress ? (
        <Card>
          <CardContent>
            <Button
              label={session.handsPlayed === 0 ? "Deal" : "Next hand"}
              icon="play"
              onPress={deal}
              disabled={!canDealNext}
            />
            {!canDealNext ? (
              <Text style={styles.empty}>
                Two players have to be in to deal a hand.
              </Text>
            ) : null}
            <Button
              label="End the game"
              variant="ghost"
              onPress={confirmEndGame}
            />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  content: { paddingTop: space.lg, gap: space.xl, paddingHorizontal: space.lg },
  contentTablet: {
    maxWidth: TABLET_MAX_WIDTH_SETTINGS,
    alignSelf: "center",
    width: "100%",
  },
  list: { gap: space.sm },
  empty: { ...text.body, color: colors.textMuted },
});
