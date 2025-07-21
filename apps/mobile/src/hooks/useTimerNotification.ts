// hooks/useTimerNotification.ts
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { BlindLevel } from "@/src/types/BlindLevel";

const NOTIFICATION_CATEGORY = "timerActions";

export function useTimerNotification() {
  const scheduleNotification = async (
    seconds: number,
    newBlindLevel: BlindLevel,
  ) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time is up!",
        body: `New blind levels: ${newBlindLevel.small} / ${newBlindLevel.big}`,
        sound: "default",
        categoryIdentifier: NOTIFICATION_CATEGORY,
      },
      trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  };

  return { scheduleNotification };
}
