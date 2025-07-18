import { useEffect, useState } from "react";
import { Audio } from "expo-av";

export const useSounds = () => {
  // Sound objects.
  const [startSound, setStartSound] = useState<Audio.Sound | null>(null);
  const [pauseSound, setPauseSound] = useState<Audio.Sound | null>(null);
  const [resetSound, setResetSound] = useState<Audio.Sound | null>(null);
  const [alarmSound, setAlarmSound] = useState<Audio.Sound | null>(null);

  // Load sounds on component mount.
  useEffect(() => {
    const loadSounds = async () => {
      const start = await Audio.Sound.createAsync(
        require("../assets/sounds/alarm.mp3"),
      );
      const pause = await Audio.Sound.createAsync(
        require("../assets/sounds/alarm.mp3"),
      );
      const reset = await Audio.Sound.createAsync(
        require("../assets/sounds/alarm.mp3"),
      );
      const alarm = await Audio.Sound.createAsync(
        require("../assets/sounds/alarm.mp3"),
      );
      setStartSound(start.sound);
      setPauseSound(pause.sound);
      setResetSound(reset.sound);
      setAlarmSound(alarm.sound);
    };
    loadSounds();

    return () => {
      // Unload sounds on component unmount.
      startSound?.unloadAsync();
      pauseSound?.unloadAsync();
      resetSound?.unloadAsync();
      alarmSound?.unloadAsync();
    };
  }, []);

  return { startSound, pauseSound, resetSound, alarmSound };
};
