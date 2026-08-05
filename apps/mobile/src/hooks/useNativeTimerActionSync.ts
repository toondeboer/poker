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
  /** Receives the full snapshot (not just which button), so the caller can apply the exact
   * paused/timeLeft/endTime the native side had at the moment of the tap, rather than deriving
   * a value from whatever JS's own (possibly stale) state currently is. */
  onAction: (pending: PendingTimerAction) => void;
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
 */
export function useNativeTimerActionSync({
  onAction,
}: NativeTimerActionCallbacks) {
  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  });

  useEffect(() => {
    if (Platform.OS === "android") {
      const subscription = DeviceEventEmitter.addListener(
        ANDROID_EVENT,
        (pending: PendingTimerAction) => {
          logger.log("Native foreground-service action:", pending);
          onActionRef.current(pending);
        },
      );
      return () => subscription.remove();
    } else if (Platform.OS === "ios") {
      const emitter = new NativeEventEmitter(NativeModules.RNLiveActivity);
      const subscription = emitter.addListener(
        IOS_EVENT,
        (pending: PendingTimerAction) => {
          // iOS reports endTime in seconds (Date.timeIntervalSince1970); normalize to
          // milliseconds here too, same as LiveActivityService.consumePendingAction() does for
          // the persisted-flag path — @poker/core always works in milliseconds.
          const normalized = { ...pending, endTime: pending.endTime * 1000 };
          logger.log("Native Live Activity action:", normalized);
          onActionRef.current(normalized);
        },
      );
      return () => subscription.remove();
    }
    return undefined;
  }, []);
}
