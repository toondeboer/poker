// src/services/groupApi.ts
import {
  NO_FEATURES,
  readFeatures,
  readRemoteBoard,
  reasonForRefusal,
  requestFor,
  resultForStatus,
  type Features,
  type RemoteBoard,
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
export type GroupApi = {
  send: (write: QueuedWrite) => Promise<SendResult>;
  /**
   * Read a board back.
   *
   * `null` for every reason a phone should keep what it has: no backend, no
   * session, no signal, a board this account cannot see. **None of them are
   * distinguished here on purpose** — the only correct response to all four is
   * to leave local state alone, and a caller offered four cases would sooner or
   * later treat one of them as "the board is empty".
   */
  board: (groupId: string) => Promise<RemoteBoard | null>;
  /**
   * What the server says the app may do — the kill switch.
   *
   * Unauthenticated, because a phone has to be able to ask before it has an
   * account: otherwise somebody signed out could never learn that sign-in has
   * been switched off, which is the state the switch exists for.
   */
  features: () => Promise<Features>;
  /**
   * Every board this account is on.
   *
   * **The only way a board reaches a second device.** Joining writes a
   * membership on the server; without asking for the list, the board exists only
   * on the phone that redeemed the link — so a reinstall, or the same person's
   * other phone, would show nothing.
   *
   * `null` rather than an empty list when it could not be asked, because those
   * are very different things: one means "you are on no boards", the other means
   * "do not touch what is already here".
   */
  myBoards: () => Promise<string[] | null>;
  /**
   * Mint the link for a board. Admin only, server-side.
   *
   * **Creating and revoking are the same call.** The link never expires, so
   * rotating it is the only way to take one back — and there is deliberately no
   * state in which a board has two working links.
   */
  createInvite: (groupId: string) => Promise<string | null>;
  /**
   * Redeem somebody's link.
   *
   * Says which board was joined, or why not in words a screen can show. The
   * distinction matters here in a way it does not for a queued write: somebody
   * is watching this one happen.
   */
  redeemInvite: (token: string) => Promise<
    { ok: true; groupId: string } | { ok: false; reason: string }
  >;
};

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

  async board(groupId) {
    const config = backendConfig;
    if (!config) return null;

    try {
      // **Inside the try.** `idToken()` can reject — the provider reads storage
      // before its own error handling — and an escaping rejection breaks the
      // `null` contract these methods promise, taking the pull loop down with it.
      const token = await idToken();
      if (!token) return null;
      const response = await fetcher(
        `${config.apiUrl.replace(/\/$/, "")}/groups/${encodeURIComponent(groupId)}`,
        { headers: { Authorization: token } },
      );
      if (!response.ok) {
        // A 404 is the ordinary answer for a board this account is not on —
        // the API answers that rather than 403, so membership is not something
        // a stranger can probe for. Nothing to merge either way.
        logger.warn(`Could not read board ${groupId}: ${response.status}`);
        return null;
      }
      return readRemoteBoard(await response.json());
    } catch (error) {
      logger.warn("Could not read board:", error);
      return null;
    }
  },

  async myBoards() {
    const config = backendConfig;
    if (!config) return null;
    try {
      const token = await idToken();
      if (!token) return null;
      const response = await fetcher(`${config.apiUrl.replace(/\/$/, "")}/groups`, {
        headers: { Authorization: token },
      });
      if (!response.ok) {
        logger.warn(`Could not list boards: ${response.status}`);
        return null;
      }
      const body = (await response.json()) as { groups?: unknown };
      return Array.isArray(body.groups)
        ? body.groups.filter((id): id is string => typeof id === "string")
        : [];
    } catch (error) {
      logger.warn("Could not list boards:", error);
      return null;
    }
  },

  async features() {
    const config = backendConfig;
    if (!config) return NO_FEATURES;
    try {
      const response = await fetcher(`${config.apiUrl.replace(/\/$/, "")}/config`);
      // **Anything other than a clean answer means off.** A 500, an HTML error
      // page from something in front of the API, a timeout — none of them are
      // the server saying yes, and treating them as such is how the switch
      // fails to switch anything off.
      if (!response.ok) return NO_FEATURES;
      return readFeatures(await response.json());
    } catch (error) {
      logger.warn("Could not read the server config:", error);
      return NO_FEATURES;
    }
  },

  async createInvite(groupId) {
    const config = backendConfig;
    if (!config) return null;
    try {
      const token = await idToken();
      if (!token) return null;
      const response = await fetcher(
        `${config.apiUrl.replace(/\/$/, "")}/groups/${encodeURIComponent(groupId)}/invite`,
        { method: "POST", headers: { Authorization: token } },
      );
      if (!response.ok) {
        logger.warn(`Could not create an invite: ${response.status}`);
        return null;
      }
      const body = (await response.json()) as { token?: unknown };
      return typeof body.token === "string" ? body.token : null;
    } catch (error) {
      logger.warn("Could not create an invite:", error);
      return null;
    }
  },

  async redeemInvite(invite) {
    const config = backendConfig;
    if (!config) return { ok: false, reason: "This build cannot join boards." };
    try {
      const token = await idToken();
      // The one refusal worth naming precisely: joining is the first thing in
      // the app that *requires* an account, and "sign in first" is actionable
      // where "something went wrong" is not.
      if (!token) return { ok: false, reason: "Sign in to join a board." };
      const response = await fetcher(
        `${config.apiUrl.replace(/\/$/, "")}/invites/${encodeURIComponent(invite)}`,
        { method: "POST", headers: { Authorization: token } },
      );
      const body: unknown = await response.json().catch(() => null);
      if (response.ok) {
        const groupId = (body as { groupId?: unknown } | null)?.groupId;
        if (typeof groupId === "string") return { ok: true, groupId };
        return { ok: false, reason: "The server did not say which board." };
      }
      logger.warn(`Invite refused (${response.status})`);
      return {
        ok: false,
        reason:
          response.status === 404
            ? "That link has expired or been replaced. Ask for a new one."
            : reasonForRefusal(body) ?? "That link could not be used.",
      };
    } catch (error) {
      logger.warn("Could not redeem an invite:", error);
      return { ok: false, reason: "No connection. Try again when you have signal." };
    }
  },
});
