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
  hostedTokensFrom,
  tokenExchangeCall,
  type Account,
  type AuthProvider,
  type CognitoCall,
  type CognitoError,
  type CognitoTokens,
  type SignUpResult,
} from "@poker/core";
import { backendConfig, type BackendConfig } from "@/src/services/backendConfig";
import { AUTH_REDIRECT_URI } from "@/src/services/socialSignIn";
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
/**
 * Where `DELETE /me` lives, or `null` when there is no backend.
 *
 * Read from `backendConfig` rather than taken as an argument because the
 * provider is handed a `CognitoConfig`, which knows about the user pool and
 * nothing about the API. Same import `groupApi` makes, for the same reason.
 */
const deleteMeUrl = (): string | null =>
  backendConfig ? `${backendConfig.apiUrl.replace(/\/$/, "")}/me` : null;

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
    /**
     * **Every field, not just the refresh token.** A blob that survived a
     * partial write with only some of them fails later and silently: a missing
     * `idToken` makes `accountFromIdToken` do `.split(".")` on `undefined` and
     * throw on every launch, which `AuthContext` catches into a signed-out
     * state with nothing said. A missing `expiresAt` is worse — `now >= NaN`
     * is `false`, so the expired token is never refreshed, every call 401s,
     * and `resultForStatus` reads that as unreachable and quietly stops
     * draining the outbox.
     *
     * Returning `null` here signs the person out honestly instead, which is
     * the one recoverable outcome of the three.
     */
    return typeof tokens.idToken === "string" &&
      typeof tokens.accessToken === "string" &&
      typeof tokens.refreshToken === "string" &&
      typeof tokens.expiresAt === "number" &&
      Number.isFinite(tokens.expiresAt)
      ? tokens
      : null;
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
  // `BackendConfig`, not `CognitoConfig`: federated sign-in needs the hosted
  // OAuth domain, which is a different host from the pool's own API and cannot
  // be derived from the pool id.
  config: BackendConfig,
): AuthProvider & {
  /** A valid access token, refreshing first if it is close to expiring. */
  accessToken: () => Promise<string | null>;
  /** A valid **ID** token — what the API wants. Refreshed the same way. */
  idToken: () => Promise<string | null>;
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

    /**
     * Finish a hosted-UI sign-in.
     *
     * The browser half — opening the provider, waiting for the redirect,
     * checking the state — belongs to `socialSignIn.ts`, because it is
     * platform work. What lands here is the code it came back with, and from
     * this point on a federated sign-in and a password sign-in are the same
     * thing: exchange, store, decode, return an `Account`.
     *
     * **The exchange answers a different shape from every other call here**,
     * so it needs `hostedTokensFrom` rather than `tokensFrom` — the pool's own
     * API returns `{AuthenticationResult: {…}}` and the OAuth endpoint returns
     * flat snake_case. Passing one to the other's parser returns `null`, which
     * is indistinguishable from a refused sign-in.
     */
    async signInWithProvider({
      code,
      codeVerifier,
    }: {
      code: string;
      codeVerifier: string;
    }): Promise<Account> {
      const body = await send(
        tokenExchangeCall(
          config,
          { domain: config.authDomain, redirectUri: AUTH_REDIRECT_URI },
          { code, codeVerifier },
        ),
      );
      const tokens = hostedTokensFrom(body, Date.now());
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

    /**
     * **Server-side, and the ordering is the whole point.**
     *
     * Calling Cognito's `DeleteUser` directly — which this used to do — removes
     * the login and leaves every membership, claim, player and result behind.
     * Permanently: once the user is gone there is no token left to authenticate
     * a cleanup with, so those rows can never be reached again by anybody. That
     * was fine while the backend held nothing durable per account. It has not
     * been since boards landed.
     *
     * `DELETE /me` clears the data first and the user last, server-side, with
     * credentials of its own, and every step before Cognito is idempotent so a
     * half-finished deletion can be finished by asking again.
     *
     * Tokens are forgotten only once the server confirms. Forgetting first
     * would leave an account nobody can sign into to delete — the mirror of the
     * bug above, and just as final.
     */
    async deleteAccount(): Promise<void> {
      const tokens = await readTokens();
      if (!tokens) throw new CognitoFailure("session-expired");
      const backend = deleteMeUrl();
      if (!backend) {
        // No API to ask. Nothing durable exists to strand either, so the old
        // path is still correct for this build.
        const fresh = await provider.accessToken();
        if (!fresh) throw new CognitoFailure("session-expired");
        await send(deleteAccountCall(config, fresh));
        await forgetTokens();
        return;
      }
      // **The id token**, not the access token: the API's authorizer is a JWT
      // authorizer over the id token, which is what carries `sub` and `email`.
      const id = await provider.idToken();
      if (!id) throw new CognitoFailure("session-expired");
      let response: Response;
      try {
        response = await fetch(backend, {
          method: "DELETE",
          headers: { Authorization: id },
        });
      } catch (error) {
        logger.warn("Account deletion unreachable:", error);
        throw new CognitoFailure("network");
      }
      // **Nothing is forgotten unless the server actually did it.** A failure
      // here leaves the account intact and signed in, which is the state it can
      // be asked from again — every step behind `DELETE /me` is idempotent
      // precisely so a second attempt finishes the job.
      /**
       * **Which failure it was, because the advice differs.** Every non-OK
       * answer used to become `network`, so an expired session on the one
       * screen somebody cannot simply retry — App Store 5.1.1(v) deletion —
       * told them to check their connection while the connection was fine.
       *
       * A 401 is the authorizer refusing the token: sign in again. A 429 is the
       * one worth waiting out. Everything else, 5xx included, is retryable and
       * says so.
       */
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new CognitoFailure("session-expired");
        }
        if (response.status === 429) throw new CognitoFailure("too-many-attempts");
        logger.warn("Account deletion refused:", response.status);
        throw new CognitoFailure("network");
      }
      await forgetTokens();
    },

    async accessToken(): Promise<string | null> {
      const tokens = await freshTokens();
      return tokens?.accessToken ?? null;
    },

    /**
     * The token the **API** wants, which is not the one Cognito's own calls
     * want.
     *
     * Cognito issues both, and they are not interchangeable: the ID token
     * carries `email` and the access token does not, so `GET /me` refuses an
     * access token outright rather than answering 200 with a missing address.
     * Sending the wrong one to some routes and the right one to others is how
     * that becomes a puzzle later, so everything that talks to the API uses
     * this and everything that talks to Cognito uses `accessToken`.
     */
    async idToken(): Promise<string | null> {
      const tokens = await freshTokens();
      return tokens?.idToken ?? null;
    },
  };

  /** Whatever is on disk, refreshed first if it is close to expiring. */
  async function freshTokens(): Promise<CognitoTokens | null> {
    const tokens = await readTokens();
    if (!tokens) return null;
    if (!needsRefresh(tokens, Date.now())) return tokens;

    try {
      const body = await send(refreshCall(config, tokens.refreshToken));
      const refreshed = tokensFrom(body, Date.now(), tokens.refreshToken);
      if (!refreshed) return null;
      await writeTokens(refreshed);
      return refreshed;
    } catch (error) {
      /**
       * **A bad signal is not a dead session.**
       *
       * A refresh token expires after ninety days or is revoked by a global
       * sign-out elsewhere, and then this session really is over — leaving dead
       * tokens on disk would make every later call fail the same way for the
       * same reason.
       *
       * But `send` throws `CognitoFailure("network")` when it cannot reach
       * Cognito at all, and treating *that* as a dead session is how syncing
       * destroys the thing it needs: the queue asks for a token per write, so
       * one drain attempted on a train would sign somebody out and leave every
       * later drain unreachable forever. Offline is exactly when the queue
       * matters most.
       */
      if (error instanceof CognitoFailure && error.reason === "network") {
        logger.warn("Refresh unreachable; keeping the session:", error);
        return null;
      }
      logger.warn("Refresh failed; signing out locally:", error);
      await forgetTokens();
      return null;
    }
  }

  return provider;
};
