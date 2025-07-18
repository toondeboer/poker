import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSounds } from "@/hooks/useSounds";
import { useBlinds } from "@/hooks/useBlinds";
import { useTimer } from "@/hooks/useTimer"; // Adjust the import path as necessary

function interpolateColor(percent: number) {
  // percent: 1 (full time) => pastel green, 0 (no time) => pastel red
  const r = Math.round((255 * (1 - percent) + 255) / 2);
  const g = Math.round((255 * percent + 255) / 2);
  const b = Math.round(255 / 2); // blending with white gives a soft yellowish tone
  return `rgb(${r},${g},${b})`;
}

export default function PokerTimer() {
  const { smallBlind, bigBlind, increaseBlinds, decreaseBlinds, setBlinds } =
    useBlinds();
  const { startSound, pauseSound, resetSound, alarmSound } = useSounds();
  const { timeLeft, TIMER_DURATION, paused, togglePause, resetTimer } =
    useTimer(alarmSound);

  const handleIncreaseBlinds = () => {
    increaseBlinds();
  };

  const handleDecreaseTimer = () => {
    decreaseBlinds();
  };

  // Toggle pause state.
  const handleTogglePause = async () => {
    togglePause();
    if (paused) {
      await startSound?.replayAsync();
    } else {
      await pauseSound?.replayAsync();
    }
  };

  // Reset timer to its initial value.
  const handleResetTimer = async () => {
    resetTimer();
    await resetSound?.replayAsync();
  };

  const percent = Math.max(0, timeLeft) / TIMER_DURATION;
  const backgroundColor = interpolateColor(percent);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={styles.text}>Small Blind: {smallBlind}</Text>
      <Text style={styles.text}>Big Blind: {bigBlind}</Text>
      <Text style={styles.timerText}>Time Left: {timeLeft}s</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => handleIncreaseBlinds()}
      >
        <Text style={styles.buttonText}>Increase Blinds</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={handleDecreaseTimer}>
        <Text style={styles.buttonText}>Decrease Blinds</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={() => handleTogglePause()}
      >
        <Text style={styles.buttonText}>
          {paused ? "Resume" : "Pause"} Timer
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={() => handleResetTimer()}
      >
        <Text style={styles.buttonText}>Reset Timer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 24, margin: 10 },
  timerText: { fontSize: 20, margin: 10, color: "red" },
  button: {
    backgroundColor: "#2196F3",
    padding: 10,
    borderRadius: 5,
    margin: 20,
  },
  buttonText: { color: "#fff", fontSize: 18 },
});
