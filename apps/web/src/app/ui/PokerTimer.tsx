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
  const [timerDuration, setTimerDuration] = useState<number>(8 * 60); // 8 minutes default
  const [customMinutes, setCustomMinutes] = useState<number>(15);
  const [customSeconds, setCustomSeconds] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(timerDuration);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentBlindIndex, setCurrentBlindIndex] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showBlindSettings, setShowBlindSettings] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate blind levels according to the specified pattern
  const generateBlindLevels = (): BlindLevel[] => {
    const levels: BlindLevel[] = [];

    // 5/10 to 30/60 (increase by 5/10)
    for (let i = 5; i <= 30; i += 5) {
      levels.push({ small: i, big: i * 2 });
    }

    // 40/80 to 100/200 (increase by 10/20)
    for (let i = 40; i <= 100; i += 10) {
      levels.push({ small: i, big: i * 2 });
    }

    // 125/250 onwards (increase by 25/50)
    for (let i = 125; i <= 250; i += 25) {
      levels.push({ small: i, big: i * 2 });
    }

    // 300/600 onwards (increase by 25/50)
    for (let i = 300; i <= 800; i += 50) {
      levels.push({ small: i, big: i * 2 });
    }

    return levels;
  };

  const [blindLevels, setBlindLevels] = useState<BlindLevel[]>(
    generateBlindLevels(),
  );
  const [customBlindLevels, setCustomBlindLevels] = useState<BlindLevel[]>(
    generateBlindLevels(),
  );

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // Create audio context for alarm
  useEffect(() => {
    // Create a simple beep sound using Web Audio API
    const createBeepSound = () => {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 1,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);
    };

    audioRef.current = { play: createBeepSound } as any;
  }, []);

  // Timer logic
  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeRemaining]);

  useEffect(() => {
    if (timeRemaining === 0) {
      // Play alarm sound
      if (audioRef.current) {
        audioRef.current.play();
      }

      // Show notification
      if (notificationPermission === "granted") {
        const nextLevel =
          blindLevels[Math.min(currentBlindIndex + 1, blindLevels.length - 1)];
        new Notification("Poker Timer Expired!", {
          body: `New blind level: ${nextLevel.small}/${nextLevel.big}`,
          icon: "/favicon.ico",
        });
      }

      // Speak announcement
      if ("speechSynthesis" in window) {
        const nextLevel =
          blindLevels[Math.min(currentBlindIndex + 1, blindLevels.length - 1)];
        const utterance = new SpeechSynthesisUtterance(
          `Timer expired! New blind level: ${nextLevel.small} ${nextLevel.big}`,
        );
        speechSynthesis.speak(utterance);
      }

      // Advance to next level and reset timer
      setCurrentBlindIndex((prevIndex) =>
        Math.min(prevIndex + 1, blindLevels.length - 1),
      );
      setTimeRemaining(timerDuration);
    }
  }, [timeRemaining]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getBackgroundColor = (): string => {
    const progress = (timerDuration - timeRemaining) / timerDuration;

    // Pastel green to pastel red gradient
    const red = Math.round(144 + (255 - 144) * progress); // From pastel green red component (144) to full red (255)
    const green = Math.round(238 - (238 - 144) * progress); // From pastel green (238) to pastel red (144)
    const blue = Math.round(144 - 144 * progress); // From pastel green/red blue component (144) to 0

    return `rgb(${red}, ${green}, ${blue})`;
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
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

        {/* Current Blind Level */}
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

        {/* Control Buttons */}
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
              if (showSettings) {
                setShowBlindSettings(false);
              }
            }}
            className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-full transition-colors"
          >
            <Settings size={24} />
          </button>
        </div>

        {/* Blind Level Controls */}
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

        {/* Settings Panel */}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={applyCustomTimer}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors mb-4"
            >
              Apply Timer Duration
            </button>

            <button
              onClick={() => setShowBlindSettings(!showBlindSettings)}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-md transition-colors"
            >
              {showBlindSettings ? "Hide" : "Customize"} Blind Levels
            </button>

            {notificationPermission !== "granted" && (
              <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded-md">
                <div className="flex items-center gap-2">
                  <Bell size={16} />
                  <span className="text-sm text-yellow-800">
                    Enable notifications for timer alerts
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Blind Settings Panel */}
        {showBlindSettings && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-80 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Blind Levels</h3>
              <div className="flex gap-2">
                <button
                  onClick={resetToDefaultBlinds}
                  className="text-xs bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
                >
                  Reset to Default
                </button>
                <button
                  onClick={addBlindLevel}
                  className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded transition-colors"
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
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Small"
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
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Big"
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
              className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-md transition-colors"
            >
              Apply Blind Levels
            </button>
          </div>
        )}

        {/* Progress Bar */}
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
