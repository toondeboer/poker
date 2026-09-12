// src/components/session/SharedSessionScreen.tsx
import { useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JOIN_CODE_LENGTH, normaliseJoinCode } from "@poker/core";
import {
  useSharedSession,
  type JoinError,
} from "@/src/contexts/SharedSessionContext";
import { useKeyboardFocusScroll } from "@/src/hooks/useKeyboardFocusScroll";
import {
  colors,
  isTabletWidth,
  space,
  text,
  TABLET_MAX_WIDTH_SETTINGS,
} from "@/src/theme";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { ClubPill } from "@/src/components/ui/ClubPill";
import { TextField } from "@/src/components/ui/TextField";
import { Paywall } from "@/src/components/paywall/Paywall";

/** What to say when a join is refused. */
const MESSAGE: Record<JoinError, string> = {
  "code-malformed": `A code is ${JOIN_CODE_LENGTH} characters — check it and try again.`,
  "no-such-session": "No clock is running under that code.",
  failed: "That didn't work. Try again in a moment.",
  /**
   * **Never reached in practice, and kept anyway.** The screen shows the
   * refusal from the context and disables the control, so the act is not
   * available to attempt. This is what the guard in `startHosting` and `join`
   * would return if a screen ever forgot to — a fallback, not a message
   * somebody is expected to read.
   */
  "not-allowed": "That isn't available on this account.",
};

/**
 * Run one tournament clock across several phones.
 *
 * **Reached from Settings → Tournament.** It was linked from nowhere for most of
 * 1.2.0, deliberately: `sessionTransport` was `null` until the backend was
 * deployed, and a join code nobody else can join is worse than no join code at
 * all. The transport landed with the `/sessions` routes, and the Settings row
 * with it — gated on the same `sharing` flag the boards are, so the screen is
 * absent rather than broken when there is nothing to poll.
 *
 * Anybody in the session can pause, resume or change level; there is no host
 * privilege, because at a real table whoever is nearest the phone is the one
 * who presses it. Conflicting presses are resolved by version order rather than
 * by seniority, which is the same answer and needs no roles to explain.
 */
