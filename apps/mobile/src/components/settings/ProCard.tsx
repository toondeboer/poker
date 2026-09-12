// src/components/settings/ProCard.tsx
import { StyleSheet, Text, View } from "react-native";
import { usePremium } from "@/src/contexts/PremiumContext";
import { space, text } from "@/src/theme";
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
      </CardContent>
    </Card>
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
});
