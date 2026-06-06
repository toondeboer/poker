import { useCallback, useRef } from "react";

/**
 * Web Audio beep used to signal a blind change. The audio context must be
 * created/resumed from a user gesture (browser autoplay policy), so call
 * `initializeAudio()` from a click handler before relying on `playBeep()`.
 */
export function useWebAudio() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const initializeAudio = useCallback(async () => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      const context = audioContextRef.current;
      if (context.state === "suspended") {
        await context.resume();
      }

      if (!audioBufferRef.current) {
        const { sampleRate } = context;
        const duration = 0.5;
        const buffer = context.createBuffer(
          1,
          sampleRate * duration,
          sampleRate,
        );
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < channelData.length; i++) {
          const t = i / sampleRate;
          channelData[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 2);
        }
        audioBufferRef.current = buffer;
      }
    } catch (error) {
      console.warn("Audio initialization failed:", error);
    }
  }, []);

  const playBeep = useCallback(() => {
    const context = audioContextRef.current;
    const buffer = audioBufferRef.current;
    if (!context || !buffer) return;
    try {
      const source = context.createBufferSource();
      const gainNode = context.createGain();
      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(context.destination);
      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
      source.start(context.currentTime);
      source.stop(context.currentTime + 0.5);
    } catch (error) {
      console.warn("Audio playback failed:", error);
    }
  }, []);

  return { initializeAudio, playBeep };
}
