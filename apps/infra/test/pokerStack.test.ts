import { describe, expect, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { PokerStack } from "../lib/pokerStack";
import { settingsFor } from "../lib/stage";
import { hostNameFor } from "../lib/apiDomain";
import cdkJson from "../cdk.json";

/**
 * The stack, synthesised.
 *
 * `Template.fromStack` runs the whole synth, so a stack that cannot be built at
 * all fails here rather than in front of somebody with credentials — which is
 * most of what CI can honestly check about infrastructure it will never deploy.
 * The assertions below cover the handful of properties where getting it wrong
 * is expensive and silent: data that cannot be recreated, and secrets that must
 * not be broadcast.
 *
 * Synthesising is slow enough to need a raised `testTimeout` — see
 * `vitest.config.mts` for why the default is wrong for this workspace.
 */
let synthesised: Template | null = null;

/**
 * The synthesised template, built once.
 *
 * Synthesising runs esbuild over the Lambda, so doing it per assertion costs a
 * few seconds for no extra confidence — the template is read-only, and every
 * test here is asking a different question about the same one.
 */
const template = (): Template => {
  synthesised ??= Template.fromStack(new PokerStack(new App(), "TestStack"));
  return synthesised;
};

describe("the stack synthesises", () => {
  it("builds without an account, a region, or a credential", () => {
    // Most of what CI can honestly check about infrastructure it will never
    // deploy: that the thing can be built at all.
    expect(() =>
      Template.fromStack(new PokerStack(new App(), "Synth")),
    ).not.toThrow();
  });

  it("builds with the context cdk.json actually declares", () => {
    // `new App()` does NOT read cdk.json, so every other test here runs with
    // empty context — which is how a pair of CDK **v1** feature flags sat in
    // that file passing every test and failing the first real `cdk synth`.
    // This is the only assertion that touches the file the CLI reads.
    const context = (cdkJson as { context?: Record<string, unknown> }).context;
    expect(() =>
      Template.fromStack(new PokerStack(new App({ context }), "WithContext")),
    ).not.toThrow();
  });

  it("carries the operational settings in cdk.json, not on a command line", () => {
    // These were `-c` flags, and the workflow did not pass them — so the first
    // `cdk deploy` from CI would have DELETED the alarm email subscription and
    // the budget. Not failed: deleted, and reported success, because a template
    // without them is a perfectly valid template. This PR's own `cdk diff` job
    // printed `[-] AWS::SNS::Subscription … destroy` before anybody noticed.
    //
    // `cdk.json` is read by the CLI on every invocation, local or CI, which is
    // what makes the two agree without anybody remembering a flag.
    const context = (cdkJson as { context?: Record<string, unknown> }).context;
    expect(typeof context?.alertEmail).toBe("string");
    expect(typeof context?.monthlyBudgetUsd).toBe("number");

    /**
     * **And `mailVerified`, which was the same bug a second time.** Dev was
     * moved onto SES with a hand-typed `-c mailVerified=true` that nothing
     * wrote down, so the next deploy from CI — which passes only account and
     * region — would have put the pool silently back on Cognito's own sender.
     * That is not a visible failure: it is confirmation codes returning to
     * spam, capped at fifty a day, found out when sign-up stops working.
     *
     * Per stage, because a fresh identity has to exist before it can be
     * verified; see `mailVerifiedFor`.
     */
    expect(typeof context?.mailVerified).toBe("object");

    // And that those two keys are the ones that matter: `bin/app.ts` reads them
    // and passes them as props, so a rename on either side is a silent loss.
    const configured = Template.fromStack(
      new PokerStack(new App(), "Operational", {
        alertEmail: context?.alertEmail as string,
        monthlyBudgetUsd: context?.monthlyBudgetUsd as number,
      }),
    );
    configured.resourceCountIs("AWS::SNS::Subscription", 1);
    configured.resourceCountIs("AWS::Budgets::Budget", 1);
  });
});

describe("a name for the API that we own", () => {
  /**
   * Why any of this is tested: the generated `execute-api` host is baked into
   * every shipped binary, and recreating the stack changes it — which breaks
   * every installed copy of the app with no way to tell it the new address.
   */
  const withDomain = (stage: "dev" | "prod" = "prod"): Template => {
    const app = new App({
      context: {
        apiDomain: "poker-api.example.test",
        hostedZoneId: "Z0000000000000000000",
        hostedZoneName: "example.test",
      },
    });
    // The stage is named, because `PokerStack` defaults to **prod** on purpose
    // — a settings mistake should fail towards the strict end.
    return Template.fromStack(
      new PokerStack(app, `Domained${stage}`, { settings: settingsFor(stage) }),
    );
  };

  it("is absent unless it is asked for", () => {
    // **The property CI depends on.** `cdk synth` has to work with no
    // credentials and no context, so a hosted zone nobody named must not
    // appear — a fork of this repo still synthesises.
    template().resourceCountIs("AWS::CertificateManager::Certificate", 0);
    template().resourceCountIs("AWS::Route53::RecordSet", 0);
    template().resourceCountIs("AWS::ApiGatewayV2::DomainName", 0);
  });

  it("is a certificate, a domain and both record types when it is", () => {
    const t = withDomain();
    t.resourceCountIs("AWS::CertificateManager::Certificate", 1);
    t.resourceCountIs("AWS::ApiGatewayV2::DomainName", 1);
    // A and AAAA. A mobile network on IPv6-only cannot reach an A record at
    // all, and the failure reads as "the app doesn't work on my phone".
    t.resourceCountIs("AWS::Route53::RecordSet", 2);
    t.hasResourceProperties(
      "AWS::Route53::RecordSet",
      Match.objectLike({ Type: "A" }),
    );
    t.hasResourceProperties(
      "AWS::Route53::RecordSet",
      Match.objectLike({ Type: "AAAA" }),
    );
  });

  it("serves IPv6, so the AAAA record is not decoration", () => {
    // **An alias can only answer with what its target has.** A custom domain is
    // IPv4-only unless told otherwise, so the AAAA resolved to nothing at all
    // until this was set — verified against the deployed stack, where `dig
    // AAAA` came back empty with the record plainly present in the zone.
    withDomain().hasResourceProperties(
      "AWS::ApiGatewayV2::DomainName",
      Match.objectLike({
        DomainNameConfigurations: Match.arrayWith([
          Match.objectLike({ IpAddressType: "dualstack" }),
        ]),
      }),
    );
  });

  it("keeps the API off the website's name, where CAA forbids ACM", () => {
    // **Not cosmetic.** Vercel publishes CAA on the name it manages that
    // authorises Let's Encrypt, Google, GlobalSign and Sectigo — and not
    // Amazon. CAA is inherited, so ACM cannot issue for anything beneath it,
    // and the failure reads exactly like a DNS propagation problem.
    expect(hostNameFor("prod", "poker-api.example.test")).toBe(
      "poker-api.example.test",
    );
    expect(hostNameFor("dev", "poker-api.example.test")).toBe(
      "poker-api-dev.example.test",
    );
    // A bare label still produces something usable rather than throwing.
    expect(hostNameFor("dev", "poker-api")).toBe("poker-api-dev");
  });

  it("validates the certificate by DNS, so it can renew itself", () => {
    // Email validation needs somebody to click a link on every renewal. For an
    // API nobody is watching, that is a certificate that expires.
    withDomain().hasResourceProperties(
      "AWS::CertificateManager::Certificate",
      Match.objectLike({ ValidationMethod: "DNS" }),
    );
  });

  it("keeps dev off the production host", () => {
    // A dev stack exists to be thrown away. One answering on the production
    // name would take production with it.
    withDomain("dev").hasResourceProperties(
      "AWS::ApiGatewayV2::DomainName",
      Match.objectLike({ DomainName: "poker-api-dev.example.test" }),
    );
    withDomain("prod").hasResourceProperties(
      "AWS::ApiGatewayV2::DomainName",
      Match.objectLike({ DomainName: "poker-api.example.test" }),
    );
  });

  it("half-configured is the same as not configured", () => {
    // Two of the three flags would otherwise fail at deploy time with
    // something unhelpful about a missing zone.
    const app = new App({ context: { apiDomain: "poker-api.example.test" } });
    Template.fromStack(new PokerStack(app, "Partial")).resourceCountIs(
      "AWS::ApiGatewayV2::DomainName",
      0,
    );
  });

  it("publishes the name to ship, not the disposable one", () => {
    // The output is what fills in `apiUrl` in the app. Reading the generated
    // endpoint here would bake the throwaway host into a build even after the
    // durable name existed.
    const outputs = withDomain("dev").findOutputs("ApiUrl");
    expect(JSON.stringify(outputs)).toContain(
      "https://poker-api-dev.example.test",
    );
  });
});

describe("where confirmation emails come from", () => {
  /**
   * Why this is tested at all: Cognito's own sender is capped around 50 a day
   * and lands in spam — observed here — so an app whose sign-up depends on a
   * code arriving cannot ship on it.
   */
  const withMail = (
    stage: "dev" | "prod" = "prod",
    verified = true,
  ): Template => {
    const app = new App({
      context: {
        mailDomain: "example.test",
        hostedZoneId: "Z0000000000000000000",
        hostedZoneName: "example.test",
        region: "us-east-1",
        // **The string, as `-c` gives it.** Setting the boolean here is what
        // let a version through that could not be switched on from a command
        // line at all: the test agreed with the code rather than with the CLI.
        ...(verified ? { mailVerified: "true" } : {}),
      },
    });
    return Template.fromStack(
      new PokerStack(app, `Mailed${stage}${verified}`, {
        settings: settingsFor(stage),
      }),
    );
  };

  it("is absent unless it is asked for", () => {
    template().resourceCountIs("AWS::SES::EmailIdentity", 0);
  });

  /** The same context, minus the region — which is the thing under test. */
  const withoutRegionContext = (id: string): Template => {
    const app = new App({
      context: {
        mailDomain: "example.test",
        hostedZoneId: "Z0000000000000000000",
        hostedZoneName: "example.test",
        mailVerified: "true",
      },
    });
    return Template.fromStack(new PokerStack(app, id));
  };

  it("is absent without a region anywhere, rather than throwing", () => {
    // **The property CI depends on.** `withSES` refuses to synthesise against
    // an environment-agnostic stack, and throwing there would break the
    // credential-free synth the whole test suite runs on.
    delete process.env.CDK_DEFAULT_REGION;
    expect(() => withoutRegionContext("NoRegion")).not.toThrow();
  });

  it("takes the region from the environment, which is how deploys set it", () => {
    /**
     * **`bin/app.ts` documents `CDK_DEFAULT_REGION` as the normal path** and
     * `-c region=` as the override, so reading only the context flag meant a
     * plain `npm run deploy` — and the documented `-c mailVerified=true`
     * follow-up if it omitted the region — dropped the SES identity and its
     * DKIM records and quietly put the pool back on Cognito's sender. There is
     * no error in that case: the identity is only built when all four values
     * are present, so the mail just starts going to spam again.
     */
    process.env.CDK_DEFAULT_REGION = "us-east-1";
    try {
      const t = withoutRegionContext("RegionFromEnv");
      t.resourceCountIs("AWS::SES::EmailIdentity", 1);
      t.hasResourceProperties(
        "AWS::Cognito::UserPool",
        Match.objectLike({
          EmailConfiguration: Match.objectLike({
            EmailSendingAccount: "DEVELOPER",
          }),
        }),
      );
    } finally {
      delete process.env.CDK_DEFAULT_REGION;
    }
  });

  it("verifies the sending subdomain and publishes its DKIM", () => {
    const t = withMail();
    t.hasResourceProperties(
      "AWS::SES::EmailIdentity",
      Match.objectLike({ EmailIdentity: "poker.example.test" }),
    );
    // Three, which is how many keys SES rotates through. Without them the
    // identity never verifies and every send fails.
    expect(
      Object.values(t.findResources("AWS::Route53::RecordSet")).filter(
        (r) => (r.Properties as { Type?: string }).Type === "CNAME",
      ),
    ).toHaveLength(3);
  });

  it("does not move the pool onto an identity nobody has confirmed", () => {
    /**
     * **Cognito checks the identity when it is updated, and verification is
     * asynchronous** — so pointing the pool at a brand-new identity rolls the
     * whole stack back with "Email address is not verified". Observed, twice.
     * The identity is still created; only the switch waits.
     */
    const t = withMail("dev", false);
    t.resourceCountIs("AWS::SES::EmailIdentity", 1);
    t.hasResourceProperties(
      "AWS::Cognito::UserPool",
      Match.objectLike({
        EmailConfiguration: Match.objectLike({
          EmailSendingAccount: "COGNITO_DEFAULT",
        }),
      }),
    );
  });

  it("keeps dev's sending reputation off the production domain", () => {
    // A dev stack mailing throwaway inboxes must not be able to spend the
    // deliverability production's sign-up depends on.
    withMail("dev").hasResourceProperties(
      "AWS::SES::EmailIdentity",
      Match.objectLike({ EmailIdentity: "poker-dev.example.test" }),
    );
  });

  it("moves only the stage whose identity has actually verified", () => {
    /**
     * The two-phase deploy, expressed per stage. Prod's identity does not exist
     * until prod's first deploy creates it, and pointing a pool at an identity
     * SES has not read the DKIM records back for rolls the whole stack back —
     * observed twice. So dev can be on SES while prod is still waiting.
     */
    const perStage = (id: string, stage: "dev" | "prod"): Template =>
      Template.fromStack(
        new PokerStack(
          new App({
            context: {
              mailDomain: "example.test",
              hostedZoneId: "Z0000000000000000000",
              hostedZoneName: "example.test",
              region: "us-east-1",
              mailVerified: { dev: true },
            },
          }),
          id,
          { settings: settingsFor(stage) },
        ),
      );

    perStage("PerStageDev", "dev").hasResourceProperties(
      "AWS::Cognito::UserPool",
      Match.objectLike({
        EmailConfiguration: Match.objectLike({
          EmailSendingAccount: "DEVELOPER",
        }),
      }),
    );
    // Still created, so it can verify; only the switch waits.
    const prod = perStage("PerStageProd", "prod");
    prod.resourceCountIs("AWS::SES::EmailIdentity", 1);
    prod.hasResourceProperties(
      "AWS::Cognito::UserPool",
      Match.objectLike({
        EmailConfiguration: Match.objectLike({
          EmailSendingAccount: "COGNITO_DEFAULT",
        }),
      }),
    );
  });

  it("sends from the domain it verified, which Cognito insists on", () => {
    withMail().hasResourceProperties(
      "AWS::Cognito::UserPool",
      Match.objectLike({
        EmailConfiguration: Match.objectLike({
          From: "Poker Blinds Timer <noreply@poker.example.test>",
        }),
      }),
    );
  });
});

describe("accounts", () => {
  it("signs people in by email, case-insensitively", () => {
    template().hasResourceProperties("AWS::Cognito::UserPool", {
      UsernameAttributes: ["email"],
      UsernameConfiguration: { CaseSensitive: false },
    });
  });

  it("is never deleted by a stack update", () => {
    // Losing the user pool loses every account and every link between an
    // account and a player on somebody's leaderboard.
    template().hasResource("AWS::Cognito::UserPool", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });

  it("gives the phone a client with no secret", () => {
    // A phone cannot keep one, so handing it one is worse than not having it.
    const clients = template().findResources("AWS::Cognito::UserPoolClient");
    const client = Object.values(clients)[0];
    expect(client.Properties.GenerateSecret).not.toBe(true);
  });

  it("does not leak whether an email is registered", () => {
    template().hasResourceProperties("AWS::Cognito::UserPoolClient", {
      PreventUserExistenceErrors: "ENABLED",
    });
  });

  it("has a hosted OAuth domain, because federated sign-in needs one", () => {
    // There is no call that trades a Google or Apple id token for user-pool
    // tokens — the provider redirects to `/oauth2/idpresponse` on this domain
    // and Cognito mints its own from that. Without it neither provider can even
    // be configured: its callback URL is what they are given.
    template().hasResourceProperties("AWS::Cognito::UserPoolDomain", {
      Domain: "pokerkit",
    });
  });

  it("keeps the stages on separate prefixes", () => {
    // A dev callback must not be a valid redirect for the production pool.
    const dev = Template.fromStack(
      new PokerStack(new App(), "DomainDev", { settings: settingsFor("dev") }),
    );
    dev.hasResourceProperties("AWS::Cognito::UserPoolDomain", {
      Domain: "pokerkit-dev",
    });
  });

  it("runs the account-linking trigger before it creates anybody", () => {
    // **Without this, social sign-in silently forks an account.** Cognito does
    // not merge identities, so somebody who signed up with a password and later
    // taps Continue with Google becomes a second, empty user — and every board
    // is keyed by `sub`, so their season looks deleted.
    const pools = template().findResources("AWS::Cognito::UserPool");
    const triggers = (
      Object.values(pools)[0].Properties as {
        LambdaConfig?: { PreSignUp?: unknown };
      }
    ).LambdaConfig;
    expect(triggers?.PreSignUp).toBeDefined();
  });

  it("lets the trigger read and link only in this pool", () => {
    // Scoped to the two calls it makes and to this pool. `ListUsers` on a
    // wildcard would be every pool in the account.
    const policies = Object.values(
      template().findResources("AWS::IAM::Policy"),
    ).map(
      (policy) =>
        policy.Properties as { PolicyDocument: { Statement: unknown[] } },
    );

    const linking = policies
      .flatMap(
        (policy) =>
          policy.PolicyDocument.Statement as Record<string, unknown>[],
      )
      .filter((statement) => {
        const actions = statement.Action;
        const list = Array.isArray(actions) ? actions : [actions];
        return list.includes("cognito-idp:AdminLinkProviderForUser");
      });

    expect(linking).toHaveLength(1);
    expect(linking[0].Action).toEqual([
      "cognito-idp:ListUsers",
      "cognito-idp:AdminLinkProviderForUser",
    ]);
    expect(linking[0].Resource).not.toBe("*");
  });
});

describe("stored data", () => {
  it("keeps the table through a stack update, and can be rewound", () => {
    // A season of game nights cannot be retyped.
    // TableV2 hangs point-in-time recovery off each replica rather than off
    // the table, which is easy to assert in the wrong place and then believe.
    template().hasResource("AWS::DynamoDB::GlobalTable", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
      Properties: Match.objectLike({
        Replicas: Match.arrayWith([
          Match.objectLike({
            PointInTimeRecoverySpecification: {
              PointInTimeRecoveryEnabled: true,
            },
          }),
        ]),
      }),
    });
  });

  it("costs nothing while nobody is playing", () => {
    // Poker nights are a few hours a week; provisioned capacity would be paid
    // for the other 165.
    template().hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      BillingMode: "PAY_PER_REQUEST",
    });
  });
});
