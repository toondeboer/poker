"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { nextBlindIndex, progress } from "@poker/core";
import { useWebBlinds } from "@/hooks/useWebBlinds";
import { useWebTimer } from "@/hooks/useWebTimer";
import { useWebAudio } from "@/hooks/useWebAudio";
import { useWebNotifications } from "@/hooks/useWebNotifications";
import { TimerDisplay } from "./TimerDisplay";
import { CurrentBlinds } from "./CurrentBlinds";
import { TimerControls } from "./TimerControls";
import { BlindsSchedule } from "./BlindsSchedule";
import { SettingsPanel } from "./SettingsPanel";
import TipJar from "@/app/components/TipJar";
import AdSlot from "@/components/ads/AdSlot";
import { ADSENSE_SLOT_TIMER } from "@/lib/monetization";

export default function PokerTimer() {
  const blinds = useWebBlinds();
  const audio = useWebAudio();
  const notifications = useWebNotifications();
  const [showSettings, setShowSettings] = useState(false);

  const handleExpire = useCallback(() => {
    const upcoming =
      blinds.blindLevels[
        nextBlindIndex(blinds.currentBlindIndex, blinds.blindLevels)
      ];
    audio.playBeep();
    if (upcoming) {
      notifications.speak(`Blinds are now ${upcoming.small}, ${upcoming.big}`);
      notifications.notify(
        "Blinds up!",
        `New blinds: ${upcoming.small} / ${upcoming.big}`,
      );
    }
    blinds.goToNextBlind();
  }, [blinds, audio, notifications]);

  const timer = useWebTimer({ onExpire: handleExpire });

  const handleToggle = useCallback(async () => {
    // Audio + notification permissions must be primed from a user gesture.
    await audio.initializeAudio();
    void notifications.requestPermission();
    timer.toggle();
  }, [audio, notifications, timer]);

  const current = blinds.blindLevels[blinds.currentBlindIndex];
  const next = blinds.blindLevels[blinds.currentBlindIndex + 1];

  // Background shifts from a calm green to an alert red as the round runs down.
  const elapsed = progress(timer.timeLeft, timer.timerDuration);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * elapsed);
  const r = lerp(16, 96);
  const g = lerp(74, 28);
  const b = lerp(54, 32);
  const background = `linear-gradient(160deg, rgb(${r + 12}, ${g + 14}, ${
    b + 12
  }) 0%, rgb(${r}, ${g}, ${b}) 55%, rgb(${Math.max(0, r - 10)}, ${Math.max(
    0,
    g - 8,
  )}, ${Math.max(0, b - 6)}) 100%)`;

  return (
    <div
      className="min-h-screen w-full text-white transition-[background] duration-1000"
      style={{ background }}
    >
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 lg:px-8">
        <header className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-white/70 transition-colors hover:text-white"
          >
            ← Poker Blinds Buzzer
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <TipJar />
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm transition-colors hover:bg-white/10"
            >
              <Settings className="h-4 w-4" /> Settings
            </button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1fr_22rem]">
          <main className="flex flex-col items-center justify-center gap-10">
            <TimerDisplay
              timeLeft={timer.timeLeft}
              duration={timer.timerDuration}
              level={blinds.currentBlindIndex}
              total={blinds.blindLevels.length}
            />
            {current && <CurrentBlinds current={current} next={next} />}
            <TimerControls
              isRunning={timer.isRunning}
              onToggle={handleToggle}
              onReset={timer.reset}
              onPrev={blinds.goToPreviousBlind}
              onNext={blinds.goToNextBlind}
              canPrev={blinds.currentBlindIndex > 0}
              canNext={blinds.currentBlindIndex < blinds.blindLevels.length - 1}
            />
          </main>

          <aside className="lg:py-4">
            <BlindsSchedule
              levels={blinds.blindLevels}
              current={blinds.currentBlindIndex}
              onSelect={blinds.selectBlind}
            />
            <AdSlot slot={ADSENSE_SLOT_TIMER} className="mt-6" />
          </aside>
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          durationSeconds={timer.timerDuration}
          onApplyDuration={(value) => {
            timer.changeDuration(value);
            setShowSettings(false);
          }}
          customBlindLevels={blinds.customBlindLevels}
          onAddLevel={blinds.addLevel}
          onRemoveLevel={blinds.removeLevel}
          onUpdateLevel={blinds.updateLevel}
          onApplyBlinds={() => {
            blinds.applyCustomBlindLevels();
            setShowSettings(false);
          }}
          onResetBlinds={blinds.resetToDefaultBlinds}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
