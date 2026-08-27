/**
 * Talking to Cognito, without a client library.
 *
 * Cognito's user-pool API is JSON over HTTPS with a target header, and the
 * handful of calls an app needs — sign up, confirm, sign in, refresh, sign out,
 * delete — are all **unauthenticated** in the SigV4 sense: they carry a client
 * id and a password or a token, and nothing has to be signed. So there is
 * nothing here that a dependency would do for us except SRP, which we are
 * deliberately not using (see below).
 *
 * **Why that matters more than usual:** the alternative is `aws-amplify`, which
 * brings native modules with it. Native modules mean every existing dev-client
 * binary is invalid until rebuilt, and they mean a bigger binary in a release
 * that is about to be tested by hand — for a feature that is dark until a
 * backend exists. A few hundred lines of request shaping is a much better
 * trade than that, and it is testable, which a library call is not.
 *
 * **This module performs no I/O.** It builds requests and reads responses; the
 * app does the fetching. That keeps `@poker/core` framework-agnostic — it has
 * no `fetch` type available at all — and it means the protocol can be tested
 * exhaustively without a network or a mock of one.
 *
 * ## The password does cross the wire
 *
 * `USER_PASSWORD_AUTH` sends the password to Cognito inside the TLS session,
 * rather than proving knowledge of it without sending it as SRP does. AWS
 * supports both and prefers SRP; SRP needs big-integer maths and therefore a
 * library, which is the whole thing we are avoiding. For an app whose accounts
 * hold a poker leaderboard, TLS is the security boundary that matters, and this
 * is the standard trade rather than a clever one. **If that stops being true —
 * if these accounts ever hold something worth attacking — switching to SRP
 * means adding a library, not redesigning anything**, because everything above
 * this module talks to `AuthProvider` and not to Cognito.
 */

/** Everything needed to reach one user pool. */
export type CognitoConfig = {
  /** e.g. `eu-west-1` — the endpoint is derived from it. */
  region: string;
  userPoolId: string;
  /** The app client. Public by design: a phone cannot keep a secret. */
  clientId: string;
};

/** A request for the app to send. Deliberately not a `Request`. */
export type CognitoCall = {
  url: string;
  headers: Record<string, string>;
  /** Already serialised, so the caller cannot change the shape by accident. */
  body: string;
};

export type CognitoTokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  /** Absolute expiry of the access token, ms epoch, on the local clock. */
  expiresAt: number;
};

const TARGET = "AWSCognitoIdentityProviderService";

const call = (
  config: CognitoConfig,
  action: string,
  body: Record<string, unknown>,
): CognitoCall => ({
  url: `https://cognito-idp.${config.region}.amazonaws.com/`,
  headers: {
    "content-type": "application/x-amz-json-1.1",
    "x-amz-target": `${TARGET}.${action}`,
  },
  body: JSON.stringify(body),
});

/**
 * Create an account.
 *
 * The email is both the username and an attribute. Cognito's pool is
 * configured to sign in by email alias, and an account whose username is its
 * email cannot later change that email without changing who it is — which is
 * why the attribute exists as well, and why nothing anywhere is keyed by it.
 */
export const signUpCall = (
  config: CognitoConfig,
  email: string,
  password: string,
): CognitoCall =>
  call(config, "SignUp", {
    ClientId: config.clientId,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });

/** Hand back the code from the email. Cognito will not sign anybody in before this. */
export const confirmSignUpCall = (
  config: CognitoConfig,
  email: string,
  code: string,
): CognitoCall =>
  call(config, "ConfirmSignUp", {
    ClientId: config.clientId,
    Username: email,
    ConfirmationCode: code,
  });

/** Send it again, for the code that never arrived or was deleted. */
export const resendCodeCall = (
  config: CognitoConfig,
  email: string,
): CognitoCall =>
  call(config, "ResendConfirmationCode", {
    ClientId: config.clientId,
    Username: email,
  });

export const signInCall = (
  config: CognitoConfig,
  email: string,
  password: string,
): CognitoCall =>
  call(config, "InitiateAuth", {
    ClientId: config.clientId,
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });

/**
 * Trade a refresh token for a new access token.
 *
 * The refresh token is the long-lived one — ninety days, so a monthly player is
 * not signed out between game nights — and the only one worth protecting on the
 * device.
 */
