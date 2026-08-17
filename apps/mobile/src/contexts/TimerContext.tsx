// src/contexts/TimerContext.tsx
import { logger } from "@/src/utils/logger";
import React, {
  createContext,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import { DEFAULT_SOUND_PACK_ID } from "@poker/core";
import { useBlinds } from "@/src/contexts/BlindsContext";
import { useTimerNotification } from "@/src/hooks/useTimerNotification";
import { useTimerEngine } from "@/src/hooks/useTimerEngine";
import { useTimerAlert } from "@/src/hooks/useTimerAlert";
import { useKeepScreenAwake } from "@/src/hooks/useKeepScreenAwake";
import { useSoundPack } from "@/src/contexts/SoundPackContext";
import { useNotificationPermission } from "@/src/hooks/useNotificationPermission";
import { usePremium } from "@/src/contexts/PremiumContext";
import { liveActivityService } from "@/src/services/LiveActivityService";
import { recordRoundPlayed } from "@/src/services/reviewService";
import { useAppState } from "./AppStateContext";

type TimerContextType = {
  endTime?: number;
  timeLeft: number;
  timerDuration: number;
  setTimerDuration: (duration: number) => void;
  paused: boolean;
  togglePause: () => void;
  resetTimer: () => void;
  isLoading: boolean;
  // Alert state
  showTimerAlert: boolean;
  /**
   * Rounds' worth of time that passed beyond the one that ran out, before the
   * app was reopened to notice. Only one level advances regardless — this is
   * what lets the alert say so rather than presenting a long absence as an
   * ordinary round change.
   */
  missedRounds: number;
  dismissTimerAlert: () => void;
  handleNextBlinds: () => void;
  // Permission state
  hasNotificationPermission: boolean | null;
  requestNotificationPermission: () => Promise<boolean>;
  showPermissionAlert: () => void;
  // Background activity state
  isBackgroundActivitySupported: boolean;
};

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: Readonly<{ children: ReactNode }>) {
  const {
    increaseBlinds,
    currentBlindIndex,
    blindLevels,
    isLoading: isBlindsLoading,
  } = useBlinds();
  const { scheduleNotification, cancelNotification } = useTimerNotification();
  const { isActive, isBackground, isInactive } = useAppState();

  // Sound pack selection is a Pro feature — non-Pro users always get the
  // free default, regardless of what's persisted from a lapsed Pro session.
  const { isPremium } = usePremium();
  const { soundPackId } = useSoundPack();
  const effectiveSoundPackId = isPremium ? soundPackId : DEFAULT_SOUND_PACK_ID;

  // Expiry alert + alarm sound (own concern; see useTimerAlert).
  const { showTimerAlert, isAlarmLoaded, showAlert, clearAlert } =
    useTimerAlert(effectiveSoundPackId);

  const [isBackgroundActivitySupported, setIsBackgroundActivitySupported] =
    useState(false);

  // Permission handling
  const {
    hasPermission: hasNotificationPermission,
    requestPermission: requestNotificationPermission,
    showPermissionAlert,
  } = useNotificationPermission();

  // How many further rounds' worth of time had passed by the time the app noticed the round
  // ended — non-zero only when reopening onto an expiry that happened a while ago. The level
  // advances by exactly one either way (nothing counts rounds while the app isn't running); this
  // only decides whether the alert admits that time was lost. Cleared when the alert is.
  const [missedRounds, setMissedRounds] = useState(0);

  // Handle timer completion
  const handleTimerComplete = async (missed: number) => {
    // Read AppState directly here rather than trusting the cached `isActive` from
    // AppStateContext. That value only updates on a "change" event — if one is ever missed or
    // arrives out of order (a transient system dialog/notification/overlay stealing focus
    // momentarily, common on some OEM builds), `isActive` can get stuck reporting the wrong
    // value indefinitely, since nothing else re-syncs it. That would silently and permanently
    // flip every future expiry — even ones that happen while the user is clearly looking at the
    // app — onto the "background" branch below: no alert, no sound, straight to the next blind
    // level. AppState.currentState is a live getter, not an event cache, so it can't go stale.
    const isCurrentlyActive = AppState.currentState === "active";
    setMissedRounds(missed);
    try {
      // Foregrounded expiry always gets the alert, whether or not the alarm sound
      // is ready to play. `isAlarmLoaded` used to gate the alert itself, so an
      // expiry noticed before `useSounds` finished loading — very possible when
      // reopening onto a round that ran out, since that check happens right after
      // a storage read — took the silent background branch instead: the level
      // moved with no alert and no sound, which is indistinguishable from the app
      // losing your place. The sound is now the only thing conditional on it.
      if (isCurrentlyActive) {
        await showAlert(isAlarmLoaded);
        logger.log("Timer completed - showing alert", { missed, isAlarmLoaded });
      } else {
        logger.log(
          "App in background, skipping alarm sound and alert (background service will handle audio)",
        );
        // Auto-advance if in background
        increaseBlinds();
      }
    } catch (error) {
      logger.error("Failed to play completion sound:", error);
      // Still show alert even if sound fails
      if (isCurrentlyActive) {
        await showAlert(false);
      }
    } finally {
      // A blind level just ran out = one round played. Count it and, once
      // enough rounds are in, ask for a review. Foreground only (isActive) —
      // the OS won't show the sheet while backgrounded. Gated + throttled in
      // @poker/core.
      void recordRoundPlayed(isCurrentlyActive);
    }
  };

  const handleNotificationScheduling = async (
    paused: boolean,
    timeLeft: number,
  ) => {
    // Only handle notifications for iOS
    if (Platform.OS !== "ios") {
      logger.log(
        "Skipping notification scheduling on Android - handled by foreground service",
      );
      return;
    }

    if (paused) {
      await cancelNotification();
    } else {
      const nextBlindLevel = blindLevels[currentBlindIndex + 1];
      await scheduleNotification(
        timeLeft,
        nextBlindLevel,
        effectiveSoundPackId,
      );
    }
  };

  // Use the timer engine
  const {
    timerDuration,
    setTimerDuration,
    endTime,
    timeLeft,
    paused,
    togglePause: engineTogglePause,
    resetTimer: engineResetTimer,
    isLoading,
    loadTimerState,
  } = useTimerEngine(currentBlindIndex, blindLevels, effectiveSoundPackId, {
    onTimerComplete: handleTimerComplete,
  });

  // Keep the screen on for as long as a round is actually counting down, so a
  // tournament left on the table stays in the foreground instead of being locked
  // out into the single-round background fallback within its first level.
  useKeepScreenAwake(!paused && endTime !== undefined && timeLeft > 0);

  // Enhanced toggle pause with notification handling
  const togglePause = async () => {
    const newPaused = !paused; // Calculate before state change
    await engineTogglePause();
    // Handle notifications after pause state changes (iOS only)
    await handleNotificationScheduling(newPaused, timeLeft);
  };

  // Enhanced reset timer with notification handling
  const resetTimer = async () => {
    await engineResetTimer();
    // Only cancel notifications on iOS
    if (Platform.OS === "ios") {
      await cancelNotification();
    }
    // End background activity when timer is reset
    await liveActivityService.endActivity();
    // Dismiss alert and stop sound if active
    await clearAlert();
  };

  // Dismiss timer alert (advance to next blind level, keep timer paused, stop sound)
  const dismissTimerAlert = async () => {
    await clearAlert();
    setMissedRounds(0);

    // Advance to next blind level but keep timer paused
    increaseBlinds();
    // Timer will remain paused - user needs to manually start it
  };

  // Handle next blinds (advance blinds, start new timer, stop sound)
  const handleNextBlinds = async () => {
    await clearAlert();
    setMissedRounds(0);

    // Advance to next blind level and start timer
    increaseBlinds();

    // Start the new timer after a short delay to ensure blind level is updated
    setTimeout(async () => {
      await engineTogglePause(); // This will start the timer if it's paused
      await handleNotificationScheduling(false, timerDuration);
    }, 100);
  };

  // iOS's "time's up" notification is scheduled ahead of time and names the
  // *next* blind level, but it was only ever (re)built on pause/resume — so any
  // other change to the level or the schedule mid-round left it announcing a
  // blind that is no longer next. Pre-existing for the timer's Previous/Next
  // buttons; jumping levels from the blind editor makes it obvious.
  //
  // Keyed on exactly what the notification says, so editing a level the player
  // has already passed doesn't pointlessly reschedule.
  const nextLevel = blindLevels[currentBlindIndex + 1];
  const notificationKey = `${currentBlindIndex}:${nextLevel?.small ?? "-"}/${nextLevel?.big ?? "-"}`;
  const lastNotificationKeyRef = useRef<string | null>(null);
  // Read the remaining time through a ref so the effect below isn't in the
  // dependency list of a value that changes every second. Written in its own
  // effect rather than during render — a ref must not be touched while
  // rendering (react-hooks/refs).
  const timeLeftRef = useRef(timeLeft);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    if (Platform.OS !== "ios" || isLoading) return;

    const previous = lastNotificationKeyRef.current;
    lastNotificationKeyRef.current = notificationKey;
    // Skip the first pass: nothing has changed yet, and pause/resume owns the
    // initial scheduling.
    if (previous === null || previous === notificationKey) return;

    // Only a running round has a pending notification worth correcting; a
    // paused or finished one has none scheduled.
    if (paused || !endTime || timeLeftRef.current <= 0) return;

    void handleNotificationScheduling(false, timeLeftRef.current);
    // `handleNotificationScheduling` is redefined every render; the key guard
    // above is what actually decides whether this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationKey, paused, endTime, isLoading]);

  // Check if background activities are supported
  useEffect(() => {
    const checkBackgroundSupport = async () => {
      const isSupported = liveActivityService.isDeviceSupported();
      setIsBackgroundActivitySupported(isSupported);

      if (isSupported && Platform.OS === "android") {
        // Actually prompt for POST_NOTIFICATIONS on Android 13+ — not just check.
        // The foreground service shows the timer notification and plays the
        // expiry alarm/vibration while backgrounded, and it refuses to start
        // without this permission (see LiveActivityService.isEnabled).
        const granted = await requestNotificationPermission();
        if (!granted) {
          logger.warn(
            "Background activity available but notification permission denied",
          );
        }
      }
    };

    checkBackgroundSupport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle app state changes. `loadTimerState` has an unstable identity (it's
  // recreated every render), so this effect re-runs every second while the timer
  // ticks. Only reload on an actual background→foreground transition — otherwise
  // we'd reload timer state from storage once per second, which (among other
  // things) clobbers a just-applied reset with the previously persisted value.
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    const cameToForeground = isActive && !wasActiveRef.current;
    // Edge-triggered (just transitioned away from active), not level-triggered (currently
    // reports non-active). This effect also re-runs the instant `showTimerAlert` flips true
    // (it's in the deps below) — a level-triggered check here would auto-dismiss+advance the
    // alert the moment it appears if isBackground/isInactive simply *happened* to already be
    // true on that render (e.g. a stale/stuck AppState flag, or the app genuinely still settling
    // right at expiry), even though nothing actually just backgrounded. That reads to the user
    // as "no alert ever showed, it just silently advanced" — this was found to be one of two
    // causes behind exactly that report (see handleTimerComplete's isActive fix for the other).
    const wentToBackground = !isActive && wasActiveRef.current;
    wasActiveRef.current = isActive;

    if (cameToForeground) {
      // App has come to the foreground: reload persisted state. This is the only
      // path by which a round that ran out while the app was away gets noticed —
      // see `handleTimerComplete`.
      loadTimerState();
      liveActivityService.syncActivityState();
    }

    // If app goes to background while alert is showing, auto-dismiss and advance
    if (wentToBackground && showTimerAlert) {
      logger.log("App is going to background, auto-dismiss timer alert");
      // Reacting to an AppState transition (app backgrounded while the alert is
      // visible); clearing the alert here is intentional. The alert's setState
      // now lives inside useTimerAlert, so no set-state-in-effect suppression is
      // needed.
      dismissTimerAlert();
    }
  }, [isActive, isBackground, isInactive, loadTimerState, showTimerAlert]);

  // Load initial state on mount.
  //
  // Deliberately waits for `isBlindsLoading` to clear first: `BlindsContext` loads its own
  // persisted `currentBlindIndex` asynchronously and completely independently of this provider's
  // `loadTimerState()`. With no gate here, a cold launch onto an expired round (the app was
  // killed mid-round, then reopened after it ran out) would run `handleTimerComplete` — and, on
  // its no-alert path, `increaseBlinds()` — against whatever `currentBlindIndex` happened to be
  // *at that instant*, which is its pre-load default of 0 if `BlindsContext` hasn't finished
  // loading yet, landing on "Level 2" regardless of what was actually persisted. The ref guard
  // keeps this firing exactly once despite `isBlindsLoading` being a dependency (it starts `true`
  // and flips to `false` once, but re-renders for *other* reasons must not re-trigger it).
  const hasLoadedOnMountRef = useRef(false);
  useEffect(() => {
    if (isBlindsLoading || hasLoadedOnMountRef.current) return;
    hasLoadedOnMountRef.current = true;
    loadTimerState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBlindsLoading]);

  // Deliberately no "end activity on unmount" effect here (there used to be one). The whole
  // point of the Android foreground service / iOS Live Activity is to keep running independent
  // of this component's lifecycle — and on Android, swiping the app away from Recents destroys
  // the Activity, which tears down the entire React Native host and unmounts this component,
  // which made that cleanup fire on every swipe-away and immediately kill the very foreground
  // service that's supposed to survive it (confirmed via logcat: "Foreground Service updated
  // successfully" followed by "ReactHost.onHostDestroy" followed by "Foreground Service
  // stopped", all within the same task-removal event). Ending the activity belongs solely to
  // explicit user intent — see resetTimer() above, which already calls endActivity().

  return (
    <TimerContext.Provider
      value={{
        endTime,
        timeLeft,
        timerDuration,
        setTimerDuration,
        paused,
        togglePause,
        resetTimer,
        isLoading,
        showTimerAlert,
        missedRounds,
        dismissTimerAlert,
        handleNextBlinds,
        hasNotificationPermission,
        requestNotificationPermission,
        showPermissionAlert,
        isBackgroundActivitySupported,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = React.useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
}
