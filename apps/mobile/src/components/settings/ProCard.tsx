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
            Pro unlocked — no ads, payouts, leaderboard, presets, and your
            pick of alarm sound.
          </Text>
          <Badge label="Unlocked" tone="live" />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader icon="star" title="Pro" />
      <CardContent>
        <Text style={styles.description}>
          Remove ads, work out payouts, keep a leaderboard, save tournament
          presets, choose your alarm sound, and support the app — a one-time
          purchase.
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
