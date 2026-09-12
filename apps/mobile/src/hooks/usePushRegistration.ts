// src/hooks/usePushRegistration.ts
import { useEffect } from "react";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import {
  apiToken,
  onSignedIn,
  signedInAccountId,
} from "@/src/contexts/AuthContext";
import { backendConfig } from "@/src/services/backendConfig";
import { logger } from "@/src/utils/logger";

/**
 * Tell the server where to reach this device, once there is somebody to reach.
 *
 * **Only while signed in.** A push token is stored against an account, so there
 * is nowhere to put one before that — and re-registering on every sign-in is
 * what keeps a shared phone from buzzing for whoever used it last.
 *
 * ## Why this asks for nothing
 *
 * It never prompts. `getExpoPushTokenAsync` needs permission, and the app
 * already asks for notification permission for the timer alarm — so by the time
 * anybody has a board worth being notified about, the answer exists. Asking
 * again here, for a feature somebody has not used yet, is the request people
 * decline.
 *
 * If permission was refused, this quietly does nothing. That is the correct
 * outcome and not an error: somebody who said no to notifications should not
 * get notifications.
 */
export function usePushRegistration(): void {
  useEffect(() => {
    let cancelled = false;

    const register = async () => {
      if (!backendConfig) return;
      if (!signedInAccountId()) return;

      try {
        const { status } = await Notifications.getPermissionsAsync();
        // **Not `requestPermissionsAsync`.** See above: this rides on the
        // answer the timer already has rather than asking for its own.
        if (status !== "granted") return;

        /**
         * The EAS project id, which Expo's push service needs to route to the
         * right app. Read from the config rather than hardcoded so a second
         * project — a staging build, say — cannot silently send to this one.
         */
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        if (typeof projectId !== "string") {
          logger.warn("No EAS project id; not registering for push");
          return;
        }

        const { data: token } = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        if (cancelled || !token) return;

        const auth = await apiToken();
        if (!auth || cancelled) return;

        await fetch(
          `${backendConfig.apiUrl.replace(/\/$/, "")}/me/push-token`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Authorization: auth,
            },
            body: JSON.stringify({ token }),
          },
        );
      } catch (error) {
        // **Never surfaced.** Not being reachable by push is a degraded
        // courtesy, not a broken app, and there is nothing the person holding
        // the phone could do about it anyway.
        logger.warn("Could not register for push", error);
      }
    };

    void register();
    // Registering again on each sign-in is the point: the token belongs to the
    // account, so signing in as somebody else has to move it.
    const stop = onSignedIn(() => void register());
    return () => {
      cancelled = true;
      stop();
    };
  }, []);
}
