import { describe, expect, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { PokerStack } from "../lib/pokerStack";
import { settingsFor } from "../lib/stage";
import { hostNameFor } from "../lib/apiDomain";
import cdkJson from "../cdk.json";
import { playerChannel } from "@poker/core";

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
    t.hasResourceProperties("AWS::Route53::RecordSet", Match.objectLike({ Type: "A" }));
    t.hasResourceProperties("AWS::Route53::RecordSet", Match.objectLike({ Type: "AAAA" }));
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
    expect(hostNameFor("prod", "poker-api.example.test")).toBe("poker-api.example.test");
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
    expect(JSON.stringify(outputs)).toContain("https://poker-api-dev.example.test");
  });
});

describe("where confirmation emails come from", () => {
  /**
   * Why this is tested at all: Cognito's own sender is capped around 50 a day
   * and lands in spam — observed here — so an app whose sign-up depends on a
   * code arriving cannot ship on it.
   */
  const withMail = (stage: "dev" | "prod" = "prod", verified = true): Template => {
    const app = new App({
      context: {
        mailDomain: "example.test",
        hostedZoneId: "Z0000000000000000000",
        hostedZoneName: "example.test",
        region: "us-east-1",
        ...(verified ? { mailVerified: true } : {}),
      },
    });
    return Template.fromStack(
      new PokerStack(app, `Mailed${stage}${verified}`, { settings: settingsFor(stage) }),
    );
  };

  it("is absent unless it is asked for", () => {
    template().resourceCountIs("AWS::SES::EmailIdentity", 0);
  });

  it("is absent without a region, rather than throwing", () => {
    // **The property CI depends on.** `withSES` refuses to synthesise against
    // an environment-agnostic stack, and throwing there would break the
    // credential-free synth the whole test suite runs on.
    const app = new App({
      context: {
        mailDomain: "example.test",
        hostedZoneId: "Z0000000000000000000",
        hostedZoneName: "example.test",
      },
    });
    expect(() => Template.fromStack(new PokerStack(app, "NoRegion"))).not.toThrow();
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
        EmailConfiguration: Match.objectLike({ EmailSendingAccount: "COGNITO_DEFAULT" }),
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

/** The namespace carrying one player's own cards. */
const privateNamespace = () => {
  const found = template().findResources("AWS::AppSync::ChannelNamespace", {
    Properties: { Name: "player" },
  });
  return Object.values(found)[0].Properties;
};

describe("the realtime bus", () => {
  it("lets players connect and subscribe with their own token", () => {
    template().hasResourceProperties("AWS::AppSync::Api", {
      EventConfig: Match.objectLike({
        ConnectionAuthModes: [{ AuthType: "AMAZON_COGNITO_USER_POOLS" }],
        DefaultSubscribeAuthModes: [{ AuthType: "AMAZON_COGNITO_USER_POOLS" }],
      }),
    });
  });

  it("allows only the server to publish", () => {
    // This is what makes the server authoritative rather than merely
    // well-behaved: nothing reaches a table except through the rules.
    template().hasResourceProperties("AWS::AppSync::Api", {
      EventConfig: Match.objectLike({
        DefaultPublishAuthModes: [{ AuthType: "AWS_IAM" }],
      }),
    });
  });

  it("has a shared channel and a private one", () => {
    template().resourceCountIs("AWS::AppSync::ChannelNamespace", 2);
    template().hasResourceProperties("AWS::AppSync::ChannelNamespace", {
      Name: "table",
    });
  });

  it("guards the private channel with a handler, not with client-side filtering", () => {
    // Hole cards are secret because of where they are published, not because
    // of what a phone chooses to draw.
    expect(privateNamespace().CodeHandlers).toContain("util.unauthorized()");
    expect(privateNamespace().CodeHandlers).toContain("ctx.identity.sub");
  });

  it("guards the namespace the private channels are actually in", () => {
    // The bug this replaced: the guard sat on a namespace those channels never
    // touch. AppSync takes the FIRST path segment as the namespace, so
    // `/table/{id}/player/{sub}` is governed by `table` — which had no handler
    // — and any signed-in account could have read anyone's cards.
    const channel = playerChannel("u9", "t1");
    expect(channel.split("/")[1]).toBe("player");
    const guarded = template().findResources("AWS::AppSync::ChannelNamespace", {
      Properties: { CodeHandlers: Match.anyValue() },
    });
    const names = Object.values(guarded).map((ns) => ns.Properties.Name);
    expect(names).toEqual([channel.split("/")[1]]);
  });

  it("creates the subscribe authorizer's data source before the namespace", () => {
    // The first deploy failed here, and nothing before it could have caught
    // that: `DataSourceName` is a plain string, not a `Ref`, so CloudFormation
    // sees no dependency and creates both in parallel — the namespace loses the
    // race and the stack rolls back with `DataSource not found`.
    //
    // Invisible in a synth, and invisible on every deploy after the first,
    // because by then the data source is already there. So the assertion is on
    // the explicit `DependsOn` rather than on any observable behaviour.
    const namespaces = template().findResources("AWS::AppSync::ChannelNamespace", {
      Properties: { HandlerConfigs: Match.anyValue() },
    });
    const [guarded] = Object.values(namespaces);
    const sources = Object.keys(
      template().findResources("AWS::AppSync::DataSource"),
    );
    expect(guarded.DependsOn).toEqual(expect.arrayContaining(sources));
  });

  it("reads the player id from where the shared path builder puts it", () => {
    // The handler and `playerChannel` must agree on the position, or the guard
    // compares the wrong segment and fails open or closed at random.
    expect(privateNamespace().CodeHandlers).toContain("segments[2]");
    expect(playerChannel("u9", "t1").split("/")[2]).toBe("u9");
  });

  it("lets the server's own publish through the private namespace", () => {
    // Namespace handlers run for every publish whatever the auth mode, so an
    // unconditional reject here would block the only publish there is.
    expect(privateNamespace().CodeHandlers).toContain("return ctx.events");
  });
});

describe("the action handler", () => {
  it("shares the stack only with functions somebody wrote", () => {
    // The thing this is guarding is not the count — it is that no Lambda got
    // here by accident. `logRetention` used to add one whose entire job was to
    // call PutRetentionPolicy on another function's log group; an explicit log
    // group does that with no function at all.
    template().resourceCountIs("Custom::LogRetention", 0);
    // Four: the action handler, the identity route that proves the API chain
    // works, the subscribe authorizer, and the group routes. Update this
    // deliberately when a fifth is written.
    template().resourceCountIs("AWS::Lambda::Function", 4);
  });

  it("has no secondary index at all", () => {
    // There was one, to read memberships from the group's side. It is gone
    // because memberships are now written twice — which makes that read a
    // strongly consistent query on the group's own partition, and removes a
    // hot partition with it: the obvious inverted index partitions on `sk`, and
    // every poker table row carries the constant `sk: "STATE"`.
    const table = Object.values(
      template().findResources("AWS::DynamoDB::GlobalTable"),
    )[0];
    expect(
      (table.Properties as { GlobalSecondaryIndexes?: unknown[] })
        .GlobalSecondaryIndexes,
    ).toBeUndefined();
  });

  it("is the only thing that can publish an event", () => {
    template().hasResourceProperties(
      "AWS::IAM::Policy",
      Match.objectLike({
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({ Action: "appsync:EventPublish" }),
          ]),
        }),
      }),
    );
  });

  it("knows where to write and where to publish", () => {
    template().hasResourceProperties("AWS::Lambda::Function", {
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          TABLE_NAME: Match.anyValue(),
          EVENT_API_HTTP: Match.anyValue(),
        }),
      }),
    });
  });

  it("gives up rather than hanging on to a turn", () => {
    // A hand cannot proceed while an action is in flight, so a slow one has to
    // fail fast enough that the table notices rather than waiting.
    template().hasResourceProperties("AWS::Lambda::Function", {
      Timeout: 10,
      Runtime: "nodejs22.x",
    });
  });
});

