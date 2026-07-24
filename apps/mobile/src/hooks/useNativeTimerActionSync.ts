// src/hooks/useNativeTimerActionSync.ts
import { useEffect, useRef } from "react";
import {
  DeviceEventEmitter,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from "react-native";
import { logger } from "@/src/utils/logger";
import { liveActivityService } from "@/src/services/LiveActivityService";
import { useAppState } from "@/src/contexts/AppStateContext";
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
 * UI. Two delivery paths, both routed through the same callbacks:
 *  - A live event, while a JS/bridge instance happens to already be running (fast path; the
 *    native side has already updated its own visible UI immediately, independent of this).
 *  - A persisted "pending action" flag, consumed on mount and whenever the app returns to the
 *    foreground. This is what makes reconciliation work when the app was backgrounded or fully
 *    killed at the moment of the tap — the live event can't be (or wasn't) delivered in that
 *    case, but the flag survives until JS next reads it.
 *
 * Callers must pass *absolute* pause/resume (not an unconditional toggle) — an out-of-band
 * native action racing against in-app state must not risk flipping the wrong way.
 */
export function useNativeTimerActionSync({
  onPause,
  onResume,
  onStop,
}: NativeTimerActionCallbacks) {
  const { isActive } = useAppState();
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

  // Live event fast path.
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

  // Persisted-flag reconciliation on mount (cold launch).
  useEffect(() => {
    liveActivityService.consumePendingAction().then(applyAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persisted-flag reconciliation on background -> foreground (app was alive but backgrounded,
  // or was killed and just relaunched into an already-mounted provider tree).
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    const cameToForeground = isActive && !wasActiveRef.current;
    wasActiveRef.current = isActive;

    if (cameToForeground) {
      liveActivityService.consumePendingAction().then(applyAction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);
}
