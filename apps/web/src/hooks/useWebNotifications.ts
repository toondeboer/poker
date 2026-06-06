import { useCallback, useEffect, useState } from "react";

/**
 * Browser notifications + speech synthesis for announcing blind changes.
 * All calls are no-ops when the relevant browser API is unavailable.
 */
export function useWebNotifications() {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission =
    useCallback(async (): Promise<NotificationPermission> => {
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        const result = await Notification.requestPermission();
        setPermission(result);
        return result;
      }
      return permission;
    }, [permission]);

  const notify = useCallback((title: string, body: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "poker-timer",
        requireInteraction: true,
      });
    } catch (error) {
      console.warn("Notification failed:", error);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { permission, requestPermission, notify, speak };
}
