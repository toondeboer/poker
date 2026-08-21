// src/components/settings/SoundPackCard.tsx
import { StyleSheet, Text, View } from "react-native";
import { SOUND_PACKS } from "@poker/core";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useSoundPack } from "@/src/contexts/SoundPackContext";
import { space, text } from "@/src/theme";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { ProPill } from "@/src/components/ui/ProPill";
import { SoundPackRow } from "./SoundPackRow";

export function SoundPackCard({ onRequestPro }: { onRequestPro: () => void }) {
  const { isPremium } = usePremium();
  const { soundPackId, setSoundPackId } = useSoundPack();

  const selectedLabel =
    SOUND_PACKS.find((pack) => pack.id === soundPackId)?.label ??
    "Classic Alarm";

  return (
    <Card>
      <CardHeader
        icon="volume-high"
        title="Sound Pack"
        right={isPremium ? <Badge label={selectedLabel} /> : <ProPill />}
      />

      {isPremium ? (
        <CardContent>
          <View style={styles.list}>
            {SOUND_PACKS.map((pack) => (
              <SoundPackRow
                key={pack.id}
                pack={pack}
                selected={pack.id === soundPackId}
                onSelect={() => setSoundPackId(pack.id)}
              />
            ))}
          </View>
        </CardContent>
      ) : (
        <CardContent>
          <Text style={styles.description}>
            Choose the alarm that plays when a round ends — a few bundled sounds
            beyond the classic alarm.
          </Text>
          <Button
            label="Unlock Pro"
            icon="star"
            variant="pro"
            onPress={onRequestPro}
          />
        </CardContent>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  description: text.body,
  list: { gap: space.md },
});
