// src/hooks/useTimerNotification.ts
import { logger } from "@/src/utils/logger";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { BlindLevel, DEFAULT_SOUND_PACK_ID, SoundPackId } from "@poker/core";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useAppState } from "@/src/contexts/AppStateContext";

const NOTIFICATION_CATEGORY = "timerActions";
const REPEAT_INTERVAL = 8; // Schedule next notification slightly before current one ends

// iOS-only custom notification sound files, one per sound pack (Android is
// handled by the foreground service instead). Filenames must exactly match
// what's bundled into the iOS app target — see PokerTimer.xcodeproj.
const CUSTOM_SOUNDS: Record<SoundPackId, string> = {
  alarm: "alarm.wav",
  classic_beep: "classic_beep.wav",
  bell_chime: "bell_chime.wav",
  double_buzz: "double_buzz.wav",
};

export function useTimerNotification() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  const { isActive } = useAppState();

  // Early return for Android - notifications handled by foreground service
  if (Platform.OS === "android") {
    return {
      scheduleNotification: async () => {
        logger.log("Android notifications handled by foreground service");
      },
      cancelNotification: async () => {
        logger.log("Android notifications handled by foreground service");
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

  const handleNotificationResponse = async (
    response: Notifications.NotificationResponse,
  ) => {
    const notificationData = response.notification.request.content.data;

    // If user interacts with a timer notification, stop the continuous notifications
    if (notificationData?.type === "timer_complete") {
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
        logger.warn("Failed to get push token for push notification!");
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
      logger.error("Error setting up notifications:", error);
      setHasPermission(false);
    }
  };

  const scheduleRepeatingNotifications = async (
    startDelay: number,
    blindLevel?: BlindLevel,
    soundPackId: SoundPackId = DEFAULT_SOUND_PACK_ID,
    maxDuration: number = 300, // Maximum 5 minutes of continuous notifications
  ) => {
    const notifications: string[] = [];
    const bodyText = blindLevel
      ? `New blind levels: ${blindLevel.small} / ${blindLevel.big}`
      : "Time is up!";

    const soundToUse = CUSTOM_SOUNDS[soundPackId];

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

      logger.log(
        `Scheduled ${notifications.length} repeating notifications starting in ${startDelay} seconds`,
      );

      return notifications;
    } catch (error) {
      logger.error("Failed to schedule repeating notifications:", error);
      return [];
    }
  };

  const scheduleNotification = async (
    seconds: number,
    newBlindLevel?: BlindLevel,
    soundPackId: SoundPackId = DEFAULT_SOUND_PACK_ID,
  ) => {
    if (!hasPermission) {
      logger.warn("No notification permission, attempting to request...");
      await registerForPushNotificationsAsync();
      if (!hasPermission) {
        logger.error("Cannot schedule notification without permission");
        return;
      }
    }

    try {
      // Cancel any existing notifications first
      await clearAllNotifications();

      await scheduleRepeatingNotifications(seconds, newBlindLevel, soundPackId);
    } catch (error) {
      logger.error("Failed to schedule notification:", error);
    }
  };

  const cancelNotification = async () => {
    await clearAllNotifications();
  };

  // Clear all notifications - both scheduled and delivered
  const clearAllNotifications = async () => {
    try {
      // Cancel all scheduled (future) notifications
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Dismiss all delivered notifications from the notification center/screen
      await Notifications.dismissAllNotificationsAsync();

      logger.log("Cleared all scheduled and delivered notifications");
    } catch (error) {
      logger.error("Failed to clear all notifications:", error);
    }
  };

  // Effects are declared after the functions they call so the React Compiler
  // lint rules don't flag access to a variable before its declaration.

  // Request notification permissions on hook initialization (iOS only)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    // Async permission registration; its setState calls run after awaits as a
    // result of the async work, so the synchronous call here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return {
    scheduleNotification,
    cancelNotification,
  };
}
