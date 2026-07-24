// src/hooks/useNativeTimerActionSync.ts
import { useEffect, useRef } from "react";
import {
  DeviceEventEmitter,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from "react-native";
import { logger } from "@/src/utils/logger";
import type { PendingTimerAction } from "@/src/modules/LiveActivityModule";

export interface NativeTimerActionCallbacks {
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const ANDROID_EVENT = "onForegroundServiceAction";
const IOS_EVENT = "onLiveActivityAction";

/**
 * Applies a pause/resume/stop action that originated natively — an Android foreground-service
 * notification button, or an iOS Live Activity/Dynamic Island button — rather than the in-app
 * UI, as it happens live while a JS/bridge instance is already running (the native side has
 * already updated its own visible UI immediately, independent of this — this is purely so JS's
 * timer state catches up).
 *
 * This is the fast path only. The persisted "pending action" flag (for when the app was
 * backgrounded/killed at the moment of the tap) is deliberately NOT handled here — it's consumed
 * by `TimerContext` itself, sequenced *after* `loadTimerState()` on mount/foreground. Racing the
 * two independently (as an earlier version of this hook did) meant `loadTimerState()`'s
 * AsyncStorage read — a completely separate, stale data source a native tap never touches —
 * would reliably resolve after the pending-action reconciliation and silently overwrite it,
 * since AsyncStorage I/O is consistently slower than the native UserDefaults/SharedPreferences
 * read behind `consumePendingAction()`. Sequencing them in one place, load-then-reconcile,
 * removes that race entirely.
 *
 * Callers must pass *absolute* pause/resume (not an unconditional toggle) — an out-of-band
 * native action racing against in-app state must not risk flipping the wrong way.
 */
export function useNativeTimerActionSync({
  onPause,
  onResume,
  onStop,
}: NativeTimerActionCallbacks) {
  const callbacksRef = useRef({ onPause, onResume, onStop });
  useEffect(() => {
    callbacksRef.current = { onPause, onResume, onStop };
  });

  const applyAction = (action?: PendingTimerAction | string | null) => {
    switch (action) {
      case "pause":
        callbacksRef.current.onPause();
        break;
      case "resume":
        callbacksRef.current.onResume();
        break;
      case "stop":
        callbacksRef.current.onStop();
        break;
    }
  };

  useEffect(() => {
    if (Platform.OS === "android") {
      const subscription = DeviceEventEmitter.addListener(
        ANDROID_EVENT,
        (action: PendingTimerAction) => {
          logger.log("Native foreground-service action:", action);
          applyAction(action);
        },
      );
      return () => subscription.remove();
    } else if (Platform.OS === "ios") {
      const emitter = new NativeEventEmitter(NativeModules.RNLiveActivity);
      const subscription = emitter.addListener(
        IOS_EVENT,
        (event: { action?: PendingTimerAction }) => {
          logger.log("Native Live Activity action:", event?.action);
          applyAction(event?.action);
        },
      );
      return () => subscription.remove();
    }
    return undefined;
  }, []);
}
