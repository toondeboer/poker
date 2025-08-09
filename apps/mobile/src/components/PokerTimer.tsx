// src/components/PokerTimer.tsx
import React from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { useTimer } from "@/src/contexts/TimerContext";
import { useRouter } from "expo-router";
import { TimerExpirationAlert } from "./TimerExpirationAlert";

export default function PokerTimer() {
  const router = useRouter();
  const { currentBlindIndex, blindLevels, increaseBlinds, decreaseBlinds } =
    useBlinds();
  const {
    timeLeft,
    timerDuration,
    paused,
    togglePause,
    resetTimer,
    isLoading,
    showTimerAlert,
    dismissTimerAlert,
    handleNextBlinds,
  } = useTimer();

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const percent = Math.max(0, timeLeft) / timerDuration;

  // Dynamic background gradient based on time left
  const getGradientColors = () => {
    if (percent > 0.6) return ["#34D399", "#10B981"]; // Green
    if (percent > 0.3) return ["#FBBF24", "#F59E0B"]; // Amber
    return ["#F87171", "#DC2626"]; // Red
  };

  const getProgressBarColor = () => {
    if (percent > 0.6) return "#10B981";
    if (percent > 0.3) return "#F59E0B";
    return "#DC2626";
  };

  // Get next blind level for alert
  const nextBlindLevel =
    currentBlindIndex < blindLevels.length - 1
      ? blindLevels[currentBlindIndex + 1]
      : undefined;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Gradient */}
      <LinearGradient
        colors={getGradientColors() as any}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.content}>
          {/* Main Timer Card */}
          <View style={styles.mainCard}>
            {/* Timer Display */}
            <View style={styles.timerSection}>
              <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
              <Text style={styles.levelText}>
                Level {currentBlindIndex + 1}
              </Text>

              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${percent * 100}%`,
                        backgroundColor: getProgressBarColor(),
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Current Blinds */}
            <View style={styles.blindsCard}>
              <Text style={styles.blindsTitle}>Current Blinds</Text>
              <View style={styles.blindsRow}>
                <View style={styles.blindColumn}>
                  <Text style={styles.blindLabel}>Small Blind</Text>
                  <Text style={styles.blindValue}>
                    {blindLevels[currentBlindIndex].small}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.blindColumn}>
                  <Text style={styles.blindLabel}>Big Blind</Text>
                  <Text style={styles.blindValue}>
                    {blindLevels[currentBlindIndex].big}
                  </Text>
                </View>
              </View>
            </View>

            {/* Next Blinds Preview */}
            {nextBlindLevel && (
              <View style={styles.nextBlindsCard}>
                <Text style={styles.nextBlindsTitle}>Next Level</Text>
                <View style={styles.nextBlindsRow}>
                  <Text style={styles.nextBlindsText}>
                    SB: {nextBlindLevel.small}
                  </Text>
                  <Text style={styles.nextBlindsText}>
                    BB: {nextBlindLevel.big}
                  </Text>
                </View>
              </View>
            )}

            {/* Timer Controls */}
            <View style={styles.timerControls}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: paused
                      ? timerDuration === timeLeft
                        ? "#7C3AED"
                        : "#10B981"
                      : "#F59E0B",
                  },
                ]}
                onPress={togglePause}
              >
                <Ionicons
                  name={paused ? "play" : "pause"}
                  size={20}
                  color="white"
                />
                <Text style={styles.primaryButtonText}>
                  {paused
                    ? timerDuration === timeLeft
                      ? "Start"
                      : "Resume"
                    : "Pause"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.resetButton} onPress={resetTimer}>
                <Ionicons name="refresh" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Blind Controls */}
            <View style={styles.blindControls}>
              <TouchableOpacity
                style={[
                  styles.blindButton,
                  styles.decreaseButton,
                  currentBlindIndex === 0 && styles.disabledButton,
                ]}
                onPress={decreaseBlinds}
                disabled={currentBlindIndex === 0}
              >
                <Ionicons name="chevron-down" size={20} color="white" />
                <Text style={styles.blindButtonText}>Previous</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.blindButton,
                  styles.increaseButton,
                  currentBlindIndex >= blindLevels.length - 1 &&
                    styles.disabledButton,
                ]}
                onPress={increaseBlinds}
                disabled={currentBlindIndex >= blindLevels.length - 1}
              >
                <Ionicons name="chevron-up" size={20} color="white" />
                <Text style={styles.blindButtonText}>Next</Text>
              </TouchableOpacity>
            </View>

            {/* Settings Button */}
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => router.navigate("/settings")}
            >
              <Ionicons name="settings" size={20} color="white" />
              <Text style={styles.settingsButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Timer Expiration Alert */}
      <TimerExpirationAlert
        visible={showTimerAlert}
        currentLevel={currentBlindIndex + 1}
        nextBlindLevel={nextBlindLevel}
        onDismiss={dismissTimerAlert}
        onNextBlinds={handleNextBlinds}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
    paddingTop: StatusBar.currentHeight || 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: "center",
  },
  mainCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 24,
    padding: 32,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  // Timer Section
  timerSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  timerText: {
    fontSize: 72,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  levelText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  progressBarContainer: {
    width: "100%",
    marginBottom: 8,
  },
  progressBarBackground: {
    width: "100%",
    height: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 6,
  },

  // Blinds Section
  blindsCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  blindsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
    marginBottom: 12,
  },
  blindsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  blindColumn: {
    alignItems: "center",
    flex: 1,
  },
  divider: {
    width: 1,
    height: 48,
    backgroundColor: "#D1D5DB",
  },
  blindLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  blindValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2563EB",
  },

  // Next Blinds
  nextBlindsCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#DBEAFE",
  },
  nextBlindsTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1D4ED8",
    textAlign: "center",
    marginBottom: 8,
  },
  nextBlindsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  nextBlindsText: {
    fontSize: 14,
    color: "#2563EB",
  },

  // Timer Controls
  timerControls: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  resetButton: {
    backgroundColor: "#6B7280",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  // Blind Controls
  blindControls: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  blindButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  decreaseButton: {
    backgroundColor: "#EF4444",
  },
  increaseButton: {
    backgroundColor: "#3B82F6",
  },
  disabledButton: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },
  blindButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },

  // Settings Button
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#374151",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  settingsButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
