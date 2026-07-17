// src/components/PokerSettings.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BlindPreset, formatTime, isValidPresetName } from "@poker/core";
import { useTimer } from "@/src/contexts/TimerContext";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { usePremium } from "@/src/contexts/PremiumContext";
import { usePresets } from "@/src/hooks/usePresets";
import { Paywall } from "./paywall/Paywall";

// Mock icons - replace with your preferred icon library (react-native-vector-icons, etc.)
const ClockIcon = () => <Text style={styles.icon}>⏰</Text>;
const DollarIcon = () => <Text style={styles.icon}>💰</Text>;
const PlusIcon = () => <Text style={styles.icon}>➕</Text>;
const TrashIcon = () => <Text style={styles.icon}>🗑️</Text>;
const SaveIcon = () => <Text style={styles.icon}>💾</Text>;
const ResetIcon = () => <Text style={styles.icon}>🔄</Text>;
const CrownIcon = () => <Text style={styles.icon}>👑</Text>;
const BookmarkIcon = () => <Text style={styles.icon}>🔖</Text>;

const { width: screenWidth } = Dimensions.get("window");

export default function PokerSettings() {
  const {
    customBlindLevels,
    addBlindLevel,
    removeBlindLevel,
    updateBlindLevel,
    applyCustomBlindLevels,
    loadBlindLevels,
    resetToDefaultBlinds,
  } = useBlinds();

  const { timerDuration, setTimerDuration } = useTimer();
  const { isPremium } = usePremium();
  const { presets, savePreset, deletePreset } = usePresets();

  const [durationSetting, setDurationSetting] = useState(String(timerDuration));
  const [showPaywall, setShowPaywall] = useState(false);
  const [presetName, setPresetName] = useState("");

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const saveButtonRef = useRef<View>(null);
  const presetInputFocused = useRef(false);

  const canSavePreset = isValidPresetName(presetName, presets);

  // Scroll the Save Preset button above the keyboard once it opens, since the
  // preset input sits mid-ScrollView and the keyboard would otherwise cover the
  // button below it. Anchored to the keyboard's actual height (not a guessed
  // offset) so it clears the button by exactly as much as it needs to.
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", (e) => {
      if (!presetInputFocused.current) return;
      const keyboardHeight = e.endCoordinates.height;
      setTimeout(() => {
        saveButtonRef.current?.measureInWindow((_x, y, _width, height) => {
          const visibleBottom = Dimensions.get("window").height - keyboardHeight;
          const overflow = y + height - visibleBottom;
          if (overflow > 0) {
            scrollViewRef.current?.scrollTo({
              y: scrollOffsetRef.current + overflow + 16,
              animated: true,
            });
          }
        });
      }, 50);
    });
    return () => subscription.remove();
  }, []);

  const handleSaveTimer = () => {
    setTimerDuration(Number(durationSetting));
  };

  const handleSaveBlinds = () => {
    applyCustomBlindLevels();
  };

  // Save the current editor setup (blind structure + round duration) as a preset.
  const handleSavePreset = () => {
    if (!canSavePreset) return;
    savePreset(presetName, customBlindLevels, timerDuration);
    setPresetName("");
  };

  // Make a saved preset the active (and editable) setup.
  const handleLoadPreset = (preset: BlindPreset) => {
    loadBlindLevels(preset.blindLevels);
    setTimerDuration(preset.timerDuration);
    setDurationSetting(String(preset.timerDuration));
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

  const isTablet = screenWidth > 768;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>
            Configure your tournament settings
          </Text>
        </View>

        {/* Pro / Remove Ads */}
        <View style={styles.proCardWrapper}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <CrownIcon />
              </View>
              <Text style={styles.cardTitle}>Pro</Text>
              {isPremium && (
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>Unlocked</Text>
                </View>
              )}
            </View>

            <View style={styles.cardContent}>
              {isPremium ? (
                <Text style={styles.proUnlockedText}>
                  Thanks for going Pro! Ads are removed and tournament presets
                  are unlocked.
                </Text>
              ) : (
                <>
                  <Text style={styles.proDescription}>
                    Remove ads, save tournament presets, and support the app — a
                    one-time purchase.
                  </Text>
                  <TouchableOpacity
                    style={styles.proButton}
                    onPress={() => setShowPaywall(true)}
                    activeOpacity={0.85}
                  >
                    <CrownIcon />
                    <Text style={styles.proButtonText}>
                      Unlock Pro / Remove Ads
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        <View
          style={[
            styles.cardsContainer,
            isTablet && styles.cardsContainerTablet,
          ]}
        >
          {/* Timer Settings Card */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <ClockIcon />
              </View>
              <Text style={styles.cardTitle}>Timer Settings</Text>
            </View>

            <View style={styles.cardContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Round Duration</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={durationSetting}
                    onChangeText={setDurationSetting}
                    placeholder="600"
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={styles.inputSuffix}>seconds</Text>
                </View>
                <Text style={styles.inputHelper}>
                  Current: {formatTime(Number(durationSetting) || 0)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveTimer}
                activeOpacity={0.8}
              >
                <SaveIcon />
                <Text style={styles.primaryButtonText}>
                  Save Timer Settings
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Blind Levels Card */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <DollarIcon />
              </View>
              <Text style={styles.cardTitle}>Blind Levels</Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>
                  {customBlindLevels.length} levels
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.blindLevelsContainer}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
            >
              {customBlindLevels.map((level, index) => (
                <View key={index} style={styles.blindLevel}>
                  <View style={styles.blindLevelHeader}>
                    <Text style={styles.blindLevelTitle}>
                      Level {index + 1}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeBlindLevel(index)}
                      style={styles.removeButton}
                      activeOpacity={0.7}
                    >
                      <TrashIcon />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.blindInputs}>
                    <View style={styles.blindInputGroup}>
                      <Text style={styles.blindInputLabel}>Small Blind</Text>
                      <TextInput
                        style={styles.blindInput}
                        keyboardType="numeric"
                        value={String(level.small)}
                        onChangeText={(text) =>
                          updateBlindLevel(index, "small", Number(text))
                        }
                        textAlign="center"
                      />
                    </View>
                    <View style={styles.blindInputGroup}>
                      <Text style={styles.blindInputLabel}>Big Blind</Text>
                      <TextInput
                        style={styles.blindInput}
                        keyboardType="numeric"
                        value={String(level.big)}
                        onChangeText={(text) =>
                          updateBlindLevel(index, "big", Number(text))
                        }
                        textAlign="center"
                      />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.blindActions}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={addBlindLevel}
                activeOpacity={0.8}
              >
                <PlusIcon />
                <Text style={styles.addButtonText}>Add Blind Level</Text>
              </TouchableOpacity>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={resetToDefaultBlinds}
                  activeOpacity={0.8}
                >
                  <ResetIcon />
                  <Text style={styles.secondaryButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveBlinds}
                  activeOpacity={0.8}
                >
                  <SaveIcon />
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Tournament Presets (Pro) */}
        <View style={styles.presetCardWrapper}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <BookmarkIcon />
              </View>
              <Text style={styles.cardTitle}>Tournament Presets</Text>
              {isPremium ? (
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>
                    {presets.length} saved
                  </Text>
                </View>
              ) : (
                <View style={styles.proPill}>
                  <Text style={styles.proPillText}>PRO</Text>
                </View>
              )}
            </View>

            {isPremium ? (
              <View style={styles.cardContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Save current setup</Text>
                  <TextInput
                    style={styles.input}
                    value={presetName}
                    onChangeText={setPresetName}
                    placeholder="Preset name"
                    placeholderTextColor="#94a3b8"
                    maxLength={40}
                    returnKeyType="done"
                    onSubmitEditing={handleSavePreset}
                    onFocus={() => {
                      presetInputFocused.current = true;
                    }}
                    onBlur={() => {
                      presetInputFocused.current = false;
                    }}
                  />
                  <Text style={styles.inputHelper}>
                    Saves your {customBlindLevels.length} blind levels and{" "}
                    {formatTime(timerDuration)} round.
                  </Text>
                </View>

                <TouchableOpacity
                  ref={saveButtonRef}
                  style={[
                    styles.primaryButton,
                    !canSavePreset && styles.disabledButton,
                  ]}
                  onPress={handleSavePreset}
                  disabled={!canSavePreset}
                  activeOpacity={0.8}
                >
                  <SaveIcon />
                  <Text style={styles.primaryButtonText}>Save Preset</Text>
                </TouchableOpacity>

                {presets.length === 0 ? (
                  <Text style={styles.presetEmpty}>
                    No presets yet — configure your blinds and round duration
                    above, then save them here.
                  </Text>
                ) : (
                  <View style={styles.presetList}>
                    {presets.map((preset) => (
                      <View key={preset.id} style={styles.presetRow}>
                        <View style={styles.presetInfo}>
                          <Text style={styles.presetName} numberOfLines={1}>
                            {preset.name}
                          </Text>
                          <Text style={styles.presetMeta}>
                            {preset.blindLevels.length} levels ·{" "}
                            {formatTime(preset.timerDuration)}/round
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.loadButton}
                          onPress={() => handleLoadPreset(preset)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.loadButtonText}>Load</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleDeletePreset(preset)}
                          activeOpacity={0.7}
                        >
                          <TrashIcon />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.cardContent}>
                <Text style={styles.proDescription}>
                  Save your tournament setups — blind structures and round
                  length — and load any of them in one tap.
                </Text>
                <TouchableOpacity
                  style={styles.proButton}
                  onPress={() => setShowPaywall(true)}
                  activeOpacity={0.85}
                >
                  <CrownIcon />
                  <Text style={styles.proButtonText}>Unlock Pro</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#94a3b8",
  },
  proCardWrapper: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  proDescription: {
    fontSize: 14,
    color: "#cbd5e1",
    lineHeight: 20,
  },
  proUnlockedText: {
    fontSize: 14,
    color: "#cbd5e1",
  },
  proButton: {
    backgroundColor: "#f59e0b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 4,
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  proButtonText: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "600",
  },
  cardsContainer: {
    paddingHorizontal: 16,
    gap: 24,
  },
  cardsContainerTablet: {
    flexDirection: "row",
    maxWidth: 1200,
    alignSelf: "center",
    width: "100%",
  },
  card: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#374151",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  cardTablet: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  cardHeaderIcon: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
    flex: 1,
  },
  levelBadge: {
    backgroundColor: "rgba(71, 85, 105, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  levelBadgeText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  cardContent: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#cbd5e1",
    marginBottom: 8,
  },
  inputContainer: {
    position: "relative",
  },
  input: {
    backgroundColor: "rgba(71, 85, 105, 0.5)",
    borderWidth: 1,
    borderColor: "#4b5563",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontFamily: "monospace",
    color: "#ffffff",
    textAlign: "center",
  },
  inputSuffix: {
    position: "absolute",
    right: 12,
    top: 16,
    fontSize: 14,
    color: "#94a3b8",
  },
  inputHelper: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    gap: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
  },
  blindLevelsContainer: {
    maxHeight: 400,
    marginBottom: 24,
  },
  blindLevel: {
    backgroundColor: "rgba(71, 85, 105, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(75, 85, 99, 0.5)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  blindLevelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  blindLevelTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  removeButton: {
    padding: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
  },
  blindInputs: {
    flexDirection: "row",
    gap: 12,
  },
  blindInputGroup: {
    flex: 1,
  },
  blindInputLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  blindInput: {
    backgroundColor: "rgba(75, 85, 99, 0.5)",
    borderWidth: 1,
    borderColor: "#6b7280",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: "monospace",
    color: "#ffffff",
    textAlign: "center",
  },
  blindActions: {
    gap: 12,
  },
  addButton: {
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    gap: 8,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#4b5563",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    gap: 8,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
  },
  presetCardWrapper: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  proPill: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "#f59e0b",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  proPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f59e0b",
    letterSpacing: 0.5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  presetEmpty: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  presetList: {
    gap: 12,
  },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(71, 85, 105, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(75, 85, 99, 0.5)",
    borderRadius: 8,
    padding: 12,
  },
  presetInfo: {
    flex: 1,
  },
  presetName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  presetMeta: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  loadButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  loadButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  icon: {
    fontSize: 20,
  },
});
