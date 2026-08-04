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
import { useNativeTimerActionSync } from "@/src/hooks/useNativeTimerActionSync";
import { useTimerAlert } from "@/src/hooks/useTimerAlert";
import { useSoundPack } from "@/src/contexts/SoundPackContext";
import { useNotificationPermission } from "@/src/hooks/useNotificationPermission";
import { usePremium } from "@/src/contexts/PremiumContext";
import { liveActivityService } from "@/src/services/LiveActivityService";
import { recordRoundPlayed } from "@/src/services/reviewService";
import type { PendingTimerAction } from "@/src/modules/LiveActivityModule";
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

  // Handle timer completion
  const handleTimerComplete = async () => {
    // Read AppState directly here rather than trusting the cached `isActive` from
    // AppStateContext. That value only updates on a "change" event — if one is ever missed or
    // arrives out of order (a transient system dialog/notification/overlay stealing focus
    // momentarily, common on some OEM builds), `isActive` can get stuck reporting the wrong
    // value indefinitely, since nothing else re-syncs it. That would silently and permanently
    // flip every future expiry — even ones that happen while the user is clearly looking at the
    // app — onto the "background" branch below: no alert, no sound, straight to the next blind
    // level. AppState.currentState is a live getter, not an event cache, so it can't go stale.
    const isCurrentlyActive = AppState.currentState === "active";
    try {
      // Only play sound and show alert if app is active (in foreground)
      if (isCurrentlyActive && isAlarmLoaded) {
        await showAlert(true);
        logger.log("Timer completed - showing alert and playing alarm");
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
    pause: enginePause,
    resume: engineResume,
    resetTimer: engineResetTimer,
    isLoading,
    loadTimerState,
  } = useTimerEngine(currentBlindIndex, blindLevels, effectiveSoundPackId, {
    onTimerComplete: handleTimerComplete,
  });

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

  // Apply a pause/resume/stop action that originated from the Android foreground-service
  // notification or the iOS Live Activity/Dynamic Island, rather than the in-app UI. Uses the
  // absolute pause()/resume() (not togglePause) since these arrive out-of-band and must not risk
  // flipping the wrong way if they race against an in-app state change — and passes the native
  // side's own timeLeft/endTime through as an exact override, not just the action name: without
  // it, pause()/resume() would derive from JS's own (possibly long-stale) current state, freezing
  // at "whenever the app happens to reopen" instead of "whenever the button was actually tapped".
  // Shared by both the live-event fast path (below) and the sequenced persisted-flag
  // reconciliation (`reconcileNativeAction`).
  const applyNativeAction = (pending?: PendingTimerAction | null) => {
    if (!pending) return;
    logger.log("applyNativeAction:", pending);
    switch (pending.action) {
      case "pause":
        void enginePause(pending.timeLeft).then(() =>
          handleNotificationScheduling(true, pending.timeLeft),
        );
        break;
      case "resume":
        if (pending.wasExpired) {
          // Resuming a round that had already expired — neither native side tracks blind
          // levels, so `pending.endTime`/`timeLeft` just restart the *same* round (see
          // PokerTimerService's ACTION_RESUME / TogglePauseTimerIntent's resume branch).
          // Advance to the next level here instead, matching how the rest of the app treats
          // expiry (background auto-advance, the in-app "Next Blinds" button), and start a
          // fresh full-duration round for it rather than trusting native's stale same-level
          // endTime.
          increaseBlinds();
          void engineResume(Date.now() + timerDuration * 1000).then(() =>
            handleNotificationScheduling(false, timerDuration),
          );
        } else {
          void engineResume(pending.endTime).then(() =>
            handleNotificationScheduling(false, pending.timeLeft),
          );
        }
        break;
      case "stop":
        void resetTimer();
        break;
    }
  };

  useNativeTimerActionSync({ onAction: applyNativeAction });

  // `applyNativeAction` is recreated every render, closing over that render's `timerDuration`/
  // `increaseBlinds`/etc. The mount-time reconciliation below only runs *once* ([] deps), so
  // without this ref it would be permanently bound to whatever those values were at the very
  // first render — i.e. their pre-load defaults (timerDuration=DEFAULT_TIMER_DURATION,
  // increaseBlinds closing over currentBlindIndex=0) — regardless of how much later
  // `loadTimerState()`/`useBlinds()`'s own persisted loads actually resolve. A `wasExpired`
  // resume reconciled through that stale closure would compute a fresh endTime from the
  // *default* 10-minute duration and call the *default*-index `increaseBlinds()`, landing on
  // "10:00, Level 2" regardless of what was actually persisted before the app was killed. Always
  // dereferencing via `.current` at call time (updated every render, same pattern as
  // `useTimerEngine`'s `callbacksRef`) guarantees the freshest closure regardless of which
  // render's effect happens to invoke it.
  const applyNativeActionRef = useRef(applyNativeAction);
  useEffect(() => {
    applyNativeActionRef.current = applyNativeAction;
  });

  // Persisted-flag reconciliation for a native action that arrived while the app was
  // backgrounded or fully killed (the live-event listener above only catches one that arrives
  // while JS is already running). Deliberately sequenced *after* `loadTimerState()` finishes,
  // not raced against it — `loadTimerState()` reads AsyncStorage, a separate, stale data source
  // a native button tap never touches, and it reliably resolves *after* a native action check
  // (AsyncStorage I/O is consistently slower), so racing them let it silently clobber the
  // reconciled action back to whatever was persisted before backgrounding.
  const reconcileNativeAction = async () => {
    const pending = await liveActivityService.consumePendingAction();
    logger.log("reconcileNativeAction: consumePendingAction ->", pending);
    applyNativeActionRef.current(pending);
  };

  // Dismiss timer alert (advance to next blind level, keep timer paused, stop sound)
  const dismissTimerAlert = async () => {
    await clearAlert();

    // Advance to next blind level but keep timer paused
    increaseBlinds();
    // Timer will remain paused - user needs to manually start it
  };

  // Handle next blinds (advance blinds, start new timer, stop sound)
  const handleNextBlinds = async () => {
    await clearAlert();

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
      // App has come to the foreground: reload persisted state, THEN reconcile any native
      // action on top of it (not in parallel — see reconcileNativeAction).
      loadTimerState().then(reconcileNativeAction);
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

  // Load initial state on mount, then reconcile any native action left pending from before
  // this launch (see reconcileNativeAction — sequenced, not raced, against the load).
  //
  // Deliberately waits for `isBlindsLoading` to clear before doing either: `BlindsContext` loads
  // its own persisted `currentBlindIndex` asynchronously, completely independently of this
  // provider's `loadTimerState()` — with no gate here, a `wasExpired` resume reconciled on a
  // cold launch (app was fully killed, e.g. force-quit, then reopened with a pending native
  // action) would apply `increaseBlinds()` against whatever `currentBlindIndex` happened to be
  // *at that instant*, which is its pre-load default (0) if `BlindsContext` hasn't finished
  // loading yet — landing on "Level 2" regardless of what was actually persisted. The `hasRunRef`
  // guard keeps this firing exactly once despite `isBlindsLoading` being a dependency (it starts
  // `true` and flips to `false` once, but re-renders for *other* reasons must not re-trigger it).
  const hasReconciledOnMountRef = useRef(false);
  useEffect(() => {
    if (isBlindsLoading || hasReconciledOnMountRef.current) return;
    hasReconciledOnMountRef.current = true;
    loadTimerState().then(reconcileNativeAction);
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
