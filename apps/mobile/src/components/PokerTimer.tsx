// src/components/PokerTimer.tsx
import React, { useCallback, useMemo } from "react";
import {
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { formatTime, shouldShowAds, SITE_URL, SHARE_MESSAGE } from "@poker/core";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { useTimer } from "@/src/contexts/TimerContext";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useAdsConsent } from "@/src/hooks/useAdsConsent";
import { useRouter } from "expo-router";
import { TimerExpirationAlert } from "./TimerExpirationAlert";
import { BannerAdSlot } from "./ads/BannerAdSlot";

// The card is designed to fit one screen with no scrolling. `BASELINE_HEIGHT` is
// roughly the available height on a typical phone in portrait with no ad banner
// (where the fixed sizes below look right); shorter available height — the ad
// banner, or landscape — scales spacing/font-size down proportionally instead of
// letting content overflow or leaving it scrollable.
const BASELINE_HEIGHT = 700;
const MIN_SCALE = 0.6;
const AD_RESERVED_HEIGHT = 60;

export default function PokerTimer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { isPremium } = usePremium();
  const { consentResolved } = useAdsConsent();
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

  const adVisible = shouldShowAds({ isPremium, consentResolved });

  const scale = useMemo(() => {
    const availableHeight =
      windowHeight -
      insets.top -
      insets.bottom -
      (adVisible ? AD_RESERVED_HEIGHT : 0);
    return Math.min(1, Math.max(MIN_SCALE, availableHeight / BASELINE_HEIGHT));
  }, [windowHeight, insets.top, insets.bottom, adVisible]);

  // Scales vertical spacing/font-size so the card fits one screen without
  // scrolling — see BASELINE_HEIGHT above.
  const s = useCallback((value: number) => value * scale, [scale]);

  const handleShare = useCallback(() => {
    Share.share({
      message: `${SHARE_MESSAGE} ${SITE_URL}`,
      url: SITE_URL,
    }).catch(() => {});
  }, []);

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
      <SystemBars style="light" />

      {/* Background Gradient */}
      <LinearGradient
        colors={getGradientColors() as any}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + s(24),
              paddingBottom: insets.bottom + s(24),
              paddingLeft: insets.left + 24,
              paddingRight: insets.right + 24,
            },
          ]}
        >
          {/* Main Timer Card */}
          <View
            style={[
              styles.mainCard,
              { padding: s(32), marginBottom: s(24) },
            ]}
          >
            {/* Timer Display */}
            <View style={[styles.timerSection, { marginBottom: s(32) }]}>
              <Text
                style={[
                  styles.timerText,
                  { fontSize: s(72), marginBottom: s(8) },
                ]}
              >
                {formatTime(timeLeft)}
              </Text>
              <Text style={[styles.levelText, { marginBottom: s(16) }]}>
                Level {currentBlindIndex + 1}
              </Text>

              {/* Progress Bar */}
              <View style={[styles.progressBarContainer, { marginBottom: s(8) }]}>
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
            <View
              style={[
                styles.blindsCard,
                { padding: s(24), marginBottom: s(24) },
              ]}
            >
              <Text style={[styles.blindsTitle, { marginBottom: s(12) }]}>
                Current Blinds
              </Text>
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
              <View
                style={[
                  styles.nextBlindsCard,
                  { padding: s(16), marginBottom: s(24) },
                ]}
              >
                <Text style={[styles.nextBlindsTitle, { marginBottom: s(8) }]}>
                  Next Level
                </Text>
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
            <View style={[styles.timerControls, { marginBottom: s(24) }]}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    paddingVertical: s(12),
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

              <TouchableOpacity
                style={[styles.resetButton, { paddingVertical: s(12) }]}
                onPress={resetTimer}
              >
                <Ionicons name="refresh" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Blind Controls */}
            <View style={[styles.blindControls, { marginBottom: s(24) }]}>
              <TouchableOpacity
                style={[
                  styles.blindButton,
                  styles.decreaseButton,
                  { paddingVertical: s(12) },
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
                  { paddingVertical: s(12) },
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
              style={[styles.settingsButton, { paddingVertical: s(12) }]}
              onPress={() => router.navigate("/settings")}
            >
              <Ionicons name="settings" size={20} color="white" />
              <Text style={styles.settingsButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>

          {/* Subtle brand + share row — helps players at the table find the app */}
          <TouchableOpacity
            style={[styles.shareRow, { marginTop: s(16) }]}
            onPress={handleShare}
            accessibilityLabel="Share Poker Blinds Buzzer"
          >
            <Ionicons
              name="share-social-outline"
              size={14}
              color="rgba(255,255,255,0.7)"
            />
            <Text style={styles.shareRowText}>Share Poker Blinds Buzzer</Text>
          </TouchableOpacity>
        </View>

        {/* Banner ad — pinned below the content, hidden for Pro users */}
        <BannerAdSlot />
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
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  mainCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  // Timer Section
  timerSection: {
    alignItems: "center",
  },
  timerText: {
    fontWeight: "bold",
    color: "#1F2937",
  },
  levelText: {
    fontSize: 14,
    color: "#6B7280",
  },
  progressBarContainer: {
    width: "100%",
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
  },
  blindsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
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
    borderWidth: 2,
    borderColor: "#DBEAFE",
  },
  nextBlindsTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1D4ED8",
    textAlign: "center",
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
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
  },
  blindButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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

  // Share row
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  shareRowText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "500",
  },
});