export const refreshCall = (
  config: CognitoConfig,
  refreshToken: string,
): CognitoCall =>
  call(config, "InitiateAuth", {
    ClientId: config.clientId,
    AuthFlow: "REFRESH_TOKEN_AUTH",
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });

/**
 * End every session, everywhere.
 *
 * `GlobalSignOut` rather than forgetting the tokens locally: a phone handed to
 * somebody else, or lost, is the case this exists for, and a local forget
 * leaves the refresh token valid for its full ninety days.
 */
export const signOutCall = (
  config: CognitoConfig,
  accessToken: string,
): CognitoCall =>
  call(config, "GlobalSignOut", { AccessToken: accessToken });

/**
 * Delete the account from inside the app.
 *
 * App Store guideline 5.1.1(v) requires this of any app offering account
 * creation, and it is the one call here with no way back.
 */
export const deleteAccountCall = (
  config: CognitoConfig,
  accessToken: string,
): CognitoCall => call(config, "DeleteUser", { AccessToken: accessToken });

/**
 * What Cognito said, translated into something a form can show.
 *
 * Cognito's error names are stable and its messages are not, so the name is
 * what gets matched. `null` means a name we do not recognise, which the caller
 * should treat as a generic failure rather than guessing.
 */
export type CognitoError =
  | "email-taken"
  | "email-unknown"
  | "credentials-wrong"
  | "code-wrong"
  | "code-expired"
  | "not-confirmed"
  | "password-weak"
  | "too-many-attempts"
  | "session-expired";

const ERRORS: Record<string, CognitoError> = {
  UsernameExistsException: "email-taken",
  UserNotFoundException: "email-unknown",
  NotAuthorizedException: "credentials-wrong",
  CodeMismatchException: "code-wrong",
  ExpiredCodeException: "code-expired",
  UserNotConfirmedException: "not-confirmed",
  InvalidPasswordException: "password-weak",
  TooManyRequestsException: "too-many-attempts",
  LimitExceededException: "too-many-attempts",
  TooManyFailedAttemptsException: "too-many-attempts",
};

/**
 * The error in a Cognito response body, if it is one we know.
 *
 * The name arrives either as `__type` or in the `x-amzn-errortype` header, and
 * either can carry a trailing `:` and a URL — `NotAuthorizedException:https://…`
 * is a real response. Everything after the colon is dropped.
 */
export const errorFrom = (body: unknown): CognitoError | null => {
  if (typeof body !== "object" || body === null) return null;
  const raw = (body as { __type?: unknown }).__type;
  if (typeof raw !== "string") return null;
  // The name sits between an optional `namespace#` prefix and an optional
  // `:https://…` suffix, so the two ends come off in that order — splitting on
  // both at once and taking the last piece yields the URL instead of the name.
  const withoutUrl = raw.split(":")[0];
  const name = withoutUrl.slice(withoutUrl.lastIndexOf("#") + 1);
  return ERRORS[name] ?? null;
};

/**
 * Tokens from an `InitiateAuth` response.
 *
 * `null` when the response is a challenge rather than a result — Cognito
 * answers `ChallengeName` instead of `AuthenticationResult` when it wants
 * something else, and treating that as a failed sign-in is both true and the
 * only honest thing to do without a challenge flow.
 *
 * **A refresh response carries no refresh token.** Cognito reuses the one you
 * sent, so the caller keeps its own — reading `RefreshToken` here and storing
 * `undefined` is how a session ends after an hour instead of ninety days.
 */
export const tokensFrom = (
  body: unknown,
  now: number,
  fallbackRefreshToken?: string,
): CognitoTokens | null => {
  if (typeof body !== "object" || body === null) return null;
  const result = (body as { AuthenticationResult?: unknown })
    .AuthenticationResult;
  if (typeof result !== "object" || result === null) return null;

  const fields = result as Record<string, unknown>;
  const idToken = fields.IdToken;
  const accessToken = fields.AccessToken;
  const refreshToken = fields.RefreshToken ?? fallbackRefreshToken;
  const expiresIn = fields.ExpiresIn;

  if (typeof idToken !== "string" || typeof accessToken !== "string") {
    return null;
  }
  if (typeof refreshToken !== "string") return null;

  return {
    idToken,
    accessToken,
    refreshToken,
    // Anchored on the local clock at receipt, for the same reason the shared
    // timer is: the server's notion of now is not comparable to this device's.
    expiresAt:
      now + (typeof expiresIn === "number" ? expiresIn : 3600) * 1000,
  };
};

