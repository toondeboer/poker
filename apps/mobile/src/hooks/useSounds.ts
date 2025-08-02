// src/hooks/useSounds.ts
import { useCallback, useEffect, useState } from "react";
import { Audio } from "expo-av";

export enum Sound {
  ALARM = require("../assets/sounds/alarm.mp3"),
}

export const useSounds = (soundType: Sound) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Configure audio session
  const configureAudio = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        interruptionModeIOS: 1, // INTERRUPTION_MODE_IOS_DO_NOT_MIX
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1, // INTERRUPTION_MODE_ANDROID_DO_NOT_MIX
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });
    } catch (error) {
      console.warn("Failed to configure audio:", error);
    }
  }, []);

  // Load sounds on component mount
  useEffect(() => {
    const loadSounds = async () => {
      try {
        // Configure audio first
        await configureAudio();

        // Load the sound
        const { sound: loadedSound } = await Audio.Sound.createAsync(
          soundType,
          {
            shouldPlay: false,
            isLooping: false,
            volume: 1.0,
          },
        );

        setSound(loadedSound);
        setIsLoaded(true);
      } catch (error) {
        console.error("Failed to load sound:", error);
        setIsLoaded(false);
      }
    };

    loadSounds();

    return () => {
      // Cleanup on unmount
      if (sound) {
        sound.unloadAsync().catch(console.error);
      }
    };
  }, [soundType, configureAudio]);

  // Function to play the sound
  const playSound = useCallback(async () => {
    if (!sound || !isLoaded) {
      console.warn("Sound not loaded, cannot play");
      return;
    }

    try {
      // Ensure audio is configured
      await configureAudio();

      // Reset to beginning and play
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch (error) {
      console.error("Failed to play sound:", error);
    }
  }, [sound, isLoaded, configureAudio]);

  // Function to stop the sound
  const stopSound = useCallback(async () => {
    if (!sound || !isLoaded) {
      return;
    }

    try {
      await sound.stopAsync();
    } catch (error) {
      console.error("Failed to stop sound:", error);
    }
  }, [sound, isLoaded]);

  return {
    playSound,
    stopSound,
    isLoaded,
    sound,
  };
};
