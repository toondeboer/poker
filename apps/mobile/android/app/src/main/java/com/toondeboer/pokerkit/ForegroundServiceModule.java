package com.toondeboer.pokerkit;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import android.Manifest;

public class ForegroundServiceModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "RNForegroundService";
    private ReactApplicationContext reactContext;
    private boolean isServiceRunning = false;

    public ForegroundServiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void startService(ReadableMap data, Promise promise) {
        try {
            // Check permission for Android 13+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(reactContext,
                        Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    promise.reject("PERMISSION_DENIED", "Notification permission required");
                    return;
                }
            }

            Intent serviceIntent = new Intent(reactContext, PokerTimerService.class);
            serviceIntent.setAction(PokerTimerService.ACTION_START);

            // Add data to intent
            if (data.hasKey("tournamentName")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_TOURNAMENT_NAME,
                        data.getString("tournamentName"));
            }
            if (data.hasKey("currentBlindLevel")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_CURRENT_BLIND_LEVEL,
                        data.getInt("currentBlindLevel"));
            }
            if (data.hasKey("currentSmallBlind")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_CURRENT_SMALL_BLIND,
                        data.getInt("currentSmallBlind"));
            }
            if (data.hasKey("currentBigBlind")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_CURRENT_BIG_BLIND,
                        data.getInt("currentBigBlind"));
            }
            if (data.hasKey("nextSmallBlind")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_NEXT_SMALL_BLIND,
                        data.getInt("nextSmallBlind"));
            }
            if (data.hasKey("nextBigBlind")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_NEXT_BIG_BLIND,
                        data.getInt("nextBigBlind"));
            }
            if (data.hasKey("endTime")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_END_TIME,
                        (long) data.getDouble("endTime"));
            }
            if (data.hasKey("timeLeft")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_TIME_LEFT,
                        data.getInt("timeLeft"));
            }
            if (data.hasKey("paused")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_PAUSED,
                        data.getBoolean("paused"));
            }
            if (data.hasKey("shouldAlertOnExpiry")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_SHOULD_ALERT_ON_EXPIRY,
                        data.getBoolean("shouldAlertOnExpiry"));
            }

            reactContext.startForegroundService(serviceIntent);
            isServiceRunning = true;
            promise.resolve("Service started successfully");

        } catch (Exception e) {
            promise.reject("START_ERROR", "Failed to start service: " + e.getMessage());
        }
    }

    @ReactMethod
    public void updateService(ReadableMap data, Promise promise) {
        try {
            if (!isServiceRunning) {
                // If service isn't running, start it instead
                startService(data, promise);
                return;
            }

            Intent serviceIntent = new Intent(reactContext, PokerTimerService.class);
            serviceIntent.setAction(PokerTimerService.ACTION_UPDATE);

            // Add data to intent (same as startService)
            if (data.hasKey("tournamentName")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_TOURNAMENT_NAME,
                        data.getString("tournamentName"));
            }
            if (data.hasKey("currentBlindLevel")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_CURRENT_BLIND_LEVEL,
                        data.getInt("currentBlindLevel"));
            }
            if (data.hasKey("currentSmallBlind")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_CURRENT_SMALL_BLIND,
                        data.getInt("currentSmallBlind"));
            }
            if (data.hasKey("currentBigBlind")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_CURRENT_BIG_BLIND,
                        data.getInt("currentBigBlind"));
            }
            if (data.hasKey("nextSmallBlind")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_NEXT_SMALL_BLIND,
                        data.getInt("nextSmallBlind"));
            }
            if (data.hasKey("nextBigBlind")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_NEXT_BIG_BLIND,
                        data.getInt("nextBigBlind"));
            }
            if (data.hasKey("endTime")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_END_TIME,
                        (long) data.getDouble("endTime"));
            }
            if (data.hasKey("timeLeft")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_TIME_LEFT,
                        data.getInt("timeLeft"));
            }
            if (data.hasKey("paused")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_PAUSED,
                        data.getBoolean("paused"));
            }
            if (data.hasKey("shouldAlertOnExpiry")) {
                serviceIntent.putExtra(PokerTimerService.EXTRA_SHOULD_ALERT_ON_EXPIRY,
                        data.getBoolean("shouldAlertOnExpiry"));
            }

            reactContext.startService(serviceIntent);
            promise.resolve("Service updated successfully");

        } catch (Exception e) {
            promise.reject("UPDATE_ERROR", "Failed to update service: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopService(Promise promise) {
        try {
            Intent serviceIntent = new Intent(reactContext, PokerTimerService.class);
            serviceIntent.setAction(PokerTimerService.ACTION_STOP);
            reactContext.startService(serviceIntent);

            isServiceRunning = false;
            promise.resolve("Service stopped successfully");

        } catch (Exception e) {
            promise.reject("STOP_ERROR", "Failed to stop service: " + e.getMessage());
        }
    }

    @ReactMethod
    public void dismissAlert(Promise promise) {
        try {
            Intent serviceIntent = new Intent(reactContext, PokerTimerService.class);
            serviceIntent.setAction(PokerTimerService.ACTION_DISMISS_ALERT);
            reactContext.startService(serviceIntent);

            promise.resolve("Alert dismissed successfully");

        } catch (Exception e) {
            promise.reject("DISMISS_ERROR", "Failed to dismiss alert: " + e.getMessage());
        }
    }

    @ReactMethod
    public void isServiceSupported(Promise promise) {
        // Foreground services are supported on all Android versions we target
        promise.resolve(true);
    }

    @ReactMethod
    public void hasNotificationPermission(Promise promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            boolean hasPermission = ContextCompat.checkSelfPermission(reactContext,
                    Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            promise.resolve(hasPermission);
        } else {
            // Pre-Android 13 doesn't require explicit notification permission
            promise.resolve(true);
        }
    }

    @ReactMethod
    public void isServiceRunning(Promise promise) {
        promise.resolve(isServiceRunning);
    }
}


