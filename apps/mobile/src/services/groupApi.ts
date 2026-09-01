// src/services/groupApi.ts
import {
  reasonForRefusal,
  requestFor,
  resultForStatus,
  type QueuedWrite,
  type SendResult,
} from "@poker/core";
import { backendConfig } from "@/src/services/backendConfig";
import { logger } from "@/src/utils/logger";

/**
 * Sending a queued write, and nothing else.
 *
 * **The decisions are all next door in `@poker/core`** — which route a write
 * goes to, and what a status means — because this app has no test runner, and
 * telling a refusal from a bad signal is the one part worth testing. What is
 * left here is the `fetch` and the token, which is the same split
 * `cognitoAuthProvider` makes.
 */
export type GroupApi = { send: (write: QueuedWrite) => Promise<SendResult> };

/**
 * @param idToken Read per request rather than held. It expires and the provider
 *   refreshes it, so a sender holding one from launch works all evening and
 *   then quietly starts failing.
 */
export const createGroupApi = (
  idToken: () => Promise<string | null>,
  fetcher: typeof fetch = fetch,
): GroupApi => ({
  async send(write) {
    const config = backendConfig;
    // A build with no backend was never meant to sync, and a session that has
    // lapsed may come back. **Both keep the queue** — reporting them as
    // refusals would empty somebody's unsent work into a list they cannot act
    // on.
    if (!config) return { status: "unreachable" };
    const token = await idToken();
    if (!token) return { status: "unreachable" };

    const call = requestFor(write, config.apiUrl);

    let response: Response;
    try {
      response = await fetcher(call.url, {
        method: call.method,
        headers: { Authorization: token, "content-type": "application/json" },
        body: call.body,
      });
    } catch (error) {
      // `fetch` rejects on a network failure rather than resolving. At a table
      // with two bars this is the ordinary case, not an exception.
      logger.warn("Sync unreachable:", error);
      return { status: "unreachable" };
    }

    if (response.ok) return { status: "ok" };

    // Read only when it might be shown to somebody: a body is only useful for a
    // refusal, and `json()` on an empty 5xx throws for nothing.
    const body: unknown = await response.json().catch(() => null);
    const result = resultForStatus(response.status, reasonForRefusal(body));
    if (result.status === "refused") {
      logger.warn(`Sync refused (${response.status}):`, result.reason);
    } else {
      logger.warn(`Sync failed with ${response.status}; will retry`);
    }
    return result;
  },
});
