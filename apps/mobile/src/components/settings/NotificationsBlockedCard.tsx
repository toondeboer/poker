// src/components/settings/NotificationsBlockedCard.tsx
import { useCallback, useEffect } from "react";
import { AppState, Platform, StyleSheet, Text } from "react-native";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { useNotificationPermission } from "@/src/hooks/useNotificationPermission";
import { colors, space, text } from "@/src/theme";

/**
 * The way back when notifications are off on Android.
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
  const { hasPermission, checkPermission, requestPermission, showPermissionAlert } =
    useNotificationPermission();

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

  /**
   * **Ask first, and only fall back to settings when Android will not ask.**
   *
   * `hasPermission === false` covers three states that look identical from
   * here: never asked, denied once, and blocked for good. Only the last needs
   * system settings — for the other two a request shows the ordinary dialog,
   * which is far better than sending somebody on a hunt through Android's
   * menus. Requesting when it *is* blocked costs nothing: it returns instantly
   * without showing anything, and then the alert offers the way through.
   *
   * This is what `showPermissionAlert` was written for. It had never been
   * called by anything.
   */
  const turnOn = useCallback(async () => {
    await requestPermission();
    /**
     * **Ask the OS again rather than trusting the answer.** `requestPermission`
     * returns `true` unconditionally below API 33 and on any path it does not
     * handle, which is a different question from the one `checkPermission`
     * asks — so a card shown because the native check said "no" could be
     * dismissed by a request that changed nothing and reported success,
     * without ever reaching the settings route below.
     */
    if (await checkPermission()) return;
    showPermissionAlert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {/* **"Off", not "blocked."** Denied once and denied for good are
          indistinguishable from here, and Android will re-prompt for the
          first — telling somebody it never asks again when it is about to
          would be worse than saying nothing. */}
      <CardHeader icon="notifications-off" title="Notifications are off" />
      <CardContent>
        <Text style={styles.body}>
          The timer cannot alert you when the blinds go up while the app is in
          the background. Turning notifications on puts that back straight away.
        </Text>
        <Button
          label="Turn on notifications"
          icon="notifications-outline"
          variant="secondary"
          onPress={() => void turnOn()}
        />
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: colors.danger },
  body: { ...text.body, marginBottom: space.md },
});
