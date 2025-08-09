package com.toondeboer.pokerkit;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import androidx.annotation.Nullable;
import android.os.Handler;
import android.os.Looper;

public class PokerTimerService extends Service {
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
    public static final String EXTRA_SHOULD_ALERT_ON_EXPIRY = "shouldAlertOnExpiry";
    // Actions
    public static final String ACTION_START = "START_TIMER_SERVICE";
    public static final String ACTION_UPDATE = "UPDATE_TIMER_SERVICE";
    public static final String ACTION_STOP = "STOP_TIMER_SERVICE";
    public static final String ACTION_DISMISS_ALERT = "DISMISS_ALERT";
    private static final String CHANNEL_ID = "PokerTimerChannel";
    private static final String ALERT_CHANNEL_ID = "PokerTimerAlertChannel";
    private static final String CHANNEL_NAME = "Poker Timer";
    private static final String ALERT_CHANNEL_NAME = "Poker Timer Alerts";
    private static final int NOTIFICATION_ID = 1001;
    private static final int ALERT_NOTIFICATION_ID = 1002;
    private Handler handler;
    private Runnable updateRunnable;
    private NotificationManager notificationManager;
    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private Handler alertHandler;
    private Runnable alertRunnable;

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
    private boolean shouldAlertOnExpiry = true;
    private boolean isAlerting = false;
    private boolean timerExpired = false;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        createNotificationChannels();
        handler = new Handler(Looper.getMainLooper());
        alertHandler = new Handler(Looper.getMainLooper());
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
                stopAlert();
                stopForeground(true);
                stopSelf();
            } else if (ACTION_DISMISS_ALERT.equals(action)) {
                dismissAlert();
            }
        }

        return START_STICKY;
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
        boolean newPaused = intent.getBooleanExtra(EXTRA_PAUSED, true);
        shouldAlertOnExpiry = intent.getBooleanExtra(EXTRA_SHOULD_ALERT_ON_EXPIRY, true);

        // If timer was unpaused or time updated, reset expired state
        if (paused && !newPaused || timeLeft > 0) {
            timerExpired = false;
            dismissAlert();
        }

        paused = newPaused;
    }

    private void startTimer() {
        stopTimer();

        if (!paused && endTime > 0) {
            updateRunnable = new Runnable() {
                @Override
                public void run() {
                    long currentTime = System.currentTimeMillis();
                    int newTimeLeft = Math.max(0, (int) ((endTime - currentTime) / 1000));

                    if (newTimeLeft != timeLeft) {
                        timeLeft = newTimeLeft;
                        updateNotification();

                        // Check if timer just expired
                        if (timeLeft == 0 && !timerExpired && shouldAlertOnExpiry) {
                            timerExpired = true;
                            startAlert();
                        }
                    }

                    if (timeLeft > 0) {
                        handler.postDelayed(this, 1000);
                    }
                }
            };
            handler.post(updateRunnable);
        }
    }

    private void startAlert() {
        if (isAlerting) return;

        isAlerting = true;

        // Show alert notification
        showAlertNotification();

        // Start infinite sound loop
        playAlertSoundInfinite();

        // Start vibration pattern (keep existing pattern)
        startVibration();

        // Optional: Still vibrate every 5 seconds for extra attention
        alertRunnable = new Runnable() {
            @Override
            public void run() {
                if (isAlerting) {
                    startVibration(); // Just vibrate, sound is already looping
                    alertHandler.postDelayed(this, 5000);
                }
            }
        };
        alertHandler.postDelayed(alertRunnable, 5000);
    }

    private void playAlertSoundInfinite() {
        try {
            if (mediaPlayer != null) {
                mediaPlayer.release();
            }

            // Try custom sound first
            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.alarm);
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, soundUri);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
            }

            // KEY CHANGE: Set looping to true for infinite repeat
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();

        } catch (Exception e) {
            // Fallback to default alarm sound
            try {
                if (mediaPlayer != null) {
                    mediaPlayer.release();
                }

                Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (defaultSound == null) {
                    defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }

                mediaPlayer = new MediaPlayer();
                mediaPlayer.setDataSource(this, defaultSound);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build());
                }

                // KEY CHANGE: Set looping to true for infinite repeat
                mediaPlayer.setLooping(true);
                mediaPlayer.prepare();
                mediaPlayer.start();

            } catch (Exception fallbackException) {
                fallbackException.printStackTrace();
            }
        }
    }

    private void startVibration() {
        if (vibrator != null && vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Vibration pattern: wait 500ms, vibrate 1000ms, wait 500ms, vibrate 1000ms
                long[] pattern = {500, 1000, 500, 1000};
                VibrationEffect effect = VibrationEffect.createWaveform(pattern, -1);
                vibrator.vibrate(effect);
            } else {
                long[] pattern = {500, 000, 500, 1000};
                vibrator.vibrate(pattern, -1);
            }
        }
    }

    private void showAlertNotification() {
        Intent dismissIntent = new Intent(this, PokerTimerService.class);
        dismissIntent.setAction(ACTION_DISMISS_ALERT);
        PendingIntent dismissPendingIntent = PendingIntent.getService(
                this,
                1,
                dismissIntent,
                PendingIntent.FLAG_IMMUTABLE
        );

        // Updated intent to preserve state when opening app
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        openAppIntent.putExtra("from_foreground_service", true); // Add flag to indicate source
        PendingIntent openAppPendingIntent = PendingIntent.getActivity(
                this,
                2,
                openAppIntent,
                PendingIntent.FLAG_IMMUTABLE
        );

        Notification alertNotification = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle("Timer Finished!")
                .setContentText("Level " + currentBlindLevel + " has ended. Time to increase blinds!")
                .setSmallIcon(R.drawable.splashscreen_logo)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(false)
                .setOngoing(true)
                .setContentIntent(openAppPendingIntent)
                .addAction(R.drawable.splashscreen_logo, "Dismiss", dismissPendingIntent)
                .setFullScreenIntent(openAppPendingIntent, true)
                .build();

        notificationManager.notify(ALERT_NOTIFICATION_ID, alertNotification);
    }

    private void dismissAlert() {
        if (!isAlerting) return;

        isAlerting = false;

        // Stop infinite sound loop
        if (mediaPlayer != null) {
            if (mediaPlayer.isPlaying()) {
                mediaPlayer.stop();
            }
            mediaPlayer.release();
            mediaPlayer = null;
        }

        // Stop vibration
        if (vibrator != null) {
            vibrator.cancel();
        }

        // Stop repeating vibration alerts
        if (alertRunnable != null) {
            alertHandler.removeCallbacks(alertRunnable);
            alertRunnable = null;
        }

        // Remove alert notification
        notificationManager.cancel(ALERT_NOTIFICATION_ID);
    }

    private void stopAlert() {
        dismissAlert();
    }

    private void stopTimer() {
        if (updateRunnable != null) {
            handler.removeCallbacks(updateRunnable);
            updateRunnable = null;
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Regular timer channel
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Poker Timer Status");
            channel.setShowBadge(false);
            notificationManager.createNotificationChannel(channel);

            // Alert channel
            NotificationChannel alertChannel = new NotificationChannel(
                    ALERT_CHANNEL_ID,
                    ALERT_CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Poker Timer Alerts");
            alertChannel.enableVibration(true);
            alertChannel.setShowBadge(true);
            alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            notificationManager.createNotificationChannel(alertChannel);
        }
    }

    private Notification createNotification() {
        // Updated intent to preserve state when opening app
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        intent.putExtra("from_foreground_service", true); // Add flag to indicate source
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
                .setSmallIcon(R.drawable.splashscreen_logo)
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
        } else if (timerExpired) {
            content.append(" • TIME'S UP!");
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
        stopAlert();
    }
}



