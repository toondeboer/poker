#!/usr/bin/env node
/**
 * CDK entry point.
 *
 * Three stacks, and one rule they all follow: **`cdk synth` and the tests must
 * work with no AWS credentials at all.** That is what lets CI check the whole
 * thing on every pull request without anybody holding a key, and it is why the
 * account and region below are *optional* rather than looked up.
 *
 * Pass them when you actually mean to deploy:
 *
 * ```
 * npx cdk deploy PokerBackend-dev -c account=123456789012 -c region=eu-west-1
 * ```
 *
 * or let the CLI fill them in from whatever credentials are in the shell, which
 * is what the deploy workflow does.
 */
import { App } from "aws-cdk-lib";
import { PokerStack } from "../lib/pokerStack";
import { DeploymentStack } from "../lib/deploymentStack";
import { STAGES, settingsFor, stackNameFor } from "../lib/stage";

const app = new App();

/**
 * The account and region to deploy into, or nothing.
 *
 * `undefined` makes a stack environment-agnostic, which synthesises fine and
 * refuses to deploy — exactly the right failure. A stack that quietly picked a
 * default region would be a stack that deployed to the wrong one.
 */
const env = (() => {
  const account =
    (app.node.tryGetContext("account") as string | undefined) ??
    process.env.CDK_DEFAULT_ACCOUNT;
  const region =
    (app.node.tryGetContext("region") as string | undefined) ??
    process.env.CDK_DEFAULT_REGION;
  return account && region ? { account, region } : undefined;
})();

/**
 * Operational settings, from context so they are not in the repository.
 *
 * All optional, and every one of them **degrades to something safe and
 * useless** rather than to something wrong: no email means alarms that fire
 * into a topic nobody reads, and no budget means no budget. Without this block
 * the stacks synthesised seven alarms, zero subscriptions and zero budgets —
 * everything built and nothing switched on.
 *
 * They live in `cdk.json`'s `context` now rather than being passed by hand,
 * because CDK context is not sticky: a deploy that omits one does not leave the
 * existing resource alone, it deletes it.
 */
const alertEmail = app.node.tryGetContext("alertEmail") as string | undefined;
const budget = app.node.tryGetContext("monthlyBudgetUsd") as
  | string
  | number
  | undefined;

for (const stage of STAGES) {
  new PokerStack(app, stackNameFor(stage), {
    env,
    settings: settingsFor(stage),
    alertEmail,
    monthlyBudgetUsd: budget === undefined ? undefined : Number(budget),
    description: `Accounts, groups and the multiplayer table for Poker Blinds Buzzer (${stage})`,
  });
}

/**
 * The roles GitHub Actions assumes. Deployed once, by hand, before either
 * backend stack can be deployed by anything other than a person.
 */
new DeploymentStack(app, "PokerDeployment", {
  env,
  repository:
    (app.node.tryGetContext("repository") as string | undefined) ??
    "toondeboer/poker",
  existingProviderArn: app.node.tryGetContext("existingProviderArn") as
    | string
    | undefined,
  description: "GitHub Actions deployment roles for the Poker backend",
});
