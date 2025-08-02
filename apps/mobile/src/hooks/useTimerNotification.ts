// src/hooks/useTimerNotification.ts
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { BlindLevel } from "@/src/types/BlindLevel";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

const NOTIFICATION_CATEGORY = "timerActions";

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
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  // Request notification permissions on hook initialization
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

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
        // You can add action buttons here if needed
        // {
        //   identifier: 'pause',
        //   buttonTitle: 'Pause Timer',
        //   options: { opensAppToForeground: true },
        // },
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

  const scheduleNotification = async (
    seconds: number,
    newBlindLevel?: BlindLevel,
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
      // Cancel any existing notification first
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      }

      const bodyText = newBlindLevel
        ? `New blind levels: ${newBlindLevel.small} / ${newBlindLevel.big}`
        : "Time is up!";

      // Determine which sound to use
      const soundToUse = CUSTOM_SOUNDS.timer_complete;

      // Determine which channel to use (Android only)
      const channelId = "timer-complete";

      const newNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Poker Timer - Time's Up!",
          body: bodyText,
          sound: soundToUse,
          categoryIdentifier: NOTIFICATION_CATEGORY,
          data: {
            type: "timer_complete",
            blindLevel: newBlindLevel,
          },
          ...(Platform.OS === "android" && {
            channelId: channelId,
          }),
        },
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.floor(seconds)), // Ensure at least 1 second, integer
        },
      });

      setNotificationId(newNotificationId);
      console.log(
        `Notification scheduled for ${seconds} seconds with ID: ${newNotificationId}, sound: ${soundToUse}`,
      );
    } catch (error) {
      console.error("Failed to schedule notification:", error);
    }
  };

  const cancelNotification = async () => {
    try {
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        console.log(`Cancelled notification with ID: ${notificationId}`);
        setNotificationId(null);
      } else {
        // Don't throw error, just log warning
        console.warn("No notification to cancel");
      }
    } catch (error) {
      console.error("Failed to cancel notification:", error);
    }
  };

  // Cancel all scheduled notifications (useful for cleanup)
  const cancelAllNotifications = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setNotificationId(null);
      console.log("Cancelled all scheduled notifications");
    } catch (error) {
      console.error("Failed to cancel all notifications:", error);
    }
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

  return {
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    getScheduledNotifications,
    hasPermission,
    notificationId,
  };
}
