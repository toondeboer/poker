// src/services/httpSessionTransport.ts
import {
  HEARTBEAT_MS,
  type SessionTransport,
  type TimerSyncMessage,
} from "@poker/core";
import { apiToken } from "@/src/contexts/AuthContext";
import { backendConfig } from "@/src/services/backendConfig";
import { logger } from "@/src/utils/logger";

/**
 * The shared clock, over plain HTTP.
 *
 * **No socket, and that is not a compromise.** The protocol in `@poker/core`
 * publishes a whole state snapshot on a five-second heartbeat and treats a
 * session as stale after fifteen — so a reader that misses one is repaired by
 * the next, and there is nothing a persistent connection would carry that a
 * poll does not. What it would carry instead is an AppSync Events API, a
 * channel namespace, a subscribe authorizer and connection handling, all of
 * which were deleted with the table backend and none of which this needs.
 *
 * **`subscribe` returning its own unsubscribe is the whole reason this fits.**
 * That signature is `setInterval` and `clearInterval` wearing a different name;
 * nothing above it can tell the difference.
 *
 * What it costs is latency: a pause reaches another screen up to one poll late.
 * Every participant can publish, so no screen is merely a viewer — but a press
 * is applied locally the moment it happens and only *other* people see it late,
 * which is the right way round. If that ever stops being a fair trade, this
 * file is the only thing that changes.
 *
 * **Every route needs a signed-in caller.** A session is peer-to-peer, so the
 * join code is a write credential rather than a read one — see `sessions.ts`
 * for why that decided it.
 */

/**
 * How often a viewer asks.
 *
 * **Slightly under the heartbeat, deliberately.** Polling at exactly
 * `HEARTBEAT_MS` means every poll races the write it is trying to read and half
 * of them lose, doubling the observed latency for no extra requests. A little
 * faster and each heartbeat is picked up by the next poll.
 */
const POLL_MS = Math.round(HEARTBEAT_MS * 0.8);

/** Long enough to cross a bad connection, short enough not to stack up polls. */
const TIMEOUT_MS = 4_000;

const request = async (
  path: string,
  init?: RequestInit,
): Promise<Response | null> => {
  const config = backendConfig;
  if (!config) return null;
  /**
   * Read per request rather than held, for the same reason `groupApi` does it:
   * the token expires and the provider refreshes it, so one taken when the
   * screen opened works for a while and then quietly starts failing — which on
   * a poll would look exactly like the host having left.
   */
  const token = await apiToken();
  if (!token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${config.apiUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        Authorization: token,
        ...init?.headers,
      },
      signal: controller.signal,
    });
  } catch (error) {
    // **A failed poll is not an event.** Signal comes and goes at a kitchen
    // table, and the protocol already says what a gap means: the session goes
    // `stale` after fifteen seconds and recovers by itself when messages
    // resume. Surfacing every miss would turn ordinary wifi into an error
    // somebody has to dismiss.
    logger.warn("Shared clock request failed", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const httpSessionTransport = (): SessionTransport => ({
  /**
   * The join code *is* the session id.
   *
   * There is no second identifier to look up, so joining is one request rather
   * than two — and joining is the moment somebody is standing there waiting.
   * `host` returning the code it was given is not a stub; it is the id.
   */
  async host(joinCode: string): Promise<string> {
    const response = await request("/sessions", {
      method: "POST",
      body: JSON.stringify({ joinCode }),
    });
    if (!response?.ok) {
      throw new Error(
        `could not host a session (${response?.status ?? "offline"})`,
      );
    }
    return joinCode;
  },

  async resolve(joinCode: string): Promise<string | null> {
    const response = await request(`/sessions/${encodeURIComponent(joinCode)}`);
    if (!response?.ok) return null;
    return joinCode;
  },

  async publish(sessionId: string, message: TimerSyncMessage): Promise<void> {
    await request(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },

  subscribe(
    sessionId: string,
    onMessage: (message: TimerSyncMessage) => void,
  ): () => void {
    let stopped = false;
    /**
     * Only forward what is new.
     *
     * The row is read every poll whether or not it changed, so without this the
     * same snapshot arrives four times a heartbeat. `shouldApply` upstream
     * would discard the repeats correctly, but it would also mean
     * `lastMessageAt` never stops advancing — and that is what decides whether
     * a session reads as `live` or `stale`. A host who closed the app would
     * look alive forever.
     */
    let lastSeen: number | null = null;

    const poll = async () => {
      const response = await request(
        `/sessions/${encodeURIComponent(sessionId)}`,
      );
      if (stopped || !response?.ok) return;
      const body: unknown = await response.json().catch(() => null);
      const message = (body as { message?: TimerSyncMessage } | null)?.message;
      if (!message || typeof message.version !== "number") return;
      if (lastSeen !== null && message.version <= lastSeen) return;
      lastSeen = message.version;
      onMessage(message);
    };

    // Once immediately, so joining shows the clock rather than a blank screen
    // for the first poll interval.
    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  },
});
