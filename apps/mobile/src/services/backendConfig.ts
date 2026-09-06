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
  /**
   * Cognito's hosted OAuth endpoint, without a trailing slash.
   *
   * **A different host from the pool's own API**, which is why it is stored
   * rather than derived: the pool answers at
   * `cognito-idp.<region>.amazonaws.com`, and this is a chosen global prefix
   * with no relationship to the pool id. Only federated sign-in uses it.
   */
  authDomain: string;
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
  authDomain: "https://pokerkit-dev.auth.us-east-1.amazoncognito.com",
  /**
   * **A name we own, not the generated one.**
   *
   * `https://<id>.execute-api...` is what CloudFormation hands out, and the id
   * belongs to the API Gateway resource — recreate the stack and it changes.
   * This value is baked into every build, so that would break every installed
   * copy of the app permanently, with no channel through which to tell them the
   * new address. The generated host still answers; it must never be the one
   * that ships.
   */
  apiUrl: "https://poker-api-dev.toondeboer.com",
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
  // Read off `PokerBackend-prod`'s own outputs on 2026-09-04, not copied from
  // anywhere they had already been written down:
  //   aws cloudformation describe-stacks --stack-name PokerBackend-prod \
  //     --query 'Stacks[0].Outputs'
  userPoolId: "us-east-1_vJMiOQqvI",
  clientId: "3qj1r450ssj3jba0g57dd8jnga",
  authDomain: "https://pokerkit.auth.us-east-1.amazoncognito.com",
  // A name we own rather than the generated `execute-api` host, which is baked
  // into every shipped build and belongs to the API Gateway resource — recreate
  // the stack and every installed copy is permanently broken. See `hostNameFor`
  // in `apps/infra/lib/apiDomain.ts`.
  apiUrl: "https://poker-api.toondeboer.com",
};

/**
 * Which backend a build talks to. **`PROD_BACKEND` ships, as of 1.2.0.**
 *
 * This was `null` for the whole of 1.2.0's development, deliberately: with no
 * prod stack to point at, the only other value was `DEV_BACKEND`, and a release
 * build set to that would have put real users' accounts in a user pool whose
 * whole purpose is being thrown away and stood up again.
 *
 * Both reasons are now gone. `PokerBackend-prod` is deployed, and SES granted
 * production access on 2026-09-04 — which was the real gate, because until then
 * a sign-up code only reached addresses verified by hand, so pointing at prod
 * would have shipped a sign-up form that silently fails for everybody.
 *
 * **This line is what makes 1.2.0 mean anything.** Sharing, accounts and the
 * shared leaderboard are the release; with this `null` every one of them is
 * dead code behind a feature flag that never turns on.
 *
 * Set it to `DEV_BACKEND` **locally, uncommitted**, to work against the throwaway
 * stack. Never commit that — see `README.md`'s release process, and note that
 * the ids above were read off prod's own stack outputs rather than trusted.
 */
export const backendConfig: BackendConfig | null = DEV_BACKEND;
