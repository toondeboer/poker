// src/components/settings/NotificationsBlockedCard.tsx
import { useCallback, useEffect } from "react";
import { AppState, Linking, Platform, StyleSheet, Text } from "react-native";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { useNotificationPermission } from "@/src/hooks/useNotificationPermission";
import { colors, space, text } from "@/src/theme";

/**
 * The way back from a permission Android will not ask about again.
 *
 * **This is a silent failure of the app's main job.** After a second denial
 * Android blocks `POST_NOTIFICATIONS` permanently: every later request returns
 * `never_ask_again` immediately, showing nothing. The foreground service then
 * refuses to start, so the background timer notification and its expiry alarm
 * never fire — a blinds timer that does not tell you the blinds went up, with
 * no dialog, no error and no way back inside the app. Until now the entire
 * reaction was a `logger.warn`.
 *
 * **Not a launch-time modal**, which is the obvious idea and the wrong one: the
 * request returns instantly in this state, so a blocked user would meet the
 * modal on every single cold launch. A row in Settings is seen when somebody
 * goes looking for why the timer is quiet, and is invisible the rest of the
 * time.
 *
 * It is not dismissible either, deliberately. Dismissal is what an unwanted
 * interruption needs; this one is only ever on screen because somebody opened
 * Settings, and hiding it would take away the only route back.
 */
export function NotificationsBlockedCard() {
  const { hasPermission, checkPermission } = useNotificationPermission();

  /**
   * Re-check whenever the app comes back.
   *
   * Granting the permission happens in the system settings app, so the return
   * to the foreground is the only moment this can learn it was fixed. Without
   * it the card sits there insisting notifications are blocked when they are
   * not, which is worse than not having it.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void checkPermission();
    });
    return () => subscription.remove();
    // `checkPermission` is redefined every render by its hook; depending on it
    // would resubscribe on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useCallback(() => {
    // `openSettings` lands on this app's own page on both platforms.
    void Linking.openSettings();
  }, []);

  // **iOS is not this problem.** It has no equivalent permanent block for the
  // Live Activity path, and `hasPermission` is hard-coded true there — so a
  // card would be dead weight rather than reassurance.
  if (Platform.OS !== "android") return null;
  // `null` means the check has not finished. Showing an alarming card while the
  // answer is still unknown is how somebody is told their app is broken when it
  // is not.
  if (hasPermission !== false) return null;

  return (
    <Card style={styles.card}>
      <CardHeader icon="notifications-off" title="Notifications are blocked" />
      <CardContent>
        <Text style={styles.body}>
          Android will not ask again, so the timer cannot alert you when the
          blinds go up while the app is in the background. Turn notifications on
          for Poker Blinds Buzzer in your device settings and it starts working
          again straight away.
        </Text>
        <Button
          label="Open settings"
          icon="open-outline"
          variant="secondary"
          onPress={open}
        />
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: colors.danger },
  body: { ...text.body, marginBottom: space.md },
});
