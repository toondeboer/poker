// hooks/useTimerNotification.ts
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { BlindLevel } from "@/src/types/BlindLevel";
import { useState } from "react";

const NOTIFICATION_CATEGORY = "timerActions";

export function useTimerNotification() {
  const [notificationId, setNotificationId] = useState<string | null>(null);

  const scheduleNotification = async (
    seconds: number,
    newBlindLevel: BlindLevel,
  ) => {
    const newNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time is up!",
        body: `New blind levels: ${newBlindLevel.small} / ${newBlindLevel.big}`,
        sound: "default",
        categoryIdentifier: NOTIFICATION_CATEGORY,
      },
      trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
    setNotificationId(newNotificationId);
  };

  const cancelNotification = async () => {
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      setNotificationId(null);
    } else {
      throw new Error("No notification to cancel");
    }
  };

  return { scheduleNotification, cancelNotification };
}
