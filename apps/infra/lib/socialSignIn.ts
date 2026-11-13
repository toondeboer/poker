/**
 * Sign in with Apple and Google, or neither.
 *
 * **Opt-in through context, like `mailFor` and `domainFor`**, and for the same
 * reason: `cdk synth` and the tests have to work with no credentials at all.
 * Without the context values this returns `null`, no provider is created, and
 * the pool behaves exactly as it did — which is also what keeps a stack anybody
 * clones deployable.
 *
 * ## What is secret here and what is not
 *
 * The identifiers are **not** secrets and live in `cdk.json`: a Google client
 * id, an Apple Services ID, a Team ID and a Key ID all appear in redirect URLs
 * or in a JWT header, and treating them as sensitive buys nothing while making
 * them harder to check.
 *
 * The two that *are* secret — Google's client secret and Apple's `.p8` — come
 * from **Secrets Manager**, resolved by CloudFormation at deploy time so they
 * never enter the template, the repository, or a `cdk diff`.
 *
 * **Parameter Store cannot do this job, though it is cheaper and the obvious
 * thing to reach for.** `ssm-secure` dynamic references are only honoured in a
 * fixed list of resource properties — Directory Service, ElastiCache, RDS,
 * Redshift, IAM `LoginProfile` and a few more — and
 * `AWS::Cognito::UserPoolIdentityProvider` is not among them. Nothing warns
 * about this: CDK synthesises it, CloudFormation stores the *literal string*
 * `{{resolve:ssm-secure:...}}` as the private key, the deploy goes green, and
 * sign-in fails later with an error that never mentions dynamic references.
 * A plain `ssm` reference is honoured more widely and stores the secret in
 * clear, which is worse than paying for Secrets Manager.
 */

import { SecretValue } from "aws-cdk-lib";
import { Construct } from "constructs";
import type { Stage } from "./stage";

export type SocialSignIn = {
  google: { clientId: string; clientSecret: SecretValue };
  apple: {
    servicesId: string;
    teamId: string;
    keyId: string;
    privateKey: SecretValue;
  };
};

/**
 * Read a value that may be a plain string or a per-stage map.
 *
 * The Services ID differs per stage — a dev callback must not be a valid
 * redirect for the production pool — while the Team ID, Key ID and Google
 * client id are the same everywhere. Both shapes are accepted so `cdk.json`
 * says which is which by its shape rather than by a naming convention nobody
 * remembers.
 */
const forStage = (
  scope: Construct,
  key: string,
  stage: Stage,
): string | undefined => {
  const value: unknown = scope.node.tryGetContext(key);
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null) return undefined;
  const perStage = (value as Record<string, unknown>)[stage];
  return typeof perStage === "string" ? perStage : undefined;
};

/**
 * The providers for this stage, or `null` when they are not configured.
 *
 * **All or nothing, deliberately.** App Store guideline 4.8 requires Sign in
 * with Apple wherever another third-party provider is offered, so a stack with
 * Google configured and Apple missing is one that cannot ship on iOS. Returning
 * `null` for a half-filled configuration turns that into "the buttons are not
 * there yet", which is recoverable, instead of a build rejected at review.
 */
export const socialSignInFor = (
  scope: Construct,
  stage: Stage,
): SocialSignIn | null => {
  const googleClientId = forStage(scope, "googleClientId", stage);
  const servicesId = forStage(scope, "appleServicesId", stage);
  const teamId = forStage(scope, "appleTeamId", stage);
  const keyId = forStage(scope, "appleKeyId", stage);
  const secretName = forStage(scope, "idpSecretName", stage);

  if (!googleClientId || !servicesId || !teamId || !keyId || !secretName) {
    return null;
  }

  return {
    google: {
      clientId: googleClientId,
      clientSecret: SecretValue.secretsManager(secretName, {
        jsonField: "googleClientSecret",
      }),
    },
    apple: {
      servicesId,
      teamId,
      keyId,
      privateKey: SecretValue.secretsManager(secretName, {
        jsonField: "applePrivateKey",
      }),
    },
  };
};

/**
 * Where the hosted UI sends somebody back to once a provider is done.
 *
 * The app's own scheme, so the redirect reopens the app rather than a browser
 * tab it would then have to be rescued from. `expo-auth-session` listens for
 * exactly this.
 */
export const APP_CALLBACK_URLS = ["pokerkit://auth"];

/** Where it sends them after signing out. */
export const APP_LOGOUT_URLS = ["pokerkit://signed-out"];
