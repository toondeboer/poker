// src/hooks/useTimerNotification.ts
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { BlindLevel } from "@/src/types/BlindLevel";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAppState } from "@/src/contexts/AppStateContext";

const NOTIFICATION_CATEGORY = "timerActions";
const REPEAT_INTERVAL = 8; // Schedule next notification slightly before current one ends

// Define your custom sounds - iOS only (Android handled by foreground service)
const CUSTOM_SOUNDS = {
  timer_complete: "alarm.wav",
} as const;

export function useTimerNotification() {
  const [scheduledNotificationIds, setScheduledNotificationIds] = useState<
    string[]
  >([]);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  const { isActive } = useAppState();

  const continuousDataRef = useRef<{
    blindLevel?: BlindLevel;
    startTime: number;
  } | null>(null);

  // Early return for Android - notifications handled by foreground service
  if (Platform.OS === "android") {
    return {
      scheduleNotification: async () => {
        console.log("Android notifications handled by foreground service");
      },
      cancelNotification: async () => {
        console.log("Android notifications handled by foreground service");
      },
    };
  }

  // Configure how notifications are handled when the app is in foreground (iOS only)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        // Only show notifications when app is NOT in foreground
        const shouldShow = !isActive;

        return {
          shouldShowAlert: shouldShow,
          shouldPlaySound: shouldShow,
          shouldSetBadge: false,
          shouldShowBanner: shouldShow,
          shouldShowList: shouldShow,
        };
      },
    });
  }, [isActive]);

  // Request notification permissions on hook initialization (iOS only)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    registerForPushNotificationsAsync();

    // Listen for notification interactions to stop continuous notifications
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    // Clear notifications when app initially loads
    clearAllNotifications();

    return () => {
      subscription.remove();
    };
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (isActive) {
      // Clear all notifications when app comes to foreground
      clearAllNotifications();
    }
  }, [isActive]);

  const handleNotificationResponse = async (
    response: Notifications.NotificationResponse,
  ) => {
    const notificationData = response.notification.request.content.data;

    // If user interacts with a timer notification, stop the continuous notifications
    if (notificationData?.type === "timer_complete") {
      await stopContinuousNotifications();
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
          },
          trigger: {
            type: SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.max(1, Math.floor(delay)),
          },
        });

        notifications.push(notificationId);
      }

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

      await scheduleRepeatingNotifications(seconds, newBlindLevel);
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
      continuousDataRef.current = null;

      console.log("Cleared all scheduled and delivered notifications");
    } catch (error) {
      console.error("Failed to clear all notifications:", error);
    }
  };

  return {
    scheduleNotification,
    cancelNotification,
  };
}
