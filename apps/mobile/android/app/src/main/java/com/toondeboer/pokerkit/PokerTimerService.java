package com.toondeboer.pokerkit;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
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
import android.content.SharedPreferences;

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
    public static final String EXTRA_TIMER_DURATION = "timerDuration";
    public static final String EXTRA_PAUSED = "paused";
    public static final String EXTRA_SHOULD_ALERT_ON_EXPIRY = "shouldAlertOnExpiry";
    public static final String EXTRA_SOUND_ID = "soundId";

    // Fallback sound resource when soundId is missing or doesn't match a bundled resource.
    private static final String DEFAULT_SOUND_ID = "alarm";

    // Actions
    public static final String ACTION_START = "START_TIMER_SERVICE";
    public static final String ACTION_UPDATE = "UPDATE_TIMER_SERVICE";
    public static final String ACTION_STOP = "STOP_TIMER_SERVICE";
    public static final String ACTION_DISMISS_ALERT = "DISMISS_ALERT";
    // Notification-button-initiated actions (distinct from the JS-driven ones above so we know
    // to persist + emit an event back to JS only for user-initiated taps).
    public static final String ACTION_PAUSE = "PAUSE_TIMER_SERVICE";
    public static final String ACTION_RESUME = "RESUME_TIMER_SERVICE";
    public static final String ACTION_STOP_FROM_NOTIFICATION = "STOP_TIMER_SERVICE_FROM_NOTIFICATION";

    // Pending-action persistence, read by JS (ForegroundServiceModule#consumePendingAction) to
    // reconcile state when the app was backgrounded/killed at the moment of a notification tap.
    // Carries the service's own authoritative timer snapshot alongside the action name — see
    // the comment on ForegroundServiceBridge#emit for why the action name alone isn't enough.
    static final String PREFS_NAME = "PokerTimerServicePrefs";
    static final String KEY_PENDING_ACTION = "pendingAction";
    static final String KEY_PENDING_TIMESTAMP = "pendingActionTimestamp";
    static final String KEY_PENDING_PAUSED = "pendingPaused";
    static final String KEY_PENDING_TIME_LEFT = "pendingTimeLeft";
    static final String KEY_PENDING_END_TIME = "pendingEndTime";
    // Set only on a "resume" action tapped while the round had already expired — lets JS tell
    // this apart from an ordinary mid-round pause/resume, since only the app knows about blind
    // levels (this service doesn't) and needs to advance to the next one instead of restarting
    // the same round. See ForegroundServiceBridge#emit.
    static final String KEY_PENDING_WAS_EXPIRED = "pendingWasExpired";

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
    private int timerDuration = 0;
    private boolean paused = true;
    private boolean shouldAlertOnExpiry = true;
    private String soundId = DEFAULT_SOUND_ID;
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
        ForegroundServiceBridge.setRunning(true);
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
            } else if (ACTION_PAUSE.equals(action)) {
                paused = true;
                stopTimer();
                updateNotification();
                persistAndEmit("pause", false);
            } else if (ACTION_RESUME.equals(action)) {
                // Capture before it's cleared below — tells JS this resume follows an expired
                // round (as opposed to an ordinary mid-round pause/resume), so it knows to advance
                // to the next blind level rather than restart the same one. This service has no
                // notion of blind levels itself, so it can't make that call — it just reports what
                // happened and lets the app decide.
                boolean wasExpired = timerExpired;
                paused = false;
                // Resuming from an already-expired timer (timeLeft == 0, e.g. the button was
                // tapped while at "TIME'S UP") restarts a full round rather than an
                // instantly-expired one. timeLeft must be synced to the same fallback value used
                // for endTime here, not left at its stale 0 — otherwise the persisted/emitted
                // snapshot tells JS "resumed, 0 seconds left", which JS's own completion-detection
                // reads as "just expired" and immediately resets the timer that was only just
                // resumed. (JS disregards this timeLeft/endTime when wasExpired is true and
                // computes its own fresh round for the new blind level instead — this is just for
                // this service's own immediate notification content.)
                int remaining = timeLeft > 0 ? timeLeft : timerDuration;
                timeLeft = remaining;
                endTime = System.currentTimeMillis() + (long) remaining * 1000L;
                // Resuming acknowledges the expiry — stop the alarm/vibration loop and clear the
                // expired flag so the notification's title/color go back to "Active".
                timerExpired = false;
                dismissAlert();
                updateNotification();
                startTimer();
                persistAndEmit("resume", wasExpired);
            } else if (ACTION_STOP_FROM_NOTIFICATION.equals(action)) {
                stopTimer();
                stopAlert();
                stopForeground(true);
                stopSelf();
                persistAndEmit("stop", false);
            }
        }

        return START_STICKY;
    }

    /**
     * Persists the notification-button action, plus this service's own authoritative
     * paused/timeLeft/endTime at the moment it happened, so JS can reconcile on next
     * foreground/launch (the app may be backgrounded or fully killed at the moment of the tap —
     * this service outlives the JS/Catalyst instance) without re-deriving a stale value from its
     * own last-persisted (pre-pause) state. Also best-effort emits it live if JS is reachable now.
     */
    private void persistAndEmit(String action, boolean wasExpired) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_PENDING_ACTION, action)
                .putBoolean(KEY_PENDING_WAS_EXPIRED, wasExpired)
                .putLong(KEY_PENDING_TIMESTAMP, System.currentTimeMillis())
                .putBoolean(KEY_PENDING_PAUSED, paused)
                .putInt(KEY_PENDING_TIME_LEFT, timeLeft)
                .putLong(KEY_PENDING_END_TIME, endTime)
                .apply();
        ForegroundServiceBridge.emit(action, paused, timeLeft, endTime, wasExpired);
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
        timerDuration = intent.getIntExtra(EXTRA_TIMER_DURATION, timerDuration);
        boolean newPaused = intent.getBooleanExtra(EXTRA_PAUSED, true);
        shouldAlertOnExpiry = intent.getBooleanExtra(EXTRA_SHOULD_ALERT_ON_EXPIRY, true);
        String newSoundId = intent.getStringExtra(EXTRA_SOUND_ID);
        soundId = (newSoundId != null) ? newSoundId : DEFAULT_SOUND_ID;

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

                        // Flip timerExpired (and rebuild the notification off the back of it)
                        // *before* the notification is rebuilt below — this is also the very last
                        // tick this runnable ever reschedules (see the `timeLeft > 0` guard
                        // below), so if the flag flipped after updateNotification() instead, the
                        // "Pause" button/title would be frozen showing the pre-expiry state
                        // forever, since nothing rebuilds the notification again on its own once
                        // ticking stops. shouldAlertOnExpiry only gates the alarm/vibration, not
                        // whether the round is considered over.
                        if (timeLeft == 0 && !timerExpired) {
                            timerExpired = true;
                            if (shouldAlertOnExpiry) {
                                startAlert();
                            }
                        }

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

    private void startAlert() {
        if (isAlerting) return;

        isAlerting = true;

        // Show alert notification
        showAlertNotification();

        // Start infinite sound loop
        playAlertSoundInfinite();

        // Start vibration pattern
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

            // Try the selected sound pack first, falling back to the bundled default
            // alarm resource if `soundId` doesn't match a `res/raw` entry (e.g. an
            // older client sent an id this build doesn't know about).
            int soundResId = getResources().getIdentifier(soundId, "raw", getPackageName());
            if (soundResId == 0) {
                soundResId = R.raw.alarm;
            }
            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + soundResId);
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, soundUri);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
            }

            // Set looping to true for infinite repeat
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

                // Set looping to true for infinite repeat
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
                long[] pattern = {500, 1000, 500, 1000};
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

        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                        Intent.FLAG_ACTIVITY_SINGLE_TOP |
                        Intent.FLAG_ACTIVITY_NEW_TASK
        );
        PendingIntent openAppPendingIntent = PendingIntent.getActivity(
                this,
                2,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification alertNotification = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle("🎯 Timer Finished!")
                .setContentText("Level " + currentBlindLevel + " completed • Time to increase blinds!")
                .setSmallIcon(getNotificationIcon())
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(false)
                .setOngoing(true)
                .setContentIntent(openAppPendingIntent)
                .addAction(R.drawable.ic_notification_clear, "Dismiss", dismissPendingIntent)
                .setFullScreenIntent(openAppPendingIntent, true)
                .setColor(0xFFDC2626) // Red for urgency
                .setColorized(true)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setStyle(new NotificationCompat.BigTextStyle()
                        .bigText("🚨 Level " + currentBlindLevel + " has ended!\n\n" +
                                "📊 Current blinds: " + formatBlinds(currentSmallBlind, currentBigBlind) + "\n" +
                                "⬆️ Next blinds: " + formatBlinds(nextSmallBlind, nextBigBlind) + "\n\n" +
                                "Tap to return to app and advance to the next level.")
                        .setBigContentTitle("🎯 Timer Finished!"))
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
            // Regular timer channel - Modern styling
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows poker timer status while app runs in background");
            channel.setShowBadge(true);
            channel.setLightColor(Color.BLUE);
            channel.enableLights(false);
            channel.enableVibration(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            notificationManager.createNotificationChannel(channel);

            // Alert channel - High priority with modern styling
            NotificationChannel alertChannel = new NotificationChannel(
                    ALERT_CHANNEL_ID,
                    ALERT_CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Important alerts when timer reaches zero");
            alertChannel.enableVibration(true);
            alertChannel.enableLights(true);
            alertChannel.setLightColor(Color.RED);
            alertChannel.setShowBadge(true);
            alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            // Set custom vibration pattern
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                alertChannel.setVibrationPattern(new long[]{0, 250, 250, 250});
            }

            notificationManager.createNotificationChannel(alertChannel);
        }
    }

    private Notification createNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                        Intent.FLAG_ACTIVITY_SINGLE_TOP |
                        Intent.FLAG_ACTIVITY_NEW_TASK
        );
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String title = getModernTitle();
        String content = formatNotificationContent();
        String bigText = formatBigText();

        // Once the round has expired, "Pause" no longer makes sense — nothing is running to
        // pause. Treat expired the same as paused for the button's label/action: it becomes
        // "Resume", which restarts a full round (see ACTION_RESUME's expired-fallback above).
        boolean showResume = paused || timerExpired;

        Intent pauseResumeIntent = new Intent(this, PokerTimerService.class);
        pauseResumeIntent.setAction(showResume ? ACTION_RESUME : ACTION_PAUSE);
        PendingIntent pauseResumePendingIntent = PendingIntent.getService(
                this,
                3,
                pauseResumeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(this, PokerTimerService.class);
        stopIntent.setAction(ACTION_STOP_FROM_NOTIFICATION);
        PendingIntent stopPendingIntent = PendingIntent.getService(
                this,
                4,
                stopIntent,
                PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(content)
                .setSmallIcon(getNotificationIcon())
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setColor(getStatusColor()) // Dynamic color based on state
                .setColorized(false)
                .setStyle(new NotificationCompat.BigTextStyle()
                        .bigText(bigText)
                        .setBigContentTitle(title))
                .setShowWhen(false)
                .setOnlyAlertOnce(true) // Don't repeatedly alert for updates
                .addAction(
                        showResume ? R.drawable.ic_notification_play : R.drawable.ic_notification_pause,
                        showResume ? "Resume" : "Pause",
                        pauseResumePendingIntent)
                .addAction(R.drawable.ic_notification_clear, "Stop", stopPendingIntent);

        // Add custom large icon if available
        try {
            builder.setLargeIcon(
                    android.graphics.BitmapFactory.decodeResource(
                            getResources(),
                            R.mipmap.ic_launcher
                    )
            );
        } catch (Exception e) {
            // No large icon, that's fine
        }

        return builder.build();
    }

    private int getStatusColor() {
        if (timerExpired) {
            return 0xFFDC2626; // Red for expired
        } else if (paused) {
            return 0xFF6B7280; // Gray for paused
        } else if (timeLeft <= 60) {
            return 0xFFEA580C; // Orange for low time
        } else {
            return 0xFF059669; // Green for active
        }
    }

    private int getNotificationIcon() {
        // Try to use custom poker icons first, fall back gracefully
        try {
            // Try poker chip icon first (most thematic)
            getResources().getDrawable(R.drawable.ic_poker_chip);
            return R.drawable.ic_poker_chip;
        } catch (Exception e1) {
            try {
                // Try poker timer icon
                getResources().getDrawable(R.drawable.ic_poker_timer);
                return R.drawable.ic_poker_timer;
            } catch (Exception e2) {
                try {
                    // Try app launcher icon
                    getResources().getDrawable(R.mipmap.ic_launcher);
                    return R.mipmap.ic_launcher;
                } catch (Exception e3) {
                    // Fall back to system timer icon
                    return android.R.drawable.ic_dialog_info;
                }
            }
        }
    }

    private String getModernTitle() {
        if (timerExpired) {
            return "⏰ " + tournamentName + " • TIME'S UP!";
        } else if (paused) {
            return "⏸️ " + tournamentName + " • Paused";
        } else {
            return "🎯 " + tournamentName + " • Active";
        }
    }

    private void updateNotification() {
        notificationManager.notify(NOTIFICATION_ID, createNotification());
    }

    private String formatNotificationContent() {
        StringBuilder content = new StringBuilder();

        // Main status line
        content.append("Level ").append(currentBlindLevel);
        content.append(" • ").append(formatBlinds(currentSmallBlind, currentBigBlind));

        if (paused) {
            if (timeLeft > 0) {
                content.append(" • ").append(formatTime(timeLeft)).append(" remaining");
            }
        } else if (timeLeft > 0) {
            content.append(" • ").append(formatTime(timeLeft)).append(" left");
        } else if (timerExpired) {
            content.append(" • Advance to next level");
        }

        return content.toString();
    }

    private String formatBigText() {
        StringBuilder bigText = new StringBuilder();

        // Current level info
        bigText.append("📊 Current Level: ").append(currentBlindLevel).append("\n");
        bigText.append("💰 Blinds: ").append(formatBlinds(currentSmallBlind, currentBigBlind));

        // Timer info
        if (paused) {
            bigText.append("\n⏸️ Status: Paused");
            if (timeLeft > 0) {
                bigText.append("\n⏱️ Time Remaining: ").append(formatTime(timeLeft));
            }
        } else if (timeLeft > 0) {
            bigText.append("\n⏱️ Time Left: ").append(formatTime(timeLeft));
        } else if (timerExpired) {
            bigText.append("\n🚨 TIME'S UP! Level completed");
        }

        // Next level info
        if (nextSmallBlind > 0 || nextBigBlind > 0) {
            bigText.append("\n⬆️ Next Level: ").append(formatBlinds(nextSmallBlind, nextBigBlind));
        }

        return bigText.toString();
    }

    private String formatBlinds(int smallBlind, int bigBlind) {
        return String.format("%,d/%,d", smallBlind, bigBlind);
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
        ForegroundServiceBridge.setRunning(false);
    }
}


