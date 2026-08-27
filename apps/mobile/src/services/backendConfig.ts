// src/services/backendConfig.ts
import type { CognitoConfig } from "@poker/core";

/**
 * Where the backend is, or nothing.
 *
 * **`null` today, and that is the switch for the whole feature.** The stack in
 * `apps/infra` has never been deployed, so there is no user pool to point at —
 * and the account screens stay unreachable while this is null, for the same
 * reason the shared clock does: a sign-up form that signs nobody up is worse
 * than no sign-up form.
 *
 * Filled in from the CDK outputs after a deploy:
 *
 * ```
 * UserPoolId      -> userPoolId
 * UserPoolClientId -> clientId
 * ApiUrl          -> apiUrl
 * ```
 *
 * **These are not secrets.** A user pool id and an app client id are public by
 * design — the client has no secret, because a phone cannot keep one — so they
 * belong in the repository rather than in a build-time variable somebody has to
 * remember to set. What protects an account is the password and the token, not
 * the obscurity of the pool it lives in.
 *
 * Which one a build points at is the thing worth being careful about, so the
 * two are written out separately and named rather than switched on a flag.
 */
export type BackendConfig = CognitoConfig & {
  /** The HTTP API's base URL, without a trailing slash. */
  apiUrl: string;
};

/** Not deployed. Replace with `DEV_BACKEND` or `PROD_BACKEND` once it is. */
export const backendConfig: BackendConfig | null = null;

/**
 * The two backends, for when there are two backends.
 *
 * Kept as named constants rather than as an environment variable so that
 * pointing a build at the wrong one is a visible line in a diff instead of a
 * setting nobody can see from the code.
 */
export const DEV_BACKEND: BackendConfig = {
  region: "eu-west-1",
  userPoolId: "replace-me",
  clientId: "replace-me",
  apiUrl: "https://replace-me.execute-api.eu-west-1.amazonaws.com",
};

export const PROD_BACKEND: BackendConfig = {
  region: "eu-west-1",
  userPoolId: "replace-me",
  clientId: "replace-me",
  apiUrl: "https://replace-me.execute-api.eu-west-1.amazonaws.com",
};