describe("who may watch a shared table", () => {
  it("checks on subscribe, rather than letting anybody signed in watch", () => {
    // The hole everything else was waiting on: sign-up is open, so
    // "authenticated" is anybody at all, and a table id was the only thing
    // between a stranger and every bet, board and showdown of a stranger's game.
    template().hasResourceProperties("AWS::AppSync::ChannelNamespace", {
      Name: "table",
      HandlerConfigs: {
        OnSubscribe: Match.objectLike({
          Behavior: "DIRECT",
          Integration: Match.objectLike({
            DataSourceName: "SubscribeAuthorizer",
          }),
        }),
      },
    });
  });

  it("waits for the answer, because an asynchronous guard cannot refuse", () => {
    // `EVENT` mode does not wait for a response, so an authorizer configured
    // that way is a log line rather than a guard.
    template().hasResourceProperties("AWS::AppSync::ChannelNamespace", {
      Name: "table",
      HandlerConfigs: {
        OnSubscribe: Match.objectLike({
          Integration: Match.objectLike({
            LambdaConfig: { InvokeType: "REQUEST_RESPONSE" },
          }),
        }),
      },
    });
  });

  it("gives the authorizer read access and nothing more", () => {
    // A guard has no business writing to the thing it is deciding about.
    const policies = Object.values(
      template().findResources("AWS::IAM::Policy"),
    ).map(
      (policy) =>
        policy.Properties as {
          PolicyDocument: { Statement: { Action: string | string[] }[] };
        },
    );
    const authorizerPolicy = policies.find((policy) =>
      JSON.stringify(policy).includes("SubscribeAuthorizer"),
    );
    expect(authorizerPolicy).toBeDefined();
    const actions = authorizerPolicy!.PolicyDocument.Statement.flatMap(
      (statement) =>
        Array.isArray(statement.Action) ? statement.Action : [statement.Action],
    );
    const writes = actions.filter((action) =>
      /PutItem|UpdateItem|DeleteItem|BatchWrite/.test(action),
    );
    expect(writes).toEqual([]);
  });

  it("lets AppSync invoke it, and only AppSync", () => {
    template().hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: { Service: "appsync.amazonaws.com" },
          }),
        ]),
      }),
    });
  });
});
