// src/services/stubAuthProvider.ts
import type { Account, AuthProvider, SignUpResult } from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";
import { generateId } from "@/src/utils/id";

const STORAGE_KEY = "stub_account";

/**
 * App-owned keys a recovery reset clears, beside the ones `@poker/core` names.
 *
 * Storage this app writes itself does not appear in core's accounting, and a
 * key left out of both is a key a recovery cannot recover — so anything added
 * here goes in this list at the same time.
 */
export const RECOVERABLE_APP_KEYS: readonly string[] = [STORAGE_KEY];

/**
 * A stand-in for a real identity provider, for developing the screens against.
 *
 * **This signs nobody up.** It records an email on this device and hands back
 * an id; there is no server, no verification, no password stored and nothing
 * checked. Any password of a legal length signs any address in, and the same
 * address on another phone is a different person entirely.
 *
 * It exists so the account screens can be built and looked at before the
 * backend is deployed. That is also why **nothing links to those screens** —
 * see ROADMAP.md. Shipping a sign-up form that signs nobody up is worse than
 * shipping no sign-up form, so the entry point is deliberately absent until
 * there is something behind it.
 *
 * When Cognito is live, this file is replaced and nothing above it changes:
 * that is what the {@link AuthProvider} seam is for.
 */
export const stubAuthProvider: AuthProvider = {
  async currentAccount(): Promise<Account | null> {
    const raw = await asyncStorageAdapter.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as Account).id === "string" &&
        typeof (parsed as Account).email === "string"
      ) {
        return parsed as Account;
      }
      return null;
    } catch {
      return null;
    }
  },

  async signUp(email: string): Promise<SignUpResult> {
    const account: Account = { id: generateId(), email: email.trim() };
    await asyncStorageAdapter.setItem(STORAGE_KEY, JSON.stringify(account));
    // No address is verified here because none is sent anywhere, so the stub
    // answers the confirmation question with "already done". A real provider
    // says `needs-confirmation`, and the screen handles both.
    return { status: "signed-in", account };
  },

  async confirmSignUp(): Promise<void> {
    // Nothing to confirm: nothing was ever emailed.
  },

  async resendCode(): Promise<void> {
    // As above. Silently doing nothing is right here and would be a bug in a
    // real provider, which is why the interface makes every provider answer.
  },

  async signIn(email: string): Promise<Account> {
    // No password check, because there is nothing to check it against. A real
    // provider rejects here; this one cannot, and pretending otherwise would
    // make the screens look tested when they are not.
    const existing = await stubAuthProvider.currentAccount();
    if (existing && existing.email === email.trim()) return existing;
    const created = await stubAuthProvider.signUp(email, "");
    if (created.status !== "signed-in") throw new Error("unreachable");
    return created.account;
  },

  async signOut(): Promise<void> {
    await asyncStorageAdapter.multiRemove([STORAGE_KEY]);
  },

  async deleteAccount(): Promise<void> {
    await asyncStorageAdapter.multiRemove([STORAGE_KEY]);
  },
};
