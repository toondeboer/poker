import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useBlinds } from "@/hooks/useBlinds";
import { useTimer } from "@/contexts/TimerContext";

export default function PokerSettings() {
  const { smallBlind, bigBlind, setBlinds } = useBlinds();
  const { timerDuration, setTimerDuration } = useTimer();

  const [smallBlindSetting, setSmallBlindSetting] = useState(
    String(smallBlind),
  );
  const [bigBlindSetting, setBigBlindSetting] = useState(String(bigBlind));
  const [durationSetting, setDurationSetting] = useState(String(timerDuration));

  const handleSave = () => {
    setBlinds(Number(smallBlindSetting), Number(bigBlindSetting));
    setTimerDuration(Number(durationSetting));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Small Blind</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={smallBlindSetting}
        onChangeText={setSmallBlindSetting}
      />
      <Text style={styles.label}>Big Blind</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={bigBlindSetting}
        onChangeText={setBigBlindSetting}
      />
      <Text style={styles.label}>Timer Duration (seconds)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={durationSetting}
        onChangeText={setDurationSetting}
      />
      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Save Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: "center" },
  label: { fontSize: 18, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    width: 120,
    padding: 8,
    marginVertical: 5,
    textAlign: "center",
    fontSize: 18,
  },
  button: {
    backgroundColor: "#2196F3",
    padding: 10,
    borderRadius: 5,
    marginTop: 20,
  },
  buttonText: { color: "#fff", fontSize: 18 },
});
