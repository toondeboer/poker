// src/components/settings/ClubCard.tsx
import { StyleSheet, Text, View } from "react-native";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useFeatures } from "@/src/contexts/FeaturesContext";
import { accountsAreReal } from "@/src/contexts/AuthContext";
import { space, text } from "@/src/theme";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";

/**
 * Club, sold in its own card beside {@link ProCard} rather than buried under it.
 *
 * **The two purchases are separated here first, and the paywall follows.** Club
 * had no entry point of its own anywhere in the app: it lived halfway down a
 * sheet titled "Pro", behind buttons that said "Unlock Pro", so the subscription
 * could only be found by somebody looking for something else. Two cards in
 * Settings is the plainest possible statement that there are two things and they
 * are not the same thing.
 */
export function ClubCard({ onRequestClub }: { onRequestClub: () => void }) {
  const { hasClub, clubPlans } = usePremium();
  const features = useFeatures();

  /**
   * **Absent, not disabled, wherever Club cannot be had.**
   *
   * Three separate reasons, all of them real: a build with no backend, the
   * server's kill switch turned off, and the ordinary state before the
   * subscriptions go live in both stores. A card advertising something that
   * cannot be bought is worse than no card — and under the kill switch it would
   * be selling a feature that has just been switched off.
   */
  if (!accountsAreReal || !features.sharing) return null;
  if (!hasClub && clubPlans.length === 0) return null;

  // Nothing left to act on, so this collapses to a single line rather than
  // keeping a full card's worth of space — the same shape ProCard takes once
  // Pro is unlocked.
  if (hasClub) {
    return (
      <Card style={styles.activeCard}>
        <View style={styles.activeRow}>
          <Text style={styles.activeText}>
            Club active — your boards and your clock can be shared with the
            table.
          </Text>
          <Badge label="Active" tone="live" />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        icon="people"
        title="Club"
        right={<Badge label="Subscription" />}
      />
      <CardContent>
        <Text style={styles.description}>
          Share one leaderboard and one clock with the people you play with —
          everyone sees the same standings, the same round and the same
          countdown. Joining a board somebody shares is always free; only the
          person sharing subscribes. Includes everything in Pro.
        </Text>
        <Button
          label="See Club"
          icon="people"
          variant="club"
          onPress={onRequestClub}
        />
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  activeCard: { padding: space.lg },
  activeRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  activeText: { ...text.body, flex: 1 },
  description: text.body,
});
