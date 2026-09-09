/**
 * Telling the other people on a board that something happened.
 *
 * **Expo's push service, not APNs and FCM.** The app is an Expo app and already
 * holds `expo-notifications`, so a token is one call away and Expo holds the
 * platform credentials. Doing it directly would mean an APNs key, an FCM
 * service account, two payload shapes and a per-platform failure mode — for the
 * same result. If the app ever leaves Expo this is the file that changes.
 *
 * ## What it will not do
 *
 * **It never fails a write.** Recording a game is the thing somebody pressed a
 * button for; the notification is a courtesy to people who are not looking.
 * Every failure here is swallowed and logged, because a board that refuses to
 * record a result because somebody's phone was uninstallable would be a far
 * worse app than one that quietly does not buzz.
 *
 * **It never notifies the person who acted.** They are holding the phone.
 */

import { log } from "./logging";
import type { PushStore } from "./pushStore";

/** Expo's endpoint. Public, and rate-limited per token rather than per caller. */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Expo's cap on one request. Larger lists have to be split, and a board with
 * more members than this is not a thing that happens — but the sender should
 * not be the reason it breaks if it ever does.
 */
export const PUSH_BATCH_SIZE = 100;

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  /** What the app routes on when somebody taps it. */
  data: { kind: "result-recorded"; groupId: string };
};

/**
 * What the notification says.
 *
 * **Names the board, not the result.** "Ann won" would be the more interesting
 * sentence and it is the wrong one: a board name is chosen by the group, while
 * a player name is typed by whoever added them, and a push notification is the
 * one surface that shows text on a locked screen to somebody who did not open
 * the app. Keeping user-typed names off the lock screen means the moderation
 * story here is the same one the board already has, rather than a new one.
 *
 * Exported and pure so the wording is testable without a network.
 */
export const resultRecordedMessage = (
  token: string,
  boardName: string,
  groupId: string,
): PushMessage => ({
  to: token,
  title: boardName,
  body: "A game night was added to this board.",
  data: { kind: "result-recorded", groupId },
});

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
};

export type PushSender = {
  resultRecorded(params: {
    groupId: string;
    boardName: string;
    /** Everybody on the board, including whoever just recorded. */
    memberIds: string[];
    /** Who acted, so they are not told about their own press. */
    actorId: string;
  }): Promise<void>;
};

export const createPushSender = (
  store: PushStore,
  fetcher: typeof fetch = fetch,
): PushSender => ({
  async resultRecorded({ groupId, boardName, memberIds, actorId }) {
    try {
      const others = memberIds.filter((id) => id !== actorId);
      if (others.length === 0) return;

      // Kept as pairs, not a flat list of tokens. A token does not carry the
      // account that owns it, and `forgetDeadTokens` below needs both to delete
      // a row — losing the association here is what would make an uninstalled
      // device unforgettable.
      const owned: { accountId: string; token: string }[] = (
        await Promise.all(
          others.map(async (accountId) =>
            (await store.tokensFor(accountId)).map((token) => ({
              accountId,
              token,
            })),
          ),
        )
      ).flat();
      if (owned.length === 0) return;

      for (const batch of chunk(owned, PUSH_BATCH_SIZE)) {
        const messages = batch.map(({ token }) =>
          resultRecordedMessage(token, boardName, groupId),
        );
        const response = await fetcher(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // Expo compresses large batches; saying so avoids a 413 on a big
            // board rather than discovering the limit in production.
            "accept-encoding": "gzip, deflate",
          },
          body: JSON.stringify(messages),
        });
        if (!response.ok) {
          log("warn", "push batch refused", { status: response.status });
          continue;
        }
        await forgetDeadTokens(store, batch, response);
      }
    } catch (error) {
      // Swallowed on purpose — see the header. A push that did not send is not
      // a reason for a recorded game to fail.
      log("warn", "push failed", { reason: String(error) });
    }
  },
});

/**
 * Clear out tokens Expo says are gone.
 *
 * `DeviceNotRegistered` is the only signal there is that an app was
 * uninstalled — nothing else tells the server. Without this the row lives until
 * its TTL and every future notification pays for a device that cannot receive
 * one.
 */
const forgetDeadTokens = async (
  store: PushStore,
  batch: { accountId: string; token: string }[],
  response: Response,
): Promise<void> => {
  const body: unknown = await response.json().catch(() => null);
  const tickets = (body as { data?: unknown[] } | null)?.data;
  if (!Array.isArray(tickets)) return;
  // Expo answers positionally: ticket *i* is the verdict on message *i*, which
  // is the only thing tying a verdict back to a row.
  await Promise.all(
    tickets.map(async (ticket, index) => {
      const details = (ticket as { details?: { error?: string } })?.details;
      if (details?.error !== "DeviceNotRegistered") return;
      const owner = batch[index];
      if (!owner) return;
      log("info", "forgetting a token Expo says is gone", {
        accountId: owner.accountId,
      });
      await store.forget(owner.accountId, owner.token);
    }),
  );
};
