// src/components/leaderboard/LeaderboardScreen.tsx
import { useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import {
  formatPlace,
  formatStandingsSummary,
  isValidPlayerName,
  MAX_PLAYERS,
} from "@poker/core";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useLeaderboard } from "@/src/contexts/LeaderboardContext";
import { useKeyboardFocusScroll } from "@/src/hooks/useKeyboardFocusScroll";
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
import { IconButton } from "@/src/components/ui/IconButton";
import { ListRow } from "@/src/components/ui/ListRow";
import { NavRow } from "@/src/components/ui/NavRow";
import { TextField } from "@/src/components/ui/TextField";
import { GroupsSheet } from "./GroupsSheet";
import { RecordResultSheet } from "./RecordResultSheet";

/** Rendered as "3 wins · 8 games", skipping the parts that are still zero. */
const describeStanding = (wins: number, games: number, won: number) => {
  const parts = [`${games} ${games === 1 ? "game" : "games"}`];
  if (wins > 0) parts.push(`${wins} ${wins === 1 ? "win" : "wins"}`);
  if (won > 0) parts.push(`won ${won}`);
  return parts.join(" · ");
};

export function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = isTabletWidth(width);
  const { isPremium } = usePremium();
  const {
    players,
    results,
    standings,
    addNewPlayer,
    deletePlayer,
    deleteResult,
    recordResult,
    isLoading,
    groups,
    activeGroupName,
  } = useLeaderboard();

  // Arriving from the timer's end-of-game prompt opens the sheet straight away.
  // Read once as the initial state rather than in an effect: the sheet should
  // open on arrival, and reopening it on every re-render would fight the user
  // closing it.
  const { record } = useLocalSearchParams<{ record?: string }>();

  const [showPaywall, setShowPaywall] = useState(false);
  const [showRecord, setShowRecord] = useState(record === "1");
  const [showGroups, setShowGroups] = useState(false);
  const [name, setName] = useState("");

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const containerRef = useRef<View>(null);

  const { keyboardInset } = useKeyboardFocusScroll({
    scrollBy: (delta) =>
      scrollViewRef.current?.scrollTo({
        y: scrollOffsetRef.current + delta,
        animated: true,
      }),
    containerRef,
    bottomInset: insets.bottom,
    topInset: insets.top,
  });

  const canAdd = isValidPlayerName(name, players) && players.length < MAX_PLAYERS;

  const handleAdd = () => {
    if (!canAdd) return;
    addNewPlayer(name);
    setName("");
    Keyboard.dismiss();
  };

  /**
   * Whether there is anything to share, which is **not** the same as whether
   * any games are stored. Removing every player deliberately keeps their past
   * results — the confirm dialog promises exactly that — so `results.length`
   * can be non-zero while no standing has a game against it, and the message
   * would read "Leaderboard — 3 games" followed by "No games recorded yet."
   */
  const hasStandingsToShare = standings.some(
    (standing) => standing.gamesPlayed > 0,
  );

  const handleShare = () => {
    Share.share({
      message: formatStandingsSummary({
        standings,
        gamesRecorded: results.length,
      }),
    }).catch(() => {});
  };

  const confirmDeletePlayer = (id: string, playerName: string) => {
    Alert.alert(
      "Remove player",
      `Remove "${playerName}" from the leaderboard? Games they played in are kept, so everyone else's history stays intact.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deletePlayer(id),
        },
      ],
    );
  };

  const confirmDeleteResult = (id: string, when: string) => {
    Alert.alert("Delete game", `Delete the game from ${when}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteResult(id) },
    ]);
  };

  // Nothing renders until the stored leaderboard has landed. Without this the
  // screen is interactive over empty state, and any edit made in that window
  // persists `{players: [], results: []}` straight over a season of game
  // nights — the arriving load then repairs the *state* and hides it until the
  // next launch. This is the one store here whose contents can't be retyped.
  // The group row is shown even with a single group, so switching boards is
  // discoverable rather than something you have to already know about. Its
  // summary carries the count so a host with one group can see there is
  // nothing to switch to without opening the sheet.
  const groupSummary =
    groups.length > 1
      ? `${groups.length} groups · tap to switch`
      : "Tap to add another group";

  const content = isLoading ? null : isPremium ? (
    <>
      <Card>
        <CardHeader
          icon="trophy"
          title="Standings"
          right={
            results.length > 0 ? (
              <Badge
                label={`${results.length} ${results.length === 1 ? "game" : "games"}`}
              />
            ) : undefined
          }
        />
        <CardContent>
          <NavRow
            title={activeGroupName || "Your first group"}
            summary={groupSummary}
            onPress={() => setShowGroups(true)}
          />
          {standings.length === 0 ? (
            <Text style={styles.empty}>
              Add the people you play with, then record a game to start the
              board.
            </Text>
          ) : (
            <View style={styles.list}>
              {standings.map((standing, index) => (
                <ListRow
                  key={standing.playerId}
                  title={`${formatPlace(index + 1)}  ${standing.name}`}
                  meta={describeStanding(
                    standing.wins,
                    standing.gamesPlayed,
                    standing.totalWon,
                  )}
                  right={
                    standing.wins > 0 ? (
                      <Badge label={`${standing.wins}`} tone="live" />
                    ) : undefined
                  }
                />
              ))}
            </View>
          )}
          <Button
            label="Record a game"
            icon="add"
            onPress={() => setShowRecord(true)}
            disabled={players.length === 0}
          />
          <Button
            label="Share standings"
            icon="share-social-outline"
            onPress={handleShare}
            disabled={!hasStandingsToShare}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          icon="people"
          title="Players"
          right={<Badge label={`${players.length}/${MAX_PLAYERS}`} />}
        />
        <CardContent>
          <TextField
            label="Add a player"
            value={name}
            onChangeText={setName}
            placeholder="Name"
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            helper={
              players.length >= MAX_PLAYERS
                ? `That's the maximum of ${MAX_PLAYERS} players.`
                : "Everyone who turns up to game night. Names stay on this device."
            }
          />
          <Button
            label="Add player"
            icon="person-add"
            onPress={handleAdd}
            disabled={!canAdd}
          />
          {players.length > 0 && (
            <View style={styles.list}>
              {players.map((player) => (
                <ListRow
                  key={player.id}
                  title={player.name}
                  right={
                    <IconButton
                      icon="trash"
                      tone="danger"
                      onPress={() => confirmDeletePlayer(player.id, player.name)}
                      accessibilityLabel={`Remove player ${player.name}`}
                    />
                  }
                />
              ))}
            </View>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader icon="time" title="Recent games" />
          <CardContent>
            <View style={styles.list}>
              {results.slice(0, 10).map((result) => {
                const when = new Date(result.playedAt).toLocaleDateString();
                const winner = players.find(
                  (player) =>
                    player.id ===
                    result.placings.find((placing) => placing.place === 1)
                      ?.playerId,
                );
                return (
                  <ListRow
                    key={result.id}
                    title={when}
                    meta={`${result.playerIds.length} played${winner ? ` · won by ${winner.name}` : ""}`}
                    right={
                      <IconButton
                        icon="trash"
                        tone="danger"
                        onPress={() => confirmDeleteResult(result.id, when)}
                        accessibilityLabel={`Delete game from ${when}`}
                      />
                    }
                  />
                );
              })}
            </View>
          </CardContent>
        </Card>
      )}
    </>
  ) : (
    <Card>
      <CardHeader icon="trophy" title="Leaderboard" />
      <CardContent>
        <Text style={styles.description}>
          Keep score across game nights — who&apos;s won the most, who turns up,
          and what everyone&apos;s taken home. Stays on your device; no accounts,
          nothing to sign up for.
        </Text>
        <Button
          label="Unlock Pro"
          icon="star"
          variant="pro"
          onPress={() => setShowPaywall(true)}
        />
      </CardContent>
    </Card>
  );

  return (
    <View style={styles.container} ref={containerRef}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isTablet && styles.contentTablet,
          {
            paddingLeft: space.lg + insets.left,
            paddingRight: space.lg + insets.right,
            paddingBottom: 40 + insets.bottom + keyboardInset,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets={true}
      >
        {content}
      </ScrollView>

      {/* Pro-gated here as well as in `content`: this sits outside that
          ternary, and `showRecord` can be seeded from `?record=1`, so without
          the check a deep link opens the record flow with Pro locked. */}
      {isPremium && !isLoading && (
      <RecordResultSheet
        visible={showRecord}
        onClose={() => setShowRecord(false)}
        players={players}
        onRecord={recordResult}
      />
      )}
      {/* Same reasoning as the record sheet: this sits outside the Pro-gated
          `content`, so it needs its own check. */}
      {isPremium && !isLoading && (
        <GroupsSheet
          visible={showGroups}
          onClose={() => setShowGroups(false)}
        />
      )}
      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  content: { paddingTop: space.lg, gap: space.xl },
  contentTablet: {
    maxWidth: TABLET_MAX_WIDTH_SETTINGS,
    alignSelf: "center",
    width: "100%",
  },
  description: text.body,
  empty: { ...text.meta, lineHeight: 18 },
  list: { gap: space.md },
});
