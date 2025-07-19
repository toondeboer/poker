import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { useTimer } from "@/src/contexts/TimerContext";

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

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Timer Duration (seconds)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={durationSetting}
        onChangeText={setDurationSetting}
      />
      <TouchableOpacity style={styles.button} onPress={handleSaveTimer}>
        <Text style={styles.buttonText}>Save Settings</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Blind Levels</Text>

      {customBlindLevels.map((level, index) => (
        <View key={index} style={{ marginBottom: 10 }}>
          <Text>Level {index + 1}</Text>
          <Text>Small Blind:</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={customBlindLevels[index].small.toString()}
            onChangeText={(text) => {
              updateBlindLevel(index, "small", Number(text));
            }}
          />
          <Text>Big Blind:</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={customBlindLevels[index].big.toString()}
            onChangeText={(text) => {
              updateBlindLevel(index, "big", Number(text));
            }}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              removeBlindLevel(index);
            }}
          >
            <Text style={styles.buttonText}>Remove Blind Level</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          addBlindLevel();
        }}
      >
        <Text style={styles.buttonText}>Add Blind Level</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={resetToDefaultBlinds}>
        <Text style={styles.buttonText}>Reset to default blinds</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleSaveBlinds}>
        <Text style={styles.buttonText}>Save Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
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
    marginBottom: 20,
  },
  buttonText: { color: "#fff", fontSize: 18 },
});
