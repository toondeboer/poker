// src/hooks/useTimerNotification.ts
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { BlindLevel } from "@/src/types/BlindLevel";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

const NOTIFICATION_CATEGORY = "timerActions";
const REPEAT_INTERVAL = 8; // Schedule next notification slightly before current one ends

// Define your custom sounds
const CUSTOM_SOUNDS = {
  timer_complete: Platform.OS === "ios" ? "alarm.wav" : "timer_complete",
  // Add more custom sounds as needed
} as const;

// Configure how notifications are handled when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useTimerNotification() {
  const [scheduledNotificationIds, setScheduledNotificationIds] = useState<
    string[]
  >([]);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isContinuousMode, setIsContinuousMode] = useState<boolean>(false);
  const continuousDataRef = useRef<{
    blindLevel?: BlindLevel;
    startTime: number;
  } | null>(null);

  // Request notification permissions on hook initialization
  useEffect(() => {
    registerForPushNotificationsAsync();

    // Listen for notification interactions to stop continuous notifications
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    // Listen for app state changes to handle background/foreground transitions
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // Clear notifications when app initially loads
    clearAllNotifications();

    return () => {
      subscription.remove();
      appStateSubscription?.remove();
    };
  }, []);

  const handleNotificationResponse = async (
    response: Notifications.NotificationResponse,
  ) => {
    const notificationData = response.notification.request.content.data;

    // If user interacts with a timer notification, stop the continuous notifications
    if (notificationData?.type === "timer_complete") {
      await stopContinuousNotifications();
    }
  };

  const handleAppStateChange = async (nextAppState: string) => {
    // If app comes to foreground, clear all notifications
    if (nextAppState === "active") {
      await clearAllNotifications();
    }
  };

  const registerForPushNotificationsAsync = async () => {
    try {
      // Check existing permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not already granted
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("Failed to get push token for push notification!");
        setHasPermission(false);
        return;
      }

      setHasPermission(true);

      // Configure notification categories (for action buttons if needed)
      await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY, [
        {
          identifier: "stop",
          buttonTitle: "Stop Timer",
          options: { opensAppToForeground: true },
        },
      ]);

      // Android-specific channel configuration
      if (Platform.OS === "android") {
        // Create multiple channels for different notification types with different sounds
        await Notifications.setNotificationChannelAsync("timer-complete", {
          name: "Timer Complete",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
          sound: CUSTOM_SOUNDS.timer_complete,
          enableVibrate: true,
        });
      }
    } catch (error) {
      console.error("Error setting up notifications:", error);
      setHasPermission(false);
    }
  };

  const scheduleRepeatingNotifications = async (
    startDelay: number,
    blindLevel?: BlindLevel,
    maxDuration: number = 300, // Maximum 5 minutes of continuous notifications
  ) => {
    const notifications: string[] = [];
    const bodyText = blindLevel
      ? `New blind levels: ${blindLevel.small} / ${blindLevel.big}`
      : "Time is up!";

    const soundToUse = CUSTOM_SOUNDS.timer_complete;
    const channelId = "timer-complete";

    try {
      // Schedule notifications every REPEAT_INTERVAL seconds for maxDuration
      const numberOfNotifications = Math.ceil(maxDuration / REPEAT_INTERVAL);

      for (let i = 0; i < numberOfNotifications; i++) {
        const delay = startDelay + i * REPEAT_INTERVAL;

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: "Poker Timer - Time's Up!",
            body: bodyText,
            sound: soundToUse,
            categoryIdentifier: NOTIFICATION_CATEGORY,
            data: {
              type: "timer_complete",
              blindLevel: blindLevel,
              sequenceNumber: i + 1,
              isRepeating: true,
            },
            ...(Platform.OS === "android" && {
              channelId: channelId,
            }),
          },
          trigger: {
            type: SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.max(1, Math.floor(delay)),
          },
        });

        notifications.push(notificationId);
        if (i !== numberOfNotifications - 1) {
          // Schedule auto-dismiss for all but the last notification
          scheduleDismiss(notificationId, delay + REPEAT_INTERVAL);
        }
      }

      setScheduledNotificationIds(notifications);
      setIsContinuousMode(true);
      continuousDataRef.current = {
        blindLevel,
        startTime: Date.now(),
      };

      console.log(
        `Scheduled ${notifications.length} repeating notifications starting in ${startDelay} seconds`,
      );

      return notifications;
    } catch (error) {
      console.error("Failed to schedule repeating notifications:", error);
      return [];
    }
  };

  const scheduleNotification = async (
    seconds: number,
    newBlindLevel?: BlindLevel,
    enableContinuous: boolean = true,
  ) => {
    if (!hasPermission) {
      console.warn("No notification permission, attempting to request...");
      await registerForPushNotificationsAsync();
      if (!hasPermission) {
        console.error("Cannot schedule notification without permission");
        return;
      }
    }

    try {
      // Cancel any existing notifications first
      await clearAllNotifications();

      if (enableContinuous) {
        // Schedule repeating notifications for continuous sound
        await scheduleRepeatingNotifications(seconds, newBlindLevel);
      } else {
        // Schedule single notification (original behavior)
        const bodyText = newBlindLevel
          ? `New blind levels: ${newBlindLevel.small} / ${newBlindLevel.big}`
          : "Time is up!";

        const soundToUse = CUSTOM_SOUNDS.timer_complete;
        const channelId = "timer-complete";

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: "Poker Timer - Time's Up!",
            body: bodyText,
            sound: soundToUse,
            categoryIdentifier: NOTIFICATION_CATEGORY,
            data: {
              type: "timer_complete",
              blindLevel: newBlindLevel,
              isRepeating: false,
            },
            ...(Platform.OS === "android" && {
              channelId: channelId,
            }),
          },
          trigger: {
            type: SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.max(1, Math.floor(seconds)),
          },
        });

        setScheduledNotificationIds([notificationId]);
        console.log(
          `Single notification scheduled for ${seconds} seconds with ID: ${notificationId}`,
        );
      }
    } catch (error) {
      console.error("Failed to schedule notification:", error);
    }
  };

  const stopContinuousNotifications = async () => {
    try {
      if (scheduledNotificationIds.length > 0) {
        // Cancel all scheduled notifications
        await Promise.all(
          scheduledNotificationIds.map((id) =>
            Notifications.cancelScheduledNotificationAsync(id),
          ),
        );

        console.log(
          `Stopped ${scheduledNotificationIds.length} continuous notifications`,
        );
        setScheduledNotificationIds([]);
        setIsContinuousMode(false);
        continuousDataRef.current = null;
      }
    } catch (error) {
      console.error("Failed to stop continuous notifications:", error);
    }
  };

  const cancelNotification = async () => {
    await stopContinuousNotifications();
  };

  // Clear all notifications - both scheduled and delivered
  const clearAllNotifications = async () => {
    try {
      // Cancel all scheduled (future) notifications
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Dismiss all delivered notifications from the notification center/screen
      await Notifications.dismissAllNotificationsAsync();

      // Reset local state
      setScheduledNotificationIds([]);
      setIsContinuousMode(false);
      continuousDataRef.current = null;

      console.log("Cleared all scheduled and delivered notifications");
    } catch (error) {
      console.error("Failed to clear all notifications:", error);
    }
  };

  // Cancel all scheduled notifications (useful for cleanup)
  const cancelAllNotifications = async () => {
    await clearAllNotifications();
  };

  // Get all scheduled notifications (for debugging)
  const getScheduledNotifications = async () => {
    try {
      const notifications =
        await Notifications.getAllScheduledNotificationsAsync();
      console.log("Scheduled notifications:", notifications);
      return notifications;
    } catch (error) {
      console.error("Failed to get scheduled notifications:", error);
      return [];
    }
  };

  const scheduleDismiss = (notificationId: string, delay: number) => {
    setTimeout(async () => {
      try {
        await Notifications.dismissNotificationAsync(notificationId);
      } catch (e) {
        console.warn(
          `Failed to auto-dismiss notification ${notificationId}:`,
          e,
        );
      }
    }, delay * 1000);
  };

  return {
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    clearAllNotifications,
    stopContinuousNotifications,
    getScheduledNotifications,
    hasPermission,
    scheduledNotificationIds,
    isContinuousMode,
    // Utility function to check if continuous notifications are active
    isContinuousActive: () =>
      isContinuousMode && scheduledNotificationIds.length > 0,
  };
}
