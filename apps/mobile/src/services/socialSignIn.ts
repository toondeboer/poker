// src/services/socialSignIn.ts
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import {
  authorizeUrl,
  isValidCodeVerifier,
  readRedirect,
  type HostedProvider,
} from "@poker/core";
import { backendConfig } from "@/src/services/backendConfig";
import { logger } from "@/src/utils/logger";

/**
 * The browser half of signing in with Apple or Google.
 *
 * **Everything platform-specific about federation lives here**, and nothing
 * else: `@poker/core` builds the URLs and reads the redirect, and
 * `cognitoAuthProvider` turns the resulting code into a session. This file
 * opens a browser, makes randomness, and hands back what came out — which is
 * the part that cannot be tested without a device.
 *
 * **`expo-web-browser` rather than `expo-auth-session`.** The session library
 * would also build the URLs and do PKCE, which core already does with tests;
 * taking it would mean two implementations of the same shaping and a second
 * one nothing verifies. `openAuthSessionAsync` is the one thing only a native
 * module can do: open a browser that the OS will hand back to us.
 */

/**
 * Where the hosted UI sends the browser when it is finished.
 *
 * **Must match `APP_CALLBACK_URLS` in `apps/infra` exactly.** Cognito compares
 * it as a string against the client's allowed list, and a mismatch is refused
 * at the *authorize* step with `redirect_mismatch` — before the provider is
 * ever reached, which makes it look like the provider is misconfigured.
 */
export const AUTH_REDIRECT_URI = "pokerkit://auth";

/** RFC 7636's unreserved set, which a verifier is drawn from. */
const VERIFIER_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/**
 * A PKCE verifier: 64 characters of real randomness.
 *
 * Drawn from the unreserved alphabet directly rather than by base64-encoding
 * random bytes, which avoids needing a `Buffer` or a hand-rolled encoder for a
 * value whose only requirement is being unguessable and URL-safe.
 *
 * **Modulo bias is why the alphabet is 64 characters** and not, say, 66: 256
 * divides evenly by 64, so every byte maps to exactly four characters and none
 * is favoured. With a length that does not divide 256 this would quietly lose
 * entropy.
 */
export const createCodeVerifier = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(64);
  let verifier = "";
  for (const byte of bytes) {
    verifier += VERIFIER_ALPHABET[byte % VERIFIER_ALPHABET.length];
  }
  return verifier;
};

/** SHA-256 of the verifier, base64url — what `code_challenge` carries. */
export const challengeFor = async (verifier: string): Promise<string> => {
  const base64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  // base64 → base64url. The `=` padding is dropped rather than encoded: the
  // spec has no padding, and a `%3D` in the query is not the same string.
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** What came back, in terms a screen can act on. */
export type SocialSignInResult =
  | { status: "code"; code: string; codeVerifier: string }
  /** The person closed the sheet. Ordinary, and not an error. */
  | { status: "cancelled" }
  | { status: "failed"; reason: string };

/**
 * Open the provider and wait for the redirect.
 *
 * **The `state` is generated here and compared here.** Core deliberately
 * returns it rather than checking it, because it cannot know what was sent —
 * this is the only place that does. Without the comparison, a redirect
 * somebody else triggered into `pokerkit://auth` would be indistinguishable
 * from ours, which is the attack PKCE alone does not close.
 */
export const signInWithProvider = async (
  provider: HostedProvider,
): Promise<SocialSignInResult> => {
  if (!backendConfig) return { status: "failed", reason: "no backend" };

  const codeVerifier = await createCodeVerifier();
  if (!isValidCodeVerifier(codeVerifier)) {
    // Cannot happen with the generator above, and is checked because the
    // remote failure is `invalid_grant` — which the token endpoint also says
    // for an expired code, a reused code and a mismatched redirect.
    return { status: "failed", reason: "could not start sign-in" };
  }
  const state = await createCodeVerifier();

  const url = authorizeUrl(
    backendConfig,
    { domain: backendConfig.authDomain, redirectUri: AUTH_REDIRECT_URI },
    { provider, codeChallenge: await challengeFor(codeVerifier), state },
  );

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(url, AUTH_REDIRECT_URI);
  } catch (error) {
    logger.warn("Could not open the sign-in browser:", error);
    return { status: "failed", reason: "could not open the browser" };
  }

  // `dismiss` is the sheet being closed, `cancel` the system cancelling it.
  // Neither is a failure worth a message: the person chose to stop.
  if (result.type !== "success") return { status: "cancelled" };

  const redirect = readRedirect(result.url);
  if (redirect.status === "error") {
    // `access_denied` is somebody declining at the provider, which reads as a
    // cancellation to them and should here too.
    if (redirect.error === "access_denied") return { status: "cancelled" };
    logger.warn("Provider refused the sign-in:", redirect.error);
    return { status: "failed", reason: redirect.error };
  }
  if (redirect.status === "unusable") {
    return { status: "failed", reason: "the sign-in did not complete" };
  }
  if (redirect.state !== state) {
    // Not ours. Nothing legitimate produces this.
    logger.warn("Discarding a sign-in redirect with an unexpected state");
    return { status: "failed", reason: "the sign-in did not complete" };
  }

  return { status: "code", code: redirect.code, codeVerifier };
};
