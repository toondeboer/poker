/**
 * How GitHub Actions is allowed to deploy, without anybody holding an AWS key.
 *
 * **Deployed once, by hand, before anything else works** — a role that deploys
 * a stack cannot be created by the stack it deploys, so this is its own stack
 * and its own bootstrap step. After that, nothing in this repo ever needs a
 * long-lived credential: Actions presents a short-lived GitHub token, AWS
 * exchanges it for temporary credentials, and there is no secret to leak,
 * rotate, or accidentally print into a log.
 *
 * ## The permission it grants, and why it is not `AdministratorAccess`
 *
 * A CDK deploy does not need broad rights of its own. `cdk bootstrap` already
 * created four roles in the account with exactly the permissions a deploy
 * needs, and the CLI assumes them. So all this role can do is **assume those
 * four** — which means the blast radius of a stolen GitHub token is "can run a
 * CDK deploy", not "owns the account".
 *
 * ## Why dev and prod are two roles, not one
 *
 * They trust different things. Dev trusts any branch of this repository, so a
 * pull request can be deployed and tried. **Prod trusts only a GitHub
 * Environment**, which is a gate a human opens — so reaching production takes
 * an approval that lives in GitHub rather than a branch name anybody can
 * create.
 */

import { Stack, type StackProps } from "aws-cdk-lib";
import {
  AccountPrincipal,
  OpenIdConnectProvider,
  Role,
  WebIdentityPrincipal,
  PolicyStatement,
  Effect,
  type IOpenIdConnectProvider,
} from "aws-cdk-lib/aws-iam";
import { CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import { STAGES, type Stage } from "./stage";

/** GitHub's OIDC issuer. Fixed by GitHub; not a setting. */
const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";

/**
 * The qualifier `cdk bootstrap` uses unless told otherwise.
 *
 * It appears in the bootstrap role names, which is the only reason this is
 * here. Change it only if you bootstrapped with `--qualifier`.
 */
const BOOTSTRAP_QUALIFIER = "hnb659fds";

/**
 * Grafana Cloud's own AWS account, which assumes the scrape role below.
 *
 * Fixed by Grafana and the same for every customer — which is exactly why the
 * external ID matters: without it, any Grafana Cloud tenant could assume a role
 * that trusts this account. See {@link GrafanaScrapeProps.externalId}.
 */
const GRAFANA_CLOUD_ACCOUNT = "008923505280";

/** What Grafana's CloudWatch scrape needs to read, and nothing more. */
const GRAFANA_SCRAPE_ACTIONS = [
  // The metrics themselves.
  "cloudwatch:ListMetrics",
  "cloudwatch:GetMetricData",
  // How Grafana discovers what exists. **This is why the stacks are tagged**:
  // discovery runs through the Resource Groups Tagging API, and a resource with
  // no tags is invisible to it — no error, just permanently absent data.
  "tag:GetResources",
  // Resource metadata for the services this account actually runs. Grafana's
  // documented policy lists a dozen more (`dms:`, `shield:`, `storagegateway:`,
  // `autoscaling:`, …) for services nothing here uses; they are left out rather
  // than pasted in, because a read-only role is still a role somebody else can
  // assume.
  "apigateway:GET",
];

export type DeploymentStackProps = StackProps & {
  /** `owner/repo`, the only repository these roles will ever trust. */
  repository: string;
  /**
   * The external ID from Grafana Cloud's *Add new account* page.
   *
   * **Without it, no role is created at all.** That is the safe degradation:
   * a scrape role trusting Grafana's shared account with no external ID
   * condition is assumable by any Grafana Cloud tenant, so a missing value must
   * mean "no role" rather than "a role with the condition left off".
   */
  grafanaExternalId?: string;
  /**
   * An existing OIDC provider to reuse.
   *
   * There can be **one** GitHub provider per AWS account, and creating a second
   * fails the deploy with `EntityAlreadyExists`. If the account already has one
   * — from another project, or a previous attempt — pass its ARN rather than
   * deleting the provider that something else is relying on.
   */
  existingProviderArn?: string;
};

export class DeploymentStack extends Stack {
  constructor(scope: Construct, id: string, props: DeploymentStackProps) {
    super(scope, id, props);

    const provider: IOpenIdConnectProvider = props.existingProviderArn
      ? OpenIdConnectProvider.fromOpenIdConnectProviderArn(
          this,
          "GitHubProvider",
          props.existingProviderArn,
        )
      : new OpenIdConnectProvider(this, "GitHubProvider", {
          url: GITHUB_ISSUER,
          // Who the token is *for*. Without this, a token minted for some other
          // audience would be accepted, which is most of the point of the
          // condition below.
          clientIds: ["sts.amazonaws.com"],
        });

    for (const stage of STAGES) {
      const role = new Role(this, `Deploy${titleCase(stage)}`, {
        roleName: `poker-github-deploy-${stage}`,
        description: `GitHub Actions deploys the ${stage} backend`,
        assumedBy: new WebIdentityPrincipal(
          provider.openIdConnectProviderArn,
          {
            StringEquals: {
              [`${issuerHost()}:aud`]: "sts.amazonaws.com",
            },
            // The subject is what actually restricts this. `StringLike` because
            // the dev pattern ends in a wildcard over refs; prod does not, and
            // an exact string in a `StringLike` is still exact.
            StringLike: {
              [`${issuerHost()}:sub`]: subjectFor(props.repository, stage),
            },
          },
        ),
      });

      // Everything a CDK deploy needs, and nothing else: the four roles
      // `cdk bootstrap` created, which already carry the real permissions.
      role.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["sts:AssumeRole"],
          resources: [
            `arn:aws:iam::${this.account}:role/cdk-${BOOTSTRAP_QUALIFIER}-*-role-${this.account}-*`,
          ],
        }),
      );

      new CfnOutput(this, `Deploy${titleCase(stage)}RoleArn`, {
        value: role.roleArn,
        description: `Put this in the ${stage} workflow's role-to-assume`,
      });
    }

    /**
     * What Grafana Cloud assumes to scrape CloudWatch.
     *
     * **This account, not the stacks.** The role reads CloudWatch for the whole
     * account, so creating it per backend stack would make two identical roles
     * that grant the same thing — and it belongs beside the other cross-account
     * trust rather than beside a DynamoDB table.
     *
     * OTel runs *inside* a Lambda and therefore cannot see API Gateway 5xx,
     * DynamoDB throttles, AppSync connection errors or cold starts: all of those
     * happen outside the function. This is the half of the picture that fills
     * those in, and without it a dashboard is empty in places for reasons nobody
     * can see from the dashboard.
     */
    if (props.grafanaExternalId) {
      const scrape = new Role(this, "GrafanaCloudWatchScrape", {
        roleName: "poker-grafana-cloudwatch-scrape",
        description: "Grafana Cloud reads CloudWatch metrics for dashboards",
        assumedBy: new AccountPrincipal(GRAFANA_CLOUD_ACCOUNT).withConditions({
          // The whole security of this role. Grafana's account is shared by
          // every one of its customers, so trusting it alone would let any of
          // them assume this. The external ID is the part that is only yours.
          StringEquals: { "sts:ExternalId": props.grafanaExternalId },
        }),
      });
      scrape.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: GRAFANA_SCRAPE_ACTIONS,
          // CloudWatch's read APIs do not take resource ARNs — a metric is not
          // a resource — so this cannot be narrowed. It is read-only, and it is
          // why the action list above is trimmed to what is actually used.
          resources: ["*"],
        }),
      );
      new CfnOutput(this, "GrafanaScrapeRoleArn", {
        value: scrape.roleArn,
        description: "Paste this into Grafana Cloud's AWS account configuration",
      });
    }
  }
}

