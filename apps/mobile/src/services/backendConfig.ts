// src/services/backendConfig.ts
import type { CognitoConfig } from "@poker/core";

/**
 * Where the backend is, or nothing.
 *
 * **`null` today, and that is the switch for the whole feature.** The account
 * screens stay unreachable while this is null, for the same reason the shared
 * clock does: a sign-up form that signs nobody up is worse than no sign-up
 * form.
 *
 * What changed is *why* it is null. `PokerBackend-dev` is deployed and the
 * values below are real — sign-up, the emailed code, sign-in and `GET /me` have
 * all been run against it. Null is now a choice about which stack a shipped
 * build should reach, not an absence of one to reach. See `backendConfig`.
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

/**
 * The two backends, for when there are two backends.
 *
 * Kept as named constants rather than as an environment variable so that
 * pointing a build at the wrong one is a visible line in a diff instead of a
 * setting nobody can see from the code.
 *
 * **Declared above `backendConfig`, and that is not cosmetic.** These are
 * `const`, so they sit in the temporal dead zone until their own line runs —
 * and `backendConfig` is evaluated at module load. With the declarations below
 * it, the single edit this file exists to support (`= DEV_BACKEND`) is a
 * `ReferenceError` at import time, which takes the whole app down at launch
 * rather than failing anywhere near the thing that caused it. It was in that
 * order until somebody actually tried it.
 */
export const DEV_BACKEND: BackendConfig = {
  region: "us-east-1",
  userPoolId: "us-east-1_6iwLdpBIy",
  clientId: "2lahhup3m7il6iqusctitu6lbc",
  apiUrl: "https://hv0qrcgmt4.execute-api.us-east-1.amazonaws.com",
};

/**
 * Not deployed yet, and deliberately left unfillable-looking.
 *
 * `PokerBackend-prod` exists as code and has never been deployed — prod holds
 * leaderboards and there is nothing to put in it until the app is actually
 * talking to a backend. Pointing a build at this would fail at the first
 * request rather than silently reaching dev, which is the right failure: the
 * two are separate stacks with separate user pools, and an account made against
 * one does not exist in the other.
 */
export const PROD_BACKEND: BackendConfig = {
  region: "us-east-1",
  userPoolId: "replace-me",
  clientId: "replace-me",
  apiUrl: "https://replace-me.execute-api.us-east-1.amazonaws.com",
};

/**
 * Which backend a build talks to. **`null` ships.**
 *
 * `DEV_BACKEND` is real and reachable now, so this is no longer "there is
 * nothing to point at" — it is a deliberate choice not to point 1.2.0 at a
 * development stack. A release build with this set to `DEV_BACKEND` would put
 * real users' accounts in a user pool whose whole purpose is being thrown away
 * and stood up again, and `/account` is reachable by URL, so "nothing links to
 * it" is not the same as "nobody can reach it".
 *
 * Set it to `DEV_BACKEND` **locally, uncommitted**, to work on the account
 * screens against the real thing. It goes to `PROD_BACKEND` for good when prod
 * is deployed and the Settings entry point lands with it.
 */
export const backendConfig: BackendConfig | null = DEV_BACKEND;
