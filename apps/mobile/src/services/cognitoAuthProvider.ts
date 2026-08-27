// src/services/cognitoAuthProvider.ts
import {
  confirmSignUpCall,
  deleteAccountCall,
  errorFrom,
  needsRefresh,
  refreshCall,
  resendCodeCall,
  signInCall,
  signOutCall,
  signUpCall,
  tokensFrom,
  accountFromIdToken,
  type Account,
  type AuthProvider,
  type CognitoCall,
  type CognitoConfig,
  type CognitoError,
  type CognitoTokens,
  type SignUpResult,
} from "@poker/core";
import { asyncStorageAdapter } from "@/src/services/storageAdapter";
import { logger } from "@/src/utils/logger";

const TOKENS_KEY = "cognito_tokens";

/**
 * Thrown for a Cognito error a form can do something about.
 *
 * A distinct type rather than a return value because it has to survive four
 * layers of `await` — the alternative is every call site checking a union, and
 * the one that forgets shows a success screen after a failure.
 */
export class CognitoFailure extends Error {
  constructor(readonly reason: CognitoError | "network" | "unknown") {
    super(reason);
    this.name = "CognitoFailure";
  }
}

/** Send one built request. The only place in the app that talks to Cognito. */
const send = async (call: CognitoCall): Promise<unknown> => {
  let response: Response;
  try {
    response = await fetch(call.url, {
      method: "POST",
      headers: call.headers,
      body: call.body,
    });
  } catch (error) {
    // A phone at a poker table is on somebody's hotspot. This is not an
    // exceptional case and should not read like one.
    logger.warn("Cognito unreachable:", error);
    throw new CognitoFailure("network");
  }

  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return body;

  const reason = errorFrom(body);
  // Deliberately not logging the body: it is the only thing here that could
  // contain an address somebody typed.
  logger.warn("Cognito refused:", response.status, reason ?? "unrecognised");
  throw new CognitoFailure(reason ?? "unknown");
};

const readTokens = async (): Promise<CognitoTokens | null> => {
  const raw = await asyncStorageAdapter.getItem(TOKENS_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const tokens = parsed as CognitoTokens;
    return typeof tokens.refreshToken === "string" ? tokens : null;
  } catch {
    return null;
  }
};

const writeTokens = (tokens: CognitoTokens) =>
  asyncStorageAdapter.setItem(TOKENS_KEY, JSON.stringify(tokens));

const forgetTokens = () => asyncStorageAdapter.multiRemove([TOKENS_KEY]);

/**
 * Real accounts, against a real Cognito user pool.
 *
 * Deliberately built on `fetch` and the request builders in `@poker/core`
 * rather than on `aws-amplify`. Amplify brings native modules, which invalidate
 * every existing dev-client binary and grow a release binary — for a feature
 * that stays dark until a backend is deployed. What it would buy is SRP, and
 * the trade there is written up in `@poker/core`'s `cognito.ts`.
 */
export const createCognitoAuthProvider = (
  config: CognitoConfig,
): AuthProvider & {
  /** A valid access token, refreshing first if it is close to expiring. */
  accessToken: () => Promise<string | null>;
} => {
  const provider = {
    async currentAccount(): Promise<Account | null> {
      const tokens = await readTokens();
      return tokens ? accountFromIdToken(tokens.idToken) : null;
    },

    /**
     * Create the account. **This does not sign anybody in.**
     *
     * Cognito emails a code and refuses to authenticate until it comes back,
     * so the screen has to ask for it. Returning as though signed in here is
     * the bug that produces "it worked but I'm not logged in".
     */
    async signUp(email: string, password: string): Promise<SignUpResult> {
      await send(signUpCall(config, email.trim(), password));
      // Cognito emails a code and refuses to authenticate until it comes back,
      // so this is not a signed-in session and must not be reported as one.
      return { status: "needs-confirmation", email: email.trim() };
    },

    async confirmSignUp(email: string, code: string): Promise<void> {
      await send(confirmSignUpCall(config, email.trim(), code.trim()));
    },

    async resendCode(email: string): Promise<void> {
      await send(resendCodeCall(config, email.trim()));
    },

    async signIn(email: string, password: string): Promise<Account> {
      const body = await send(signInCall(config, email.trim(), password));
      const tokens = tokensFrom(body, Date.now());
      if (!tokens) throw new CognitoFailure("unknown");
      await writeTokens(tokens);
      const account = accountFromIdToken(tokens.idToken);
      if (!account) throw new CognitoFailure("unknown");
      return account;
    },

    async signOut(): Promise<void> {
      const tokens = await readTokens();
      // Forgotten locally first, and unconditionally. If the network call
      // fails, the alternative is a phone that has been handed to somebody
      // else and is still signed in.
      await forgetTokens();
      if (!tokens) return;
      try {
        await send(signOutCall(config, tokens.accessToken));
      } catch (error) {
        logger.warn("Global sign-out failed; tokens are gone locally:", error);
      }
    },

    async deleteAccount(): Promise<void> {
      const tokens = await readTokens();
      if (!tokens) throw new CognitoFailure("session-expired");
      // Here the order is the other way round: forgetting first and failing to
      // delete would leave an account nobody can reach to delete.
      const fresh = await provider.accessToken();
      if (!fresh) throw new CognitoFailure("session-expired");
      await send(deleteAccountCall(config, fresh));
      await forgetTokens();
    },

    async accessToken(): Promise<string | null> {
      const tokens = await readTokens();
      if (!tokens) return null;
      if (!needsRefresh(tokens, Date.now())) return tokens.accessToken;

      try {
        const body = await send(refreshCall(config, tokens.refreshToken));
        const refreshed = tokensFrom(body, Date.now(), tokens.refreshToken);
        if (!refreshed) return null;
        await writeTokens(refreshed);
        return refreshed.accessToken;
      } catch (error) {
        // A refresh token expires after ninety days, or is revoked by a global
        // sign-out somewhere else. Either way this session is over, and
        // leaving the dead tokens on disk means every later call fails the
        // same way for the same reason.
        logger.warn("Refresh failed; signing out locally:", error);
        await forgetTokens();
        return null;
      }
    },
  };

  return provider;
};
