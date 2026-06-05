// src/components/PokerSettings.tsx
import React, { useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTimer } from "@/src/contexts/TimerContext";
import { useBlinds } from "@/src/contexts/BlindsContext";

// Mock icons - replace with your preferred icon library (react-native-vector-icons, etc.)
const ClockIcon = () => <Text style={styles.icon}>⏰</Text>;
const DollarIcon = () => <Text style={styles.icon}>💰</Text>;
const PlusIcon = () => <Text style={styles.icon}>➕</Text>;
const TrashIcon = () => <Text style={styles.icon}>🗑️</Text>;
const SaveIcon = () => <Text style={styles.icon}>💾</Text>;
const ResetIcon = () => <Text style={styles.icon}>🔄</Text>;

const { width: screenWidth } = Dimensions.get("window");

export default function PokerSettings() {
  const {
    customBlindLevels,
    addBlindLevel,
    removeBlindLevel,
    updateBlindLevel,
    applyCustomBlindLevels,
    resetToDefaultBlinds,
  } = useBlinds();

  const { timerDuration, setTimerDuration } = useTimer();

  const [durationSetting, setDurationSetting] = useState(String(timerDuration));

  const handleSaveTimer = () => {
    setTimerDuration(Number(durationSetting));
  };

  const handleSaveBlinds = () => {
    applyCustomBlindLevels();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const isTablet = screenWidth > 768;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>
            Configure your tournament settings
          </Text>
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
      </ScrollView>
    </View>
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
  icon: {
    fontSize: 20,
  },
});
