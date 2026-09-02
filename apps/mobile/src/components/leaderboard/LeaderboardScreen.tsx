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
  boardIsVisible,
  formatPlace,
  formatStandingsSummary,
  isValidPlayerName,
  MAX_PLAYERS,
  type ClaimError,
} from "@poker/core";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useLeaderboard } from "@/src/contexts/LeaderboardContext";
import {
  accountsAreReal, useAuth } from "@/src/contexts/AuthContext";
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
import { SyncNotice } from "@/src/components/leaderboard/SyncNotice";
import { IconButton } from "@/src/components/ui/IconButton";
import { ListRow } from "@/src/components/ui/ListRow";
import { NavRow } from "@/src/components/ui/NavRow";
import { TextField } from "@/src/components/ui/TextField";
import { GroupsSheet } from "./GroupsSheet";
import { RecordResultSheet } from "./RecordResultSheet";

/** Rendered as "8 games · 3 wins · won 120 · 5 KOs", skipping what is zero. */
const describeStanding = (
  wins: number,
  games: number,
  won: number,
  knockouts: number,
) => {
  const parts = [`${games} ${games === 1 ? "game" : "games"}`];
  if (wins > 0) parts.push(`${wins} ${wins === 1 ? "win" : "wins"}`);
  if (won > 0) parts.push(`won ${won}`);
  // Only ever non-zero for games the app dealt — nobody can reconstruct
  // knockouts from a night written down afterwards, so a board of
  // hand-recorded games simply never shows this rather than showing zeros.
  if (knockouts > 0) parts.push(`${knockouts} KO${knockouts === 1 ? "" : "s"}`);
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
    activeGroupId,
    activeGroupName,
    claimedPlayer,
    claimPlayerAs,
    releasePlayer,
    activeBoardIsGuest,
    refusedWrites,
    acknowledgeRefusal,
  } = useLeaderboard();
  const { account } = useAuth();

  // Arriving from the timer's end-of-game prompt opens the sheet straight away.
  // Read once as the initial state rather than in an effect: the sheet should
  // open on arrival, and reopening it on every re-render would fight the user
  // closing it.
  const { record } = useLocalSearchParams<{ record?: string }>();

  const [showPaywall, setShowPaywall] = useState(false);
  const [showRecord, setShowRecord] = useState(record === "1");
  const [showGroups, setShowGroups] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
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

  // A refusal is about one board and one account, so it stops being true the
  // moment either changes — and a message pinned across a board switch reads
  // as a false statement about the new one.
  const claimContext = `${activeGroupId ?? ""}:${account?.id ?? ""}`;
  const [lastClaimContext, setLastClaimContext] = useState(claimContext);
  if (lastClaimContext !== claimContext) {
    setLastClaimContext(claimContext);
    setClaimError(null);
  }

  /**
   * Which player on this board is the signed-in account, if any.
   *
   * `null` whenever nobody is signed in — which is everybody today, since
   * nothing links to the account screens yet. The whole claim affordance stays
   * invisible rather than appearing and doing nothing.
   */
  const mine = account ? claimedPlayer(account.id) : null;

  // Keyed by the error type rather than by `string`, so adding a ClaimError
  // fails the build here instead of rendering nothing — a tap that does
  // nothing and says nothing is the worst of both.
  const CLAIM_REFUSAL: Record<ClaimError, string> = {
    "player-already-claimed":
      "Somebody else has already said that player is them.",
    "account-already-in-group":
      "You're already one of the players on this board. Release that one first.",
    "no-such-group": "That board isn't open any more.",
    "no-such-player": "That player isn't on this board any more.",
  };

  const claim = (playerId: string, playerName: string) => {
    if (!account) return;
    Alert.alert(
      "Is this you?",
      `Link "${playerName}" to your account. Every game they've played becomes yours — nothing is rewritten, and you can undo it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "That's me",
          onPress: () => {
            const refused = claimPlayerAs(playerId, account.id);
            setClaimError(refused ? CLAIM_REFUSAL[refused] : null);
          },
        },
      ],
    );
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

  // The group row is shown even with a single group, so switching boards is
  // discoverable rather than something you have to already know about. Its
  // summary carries the count, so a host with one group can see there is
  // nothing to switch to without opening the sheet — and with no group at all
  // it says what the row will actually do rather than offering "another" one.
  const groupSummary =
    groups.length === 0
      ? "Tap to name your first group"
      : groups.length === 1
        ? "Tap to add another group"
        : `${groups.length} groups · tap to switch`;

  // Nothing renders until the stored leaderboard has landed. Without this the
  // screen is interactive over empty state, and any edit made in that window
  // persists `{players: [], results: []}` straight over a season of game
  // nights — the arriving load then repairs the *state* and hides it until the
  // next launch. This is the one store here whose contents can't be retyped.
  /**
   * **A shared board is readable without Pro.** Pro is for keeping your own
   * score; a board somebody else keeps is theirs, and they are paying for it.
   * Without this a guest joins and lands on a paywall looking at the board they
   * were just invited to — which would make "joining is always free" untrue.
   */
  const canView = boardIsVisible({ isPremium, isGuestBoard: activeBoardIsGuest });

  const content = isLoading ? null : canView ? (
    <>
      {/* Above the standings, because it is about the standings: what is on
          this phone and not on anybody else's. Renders nothing when there is
          nothing refused. */}
      <SyncNotice refused={refusedWrites} onDismiss={acknowledgeRefusal} />

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
                    standing.knockouts,
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
          {claimError ? <Text style={styles.error}>{claimError}</Text> : null}
          {players.length > 0 && (
            <View style={styles.list}>
              {players.map((player) => {
                const isMine = mine?.id === player.id;
                return (
                  <ListRow
                    key={player.id}
                    title={player.name}
                    meta={isMine ? "You" : undefined}
                    selected={isMine}
                    right={
                      <View style={styles.playerActions}>
                        {/* Only offered while signed in, and only for a player
                            nobody has claimed — including you, since one
                            person is one seat at a table. */}
                        {account && !mine && !player.accountId ? (
                          <IconButton
                            icon="person-add-outline"
                            onPress={() => claim(player.id, player.name)}
                            accessibilityLabel={`${player.name} is me`}
                          />
                        ) : null}
                        {/* Releasing is offered for any claimed player, not
                            just your own. A board is device-local and account
                            ids are not, so a claim can outlive the account
                            that made it — and without a way to let go, that
                            player is stuck: unclaimable because it is claimed,
                            unreleasable because it is not yours. */}
                        {player.accountId ? (
                          <IconButton
                            icon="person-remove-outline"
                            onPress={() => {
                              releasePlayer(player.id);
                              setClaimError(null);
                            }}
                            accessibilityLabel={
                              isMine
                                ? `${player.name} is not me`
                                : `Unlink ${player.name} from an account`
                            }
                          />
                        ) : null}
                        <IconButton
                          icon="trash"
                          tone="danger"
                          onPress={() =>
                            confirmDeletePlayer(player.id, player.name)
                          }
                          accessibilityLabel={`Remove player ${player.name}`}
                        />
                      </View>
                    }
                  />
                );
              })}
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
        {/* Same reason as the account screen: "no accounts, nothing to sign
            up for" is true of a build with no backend and false of one with
            it, and this is the screen where somebody decides to pay. */}
        <Text style={styles.description}>
          {accountsAreReal
            ? "Keep score across game nights — who's won the most, who turns up, and what everyone's taken home. Sent a board by somebody else? Joining is free."
            : "Keep score across game nights — who's won the most, who turns up, and what everyone's taken home. Stays on your device; no accounts, nothing to sign up for."}
        </Text>
        <Button
          label="Unlock Pro"
          icon="star"
          variant="pro"
          onPress={() => setShowPaywall(true)}
        />
        {/* **The way in for somebody who was sent a board.** Without it a
            guest sees only a paywall for a feature they do not need — joining
            is free — and has nowhere to put the code they were given. */}
        {accountsAreReal ? (
          <Button
            label="Join a board"
            icon="enter-outline"
            variant="secondary"
            onPress={() => setShowGroups(true)}
          />
        ) : null}
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
      {canView && !isLoading && (
      <RecordResultSheet
        visible={showRecord}
        onClose={() => setShowRecord(false)}
        players={players}
        onRecord={recordResult}
      />
      )}
      {/* **Not gated on `canView`, unlike the record sheet.** This is the only
          place an invite code can be pasted, and gating it here made "guests
          join free" unreachable: a guest with a code has no board yet, so
          `canView` is false, so the sheet never renders, so there is nowhere to
          paste it. The sheet does its own gating per section — creating a board
          is Pro, sharing is Club, joining is neither. */}
      {!isLoading && (
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
  playerActions: { flexDirection: "row", gap: space.xs },
  error: { ...text.body, color: colors.danger },
  empty: { ...text.meta, lineHeight: 18 },
  list: { gap: space.md },
});
