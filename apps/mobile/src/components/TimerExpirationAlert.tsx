// src/components/TimerExpirationAlert.tsx
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

interface TimerExpirationAlertProps {
  visible: boolean;
  currentLevel: number;
  nextBlindLevel?: {
    small: number;
    big: number;
  };
  onDismiss: () => void;
  onNextBlinds: () => void;
}

export function TimerExpirationAlert({
  visible,
  currentLevel,
  nextBlindLevel,
  onDismiss,
  onNextBlinds,
}: TimerExpirationAlertProps) {
  const pulse1 = useRef(new Animated.Value(0.8)).current;
  const pulse2 = useRef(new Animated.Value(1.2)).current;

  // Vibrate and start pulse animation when alert becomes visible
  useEffect(() => {
    if (visible) {
      // Create a vibration pattern for attention
      const pattern = [0, 500, 200, 500, 200, 500];
      Vibration.vibrate(pattern);

      // Start pulsing animations
      const pulse1Animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse1, {
            toValue: 1.0,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulse1, {
            toValue: 0.8,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );

      const pulse2Animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse2, {
            toValue: 1.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulse2, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );

      pulse1Animation.start();
      pulse2Animation.start();

      return () => {
        pulse1Animation.stop();
        pulse2Animation.stop();
      };
    }
  }, [visible, pulse1, pulse2]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
    >
      {/* Backdrop */}
      <View style={styles.backdrop}>
        {/* Pulsing Background Effect */}
        <View style={styles.pulseContainer}>
          <Animated.View
            style={[
              styles.pulseBackground,
              styles.pulse1,
              { transform: [{ scale: pulse1 }] },
            ]}
          >
            <LinearGradient
              colors={["rgba(239, 68, 68, 0.8)", "rgba(220, 38, 38, 0.9)"]}
              style={styles.pulseGradient}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.pulseBackground,
              styles.pulse2,
              { transform: [{ scale: pulse2 }] },
            ]}
          >
            <LinearGradient
              colors={["rgba(239, 68, 68, 0.6)", "rgba(220, 38, 38, 0.7)"]}
              style={styles.pulseGradient}
            />
          </Animated.View>
        </View>

        {/* Main Alert Card */}
        <View style={styles.alertCard}>
          {/* Alert Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={["#EF4444", "#DC2626"]}
              style={styles.iconGradient}
            >
              <Ionicons name="alarm" size={48} color="white" />
            </LinearGradient>
          </View>

          {/* Alert Content */}
          <View style={styles.content}>
            <Text style={styles.title}>Time's Up!</Text>
            <Text style={styles.subtitle}>Level {currentLevel} Complete</Text>

            {nextBlindLevel && (
              <View style={styles.nextLevelContainer}>
                <Text style={styles.nextLevelTitle}>Next Level Blinds:</Text>
                <View style={styles.nextLevelBlinds}>
                  <Text style={styles.nextLevelText}>
                    SB: {nextBlindLevel.small}
                  </Text>
                  <View style={styles.blindDivider} />
                  <Text style={styles.nextLevelText}>
                    BB: {nextBlindLevel.big}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Dismiss Button */}
            <TouchableOpacity
              style={[styles.button, styles.dismissButton]}
              onPress={onDismiss}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle" size={20} color="white" />
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>

            {/* Next Blinds Button */}
            <TouchableOpacity
              style={[styles.button, styles.nextButton]}
              onPress={onNextBlinds}
              activeOpacity={0.8}
            >
              <Ionicons name="play-circle" size={20} color="white" />
              <Text style={styles.nextButtonText}>Next Blinds</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Optional: Blow Animation Component (you can implement or remove)
function BlowAnimationView({ style }: { style?: any }) {
  return <View style={style} />;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  pulseContainer: {
    position: "absolute",
    width: width,
    height: height,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseBackground: {
    position: "absolute",
    borderRadius: width / 2,
  },
  pulseGradient: {
    width: "100%",
    height: "100%",
    borderRadius: width / 2,
  },
  pulse1: {
    width: width * 0.8,
    height: width * 0.8,
  },
  pulse2: {
    width: width * 1.2,
    height: width * 1.2,
  },
  alertCard: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    maxWidth: width * 0.9,
    width: "100%",
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 24,
    textAlign: "center",
  },
  nextLevelContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    width: "100%",
  },
  nextLevelTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  nextLevelBlinds: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  nextLevelText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2563EB",
  },
  blindDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#D1D5DB",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  dismissButton: {
    backgroundColor: "#6B7280",
  },
  dismissButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  nextButton: {
    backgroundColor: "#10B981",
  },
  nextButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default TimerExpirationAlert;
