import { useEffect, useState } from "react";
import { Audio } from "expo-av";

export enum Sound {
  ALARM = require("../assets/sounds/alarm.mp3"),
}

export const useSounds = (soundType: Sound) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // Load sounds on component mount.
  useEffect(() => {
    const loadSounds = async () => {
      const sound = await Audio.Sound.createAsync(soundType);

      setSound(sound.sound);
    };
    loadSounds();

    return () => {
      // Unload sounds on component unmount.
      sound?.unloadAsync();
    };
  }, []);

  // Function to replay the sound.
  const playSound = async () => {
    if (sound) {
      await sound.replayAsync();
    }
  };

  return { playSound };
};
