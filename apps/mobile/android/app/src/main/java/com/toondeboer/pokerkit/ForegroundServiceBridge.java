package com.toondeboer.pokerkit;

/**
 * Shared static state between {@link ForegroundServiceModule} (JS-facing) and
 * {@link PokerTimerService} (the actual notification/timer, which isn't itself
 * a React Native module). Only tracks whether the service is really running —
 * the service can stop itself (a stopSelf on its own terms) without JS being
 * involved, so JS asking "are you running" has to reach something outside the
 * module instance.
 */
final class ForegroundServiceBridge {
    private static volatile boolean running = false;

    private ForegroundServiceBridge() {}

    static void setRunning(boolean value) {
        running = value;
    }

    static boolean isRunning() {
        return running;
    }
}
