// src/services/loopbackSessionTransport.ts
import type { SessionTransport, TimerSyncMessage } from "@poker/core";
import { generateId } from "@/src/utils/id";

/**
 * A transport that goes nowhere, for developing the screens against.
 *
 * **It carries nothing between phones.** Everything published lands back in the
 * same process, so hosting and joining on one device exercises the whole path —
 * code, subscribe, publish, apply — without a server existing. The clock-skew
 * problem it is all built around cannot be reproduced here, because there is
 * only one clock.
 *
 * It exists so the wiring can be looked at rather than reasoned about, and so
 * that swapping in AppSync Events later changes one import. That is also why
 * `sessionTransport` below is `null` rather than this: a join code that nobody
 * else can join is worse than no join code, so the entry point stays absent
 * until there is something behind it.
 */
export const loopbackSessionTransport = (): SessionTransport => {
  const sessions = new Map<string, string>();
  const listeners = new Map<string, Set<(message: TimerSyncMessage) => void>>();

  return {
    async host(joinCode: string): Promise<string> {
      const sessionId = generateId();
      sessions.set(joinCode, sessionId);
      return sessionId;
    },

    async resolve(joinCode: string): Promise<string | null> {
      return sessions.get(joinCode) ?? null;
    },

    async publish(sessionId: string, message: TimerSyncMessage): Promise<void> {
      for (const listener of listeners.get(sessionId) ?? []) listener(message);
    },

    subscribe(
      sessionId: string,
      onMessage: (message: TimerSyncMessage) => void,
    ): () => void {
      const forSession = listeners.get(sessionId) ?? new Set();
      forSession.add(onMessage);
      listeners.set(sessionId, forSession);
      return () => {
        forSession.delete(onMessage);
      };
    },
  };
};

/**
 * The transport the app actually uses, or `null` when there isn't one.
 *
 * `null` today: the AppSync Events API is defined in `apps/infra` and has never
 * been deployed. Everything downstream reads this to decide whether shared
 * sessions exist at all, so there is exactly one place to change when it is.
 *
 * To look at the screens during development, put `loopbackSessionTransport()`
 * here — and put it back before committing.
 */
export const sessionTransport: SessionTransport | null = null;
