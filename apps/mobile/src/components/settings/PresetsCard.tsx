// src/components/settings/PresetsCard.tsx
import { RefObject, useState } from "react";
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { BlindPreset, formatTime, isValidPresetName } from "@poker/core";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useTimer } from "@/src/contexts/TimerContext";
import { usePresets } from "@/src/hooks/usePresets";
import { useKeyboardNudge } from "@/src/hooks/useKeyboardNudge";
import { space, text } from "@/src/theme";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { IconButton } from "@/src/components/ui/IconButton";
import { ListRow } from "@/src/components/ui/ListRow";
import { ProPill } from "@/src/components/ui/ProPill";
import { TextField } from "@/src/components/ui/TextField";

export function PresetsCard({
  onRequestPro,
  scrollViewRef,
  scrollOffsetRef,
  containerRef,
  bottomInset,
  style,
}: {
  onRequestPro: () => void;
  scrollViewRef: RefObject<ScrollView | null>;
  scrollOffsetRef: RefObject<number>;
  containerRef: RefObject<View | null>;
  bottomInset: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { isPremium } = usePremium();
  const { presets, savePreset, deletePreset } = usePresets();
  const { blindLevels, loadBlindLevels, isDraftDirty } = useBlinds();
  const { timerDuration, setTimerDuration } = useTimer();
  const [presetName, setPresetName] = useState("");

  const { targetRef, setActive } = useKeyboardNudge({
    scrollViewRef,
    scrollOffsetRef,
    containerRef,
    bottomInset,
  });

  const canSavePreset = isValidPresetName(presetName, presets);

  // Saves the *active* structure, not the editor draft: with editing on its own
  // screen, "save current setup" has to mean the setup that's actually live.
  const handleSavePreset = () => {
    if (!canSavePreset) return;
    savePreset(presetName, blindLevels, timerDuration);
    setPresetName("");
  };

  const handleLoadPreset = (preset: BlindPreset) => {
    loadBlindLevels(preset.blindLevels);
    setTimerDuration(preset.timerDuration);
  };

  const handleDeletePreset = (preset: BlindPreset) => {
    Alert.alert("Delete preset", `Delete "${preset.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deletePreset(preset.id),
      },
    ]);
  };

  return (
    <Card style={style}>
      <CardHeader
        icon="bookmark"
        title="Tournament Presets"
        right={
          isPremium ? <Badge label={`${presets.length} saved`} /> : <ProPill />
        }
      />

      {isPremium ? (
        <CardContent>
          <TextField
            label="Save current setup"
            value={presetName}
            onChangeText={setPresetName}
            placeholder="Preset name"
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
            onFocus={() => setActive(true)}
            onBlur={() => setActive(false)}
            helper={
              isDraftDirty
                ? `Saves the ${blindLevels.length} active levels and ${formatTime(timerDuration)} round. Unapplied blind changes aren't included — apply them first.`
                : `Saves your ${blindLevels.length} blind levels and ${formatTime(timerDuration)} round.`
            }
          />

          {/* measureInWindow needs a host component, so the nudge target is this
              plain View rather than the Button itself. */}
          <View ref={targetRef}>
            <Button
              label="Save Preset"
              icon="save"
              onPress={handleSavePreset}
              disabled={!canSavePreset}
            />
          </View>

          {presets.length === 0 ? (
            <Text style={styles.empty}>
              No presets yet — set up your blinds and round duration, then save
              them here.
            </Text>
          ) : (
            <View style={styles.list}>
              {presets.map((preset) => (
                <ListRow
                  key={preset.id}
                  title={preset.name}
                  meta={`${preset.blindLevels.length} levels · ${formatTime(preset.timerDuration)}/round`}
                  right={
                    <>
                      <Button
                        label="Load"
                        size="sm"
                        onPress={() => handleLoadPreset(preset)}
                      />
                      <IconButton
                        icon="trash"
                        tone="danger"
                        onPress={() => handleDeletePreset(preset)}
                        accessibilityLabel={`Delete preset ${preset.name}`}
                      />
                    </>
                  }
                />
              ))}
            </View>
          )}
        </CardContent>
      ) : (
        <CardContent>
          <Text style={styles.description}>
            Save your tournament setups — blind structures and round length —
            and load any of them in one tap.
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
  empty: { ...text.meta, lineHeight: 18 },
  list: { gap: space.md },
});
