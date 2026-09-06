/**
 * Signing in with Apple or Google, which a user pool only does one way.
 *
 * **There is no call that trades a provider's id token for pool tokens.** The
 * app opens Cognito's hosted endpoint, Cognito sends the person to Apple or
 * Google, the provider redirects back to Cognito, and Cognito redirects to the
 * app with a **code** — which is then exchanged for the same
 * {@link CognitoTokens} that a password sign-in produces. (An *identity* pool
 * does accept a provider token directly, and hands back AWS credentials rather
 * than the pool tokens every route in this API authorises against.)
 *
 * So this module is two URLs and one request, built here for the same reason
 * `cognito.ts` builds the others here: the shaping is where the mistakes are,
 * and it is testable without a network. The app opens the browser and supplies
 * `fetch`.
 *
 * ## PKCE, and why the caller brings its own randomness
 *
 * The code that comes back is single-use, but on a phone it arrives through a
 * **custom URL scheme** — and any app on the device can claim to handle
 * `pokerkit://`. PKCE closes that: the app invents a secret, sends only its
 * hash to start the flow, and proves it at the exchange. An interceptor with
 * the code and no verifier has nothing.
 *
 * The verifier and its hash are made by the caller because this package has no
 * crypto — `lib: ["esnext"]`, `types: []`, so there is no `crypto`, no
 * `Buffer`, and no `atob`. The app supplies them from `expo-crypto`, the same
 * way it supplies `fetch`. This module says what they must *look* like
 * ({@link isValidCodeVerifier}) so a caller that gets it wrong fails here
 * rather than at the token endpoint.
 */

import type { CognitoConfig, CognitoTokens } from "./cognito";
import { tokensFrom } from "./cognito";

/** The providers this app offers, named as Cognito names them. */
export type HostedProvider = "Google" | "SignInWithApple";

/**
 * Where the hosted UI lives.
 *
 * Separate from {@link CognitoConfig} because it is a *different host* — the
 * pool is reached at `cognito-idp.<region>.amazonaws.com`, and this is the
 * chosen domain prefix. Deriving one from the other is not possible, which is
 * why it is passed rather than computed.
 */
export type HostedUiConfig = {
  /** e.g. `https://pokerkit.auth.us-east-1.amazoncognito.com`, no trailing slash. */
  domain: string;
  /** Where the hosted UI sends the browser back to, e.g. `pokerkit://auth`. */
  redirectUri: string;
};

/**
 * The scopes asked for, and why these three.
 *
 * `openid` is what makes the response an id token rather than only an access
 * token — without it there is no `sub` to key an account by. `email` is what
 * the account-linking trigger matches on. `profile` carries the name, which is
 * the difference between a leaderboard row saying "Ann" and one saying nothing.
 */
export const HOSTED_SCOPES = ["openid", "email", "profile"] as const;

const encode = (params: Record<string, string>): string =>
  Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

/**
 * RFC 7636: 43–128 characters from an unreserved set.
 *
 * Checked rather than trusted because the failure is remote and unhelpful —
 * the token endpoint answers `invalid_grant`, which is the same thing it says
 * for an expired code, a reused code and a mismatched redirect.
 */
export const isValidCodeVerifier = (verifier: string): boolean =>
  verifier.length >= 43 &&
  verifier.length <= 128 &&
  /^[A-Za-z0-9\-._~]+$/.test(verifier);

/**
 * The URL to open in a browser to start signing in.
 *
 * `identity_provider` is what skips Cognito's own account-picker page and goes
 * straight to Apple or Google — without it the person lands on a hosted login
 * form asking for a password they may not have.
 */
export const authorizeUrl = (
  config: CognitoConfig,
  hosted: HostedUiConfig,
  params: {
    provider: HostedProvider;
    /** Hash of the verifier, base64url, supplied by the caller. */
    codeChallenge: string;
    /** Opaque value echoed back, so a stray redirect can be told from ours. */
    state: string;
  },
): string =>
  `${hosted.domain.replace(/\/$/, "")}/oauth2/authorize?${encode({
    identity_provider: params.provider,
    client_id: config.clientId,
    response_type: "code",
    scope: HOSTED_SCOPES.join(" "),
    redirect_uri: hosted.redirectUri,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  })}`;

/**
 * What comes back on the redirect, read out of the URL.
 *
 * **The state is compared by the caller, not here**, because this cannot know
 * what it sent. Returning it rather than checking it keeps that comparison
 * somewhere it can be done against the value actually used.
 *
 * A provider that refuses, or somebody who cancels, comes back with `error`
 * instead of `code` — which is an ordinary outcome and not a failure to log.
 */
export type RedirectResult =
  | { status: "code"; code: string; state: string | null }
  | { status: "error"; error: string; state: string | null }
  | { status: "unusable" };

export const readRedirect = (url: string): RedirectResult => {
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  if (query.length === 0) return { status: "unusable" };

  const params = new Map<string, string>();
  for (const pair of query.split("&")) {
    const at = pair.indexOf("=");
    if (at <= 0) continue;
    params.set(
      decodeURIComponent(pair.slice(0, at)),
      decodeURIComponent(pair.slice(at + 1).replace(/\+/g, " ")),
    );
  }

  const state = params.get("state") ?? null;
  const error = params.get("error");
  if (error) return { status: "error", error, state };
  const code = params.get("code");
  if (code) return { status: "code", code, state };
  return { status: "unusable" };
};

/**
 * The request that turns a code into tokens.
 *
 * Form-encoded rather than JSON — the OAuth token endpoint takes
 * `application/x-www-form-urlencoded` and answers `invalid_request` to
 * anything else, which reads like a problem with the values rather than with
 * the encoding.
 *
 * **No client secret.** The app client is public, which is exactly why PKCE is
 * carrying the weight here.
 */
export const tokenExchangeCall = (
  config: CognitoConfig,
  hosted: HostedUiConfig,
  params: { code: string; codeVerifier: string },
): { url: string; headers: Record<string, string>; body: string } => ({
  url: `${hosted.domain.replace(/\/$/, "")}/oauth2/token`,
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: encode({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code: params.code,
    redirect_uri: hosted.redirectUri,
    code_verifier: params.codeVerifier,
  }),
});

/**
 * Tokens out of the hosted UI's answer.
 *
 * **A different shape from every other call in `cognito.ts`.** The pool's own
 * API answers `{AuthenticationResult: {IdToken, AccessToken, …}}`; the OAuth
 * token endpoint answers flat, snake-cased `{id_token, access_token,
 * expires_in, …}`. Passing one to the other's parser returns `null`, which
 * looks exactly like a rejected sign-in — so this reshapes into the same
 * envelope and reuses {@link tokensFrom} rather than growing a second parser
 * that could drift from it.
 */
export const hostedTokensFrom = (
  body: unknown,
  now: number,
): CognitoTokens | null => {
  if (typeof body !== "object" || body === null) return null;
  const fields = body as Record<string, unknown>;
  return tokensFrom(
    {
      AuthenticationResult: {
        IdToken: fields.id_token,
        AccessToken: fields.access_token,
        RefreshToken: fields.refresh_token,
        ExpiresIn: fields.expires_in,
      },
    },
    now,
  );
};
