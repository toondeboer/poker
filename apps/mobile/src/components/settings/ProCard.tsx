// src/components/settings/ProCard.tsx
import {
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Constants from "expo-constants";
import { adReportMailto, SITE_URL } from "@poker/core";
import { usePremium } from "@/src/contexts/PremiumContext";
import { colors, space, text } from "@/src/theme";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";

export function ProCard({ onRequestPro }: { onRequestPro: () => void }) {
  const { isPremium } = usePremium();

  // Once unlocked there's nothing to act on, so this collapses to a single line
  // rather than keeping a full card's worth of space.
  if (isPremium) {
    return (
      <Card style={styles.unlockedCard}>
        <View style={styles.unlockedRow}>
          <Text style={styles.unlockedText}>
            Pro unlocked — no ads, payouts, leaderboard, presets, and your pick
            of alarm sound.
          </Text>
          <Badge label="Unlocked" tone="live" />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      {/* **"One-time" said beside the name, not only in the body.** It is the
          one thing that must not be confused with the Club card below, and the
          two badges are the fastest way to read the difference. */}
      <CardHeader icon="star" title="Pro" right={<Badge label="One-time" />} />
      <CardContent>
        <Text style={styles.description}>
          Remove ads, work out payouts, keep a leaderboard, save tournament
          presets, choose your alarm sound, and support the app. Paid once, and
          it all runs on this phone — nothing to renew.
        </Text>
        <Button
          label="Unlock Pro / Remove Ads"
          icon="star"
          variant="pro"
          onPress={onRequestPro}
        />
        {/* **Here because this card is shown exactly when ads are.** App Review
            Guideline 2.5.18 requires a way to report an inappropriate ad, and a
            Pro or Club user sees none, so the free branch of the one card about
            ads is where it belongs. Quiet on purpose: it must be findable, not
            compete with the button above it. */}
        <TouchableOpacity
          style={styles.reportAd}
          onPress={reportAd}
          accessibilityRole="link"
          accessibilityLabel="Report an inappropriate ad"
          hitSlop={8}
        >
          <Text style={styles.reportAdText}>
            Seen an inappropriate ad? Report it
          </Text>
        </TouchableOpacity>
      </CardContent>
    </Card>
  );
}

/**
 * Opens a pre-filled email to support. `openURL` rejects when no mail app can
 * take a `mailto:` link (none installed, or none signed in on Android), and a
 * report link that silently does nothing is worse than none, so it falls back
 * to the support page, which shows the same address.
 */
function reportAd() {
  const url = adReportMailto({
    platform: Platform.OS === "ios" ? "iOS" : "Android",
    appVersion: Constants.expoConfig?.version,
  });
  Linking.openURL(url).catch(
    () => void Linking.openURL(`${SITE_URL}/support`).catch(() => {}),
  );
}

const styles = StyleSheet.create({
  unlockedCard: { padding: space.lg },
  unlockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  unlockedText: { ...text.body, flex: 1 },
  description: text.body,
  reportAd: { alignSelf: "center" },
  reportAdText: {
    ...text.meta,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
});
