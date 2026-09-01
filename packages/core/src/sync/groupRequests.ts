/**
 * The shape of a request to the shared-board API, and what its answer means.
 *
 * **This module performs no I/O**, for the same reason `auth/cognito.ts` does
 * not: it builds requests and reads statuses, and the app does the fetching.
 * That keeps `@poker/core` framework-agnostic — and, more usefully here, makes
 * the one genuinely subtle decision testable without a network.
 *
 * The subtle decision is telling a **refusal** from **silence**. A refusal is
 * the server considering the request and saying no, and retrying it forever is
 * a queue that never drains. Silence is a bad signal, and dropping the write
 * loses somebody's evening. Getting it backwards is bad in both directions,
 * and the difference is not simply "did it fail".
 */

import type { QueuedWrite } from "./pendingWrites";
import type { SendResult } from "./drain";

/** A request for the app to send. Deliberately not a `Request`. */
export type GroupCall = {
  url: string;
  method: "POST";
  /** Already serialised, so the caller cannot change the shape by accident. */
  body: string;
};

/**
 * Where a write goes.
 *
 * Only the two additive kinds exist, so this is total without a default — and
 * if a third is ever added, this stops compiling rather than silently posting
 * it to the wrong place.
 */
export const requestFor = (write: QueuedWrite, baseUrl: string): GroupCall => {
  const base = baseUrl.replace(/\/$/, "");
  switch (write.kind) {
    case "createGroup":
      return {
        url: `${base}/groups`,
        method: "POST",
        // The id goes with it: a board made offline has to keep the id its
        // players and games already name.
        body: JSON.stringify({ groupId: write.groupId, name: write.name }),
      };
    case "addPlayer":
      return {
        url: `${base}/groups/${encodeURIComponent(write.groupId)}/players`,
        method: "POST",
        // **The `accountId` is not sent**, even when the local copy has one.
        // Adding is not claiming; the server ignores it, and sending it would
        // suggest otherwise to whoever reads this next.
        body: JSON.stringify({
          player: { id: write.player.id, name: write.player.name },
        }),
      };
    case "recordGame":
      return {
        url: `${base}/groups/${encodeURIComponent(write.groupId)}/games`,
        method: "POST",
        body: JSON.stringify({ result: write.result }),
      };
  }
};

/**
 * What an HTTP status means for a queued write.
 *
 * - **2xx** — it landed.
 * - **4xx** — the server read it and said no. An answer, so it is never
 *   retried, and somebody is told.
 * - **5xx** — the server fell over. It never considered the request, so calling
 *   this a refusal would tell somebody their game was rejected when nothing
 *   ever read it. Retried.
 * - **401, 408 and 429 are the exceptions inside 4xx**, all of them "ask
 *   again" rather than "no":
 *   - a **timeout** and a **rate limit** would otherwise throw away a write
 *     because the server was busy, which is the failure a queue exists to
 *     prevent;
 *   - a **401** is a token problem, and it is the dangerous one. `drain`
 *     carries on past refusals, so one stale token would refuse *every*
 *     pending write in a single pass and move the lot somewhere nothing
 *     retries — an expired session silently eating an evening's work.
 *
 * A **403** stays a refusal, and the difference is worth being deliberate
 * about: 401 is "I do not know who you are", which a fresh token fixes, and 403
 * is "I know, and no" — `an admin has to do that`, which retrying cannot
 * change.
 */
export const RETRYABLE_STATUSES: readonly number[] = [401, 408, 429];

export const resultForStatus = (status: number, reason: string): SendResult => {
  if (status >= 200 && status < 300) return { status: "ok" };
  if (RETRYABLE_STATUSES.includes(status)) return { status: "unreachable" };
  if (status >= 400 && status < 500) return { status: "refused", reason };
  return { status: "unreachable" };
};

/**
 * The sentence to show somebody, out of whatever the server sent back.
 *
 * A refusal reaches a person eventually, so it has to be a sentence rather than
 * a status code. The API answers `{reason}` for a conflict and `{error}` for a
 * bad request; anything else gets a fallback, because "the server would not
 * accept it" is at least true.
 */
export const reasonFrom = (body: unknown): string => {
  if (typeof body === "object" && body !== null) {
    const { reason, error } = body as { reason?: unknown; error?: unknown };
    if (typeof reason === "string" && reason.length > 0) return reason;
    if (typeof error === "string" && error.length > 0) return error;
  }
  return "the server would not accept it";
};
