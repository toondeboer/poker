// android/app/src/main/java/com/yourapp/PokerTimerService.java
package com.toondeboer.pokerkit; // Replace with your actual package name

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.annotation.Nullable;
import android.os.Handler;
import android.os.Looper;

public class PokerTimerService extends Service {
    private static final String CHANNEL_ID = "PokerTimerChannel";
    private static final String CHANNEL_NAME = "Poker Timer";
    private static final int NOTIFICATION_ID = 1001;

    // Intent extras
    public static final String EXTRA_TOURNAMENT_NAME = "tournamentName";
    public static final String EXTRA_CURRENT_BLIND_LEVEL = "currentBlindLevel";
    public static final String EXTRA_CURRENT_SMALL_BLIND = "currentSmallBlind";
    public static final String EXTRA_CURRENT_BIG_BLIND = "currentBigBlind";
    public static final String EXTRA_NEXT_SMALL_BLIND = "nextSmallBlind";
    public static final String EXTRA_NEXT_BIG_BLIND = "nextBigBlind";
    public static final String EXTRA_END_TIME = "endTime";
    public static final String EXTRA_TIME_LEFT = "timeLeft";
    public static final String EXTRA_PAUSED = "paused";

    // Actions
    public static final String ACTION_START = "START_TIMER_SERVICE";
    public static final String ACTION_UPDATE = "UPDATE_TIMER_SERVICE";
    public static final String ACTION_STOP = "STOP_TIMER_SERVICE";

    private Handler handler;
    private Runnable updateRunnable;
    private NotificationManager notificationManager;

    // Timer state
    private String tournamentName = "Poker Tournament";
    private int currentBlindLevel = 1;
    private int currentSmallBlind = 0;
    private int currentBigBlind = 0;
    private int nextSmallBlind = 0;
    private int nextBigBlind = 0;
    private long endTime = 0;
    private int timeLeft = 0;
    private boolean paused = true;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        handler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();

            if (ACTION_START.equals(action) || ACTION_UPDATE.equals(action)) {
                updateTimerData(intent);
                startForeground(NOTIFICATION_ID, createNotification());
                startTimer();
            } else if (ACTION_STOP.equals(action)) {
                stopTimer();
                stopForeground(true);
                stopSelf();
            }
        }

        return START_STICKY; // Restart if killed
    }

    private void updateTimerData(Intent intent) {
        tournamentName = intent.getStringExtra(EXTRA_TOURNAMENT_NAME);
        if (tournamentName == null) tournamentName = "Poker Tournament";

        currentBlindLevel = intent.getIntExtra(EXTRA_CURRENT_BLIND_LEVEL, 1);
        currentSmallBlind = intent.getIntExtra(EXTRA_CURRENT_SMALL_BLIND, 0);
        currentBigBlind = intent.getIntExtra(EXTRA_CURRENT_BIG_BLIND, 0);
        nextSmallBlind = intent.getIntExtra(EXTRA_NEXT_SMALL_BLIND, 0);
        nextBigBlind = intent.getIntExtra(EXTRA_NEXT_BIG_BLIND, 0);
        endTime = intent.getLongExtra(EXTRA_END_TIME, 0);
        timeLeft = intent.getIntExtra(EXTRA_TIME_LEFT, 0);
        paused = intent.getBooleanExtra(EXTRA_PAUSED, true);
    }

    private void startTimer() {
        stopTimer(); // Stop any existing timer

        if (!paused && endTime > 0) {
            updateRunnable = new Runnable() {
                @Override
                public void run() {
                    long currentTime = System.currentTimeMillis();
                    int newTimeLeft = Math.max(0, (int) ((endTime - currentTime) / 1000));

                    if (newTimeLeft != timeLeft) {
                        timeLeft = newTimeLeft;
                        updateNotification();
                    }

                    if (timeLeft > 0) {
                        handler.postDelayed(this, 1000);
                    }
                }
            };
            handler.post(updateRunnable);
        }
    }

    private void stopTimer() {
        if (updateRunnable != null) {
            handler.removeCallbacks(updateRunnable);
            updateRunnable = null;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Poker Timer Status");
            channel.setShowBadge(false);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private Notification createNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE
        );

        String title = tournamentName;
        String content = formatNotificationContent();

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(content)
                .setSmallIcon(R.drawable.splashscreen_logo) // You'll need to add this icon
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
    }

    private void updateNotification() {
        notificationManager.notify(NOTIFICATION_ID, createNotification());
    }

    private String formatNotificationContent() {
        StringBuilder content = new StringBuilder();

        content.append("Level ").append(currentBlindLevel);
        content.append(" • ").append(currentSmallBlind).append("/").append(currentBigBlind);

        if (paused) {
            content.append(" • Paused");
            if (timeLeft > 0) {
                content.append(" (").append(formatTime(timeLeft)).append(")");
            }
        } else if (timeLeft > 0) {
            content.append(" • ").append(formatTime(timeLeft));
        }

        if (nextSmallBlind > 0 || nextBigBlind > 0) {
            content.append(" → ").append(nextSmallBlind).append("/").append(nextBigBlind);
        }

        return content.toString();
    }

    private String formatTime(int seconds) {
        int minutes = seconds / 60;
        int remainingSeconds = seconds % 60;
        return String.format("%d:%02d", minutes, remainingSeconds);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopTimer();
    }
}


