// src/components/leaderboard/JoinBoardScreen.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokenFromUrl, isInviteToken } from "@poker/core";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { useLeaderboard } from "@/src/contexts/LeaderboardContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors, space, text } from "@/src/theme";

type State =
  | { step: "working" }
  | { step: "joined"; name: string }
  | { step: "failed"; reason: string };

/**
 * Where a shared link lands.
 *
 * **Redeeming is not queueable and this screen is why.** Every other write the
 * app makes can wait in an outbox, because nobody is watching it happen.
 * Somebody who has just tapped a link is watching this one, and "it will go
 * through eventually" is not an answer to "am I on the board?".
 *
 * It runs once, on arrival, and never again for the same link: joining is not
 * harmful to repeat — the server is happy to be told twice — but a screen that
 * silently retries is one that can sit there redeeming forever against a
 * refusal that is never going to change.
 */
export function JoinBoardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { joinBoard } = useLeaderboard();
  const { account } = useAuth();
  const { token: raw } = useLocalSearchParams<{ token?: string }>();

  /**
   * The token, read from the route parameter or from a whole URL.
   *
   * Both, because `expo-router` hands over the path segment for a link it
   * matched, and there is no reason for this screen to care which of those it
   * was given.
   */
  const token = isInviteToken(raw) ? raw : raw ? tokenFromUrl(raw) : null;

  const [state, setState] = useState<State>(
    token ? { step: "working" } : { step: "failed", reason: "That link is not valid." },
  );

  // Guarded rather than keyed on the token: an effect that re-ran would redeem
  // again on every render caused by its own result.
  const attempted = useRef(false);

  const attempt = useCallback(
    (invite: string) => {
      setState({ step: "working" });
      void joinBoard(invite).then((result) =>
        setState(
          result.ok
            ? { step: "joined", name: result.name }
            : { step: "failed", reason: result.reason },
        ),
      );
    },
    [joinBoard],
  );

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    attempt(token);
  }, [token, attempt]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingLeft: space.lg + insets.left,
          paddingRight: space.lg + insets.right,
          paddingBottom: 40 + insets.bottom,
        },
      ]}
    >
      <Card>
        <CardHeader icon="people" title="Join a board" />
        <CardContent>
          {state.step === "working" ? (
            <View style={styles.centre}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.body}>Adding you to the board…</Text>
            </View>
          ) : state.step === "joined" ? (
            <>
              <Text style={styles.body}>
                You are on <Text style={styles.strong}>{state.name}</Text>. Its
                players and games are on your leaderboard now.
              </Text>
              <Button
                label="Open the board"
                onPress={() => router.replace("/leaderboard")}
              />
            </>
          ) : (
            <>
              <Text style={styles.body}>{state.reason}</Text>
              {/* Signing in is the one refusal somebody can act on from here,
                  and joining is the first thing in the app that requires an
                  account — so it is worth taking them straight to it. */}
              {!account ? (
                <Button label="Sign in" onPress={() => router.push("/account")} />
              ) : token ? (
                <Button label="Try again" onPress={() => attempt(token)} />
              ) : null}
              <Button
                label="Not now"
                variant="secondary"
                onPress={() => router.replace("/")}
              />
            </>
          )}
        </CardContent>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: space.lg, gap: space.md },
  centre: { alignItems: "center", gap: space.md, paddingVertical: space.lg },
  body: { ...text.body, marginBottom: space.md },
  strong: { ...text.body, color: colors.text, fontWeight: "600" },
});