const issuerHost = (): string => GITHUB_ISSUER.replace("https://", "");

const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

/**
 * The GitHub Environment that gates a production deploy.
 *
 * **Not `production`, and that is not a style choice.** GitHub environment
 * names are case-insensitive, and this repository already has a `Production`
 * environment — created by the Vercel integration, which deploys the website on
 * every push to `main`. Two things follow, and both were found by looking
 * rather than by a deploy failing:
 *
 * 1. A required reviewer added to it would gate **the website**, which is
 *    supposed to ship continuously. The approval meant for a backend deploy
 *    would start holding up a typo fix on a landing page.
 * 2. The OIDC subject carries the environment's *stored* name, so it would read
 *    `…:environment:Production` while the trust policy below asks for
 *    `…:environment:production` — and IAM string conditions are case-sensitive.
 *    The gate would not have failed closed; it would have failed to
 *    authenticate at all, which is a confusing way to discover this.
 *
 * A name of its own avoids both, and says what it gates.
 */
export const PRODUCTION_ENVIRONMENT = "backend-production";

/**
 * Which GitHub identities may assume the role for a stage.
 *
 * Dev: any ref of this repository, so a branch can be deployed and tried.
 * Prod: **only** the {@link PRODUCTION_ENVIRONMENT} GitHub Environment, which
 * is a gate a person opens — an approval that lives in GitHub rather than a
 * branch name anybody with push access can create.
 */
export const subjectFor = (repository: string, stage: Stage): string =>
  stage === "prod"
    ? `repo:${repository}:environment:${PRODUCTION_ENVIRONMENT}`
    : `repo:${repository}:*`;
