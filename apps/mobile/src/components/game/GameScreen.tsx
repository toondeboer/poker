// src/components/game/GameScreen.tsx
import { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  computePayouts,
  finishingPlacings,
  knockoutCounts,
  knockoutsFullyRecorded,
  unclaimedBounty,
  MAX_SEATS,
  toPayoutOptions,
} from "@poker/core";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useLeaderboard } from "@/src/contexts/LeaderboardContext";
import { usePayouts } from "@/src/contexts/PayoutContext";
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
import { NumberField } from "@/src/components/ui/NumberField";
import { useGame } from "@/src/contexts/GameContext";
import { FinishingOrder, TableView } from "./TableView";

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
  const { players, activeGroupId } = useLeaderboard();
  const game = useGame();

  const [showPaywall, setShowPaywall] = useState(false);
  const [seated, setSeated] = useState<string[]>([]);
  const [startingStack, setStartingStack] = useState(1000);
  const [smallBlind, setSmallBlind] = useState(5);
  const [bigBlind, setBigBlind] = useState(10);

  const canStart =
    seated.length >= MIN_PLAYERS &&
    startingStack > bigBlind &&
    bigBlind > smallBlind &&
    smallBlind > 0;

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
        <CardHeader icon="cash" title="Chips and blinds" />
        <CardContent>
          <NumberField
            label="Starting stack"
            value={startingStack}
            onChangeValue={setStartingStack}
            min={1}
          />
          <NumberField
            label="Small blind"
            value={smallBlind}
            onChangeValue={setSmallBlind}
            min={1}
          />
          <NumberField
            label="Big blind"
            value={bigBlind}
            onChangeValue={setBigBlind}
            min={1}
          />
          <Button
            label="Deal the first hand"
            icon="play"
            onPress={() =>
              game.startGame({
                players: seated,
                startingStack,
                smallBlind,
                bigBlind,
                groupId: activeGroupId,
              })
            }
            disabled={!canStart}
          />
          {!canStart && seated.length >= MIN_PLAYERS ? (
            <Text style={styles.empty}>
              The big blind has to be above the small blind, and everyone needs
              a stack bigger than the big blind.
            </Text>
          ) : null}
        </CardContent>
      </Card>
    </>
  ) : null;

  const content = game.isLoading ? null : !isPremium ? (
    <Card>
      <CardHeader icon="grid" title="Play a hand" />
      <CardContent>
        <Text style={styles.empty}>
          Deal a real hand of hold&apos;em from the phone, for a table that has
          chips but no cards. Everyone sees the board; only the player to act
          sees their own two cards.
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

/** A game in progress. All of its state lives in {@link GameProvider}. */
function ActiveGame({ nameFor }: { nameFor: (id: string) => string }) {
  const { session, setup, legal, complete, order, handInProgress, recorded,
    markRecorded, deal, act, endGame } = useGame();
  const { settings } = usePayouts();
  const { recordResult, activeGroupId } = useLeaderboard();
  const [refused, setRefused] = useState<string | null>(null);

  /**
   * What each finishing position pays, from the payout setup the host already
   * made — priced for the field that actually sat down rather than the one on
   * the Payouts screen, exactly as the record-a-game sheet does it.
   *
   * A game with no buy-in set produces nothing, and the finishes are recorded
   * winning zero. That is deliberate: who finished where is a different
   * question from who got paid, and a friendly game still has a winner.
   */
  const winningsByPlace = useMemo(() => {
    if (!session) return [];
    // The field is who sat down, and there are **no rebuys or add-ons**: this
    // game is dealt by the app with fixed starting stacks and no way to buy
    // back in. Carrying the Payouts screen's saved rebuy count over would
    // price a pool that nobody paid into — settings left at four rebuys turn a
    // real 80 into a recorded 200 for the winner.
    const structure = computePayouts({
      ...toPayoutOptions(settings),
      entrants: session.seats.length,
      rebuys: 0,
      addOns: 0,
    });
    if (!structure) return [];
    const byPlace: number[] = [];
    for (const payout of structure.payouts) byPlace[payout.place - 1] = payout.amount;
    return byPlace.map((amount) => amount ?? 0);
  }, [session, settings]);

  // Two things the table has to be told about the bounty money, both computed
  // from the same ledger the recorded amounts come from.
  const unclaimed = session
    ? unclaimedBounty(session, settings.bounty, settings.bountyMode)
    : 0;
  const fullyRecorded = session ? knockoutsFullyRecorded(session) : true;

  if (!session) return null;

  /**
   * Put the finished game on the leaderboard.
   *
   * This is the whole reason the engine exists rather than a chip counter: the
   * app dealt every hand, so it already knows who went out fourth. Recording by
   * hand is two taps per player and a memory test at the end of a long evening.
   */
  const record = (): boolean => {
    // The board this game's players came from. Recording into whichever group
    // happens to be selected now would file the night with people who were
    // never at the table, and nothing downstream would notice.
    if (setup && setup.groupId !== activeGroupId) {
      setRefused(
        "These players came from a different group. Switch back to it on the Leaderboard screen to save this game.",
      );
      return false;
    }
    const saved = recordResult({
      playerIds: session.seats.map((seat) => seat.playerId),
      placings: finishingPlacings(session, winningsByPlace),
      buyIn: settings.buyIn,
      bounty: settings.bounty,
      // The thing a game recorded by hand can never carry: the app watched
      // every hand, so it knows whose chips took whom out. Without it a bounty
      // game's money column is prize money only, which is most of the point of
      // playing one missing.
      knockouts: knockoutCounts(session, settings.bounty, settings.bountyMode),
    });
    // Only claim it was saved if it was. A refused result used to leave the
    // message saying otherwise and took the retry away with it.
    if (saved) markRecorded();
    else setRefused("That result couldn't be saved. Nothing has been recorded.");
    // **Returned, because the caller may be about to throw the game away.**
    // `record` refuses for two reasons that are invisible from outside it, and
    // ending the game on the strength of a save that did not happen destroys
    // the night *and* the message explaining why.
    return saved;
  };


  /**
   * Ending a game is the one action that throws it away.
   *
   * **So it is the moment to ask, and the completion itself is not.** An alert
   * the instant the game ends covers the showdown — the board, the cards and
   * who won what — which is the one hand everybody wants to look at, and is
   * exactly why the table is kept drawn below rather than replaced by a
   * summary.
   *
   * It is also the only place the night is genuinely at risk. A finished game
   * survives the app closing and its Save button is still there next launch;
   * this is what makes it gone.
   */
  const confirmEndGame = () => {
    // Nothing to lose: already on the leaderboard.
    if (complete && recorded) {
      endGame();
      return;
    }

    /**
     * **A game still in progress is the worse loss**, and it reached this
     * button unguarded. A finished one can at least be recorded; an evening
     * halfway through cannot be reconstructed from anywhere, and "End the game"
     * sits directly under "Next hand".
     */
    if (!complete) {
      Alert.alert(
        "End this game?",
        "The hands played so far cannot be recovered, and a game in progress cannot be put on the leaderboard.",
        [
          { text: "Keep playing", style: "cancel" },
          { text: "End the game", style: "destructive", onPress: endGame },
        ],
      );
      return;
    }

    /**
     * **Save first in the array, destructive second.** iOS moves the `cancel`
     * action to the bottom and keeps the rest in order, so `[Cancel, Discard,
     * Save]` renders as Discard / Save / Cancel — putting the destructive
     * choice in the easiest slot to hit, on the prompt written to prevent
     * exactly that loss. This order renders Save / Discard / Cancel on iOS and
     * reads the same way on Android.
     */
    Alert.alert(
      "Save this game first?",
      "The app dealt every hand, so it already knows who finished where. Ending the game throws it away.",
      [
        {
          /**
           * **Only ends the game if the save actually happened.** `record`
           * refuses when the players came from a board that is no longer
           * active, and refusing then ending would clear the session — taking
           * the night with it, and the explanation with it too, since this
           * component renders nothing once there is no session.
           */
          text: "Save",
          onPress: () => {
            if (record()) endGame();
          },
        },
        { text: "Discard", style: "destructive", onPress: endGame },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  return (
    <>
      {/* The table is drawn even once the game is over. Returning early here
          hid the hand that decided it — the board, the showdown and who won
          what — which is the one hand everybody wants to look at. */}
      <TableView
        session={session}
        legal={legal}
        onAct={act}
        nameFor={nameFor}
      />
      {complete ? (
        <Card>
          <CardHeader icon="trophy" title="Game over" />
          <CardContent>
            <FinishingOrder order={order} nameFor={nameFor} />
            {/* Money that reached nobody: a pot everyone eligible folded out
                of leaves the bounty on that head with nowhere to go. Said out
                loud, because somebody is otherwise counting the cash at the
                end of the night and finding it short with no explanation. */}
            {unclaimed > 0 ? (
              <Text style={styles.empty}>
                {`${unclaimed} in bounties went unclaimed — the pot that busted them was won by nobody.`}
              </Text>
            ) : null}
            {/* An evening resumed from a build that did not track knockouts.
                Flat still pays the ones it knows about correctly; progressive
                does not, because every unrecorded exit leaves a head loaded and
                stops the chain after it escalating. */}
            {settings.bountyMode === "progressive" && !fullyRecorded ? (
              <Text style={styles.empty}>
                Some knockouts from earlier in this game were never recorded, so
                the bounty amounts below are short of what was really won.
              </Text>
            ) : null}
            {recorded ? (
              <Text style={styles.empty}>
                Saved to the leaderboard. The standings have it already.
              </Text>
            ) : (
              <>
                {refused ? <Text style={styles.empty}>{refused}</Text> : null}
                <Button
                  label="Save to the leaderboard"
                  icon="trophy"
                  onPress={record}
                />
              </>
            )}
            <Button label="New game" icon="refresh" onPress={confirmEndGame} />
          </CardContent>
        </Card>
      ) : !handInProgress ? (
        <Card>
          <CardContent>
            <Button
              label={session.handsPlayed === 0 ? "Deal" : "Next hand"}
              icon="play"
              onPress={deal}
            />
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
