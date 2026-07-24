package com.toondeboer.pokerkit;

import com.facebook.react.bridge.ReactApplicationContext;
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

    static void emit(String action) {
        ReactApplicationContext context = reactContextRef != null ? reactContextRef.get() : null;
        if (context != null && context.hasActiveReactInstance()) {
            context
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(EVENT_ACTION, action);
        }
    }
}
