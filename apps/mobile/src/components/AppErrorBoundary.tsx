// src/components/AppErrorBoundary.tsx
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import type { ErrorBoundaryProps } from "expo-router";
import { clearForRecovery } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";
import { logger } from "@/src/utils/logger";
import { colors, space, text } from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";

/**
 * What the app shows instead of disappearing.
 *
 * expo-router wraps a route in this when the route's module exports it, so
 * exporting it from the root layout covers everything below — every screen and
 * every provider. Without it a throw during render takes the whole app with it:
 * on a release build that is a blank screen or an instant close, with nothing
 * on screen to say what happened and no way back.
 *
 * **Retrying is not always enough, and that is the interesting part.** The
 * failure this app can actually produce is a throw from inside a state updater
 * reading something it was given from storage — and storage is loaded again on
 * every launch, so the same failure repeats forever. Somebody in that position
 * has exactly one option left today, which is deleting the app, and that takes
 * the leaderboard with it. So the second button exists: throw away everything
 * that can be recreated in a minute, keep the seasons of results that cannot.
 *
 * It is deliberately not offered first. Retrying costs nothing and fixes a
 * one-off; the reset is the thing you reach for when retrying has not worked,
 * which is why it says what it will take before it takes it.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // Logged from here rather than left to whatever caught it, so a bug report
  // has the message in it. There is no crash reporter in this app.
  logger.error("Unhandled error, showing the recovery screen:", error);

  return (
    <SafeAreaProvider>
      <RecoveryScreen error={error} retry={retry} />
    </SafeAreaProvider>
  );
}

function RecoveryScreen({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    try {
      await clearForRecovery(asyncStorageAdapter);
      await retry();
    } catch (failure) {
      // Nothing better to offer: the screen is already the failure screen, and
      // saying so beats a button that silently does nothing.
      logger.error("The recovery reset failed:", failure);
      Alert.alert(
        "That didn't work",
        "The app couldn't clear its saved state. Reopening it is the next thing to try.",
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = () => {
    Alert.alert(
      "Start fresh",
      "This clears the round in progress, your blind structure, payout setup, saved presets and sound choice. Your leaderboard is kept — every game night you've recorded stays exactly where it is.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start fresh",
          style: "destructive",
          onPress: () => void reset(),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        <Card>
          <CardHeader icon="alert-circle" title="Something went wrong" />
          <CardContent>
            <Text style={styles.blurb}>
              The app hit a problem it couldn&apos;t carry on from. Nothing has
              been deleted.
            </Text>
            {/* Shown, not hidden behind a "details" tap: this is the only place
                the message exists, and it is what makes a bug report useful. */}
            <Text style={styles.detail} selectable>
              {error.message || "No further detail."}
            </Text>
            <Button
              label="Try again"
              icon="refresh"
              onPress={() => void retry()}
              disabled={busy}
            />
            <Text style={styles.blurb}>
              If it keeps happening, the app may be stuck on something it saved.
              Starting fresh clears that — and keeps your leaderboard.
            </Text>
            <Button
              label="Start fresh"
              variant="danger"
              icon="trash-outline"
              onPress={confirmReset}
              disabled={busy}
            />
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, gap: space.xl },
  blurb: { ...text.body, color: colors.textMuted },
  detail: {
    ...text.body,
    color: colors.text,
    backgroundColor: colors.badge,
    borderRadius: 8,
    padding: space.md,
  },
});
