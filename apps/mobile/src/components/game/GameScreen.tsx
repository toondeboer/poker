// src/components/game/GameScreen.tsx
import { useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
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
import { NumberField } from "@/src/components/ui/NumberField";
import { FinishingOrder, TableView } from "./TableView";
import { useGameSession } from "./useGameSession";

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

  const [showPaywall, setShowPaywall] = useState(false);
  const [seated, setSeated] = useState<string[]>([]);
  const [startingStack, setStartingStack] = useState(1000);
  const [smallBlind, setSmallBlind] = useState(5);
  const [bigBlind, setBigBlind] = useState(10);
  const [started, setStarted] = useState(false);

  const canStart =
    seated.length >= MIN_PLAYERS &&
    startingStack > bigBlind &&
    bigBlind > smallBlind &&
    smallBlind > 0;

  const toggleSeat = (name: string) =>
    setSeated((current) =>
      current.includes(name)
        ? current.filter((id) => id !== name)
        : current.length >= MAX_SEATS
          ? current
          : [...current, name],
    );

  const setup = !started ? (
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
                  selected={seated.includes(player.name)}
                  onPress={() => toggleSeat(player.name)}
                  meta={
                    seated.includes(player.name)
                      ? `Seat ${seated.indexOf(player.name) + 1}`
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
            onPress={() => setStarted(true)}
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

  const content = !isPremium ? (
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
    setup ?? <ActiveGame
      players={seated}
      startingStack={startingStack}
      smallBlind={smallBlind}
      bigBlind={bigBlind}
      onQuit={() => {
        setStarted(false);
        setSeated([]);
      }}
    />
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

/**
 * A game in progress.
 *
 * Split out so the session hook mounts with the seats already chosen — the
 * engine takes them at creation, and remounting it on every setup keystroke
 * would throw the game away.
 */
function ActiveGame({
  players,
  startingStack,
  smallBlind,
  bigBlind,
  onQuit,
}: {
  players: string[];
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  onQuit: () => void;
}) {
  const { session, legal, complete, order, handInProgress, deal, act } =
    useGameSession({ players, startingStack, smallBlind, bigBlind });

  if (complete) {
    return (
      <Card>
        <CardHeader icon="trophy" title="Game over" />
        <CardContent>
          <FinishingOrder order={order} />
          <Button label="New game" icon="refresh" onPress={onQuit} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <TableView session={session} legal={legal} onAct={act} />
      {!handInProgress ? (
        <Card>
          <CardContent>
            <Button
              label={session.handsPlayed === 0 ? "Deal" : "Next hand"}
              icon="play"
              onPress={deal}
            />
            <Button label="End the game" variant="ghost" onPress={onQuit} />
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
