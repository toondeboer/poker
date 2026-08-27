import { describe, expect, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { DeploymentStack, subjectFor } from "../lib/deploymentStack";

const REPO = "toondeboer/poker";

const template = (props: { existingProviderArn?: string } = {}) =>
  Template.fromStack(
    new DeploymentStack(new App(), "Deploy", {
      env: { account: "123456789012", region: "eu-west-1" },
      repository: REPO,
      ...props,
    }),
  );

const assumeRolePolicy = (roleName: string) => {
  const roles = template().findResources("AWS::IAM::Role");
  const match = Object.values(roles).find(
    (role) => (role.Properties as { RoleName?: string }).RoleName === roleName,
  );
  if (!match) throw new Error(`no role named ${roleName}`);
  return match.Properties as {
    AssumeRolePolicyDocument: { Statement: Record<string, unknown>[] };
  };
};

describe("who may deploy", () => {
  it("trusts GitHub's token exchange rather than a stored key", () => {
    // The whole point: nothing in this repository ever needs a long-lived AWS
    // credential, so there is none to leak, rotate, or print into a log.
    template().hasResourceProperties("Custom::AWSCDKOpenIdConnectProvider", {
      Url: "https://token.actions.githubusercontent.com",
      ClientIDList: ["sts.amazonaws.com"],
    });
  });

  it("checks the token was minted for AWS, not for something else", () => {
    const policy = assumeRolePolicy("poker-github-deploy-dev");
    expect(policy.AssumeRolePolicyDocument.Statement[0]).toMatchObject({
      Condition: {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        },
      },
    });
  });

  it("trusts this repository and no other", () => {
    // A condition on the audience alone would accept a token from *anybody's*
    // GitHub Actions run, which is every repository on the internet.
    const failures: string[] = [];
    for (const stage of ["dev", "prod"] as const) {
      const policy = assumeRolePolicy(`poker-github-deploy-${stage}`);
      const subject = (
        policy.AssumeRolePolicyDocument.Statement[0] as {
          Condition: { StringLike: Record<string, string> };
        }
      ).Condition.StringLike["token.actions.githubusercontent.com:sub"];
      if (!subject.startsWith(`repo:${REPO}:`)) {
        failures.push(`${stage}: ${subject}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("production is a gate somebody opens", () => {
  it("is reachable only through a GitHub Environment, not a branch", () => {
    // A branch name is something anybody with push access can create. An
    // Environment is an approval, and this is what makes the workflow's
    // `environment: production` load-bearing rather than decorative.
    expect(subjectFor(REPO, "prod")).toBe(
      "repo:toondeboer/poker:environment:production",
    );
    expect(subjectFor(REPO, "prod")).not.toContain("*");
  });

  it("lets dev be deployed from any branch, which is what dev is for", () => {
    expect(subjectFor(REPO, "dev")).toBe("repo:toondeboer/poker:*");
  });

  it("does not let the dev pattern reach the prod subject", () => {
    // The two must not overlap: if `repo:owner/repo:*` matched the production
    // environment, the approval would be bypassable from any branch.
    const devPattern = subjectFor(REPO, "dev");
    const prodSubject = subjectFor(REPO, "prod");
    // IAM `StringLike` treats `*` as any characters, so the dev pattern DOES
    // match the prod subject as a string — which is exactly why they are two
    // roles with two policies rather than one role with both conditions.
    expect(devPattern).not.toBe(prodSubject);
    // Two deploy roles, named. (The provider's custom resource brings its own
    // unnamed Lambda role, which is not one of ours.)
    const named = Object.values(template().findResources("AWS::IAM::Role"))
      .map((role) => (role.Properties as { RoleName?: string }).RoleName)
      .filter(Boolean);
    expect(named.sort()).toEqual([
      "poker-github-deploy-dev",
      "poker-github-deploy-prod",
    ]);
  });
});

describe("what a stolen token could do", () => {
  it("can assume the bootstrap roles and nothing else", () => {
    // Not `AdministratorAccess`: a CDK deploy needs no rights of its own, only
    // the four roles `cdk bootstrap` already created with exactly the right
    // ones. The blast radius is "can run a deploy", not "owns the account".
    template().hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "sts:AssumeRole",
            Resource: Match.stringLikeRegexp(
              "arn:aws:iam::123456789012:role/cdk-hnb659fds-.*",
            ),
          }),
        ]),
      },
    });
  });

  it("is scoped to one account, so it cannot reach another", () => {
    const policies = template().findResources("AWS::IAM::Policy");
    const resources = Object.values(policies).flatMap((policy) =>
      (
        policy.Properties as {
          PolicyDocument: { Statement: { Resource: string }[] };
        }
      ).PolicyDocument.Statement.map((statement) => statement.Resource),
    );
    expect(resources.every((arn) => arn.includes("123456789012"))).toBe(true);
    expect(resources.some((arn) => arn === "*")).toBe(false);
  });
});

describe("an account that already has a GitHub provider", () => {
  it("reuses it rather than failing the deploy", () => {
    // There can be one GitHub OIDC provider per AWS account. Creating a second
    // fails with `EntityAlreadyExists`, and deleting the existing one breaks
    // whatever else was relying on it.
    const reused = template({
      existingProviderArn:
        "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com",
    });
    expect(
      Object.keys(reused.findResources("Custom::AWSCDKOpenIdConnectProvider")),
    ).toHaveLength(0);
    expect(Object.keys(reused.findResources("AWS::IAM::Role"))).toHaveLength(2);
    expect(
      Object.values(reused.findResources("AWS::IAM::Role")).every(
        (role) => (role.Properties as { RoleName?: string }).RoleName,
      ),
    ).toBe(true);
  });
});