/**
 * Should these tokens be refreshed before being used?
 *
 * A minute of slack, because a token that expires while the request is in
 * flight fails exactly as hard as one that expired an hour ago, and a retry
 * costs a round trip on a phone that may be on a hotspot.
 */
export const EXPIRY_SLACK_MS = 60_000;

export const needsRefresh = (tokens: CognitoTokens, now: number): boolean =>
  now >= tokens.expiresAt - EXPIRY_SLACK_MS;

/**
 * Base64url, decoded by hand.
 *
 * Not `atob`: it is not in this package's environment at all (`lib: esnext`,
 * `types: []`), and on React Native its presence depends on the engine and the
 * version — which is exactly the kind of thing that works in development and
 * throws on somebody's phone. Fifteen lines that always work beat a global that
 * usually does.
 *
 * Base64**url** specifically: JWT payloads use `-` and `_` for the last two
 * characters and drop the padding, so a decoder expecting `+`, `/` and `=`
 * throws on some payloads and silently truncates others.
 *
 * Returns `null` on anything malformed rather than a partial string, because a
 * half-decoded JWT payload is not JSON and the error further along would name
 * the wrong thing.
 */
const BASE64URL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export const decodeBase64Url = (value: string): string | null => {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index);
    // Tolerated because the padding is optional in base64url and some encoders
    // emit it anyway; anything else is a decode failure rather than a skip.
    if (character === "=") continue;
    const digit = BASE64URL.indexOf(character);
    if (digit === -1) return null;
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return decodeUtf8(bytes);
};

/**
 * UTF-8 bytes to a string, also by hand and for the same reason —
 * `TextDecoder` is not available here either.
 *
 * An email address is very often not ASCII, and a decoder that assumes it is
 * mangles somebody's name on the one screen that shows it back to them.
 */
const decodeUtf8 = (bytes: readonly number[]): string | null => {
  let result = "";
  let index = 0;

  while (index < bytes.length) {
    const first = bytes[index];
    let codePoint: number;
    let length: number;

    if (first < 0x80) {
      codePoint = first;
      length = 1;
    } else if (first >= 0xc0 && first < 0xe0) {
      codePoint = first & 0x1f;
      length = 2;
    } else if (first >= 0xe0 && first < 0xf0) {
      codePoint = first & 0x0f;
      length = 3;
    } else if (first >= 0xf0 && first < 0xf8) {
      codePoint = first & 0x07;
      length = 4;
    } else {
      // A continuation byte where a leading byte should be, or 0xf8+, which is
      // not UTF-8 at all.
      return null;
    }

    if (index + length > bytes.length) return null;
    for (let offset = 1; offset < length; offset += 1) {
      const continuation = bytes[index + offset];
      if ((continuation & 0xc0) !== 0x80) return null;
      codePoint = (codePoint << 6) | (continuation & 0x3f);
    }

    if (codePoint > 0xffff) {
      // Outside the basic plane, so it needs a surrogate pair. Emoji in a
      // display name is not hypothetical.
      const adjusted = codePoint - 0x10000;
      result += String.fromCharCode(
        0xd800 + (adjusted >> 10),
        0xdc00 + (adjusted & 0x3ff),
      );
    } else {
      result += String.fromCharCode(codePoint);
    }
    index += length;
  }

  return result;
};

/**
 * Who an ID token says you are.
 *
 * **This is not a security check and must never become one.** The token comes
 * from the device's own storage, having been put there by a successful
 * sign-in, and is read only to show somebody their own email. Every request
 * that *matters* sends the token to the server, which verifies the signature,
 * the issuer, the audience and the expiry properly. Reading claims locally to
 * decide anything would be trusting a string the device could have written.
 */
export const accountFromIdToken = (
  idToken: string,
): { id: string; email: string } | null => {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const payload = decodeBase64Url(parts[1]);
  if (payload === null) return null;

  try {
    const claims: unknown = JSON.parse(payload);
    if (typeof claims !== "object" || claims === null) return null;
    const { sub, email } = claims as { sub?: unknown; email?: unknown };
    if (typeof sub !== "string" || sub.length === 0) return null;
    return { id: sub, email: typeof email === "string" ? email : "" };
  } catch {
    return null;
  }
};