export function SharedSessionScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = isTabletWidth(width);
  const {
    status,
    code,
    health,
    busy,
    startHosting,
    join,
    hostRefusal,
    joinRefusal,
    leave,
  } = useSharedSession();

  const [typed, setTyped] = useState("");
  const [error, setError] = useState<JoinError | null>(null);

  /**
   * **Whether the refusal above is one Club would actually fix.**
   *
   * Three different things can stop somebody hosting — not signed in, purchases
   * still being checked, and no subscription — and only the last is something to
   * sell. Asked of the entitlements directly rather than by matching the
   * refusal's wording, which would break the moment a sentence is reworded.
   *
   * Until this, the screen stated the refusal and stopped: "Sharing your clock
   * is part of Club" with no Club anywhere on the screen, and the subscription
   * reachable only from a sheet titled Pro in Settings.
   */
  const { hasClub, entitlementsKnown, clubPlans } = usePremium();
  const { account } = useAuth();
  const [showClub, setShowClub] = useState(false);
  const clubWouldFix =
    hostRefusal !== null &&
    account !== null &&
    entitlementsKnown &&
    !hasClub &&
    clubPlans.length > 0;

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const containerRef = useRef<View>(null);

  // Android under edge-to-edge does not resize for the keypad on its own, and a
  // code field halfway down the screen sits right where it lands.
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

  const runJoin = async () => {
    const result = await join(typed);
    setError(result);
    if (!result) setTyped("");
  };

  const connected = status !== "off";

  const content = connected ? (
    <Card>
      <CardHeader
        icon="phone-portrait-outline"
        title={status === "hosting" ? "Your table's clock" : "Joined a clock"}
      />
      <CardContent>
        <Text style={styles.blurb}>
          Read this out to anyone who wants the clock on their phone.
        </Text>
        <Text style={styles.code} selectable>
          {code}
        </Text>
        {/* Said plainly rather than hidden: the countdown keeps running either
            way — this phone knows how much of the round is left, it just no
            longer knows whether somebody paused it. */}
        <Text style={health === "stale" ? styles.warning : styles.blurb}>
          {health === "live"
            ? "In step with the table."
            : health === "waiting"
              ? "Waiting for another phone to join…"
              : "Out of touch — still counting down, but nobody else's presses are getting through."}
        </Text>
        <Button
          label="Leave"
          variant="secondary"
          icon="exit-outline"
          onPress={leave}
        />
      </CardContent>
    </Card>
  ) : (
    <>
      <Card>
        {/* Marked the way the Settings row that leads here is: hosting is the
            half of this screen that costs something, and joining below it is
            free. Without the pill the two cards look like one feature that
            sometimes refuses. */}
        <CardHeader
          icon="play-outline"
          title="Start a clock"
          right={hasClub ? undefined : <ClubPill />}
        />
        <CardContent>
          <Text style={styles.blurb}>
            Everyone who joins sees the same round, the same level, and the same
            countdown — and any of them can pause it.
          </Text>
          <Button
            label="Start a shared clock"
            icon="share-outline"
            onPress={() => void startHosting().then(setError)}
            disabled={busy || hostRefusal !== null}
          />
          {/* **The reason, in the words it came with.** One title over three
              different refusals — sign in, still checking, not subscribed — was
              the bug the board already fixed; the policy returns a sentence per
              case so this can just show it. */}
          {hostRefusal ? <Text style={styles.blurb}>{hostRefusal}</Text> : null}
          {clubWouldFix ? (
            <Button
              label="See Club"
              icon="people"
              variant="club"
              onPress={() => setShowClub(true)}
            />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader icon="enter-outline" title="Join a clock" />
        <CardContent>
          <TextField
            label="Code"
            value={typed}
            onChangeText={(next) => {
              // Uppercased on the way in so what is on screen matches what was
              // read out, rather than being quietly fixed on submit.
              setTyped(normaliseJoinCode(next));
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            // Room for the spaces and dashes people put in a code they were
            // read out — the limit applies to what was typed, before those are
            // taken out, and a code pasted with a space in it would otherwise
            // lose its last character.
            maxLength={JOIN_CODE_LENGTH * 2}
            placeholder="4F7K2P"
            helper={`${JOIN_CODE_LENGTH} characters, from whoever started it.`}
          />
          {error ? <Text style={styles.error}>{MESSAGE[error]}</Text> : null}
          {/* Joining is free — this only ever says "sign in", never "subscribe".
              Showing it under the field rather than hiding the whole card: a
              guest who was read a code should see where to put it and what is
              stopping them, not an empty screen. */}
          {joinRefusal ? <Text style={styles.blurb}>{joinRefusal}</Text> : null}
          <Button
            label="Join"
            icon="enter-outline"
            onPress={() => void runJoin()}
            disabled={
              busy ||
              joinRefusal !== null ||
              normaliseJoinCode(typed).length !== JOIN_CODE_LENGTH
            }
          />
        </CardContent>
      </Card>
    </>
  );

  return (
    <View style={styles.container} ref={containerRef}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isTablet && styles.contentTablet,
          { paddingBottom: insets.bottom + space.xl + keyboardInset },
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets={true}
      >
        {content}
      </ScrollView>
      {/* Opened onto Club, which is the only thing this screen ever sells —
          joining a clock is free and always has been. */}
      <Paywall
        visible={showClub}
        focus="club"
        onClose={() => setShowClub(false)}
      />
    </View>
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
  blurb: { ...text.body, color: colors.textMuted },
  warning: { ...text.body, color: colors.pro },
  error: { ...text.body, color: colors.danger },
  code: {
    ...text.cardTitle,
    fontSize: 40,
    letterSpacing: 8,
    textAlign: "center",
    paddingVertical: space.md,
    color: colors.text,
  },
});
