import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Settings,
  Bell,
} from "lucide-react";

interface BlindLevel {
  small: number;
  big: number;
}

const PokerTimer: React.FC = () => {
  const [timerDuration, setTimerDuration] = useState<number>(5);
  const [customMinutes, setCustomMinutes] = useState<number>(15);
  const [customSeconds, setCustomSeconds] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(timerDuration);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentBlindIndex, setCurrentBlindIndex] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showBlindSettings, setShowBlindSettings] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");
  const [audioReady, setAudioReady] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const generateBlindLevels = (): BlindLevel[] => {
    const levels: BlindLevel[] = [];
    for (let i = 5; i <= 30; i += 5) levels.push({ small: i, big: i * 2 });
    for (let i = 40; i <= 100; i += 10) levels.push({ small: i, big: i * 2 });
    for (let i = 125; i <= 250; i += 25) levels.push({ small: i, big: i * 2 });
    for (let i = 300; i <= 800; i += 50) levels.push({ small: i, big: i * 2 });
    return levels;
  };

  const [blindLevels, setBlindLevels] = useState<BlindLevel[]>(
    generateBlindLevels(),
  );
  const [customBlindLevels, setCustomBlindLevels] = useState<BlindLevel[]>(
    generateBlindLevels(),
  );

  // Detect iOS and standalone mode
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const iosDetected = /ipad|iphone|ipod/.test(userAgent);
    const standaloneDetected =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    setIsIOS(iosDetected);
    setIsStandalone(standaloneDetected);

    // Check notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Initialize audio context and create audio buffer
  const initializeAudio = async () => {
    try {
      // Use webkitAudioContext for iOS Safari compatibility
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const context = audioContextRef.current;

      // Resume context if suspended (required for iOS)
      if (context.state === "suspended") {
        await context.resume();
      }

      // Create a simple beep sound buffer
      if (!audioBufferRef.current) {
        const sampleRate = context.sampleRate;
        const duration = 0.5; // 500ms
        const buffer = context.createBuffer(
          1,
          sampleRate * duration,
          sampleRate,
        );
        const channelData = buffer.getChannelData(0);

        // Generate a beep sound
        for (let i = 0; i < channelData.length; i++) {
          const t = i / sampleRate;
          channelData[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 2);
        }

        audioBufferRef.current = buffer;
      }

      setAudioReady(true);
    } catch (error) {
      console.warn("Audio initialization failed:", error);
    }
  };

  // Play audio notification
  const playAudioNotification = () => {
    if (!audioReady || !audioContextRef.current || !audioBufferRef.current) {
      return;
    }

    try {
      const context = audioContextRef.current;
      const source = context.createBufferSource();
      const gainNode = context.createGain();

      source.buffer = audioBufferRef.current;
      source.connect(gainNode);
      gainNode.connect(context.destination);

      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        context.currentTime + 0.5,
      );

      source.start(context.currentTime);
      source.stop(context.currentTime + 0.5);
    } catch (error) {
      console.warn("Audio playback failed:", error);
    }
  };

  // Enhanced speech synthesis for iOS
  const speakAnnouncement = (text: string) => {
    if (!("speechSynthesis" in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      // For iOS, we need to select a voice explicitly
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (voice) => voice.lang.startsWith("en") && voice.localService,
        ) ||
        voices.find((voice) => voice.lang.startsWith("en")) ||
        voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    };

    // iOS Safari requires voices to be loaded
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        speak();
        window.speechSynthesis.onvoiceschanged = null;
      };
      // Fallback timeout
      setTimeout(speak, 100);
    } else {
      speak();
    }
  };

  // Show browser notification
  const showNotification = (title: string, body: string) => {
    // Only show notifications in standalone mode on iOS or if permission is granted
    if (isIOS && !isStandalone) {
      return;
    }

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "poker-timer",
          requireInteraction: true,
          silent: false,
        });
      } catch (error) {
        console.warn("Notification failed:", error);
      }
    }
  };

  // Timer effect
  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timeRemaining]);

  // Handle timer expiration
  useEffect(() => {
    if (timeRemaining === 0) {
      const nextLevel =
        blindLevels[Math.min(currentBlindIndex + 1, blindLevels.length - 1)];
      const announcementText = `Timer expired! New blind level: ${nextLevel.small} ${nextLevel.big}`;

      // Play audio notification
      playAudioNotification();

      // Speak announcement
      speakAnnouncement(announcementText);

      // Show notification
      showNotification(
        "Poker Timer Expired!",
        `New blind level: ${nextLevel.small}/${nextLevel.big}`,
      );

      // Move to next blind level
      setCurrentBlindIndex((prev) =>
        Math.min(prev + 1, blindLevels.length - 1),
      );
      setTimeRemaining(timerDuration);
    }
  }, [timeRemaining, currentBlindIndex, blindLevels, timerDuration]);

  const toggleTimer = async () => {
    if (!audioReady) {
      await initializeAudio();
    }

    // Request notification permission if not granted
    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }

    // Prime speech synthesis on iOS
    if (isIOS && !isRunning) {
      try {
        const utterance = new SpeechSynthesisUtterance(" ");
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.warn("Speech synthesis priming failed:", error);
      }
    }

    setIsRunning((prev) => !prev);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getBackgroundColor = (): string => {
    const progress = (timerDuration - timeRemaining) / timerDuration;
    const red = Math.round(144 + (255 - 144) * progress);
    const green = Math.round(238 - (238 - 144) * progress);
    const blue = Math.round(144 - 144 * progress);
    return `rgb(${red}, ${green}, ${blue})`;
  };

  const resetTimer = () => {
    setTimeRemaining(timerDuration);
    setIsRunning(false);
  };

  const goToPreviousBlind = () => {
    setCurrentBlindIndex((prev) => Math.max(prev - 1, 0));
  };

  const goToNextBlind = () => {
    setCurrentBlindIndex((prev) => Math.min(prev + 1, blindLevels.length - 1));
  };

  const applyCustomTimer = () => {
    const newDuration = customMinutes * 60 + customSeconds;
    setTimerDuration(newDuration);
    setTimeRemaining(newDuration);
    setIsRunning(false);
    setShowSettings(false);
    setShowBlindSettings(false);
  };

  const addBlindLevel = () => {
    setCustomBlindLevels([...customBlindLevels, { small: 10, big: 20 }]);
  };

  const removeBlindLevel = (index: number) => {
    if (customBlindLevels.length > 1) {
      const newLevels = customBlindLevels.filter((_, i) => i !== index);
      setCustomBlindLevels(newLevels);
    }
  };

  const updateBlindLevel = (
    index: number,
    field: "small" | "big",
    value: number,
  ) => {
    const newLevels = [...customBlindLevels];
    newLevels[index][field] = value;
    setCustomBlindLevels(newLevels);
  };

  const applyCustomBlindLevels = () => {
    setBlindLevels([...customBlindLevels]);
    setCurrentBlindIndex(0);
    setShowBlindSettings(false);
  };

  const resetToDefaultBlinds = () => {
    const defaultLevels = generateBlindLevels();
    setCustomBlindLevels(defaultLevels);
    setBlindLevels(defaultLevels);
    setCurrentBlindIndex(0);
  };

  const currentBlind = blindLevels[currentBlindIndex];
  const nextBlind =
    blindLevels[Math.min(currentBlindIndex + 1, blindLevels.length - 1)];

  return (
    <div
      className="min-h-screen transition-colors duration-1000 p-4 flex flex-col items-center justify-center"
      style={{ backgroundColor: getBackgroundColor() }}
    >
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Poker Timer</h1>
          <div className="text-6xl font-mono font-bold text-gray-900 mb-4">
            {formatTime(timeRemaining)}
          </div>
          <div className="text-sm text-gray-600">
            Level {currentBlindIndex + 1} of {blindLevels.length}
          </div>
        </div>

        {/* iOS Safari PWA Notice */}
        {isIOS && !isStandalone && (
          <div className="mb-4 p-3 bg-blue-100 border border-blue-400 rounded-md">
            <div className="text-sm text-blue-800">
              <strong>iOS Tip:</strong> For full functionality including
              notifications, tap the Share button and select "Add to Home
              Screen"
            </div>
          </div>
        )}

        <div className="bg-gray-100 rounded-lg p-4 mb-6 text-center">
          <div className="text-sm text-gray-600 mb-1">Current Blinds</div>
          <div className="text-2xl font-bold text-gray-800">
            {currentBlind.small} / {currentBlind.big}
          </div>
          {currentBlindIndex < blindLevels.length - 1 && (
            <div className="text-sm text-gray-500 mt-2">
              Next: {nextBlind.small} / {nextBlind.big}
            </div>
          )}
        </div>

        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={toggleTimer}
            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full transition-colors"
          >
            {isRunning ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button
            onClick={resetTimer}
            className="bg-gray-500 hover:bg-gray-600 text-white p-3 rounded-full transition-colors"
          >
            <RotateCcw size={24} />
          </button>
          <button
            onClick={() => {
              setShowSettings(!showSettings);
              if (showSettings) setShowBlindSettings(false);
            }}
            className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-full transition-colors"
          >
            <Settings size={24} />
          </button>
        </div>

        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={goToPreviousBlind}
            disabled={currentBlindIndex === 0}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-2 rounded-full transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm text-gray-600 flex items-center px-4">
            Blind Level
          </span>
          <button
            onClick={goToNextBlind}
            disabled={currentBlindIndex === blindLevels.length - 1}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-2 rounded-full transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {showSettings && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold mb-4">Timer Settings</h3>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minutes
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={customMinutes}
                  onChange={(e) =>
                    setCustomMinutes(parseInt(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seconds
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={customSeconds}
                  onChange={(e) =>
                    setCustomSeconds(parseInt(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <button
              onClick={applyCustomTimer}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md mb-4"
            >
              Apply Timer Duration
            </button>
            <button
              onClick={() => setShowBlindSettings(!showBlindSettings)}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-md"
            >
              {showBlindSettings ? "Hide" : "Customize"} Blind Levels
            </button>

            {(!isIOS || isStandalone) &&
              notificationPermission !== "granted" && (
                <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell size={16} />
                    <span className="text-sm text-yellow-800">
                      Enable notifications for timer alerts
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      Notification.requestPermission().then(
                        setNotificationPermission,
                      )
                    }
                    className="bg-yellow-400 hover:bg-yellow-500 text-white py-1 px-3 rounded text-sm"
                  >
                    Enable Notifications
                  </button>
                </div>
              )}
          </div>
        )}

        {showBlindSettings && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-80 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Blind Levels</h3>
              <div className="flex gap-2">
                <button
                  onClick={resetToDefaultBlinds}
                  className="text-xs bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded"
                >
                  Reset to Default
                </button>
                <button
                  onClick={addBlindLevel}
                  className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                >
                  Add Level
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {customBlindLevels.map((level, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-white rounded border"
                >
                  <span className="text-sm font-medium min-w-[30px]">
                    {index + 1}.
                  </span>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="1"
                      value={level.small}
                      onChange={(e) =>
                        updateBlindLevel(
                          index,
                          "small",
                          parseInt(e.target.value) || 1,
                        )
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <span className="text-sm text-gray-500">/</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="1"
                      value={level.big}
                      onChange={(e) =>
                        updateBlindLevel(
                          index,
                          "big",
                          parseInt(e.target.value) || 1,
                        )
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  {customBlindLevels.length > 1 && (
                    <button
                      onClick={() => removeBlindLevel(index)}
                      className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={applyCustomBlindLevels}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded"
            >
              Apply Blind Levels
            </button>
          </div>
        )}

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
            style={{
              width: `${((timerDuration - timeRemaining) / timerDuration) * 100}%`,
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default PokerTimer;
