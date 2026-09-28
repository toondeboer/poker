import { StorageAdapter } from "./StorageAdapter";

export const SHARED_SESSION_KEY = "shared_session";

/**
 * Which session this phone belongs to, remembered across a restart.
 *
 * **Only the membership, never the clock.** The session's actual state — round,
 * level, countdown, who paused it — lives on the server and arrives on the next
 * poll. Storing a copy here would give a restarted phone a stale clock to
 * display before the first message lands, which is worse than showing nothing:
 * a wrong time on a tournament clock is read and acted on, an absent one is not.
 */
export type StoredSharedSession = {
  /** `hosting` or `joined` — a restarted host must not come back as a guest. */
  status: "hosting" | "joined";
  /** The six-character code, normalised. */
  code: string;
};

export interface SessionStorage {
  loadSharedSession(): Promise<StoredSharedSession | null>;
  saveSharedSession(session: StoredSharedSession): Promise<void>;
  clearSharedSession(): Promise<void>;
}

const coerce = (raw: unknown): StoredSharedSession | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const { status, code } = value;
  if (status !== "hosting" && status !== "joined") return null;
  if (typeof code !== "string" || code.length === 0) return null;
  return { status, code };
};

/**
 * Create a shared-session store backed by any {@link StorageAdapter}.
 *
 * **Anything unreadable reads as "not in a session".** There is no default to
 * fall back to the way payout settings have one — a half-written value must not
 * become a phone claiming to host a clock that nobody else is in.
 */
export function createSessionStorage(storage: StorageAdapter): SessionStorage {
  return {
    async loadSharedSession(): Promise<StoredSharedSession | null> {
      try {
        const raw = await storage.getItem(SHARED_SESSION_KEY);
        if (!raw) return null;
        return coerce(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    async saveSharedSession(session: StoredSharedSession): Promise<void> {
      try {
        await storage.setItem(SHARED_SESSION_KEY, JSON.stringify(session));
      } catch {
        // Deliberately swallowed. Failing to remember the session must never
        // fail the join that just succeeded — the cost is the restart problem
        // this exists to fix, not a refused join.
      }
    },
    async clearSharedSession(): Promise<void> {
      try {
        await storage.setItem(SHARED_SESSION_KEY, "");
      } catch {
        // Same reasoning: leaving must always work locally.
      }
    },
  };
}
