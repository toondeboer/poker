// src/hooks/useTimerAlert.ts
import { useEffect, useRef, useState } from "react";
import { Sound, useSounds } from "@/src/hooks/useSounds";

/**
 * Owns the timer-expiry alert + alarm sound. Showing the alert and playing the
 * alarm are one concern (show ⇒ start alarm, clear ⇒ stop alarm), kept out of
 * the TimerContext composition root.
 */
export function useTimerAlert() {
  const { playSound, stopSound, isLoaded } = useSounds(Sound.ALARM);
  const [showTimerAlert, setShowTimerAlert] = useState(false);
  const alarmPlayingRef = useRef(false);

  /** Show the alert; optionally start the alarm (foreground expiry). */
  const showAlert = async (withAlarm: boolean) => {
    if (withAlarm && isLoaded) {
      await playSound();
      alarmPlayingRef.current = true;
    }
    setShowTimerAlert(true);
  };

  /** Hide the alert and stop the alarm if it's playing. Idempotent. */
  const clearAlert = async () => {
    setShowTimerAlert(false);
    if (alarmPlayingRef.current) {
      await stopSound();
      alarmPlayingRef.current = false;
    }
  };

  // Stop a still-playing alarm if the owner unmounts.
  useEffect(() => {
    return () => {
      if (alarmPlayingRef.current) {
        stopSound();
      }
    };
  }, [stopSound]);

  return { showTimerAlert, isAlarmLoaded: isLoaded, showAlert, clearAlert };
}
