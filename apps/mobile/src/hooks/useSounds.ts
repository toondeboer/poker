// src/hooks/useSounds.ts
import { logger } from "@/src/utils/logger";
import { useCallback, useEffect } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import type { SoundPackId } from "@poker/core";

export enum Sound {
  ALARM = require("../assets/sounds/alarm.mp3"),
  CLASSIC_BEEP = require("../assets/sounds/classic_beep.wav"),
  BELL_CHIME = require("../assets/sounds/bell_chime.wav"),
  DOUBLE_BUZZ = require("../assets/sounds/double_buzz.wav"),
}

/** Maps a persisted {@link SoundPackId} to the bundled asset that plays it. */
export const SOUND_BY_PACK_ID: Record<SoundPackId, Sound> = {
  alarm: Sound.ALARM,
  classic_beep: Sound.CLASSIC_BEEP,
  bell_chime: Sound.BELL_CHIME,
  double_buzz: Sound.DOUBLE_BUZZ,
};

export const useSounds = (soundType: Sound) => {
  // `useAudioPlayer` loads the source and releases the native player on unmount,
  // so there's no manual load/unload bookkeeping (unlike the old expo-av hook).
  const player = useAudioPlayer(soundType);
  const status = useAudioPlayerStatus(player);

  const isLoaded = status.isLoaded;
  const isPlaying = status.playing;

  // Configure audio session for foreground playback only.
  const configureAudio = useCallback(async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        interruptionMode: "doNotMix",
        playsInSilentMode: true, // Play even if device is in silent mode
        interruptionModeAndroid: "doNotMix",
        shouldRouteThroughEarpiece: false,
        shouldPlayInBackground: false,
      });
    } catch (error) {
      logger.warn("Failed to configure audio:", error);
    }
  }, []);

  // Configure the audio session once on mount.
  useEffect(() => {
    configureAudio();
  }, [configureAudio]);

  // Function to play the sound (foreground only)
  const playSound = useCallback(async () => {
    if (!isLoaded) {
      logger.warn("Sound not loaded, cannot play");
      return;
    }

    try {
      // Ensure audio is configured for foreground playback
      await configureAudio();

      // Reset to beginning and play
      await player.seekTo(0);
      player.play();
      logger.log("Alarm sound played");
    } catch (error) {
      logger.error("Failed to play sound:", error);
    }
  }, [player, isLoaded, configureAudio]);

  // Function to stop the sound (pause + rewind; expo-audio has no stop())
  const stopSound = useCallback(async () => {
    if (!isLoaded) {
      logger.warn("Sound not loaded, cannot stop");
      return;
    }

    try {
      player.pause();
      await player.seekTo(0);
      logger.log("Sound stopped");
    } catch (error) {
      logger.error("Failed to stop sound:", error);
    }
  }, [player, isLoaded]);

  // Function to pause the sound
  const pauseSound = useCallback(async () => {
    if (!isLoaded) {
      logger.warn("Sound not loaded, cannot pause");
      return;
    }

    try {
      player.pause();
      logger.log("Sound paused");
    } catch (error) {
      logger.error("Failed to pause sound:", error);
    }
  }, [player, isLoaded]);

  return {
    playSound,
    stopSound,
    pauseSound,
    isLoaded,
    isPlaying,
    sound: player,
  };
};
