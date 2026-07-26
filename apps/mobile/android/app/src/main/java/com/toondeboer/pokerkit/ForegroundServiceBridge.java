package com.toondeboer.pokerkit;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.lang.ref.WeakReference;

/**
 * Shared static state between {@link ForegroundServiceModule} (JS-facing) and
 * {@link PokerTimerService} (the actual notification/timer, which isn't itself
 * a React Native module). Tracks whether the service is really running
 * (PokerTimerService owns the source of truth — a notification button tap can
 * stop the service without JS being involved) and emits notification-button
 * events to JS when a React instance is alive.
 */
final class ForegroundServiceBridge {
    static final String EVENT_ACTION = "onForegroundServiceAction";

    private static WeakReference<ReactApplicationContext> reactContextRef;
    private static volatile boolean running = false;

    private ForegroundServiceBridge() {}

    static void setReactContext(ReactApplicationContext context) {
        reactContextRef = new WeakReference<>(context);
    }

    static void setRunning(boolean value) {
        running = value;
    }

    static boolean isRunning() {
        return running;
    }

    /**
     * Emits the action plus the service's own authoritative timer snapshot at the moment it
     * happened — not just the action name. Without this, a JS instance that wasn't alive to
     * receive this live event would instead reconcile later via
     * {@link ForegroundServiceModule#consumePendingAction}, which reads the *persisted* snapshot
     * carrying the same fields for the same reason: reconciling from the action name alone would
     * require re-deriving `timeLeft` from AsyncStorage's stale, pre-pause `endTime` continuing to
     * count down all the way to "now" (whenever the app happens to reopen), pausing/resuming at
     * the wrong instant instead of the one the button was actually tapped at.
     */
    static void emit(String action, boolean paused, int timeLeft, long endTime) {
        ReactApplicationContext context = reactContextRef != null ? reactContextRef.get() : null;
        if (context != null && context.hasActiveReactInstance()) {
            WritableMap payload = Arguments.createMap();
            payload.putString("action", action);
            payload.putBoolean("paused", paused);
            payload.putInt("timeLeft", timeLeft);
            payload.putDouble("endTime", (double) endTime);
            context
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(EVENT_ACTION, payload);
        }
    }
}
