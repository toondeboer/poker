/**
 * The backend for accounts and shared leaderboards.
 *
 * Everything the app cannot do on a phone alone: who you are, which boards you
 * belong to, and one copy of a board that several people can read from
 * different houses. Everything else — the timer, the payouts, dealing a hand —
 * works with no backend at all.
 *
 * **Nothing in here decides anything about poker.** There is no game on the
 * server. A server-authoritative poker table lived here for most of the
 * project's life and was deleted before 1.2.0 shipped, along with the betting
 * engine it enforced: wagering chips is simulated gambling under Apple's
 * definition. See the Gambling classification section in `ROADMAP.md`, and the
 * `archive/betting-engine` tag.
 *
 * ## Every read is authorized, not merely authenticated
 *
 * Sign-up is open, so "has a token" means nothing on its own — an account
 * holding a board id must not be able to read it. Membership is a row
 * (`MEMBER#<accountId>` under the group), and every handler checks it. The
 * shape of the key schema carries several of these rules outright; see
 * `SYNC.md`.
 */

import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps,
} from "aws-cdk-lib";
import {
  AttributeType,
  Billing,
  Operation,
  TableV2,
} from "aws-cdk-lib/aws-dynamodb";
import {
  AccountRecovery,
  UserPool,
  UserPoolClient,
  OAuthScope,
  ProviderAttribute,
  UserPoolClientIdentityProvider,
  UserPoolEmail,
  UserPoolIdentityProviderApple,
  UserPoolIdentityProviderGoogle,
  UserPoolOperation,
} from "aws-cdk-lib/aws-cognito";
import { Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { FilterPattern, LogGroup, MetricFilter } from "aws-cdk-lib/aws-logs";
import {
  HttpNoneAuthorizer,
  HttpApi,
  HttpMethod,
  type CfnStage,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { settingsFor, type StageSettings } from "./stage";
import { domainFor } from "./apiDomain";
import { mailFor } from "./mailIdentity";
import {
  APP_CALLBACK_URLS,
  APP_LOGOUT_URLS,
  socialSignInFor,
} from "./socialSignIn";
import { Observability, serviceMetric } from "./observability";
import { MathExpression } from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";
import * as path from "node:path";

export type PokerStackProps = StackProps & {
  /** Where alarms are sent. Without it they fire into a topic nobody reads. */
  alertEmail?: string;
  /** Dollars a month before somebody is warned. Needs an `alertEmail`. */
  monthlyBudgetUsd?: number;
  /**
   * Which backend this is.
   *
   * Optional so the tests and a bare `cdk synth` still work — they default to
   * the *strict* end, because a settings mistake that makes prod behave like
   * dev deletes data, and one that makes dev behave like prod merely costs a
   * manual cleanup.
   */
  settings?: StageSettings;
};

/**
 * One DynamoDB metric, for one table and one operation.
 *
 * **Both dimensions, always.** Without `TableName` this reads every table in
 * the account; without `Operation` it reads none at all, because DynamoDB
 * publishes these per-operation and CloudWatch does not aggregate across a
 * dimension you simply left out.
 */
const dynamoMetric = (
  tableName: string,
  metricName: string,
  operation: Operation,
) =>
  serviceMetric({
    namespace: "AWS/DynamoDB",
    metricName,
    dimensions: { TableName: tableName, Operation: operation },
  });

export class PokerStack extends Stack {
  constructor(scope: Construct, id: string, props?: PokerStackProps) {
    super(scope, id, props);
    const settings = props?.settings ?? settingsFor("prod");

    /**
     * Tags on everything in this stack.
     *
     * Two jobs, which is why there are three tags rather than two.
     *
     * `project` and `stage` are for **reading** the bill: Cost Explorer can
     * group by several tags at once, so these are what answer "what does poker
     * cost, and how much of it is dev" once they are activated as cost
     * allocation tags.
     *
     * `billingScope` is for **alarming** on it, and exists because AWS Budgets
     * cannot express the same thing. Its `TagKeyValue` filter ORs the values it
     * is given, so `project$poker` plus `stage$dev` matches either — every
     * poker resource including prod, *plus* anything else in the account tagged
     * `stage=dev`. One tag whose value is already unique per stack is the only
     * shape that filter can hold. See `Observability`.
     *
     * **None of this does anything until the tags are activated by hand** in
     * Billing → Cost allocation tags. CloudFormation cannot activate them, and
     * activation is not retroactive — spend before it stays unattributed. The
     * runbook is in the README.
     */
    Tags.of(this).add("project", "poker");
    Tags.of(this).add("stage", settings.stage);
    Tags.of(this).add("billingScope", `poker-${settings.stage}`);

    /**
     * Telemetry and the alarms that read it — set up first, because every
     * resource below wants to hand it something.
     */
    const observability = new Observability(this, "Observability", {
      settings,
      alertEmail: props?.alertEmail,
      monthlyBudgetUsd: props?.monthlyBudgetUsd,
    });

    /**
     * Traces, the AWS-native way.
     *
     * **This replaced an OpenTelemetry collector layer, and the reason is a
     * measurement.** The ADOT layer worked — traces reached Grafana Cloud — and
     * it cost **~1.9 seconds of cold start** on every function: Identity
     * 142.9 → 1889.2 ms, TableAction 302.0 → 2267.5 ms, SubscribeAuthorizer
     * 277.4 → 2160.9 ms, n=6 each. The figure everybody quotes for that layer,
     * including an earlier version of this comment, is 50-200 ms.
     *
     * That is the wrong trade for this app specifically. A table plays one
     * evening a week, so **most invocations are cold starts** rather than a
     * rounding error on a warm fleet — and `SubscribeAuthorizer` runs before a
     * player can see a table, on a three-second timeout, which ~2.2 s of init
     * very nearly exhausts.
     *
     * **`TableAction` and `SubscribeAuthorizer` no longer exist** — they went with
     * the table backend — but the measurement is left as it was taken rather
     * than rewritten around the survivors, because the numbers are the point
     * and re-deriving them from functions that were never measured would make
     * this a claim instead of a record.
     *
     * `Tracing.ACTIVE` costs single-digit milliseconds because the X-Ray daemon
     * is part of the execution environment rather than a Go binary this
     * function has to start. What it gives up is vendor neutrality — and that
     * was always the weakest argument here, in a backend welded to Cognito,
     * API Gateway, DynamoDB and CDK. The telemetry was the one portable
     * piece of something entirely AWS-specific.
     *
     * The infrastructure half needs no export at all: API Gateway 5xx and
     * DynamoDB throttles are already CloudWatch metrics,
     * which is what the alarms read and what the dashboard draws. Shipping them
     * to a third party meant paying to copy data out of the place it already
     * was.
     */
    const functionEnvironment = { NODE_OPTIONS: "--enable-source-maps" };

    /**
     * How every handler in this stack is bundled. One object, three functions.
     *
     * Nothing is copied in beside the bundle any more: the collector
     * configuration this used to carry went with the collector. Nor is there a
     * `footer` re-exporting the handler — that existed because esbuild compiles
     * `export const handler` into a **non-configurable** getter, which made
     * ADOT's `shimmer` wrap throw `Cannot redefine property: handler` and fail
     * every invocation. Nothing wraps the handler now. **If an OpenTelemetry
     * layer is ever added back, that footer has to come back with it**; see the
     * README.
     */
    const handlerBundling = {
      minify: true,
      sourceMap: true,
      target: "node22",
      /**
       * **Bundle the Cognito client rather than trusting the runtime to have
       * it.** CDK leaves every `@aws-sdk/*` external by default, which is right
       * for DynamoDB — the runtime certainly ships that — and a gamble for
       * anything else. `DELETE /me` calls Cognito at the **last** step, after
       * every row is already gone, so a missing module there fails in the one
       * place from which no retry can recover.
       *
       * It does work unbundled today; that was verified twice against the
       * deployed stack. It is not a thing to depend on: what the runtime
       * includes is AWS's to change, and bundling costs a few hundred kilobytes
       * to stop it being a question.
       */
      externalModules: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb"],
    };

    /**
     * Who you are.
     *
     * Email sign-in, plus Google and Apple as user-pool identity providers —
     * added together, because App Store guideline 4.8 requires Sign in with
     * Apple alongside any other third-party sign-in. Both carry real client ids
     * and secrets, resolved per stage by `socialSignInFor` below, so a stage
     * without credentials gets email-only rather than a provider scaffolded
     * with placeholders that would silently ship broken.
     */
    // Resolved before the user pool, which is the first thing that needs it.
    const mail = mailFor(this, settings.stage);

    const userPool = new UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 10,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      /**
       * **Cognito's own sender only when nothing better is configured.** It is
       * capped around 50 messages a day and its mail lands in spam — observed
       * here with the smoke-test codes — so a build whose sign-up depends on a
       * code arriving cannot ship on it. See `mailFor`.
       */
      email: mail?.email ?? UserPoolEmail.withCognito(),
      // Losing the user pool loses every account and every link between an
      // account and a player. Nothing about a stack update should be able to
      // do that by accident.
      removalPolicy: settings.dataRemovalPolicy,
      // Prod refuses to be deleted at all until somebody turns this off on
      // purpose — `RETAIN` saves the rows, and this saves the identities they
      // are keyed by.
      deletionProtection: settings.deletionProtection,
    });

    /**
     * One person, one account, however they signed in.
     *
     * **Cognito does not merge identities**, so somebody who signed up with a
     * password and later taps *Continue with Google* becomes a second, empty
     * account — and since every board and claim is keyed by `sub`, their season
     * looks deleted. `linkAccounts` is the `PreSignUp` trigger that attaches the
     * provider identity to the account that already exists instead.
     *
     * **Attached unconditionally, not with the providers.** It costs nothing
     * while nobody is federated — the `PreSignUp_SignUp` path only reads and
     * allows — and wiring it at the same time as the first provider would mean
     * the one deploy that introduces federated sign-in is also the one that
     * introduces the thing protecting it. The order matters more than the
     * saving.
     */
    const linkHandler = new NodejsFunction(this, "LinkAccounts", {
      entry: path.join(__dirname, "lambda", "linkAccounts.ts"),
      runtime: Runtime.NODEJS_20_X,
      logGroup: new LogGroup(this, "LinkAccountsLogs", {
        retention: settings.logRetention,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: functionEnvironment,
      tracing: Tracing.ACTIVE,
      bundling: handlerBundling,
    });
    userPool.addTrigger(UserPoolOperation.PRE_SIGN_UP, linkHandler);
    /**
     * Scoped to this pool, and to the two calls the trigger makes.
     *
     * **Attached as its own policy rather than through `addToRolePolicy`, and
     * that is the whole reason this is three lines longer than it looks.** The
     * pool depends on the function — it is the trigger — and CDK makes a
     * function depend on its role's *default* policy, so putting a statement
     * naming `userPoolArn` there closes the loop:
     *
     *     UserPool → LinkAccounts → LinkAccountsServiceRoleDefaultPolicy → UserPool
     *
     * `cdk synth` does not notice. `Template.fromStack` does, which is the only
     * reason it was caught before a deploy failed on it.
     *
     * A separate `Policy` hangs off the same role without the function
     * depending on it, so the cycle is gone and the permission stays scoped to
     * this pool. The alternative — a `userpool/*` wildcard — has no cycle
     * either and hands the trigger every pool in the account, which is a worse
     * trade for a saving of one construct.
     */
    linkHandler.role?.attachInlinePolicy(
      new Policy(this, "LinkAccountsPolicy", {
        statements: [
          new PolicyStatement({
            actions: [
              "cognito-idp:ListUsers",
              "cognito-idp:AdminLinkProviderForUser",
            ],
            resources: [userPool.userPoolArn],
          }),
        ],
      }),
    );

    /**
     * Cognito's hosted OAuth endpoint.
     *
     * **Federated sign-in on a *user pool* cannot skip this.** There is no call
     * that trades a Google or Apple id token for user-pool tokens — the phone
     * opens this domain, the provider redirects back to `/oauth2/idpresponse`
     * here, and Cognito mints its own tokens from that. (An *identity* pool
     * does take a provider token directly, but it hands back AWS credentials
     * rather than the pool tokens every route in this API authorises against.)
     *
     * So the domain has to exist **before** either provider can be configured:
     * its callback URL is what gets pasted into Google Cloud Console and the
     * Apple developer portal, and neither can be saved without it.
     *
     * The prefix is global across every AWS customer, not per account — which
     * is why it is a chosen name rather than something derived. Separate
     * prefixes per stage for the same reason the mail domains are separate: a
     * dev callback must not be a valid redirect for the production pool.
     */
    const authDomain = userPool.addDomain("AuthDomain", {
      cognitoDomain: {
        domainPrefix: settings.stage === "prod" ? "pokerkit" : "pokerkit-dev",
      },
    });

    /**
     * Sign in with Apple and Google, when the credentials are configured.
     *
     * **Built-in provider constructs, never `UserPoolIdentityProviderOidc`.**
     * The OIDC one works, looks identical on the login screen, and bills every
     * user on Cognito's 50-MAU federated tier instead of the 10,000-MAU one
     * that includes social providers. There is nothing on the bill to catch it
     * until it is already wrong.
     */
    const social = socialSignInFor(this, settings.stage);
    // Typed as constructs because that is all this needs them for: the client
    // names these providers by string, so it must be created after them.
    const socialProviders: Construct[] = [];
    if (social) {
      socialProviders.push(
        new UserPoolIdentityProviderGoogle(this, "Google", {
          userPool,
          clientId: social.google.clientId,
          clientSecretValue: social.google.clientSecret,
          // `email` is what the linking trigger matches on, and `openid` is
          // what makes it an id token rather than an access token.
          scopes: ["openid", "email", "profile"],
          attributeMapping: {
            email: ProviderAttribute.GOOGLE_EMAIL,
            givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
            /**
             * **The account-linking trigger refuses to link without this**, and
             * it is not decoration on either side. Cognito only passes a
             * federated attribute to a trigger if it is *mapped*, so leaving
             * this out means `email_verified` is simply absent from the event —
             * and the trigger, correctly, treats absent as unverified and
             * declines to link. The result is the silent duplicate account the
             * whole trigger exists to prevent.
             */
            emailVerified: ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
          },
        }),
        new UserPoolIdentityProviderApple(this, "Apple", {
          userPool,
          clientId: social.apple.servicesId,
          teamId: social.apple.teamId,
          keyId: social.apple.keyId,
          privateKeyValue: social.apple.privateKey,
          scopes: ["email", "name"],
          attributeMapping: {
            email: ProviderAttribute.APPLE_EMAIL,
            // See the note on Google above: unmapped means absent from the
            // trigger event, which the trigger reads as unverified.
            emailVerified: ProviderAttribute.APPLE_EMAIL_VERIFIED,
          },
        }),
      );
    }

    const userPoolClient = new UserPoolClient(this, "MobileClient", {
      userPool,
      // A phone cannot keep a secret, so it does not get one.
      generateSecret: false,
      /**
       * Both flows, and the app uses the second.
       *
       * `userSrp` proves knowledge of a password without sending it, and needs
       * big-integer maths — which means a client library, which on React Native
       * means native modules, which means every dev-client binary is invalid
       * until rebuilt and every release binary is bigger. For accounts holding
       * a poker leaderboard that is a bad trade, so the app uses
       * `userPassword`: the password crosses inside the TLS session rather than
       * not at all.
       *
       * SRP stays enabled because switching to it later means adding a library
       * and changing one file — nothing above `AuthProvider` knows which is in
       * use — and because a future federated or hosted-UI flow may want it.
       */
      authFlows: { userSrp: true, userPassword: true },
      /**
       * **Named redirects, because there is a hosted-UI domain now.**
       *
       * This used to have no `oAuth` block at all, on the grounds that the app
       * signs in through SRP — with a note that CDK fills an omitted
       * `callbackUrls` with `https://example.com`, harmless while no hosted UI
       * existed and "a perfectly valid redirect target the moment one exists".
       * One exists. So the default is replaced rather than left: an authorised
       * redirect to a domain we do not own is somewhere an authorisation code
       * can be delivered.
       *
       * The app's own scheme, so finishing at a provider reopens the app
       * instead of stranding somebody in a browser tab.
       *
       * `authorizationCodeGrant` only. The implicit flow puts tokens in a URL
       * fragment, where they reach browser history and any handler on the way
       * back; the code flow hands over something single-use instead.
       */
      oAuth: {
        flows: { authorizationCodeGrant: true, implicitCodeGrant: false },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: APP_CALLBACK_URLS,
        logoutUrls: APP_LOGOUT_URLS,
      },
      /**
       * Cognito first, then whatever is configured.
       *
       * Email and password stays on the list whether or not the providers are:
       * it is what everybody who has an account today uses, and dropping it
       * would sign all of them out.
       */
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.COGNITO,
        ...(social
          ? [
              UserPoolClientIdentityProvider.GOOGLE,
              UserPoolClientIdentityProvider.APPLE,
            ]
          : []),
      ],
      // Long enough that a monthly player is not signed out between game
      // nights; the access token stays short.
      refreshTokenValidity: Duration.days(90),
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      preventUserExistenceErrors: true,
    });
    /**
     * **The client names the providers, so they have to exist first.**
     * CloudFormation infers no dependency from `supportedIdentityProviders` —
     * it is a list of strings — and creating the client first fails with
     * "identity provider Google does not exist", intermittently, because it is
     * a race rather than a rule.
     */
    for (const provider of socialProviders) {
      userPoolClient.node.addDependency(provider);
    }

    /**
     * Everything else, in one table.
     *
     * Groups, memberships, players, games and live table state are all small,
     * always read by a known key, and never queried across each other — so one
     * table with a composite key is the whole data model, and on-demand billing
     * costs nothing while the app is idle, which it is most of the week.
     */
    const table = new TableV2(this, "Table", {
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      billing: Billing.onDemand(),
      // A season of game nights cannot be retyped. Both of these are about
      // that, not about uptime.
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: settings.pointInTimeRecovery,
      },
      removalPolicy: settings.dataRemovalPolicy,
      /**
       * **And the table's own guard, which is not the same thing as `RETAIN`.**
       *
       * `removalPolicy` is a CloudFormation instruction: it stops a stack
       * update or a `cdk destroy` taking the table with it. It says nothing
       * about a direct `DeleteTable` call, which is the one an accident or a
       * stray script makes — and this account runs two other projects, so it is
       * not a hypothetical hand on the keyboard.
       *
       * The user pool has had exactly this since the beginning (`settings.
       * deletionProtection`, applied below). The table holding every board and
       * every game ever recorded had not, which was an omission rather than a
       * decision — found by reading prod back after its first deploy.
       *
       * Off in dev, deliberately: dev exists to be thrown away and rebuilt, and
       * a protected table makes `cdk destroy` a two-step job for no benefit.
       */
      deletionProtection: settings.deletionProtection,
      // A tombstone is worth keeping only until every phone that might
      // resurrect the thing it deleted has seen it — see SYNC.md.
      timeToLiveAttribute: "expiresAt",
    });

    /**
     * Who the caller is, according to the token they presented.
     *
     * `GET /me` exists so the app can turn a Cognito token into the account id
     * every other route keys on, without decoding the token itself and without
     * a second source of truth about what a `sub` means.
     *
     * No CORS. The mobile app does not need it, and a permissive policy added
     * "for later" is a permissive policy nobody revisits. The web timer can
     * have one the day it needs one, scoped to its own origin.
     */
    const identityHandler = new NodejsFunction(this, "Identity", {
      entry: path.join(__dirname, "lambda", "identity.ts"),
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(5),
      logGroup: new LogGroup(this, "IdentityLogs", {
        retention: settings.logRetention,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      // Bundling a source map does nothing on its own — Node ignores it unless
      // told to load it, so without this every stack trace reads
      // `index.js:1:24310` and the map is dead weight in the artefact.
      environment: functionEnvironment,
      tracing: Tracing.ACTIVE,
      bundling: handlerBundling,
    });

    /**
     * Verified before a handler ever runs.
     *
     * API Gateway checks the signature, the issuer, the audience and the expiry
     * and hands the decoded claims to the function. A handler that parsed the
     * `Authorization` header itself would be duplicating that, and the
     * duplicate is the one that eventually gets it wrong.
     */
    const authorizer = new HttpUserPoolAuthorizer("Authorizer", userPool, {
      userPoolClients: [userPoolClient],
    });

    /**
     * A name of our own for the API.
     *
     * **The reason is durability, not looks.** The generated
     * `https://<id>.execute-api.<region>.amazonaws.com` host is baked into
     * every shipped binary, and the id belongs to the API Gateway resource — so
     * if this stack is ever recreated, that host changes and **every installed
     * copy of the app is permanently broken**, with no way to point it
     * anywhere else. A name we own is the only insurance against that, it is
     * nearly free, and it is impossible to add retroactively for anybody who
     * has already installed the old one.
     *
     * **Opt-in through context**, because `cdk synth` and the tests have to
     * work with no credentials at all (see `bin/app.ts`) — and because a
     * hosted zone this stack does not own would fail at deploy time rather
     * than here. Without the context flags the API is exactly what it was.
     */
    const domain = domainFor(this, settings.stage);

    const api = new HttpApi(this, "Api", {
      apiName: `${this.stackName}-api`,
      // Stale — the AppSync push side is gone. Left as-is deliberately: this
      // string is deployed metadata, and changing it would put the branch out
      // of sync with the live stack for a cosmetic fix. Correct it with the
      // next real infra deploy.
      description: "Requests in. Everything else comes back over AppSync.",
      // **Default, not per-route.** A route added later is authenticated
      // because nobody did anything, and making one public has to be a
      // deliberate `authorizer: new HttpNoneAuthorizer()`. Fail closed is only
      // worth anything when it is the thing that happens by default.
      defaultAuthorizer: authorizer,
      ...(domain
        ? {
            defaultDomainMapping: { domainName: domain.domainName },
            /**
             * The generated host is deliberately **left answering**, as a way
             * back in if DNS or the certificate ever has a bad day. That is
             * only safe because the `ApiUrl` output below names the custom
             * host, so a build cannot pick up the disposable one by accident.
             *
             * Worth turning off (`disableExecuteApiEndpoint: true`) once the
             * custom name has carried real traffic for a while: two names for
             * one API is two names somebody can end up depending on.
             */
          }
        : {}),
    });

    api.addRoutes({
      path: "/me",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("IdentityRoute", identityHandler),
    });

    /**
     * The kill switch — see `lambda/config.ts`.
     *
     * **The one deliberately public route**, and `HttpNoneAuthorizer` is how
     * that is said out loud rather than by omission: the API authenticates by
     * default precisely so this has to be a choice somebody made. A phone must
     * be able to ask whether accounts work *before* it has one, which is
     * exactly the state the switch exists for.
     */
    const configHandler = new NodejsFunction(this, "Config", {
      entry: path.join(__dirname, "lambda", "config.ts"),
      runtime: Runtime.NODEJS_22_X,
      memorySize: 128,
      timeout: Duration.seconds(3),
      logGroup: new LogGroup(this, "ConfigLogs", {
        retention: settings.logRetention,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: {
        ...functionEnvironment,
        /**
         * Set to `off` to switch a feature off in a running deployment. A stack
         * update rather than a build — a minute, against days for a store
         * review, which is the entire point.
         */
        FEATURE_ACCOUNTS:
          (this.node.tryGetContext("featureAccounts") as string) ?? "on",
        FEATURE_SHARING:
          (this.node.tryGetContext("featureSharing") as string) ?? "on",
      },
      // Traced like everything else. It is the first thing a cold app asks, so
      // when launches are slow this is where the answer starts.
      tracing: Tracing.ACTIVE,
      // `bundling:`, not a spread. Spread, these land on `NodejsFunctionProps`
      // keys that do not exist and are dropped without a word — the Config
      // function was the only one of the five shipping unminified and without a
      // source map, which is exactly the opposite of what the others say.
      bundling: handlerBundling,
    });

    api.addRoutes({
      path: "/config",
      methods: [HttpMethod.GET],
      authorizer: new HttpNoneAuthorizer(),
      integration: new HttpLambdaIntegration("ConfigRoute", configHandler),
    });

    /**
     * The shared clock.
     *
     * **Authenticated, and its own function.** Its own function because these
     * routes are *polled*: every viewer asks every few seconds, all evening,
     * and that traffic must not be able to make recording a game slow.
     *
     * **Authenticated because a session is peer-to-peer, not a broadcast.** Any
     * participant may publish — that is why the protocol breaks ties on
     * `sender`, "two people can reach for the phone at once" — so the join code
     * is not a read credential, it is a write one. A guessed code would not
     * merely watch a countdown; it would pause somebody's game and jump their
     * blind level. Leaving these open was considered and is the wrong trade: the
     * app already requires an account to join a shared board, so requiring one
     * to join a shared clock is the rule it already has rather than a new
     * imposition.
     */
    const sessionsHandler = new NodejsFunction(this, "Sessions", {
      entry: path.join(__dirname, "lambda", "sessions.ts"),
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(5),
      logGroup: new LogGroup(this, "SessionsLogs", {
        retention: settings.logRetention,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: { ...functionEnvironment, TABLE_NAME: table.tableName },
      tracing: Tracing.ACTIVE,
      bundling: handlerBundling,
    });
    table.grantReadWriteData(sessionsHandler);

    const sessionsRoute = new HttpLambdaIntegration(
      "SessionsRoute",
      sessionsHandler,
    );
    for (const [path_, methods] of [
      ["/sessions", [HttpMethod.POST]],
      ["/sessions/{code}", [HttpMethod.GET, HttpMethod.POST]],
    ] as [string, HttpMethod[]][]) {
      // No `authorizer:` — the API's default is the Cognito one, and taking it
      // is the whole point of the default being what it is.
      api.addRoutes({ path: path_, methods, integration: sessionsRoute });
    }

    /**
     * The shared leaderboard.
     *
     * One function behind every group route, because they share the thing that
     * matters — each authorizes before it acts, and one entry point is how that
     * stays true of a route somebody adds later. Its own function rather than a
     * branch inside the action handler: a leaderboard write must not be able to
     * fail because a poker hand was slow.
     */
    const groupsLogs = new LogGroup(this, "GroupsLogs", {
      retention: settings.logRetention,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**
     * What turns a report into something a person sees.
     *
     * `POST /groups/{groupId}/report` writes a row and logs `content reported`;
     * on its own that is a table nobody opens. This counts that exact message
     * and the alarm below emails it on, which is the part both stores' UGC
     * rules actually care about — Apple's guideline 1.2 asks for a report
     * mechanism *and* a timely response, and nothing responds timely to a row.
     *
     * **The string has to match the handler's.** Changing one without the other
     * switches reporting off silently, so the handler carries the same warning.
     */
    const reportsMetric = new MetricFilter(this, "ContentReportFilter", {
      logGroup: groupsLogs,
      metricNamespace: `Poker/${settings.stage}`,
      metricName: "ContentReports",
      filterPattern: FilterPattern.stringValue(
        "$.message",
        "=",
        "content reported",
      ),
      metricValue: "1",
      // Without this the metric reports nothing when nobody reports anything,
      // and `TreatMissingData` has to carry the meaning instead.
      defaultValue: 0,
    });

    const groupsHandler = new NodejsFunction(this, "Groups", {
      entry: path.join(__dirname, "lambda", "groups.ts"),
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        ...functionEnvironment,
        TABLE_NAME: table.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
      tracing: Tracing.ACTIVE,
      logGroup: groupsLogs,
      bundling: handlerBundling,
    });
    table.grantReadWriteData(groupsHandler);
    /**
     * Deleting the Cognito user, and **only** that.
     *
     * `DELETE /me` is the last step of a deletion the server is running on
     * somebody's behalf, so it needs a permission the client's own token cannot
     * give it. Scoped to this one action on this one pool: a handler that could
     * also *create* or *update* users would be a handler that could mint an
     * account or change somebody's email.
     */
    groupsHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ["cognito-idp:AdminDeleteUser"],
        resources: [userPool.userPoolArn],
      }),
    );

    const groupsRoute = new HttpLambdaIntegration("GroupsRoute", groupsHandler);
    for (const [path_, methods] of [
      ["/groups", [HttpMethod.GET, HttpMethod.POST]],
      ["/groups/{groupId}", [HttpMethod.GET]],
      ["/groups/{groupId}/players", [HttpMethod.POST]],
      ["/groups/{groupId}/players/{playerId}", [HttpMethod.DELETE]],
      ["/groups/{groupId}/games", [HttpMethod.POST]],
      ["/groups/{groupId}/games/{gameId}", [HttpMethod.DELETE]],
      ["/groups/{groupId}/claims", [HttpMethod.POST]],
      ["/groups/{groupId}/members", [HttpMethod.GET]],
      ["/groups/{groupId}/invite", [HttpMethod.POST]],
      // Reporting what is on a board. Members only — see the handler.
      ["/groups/{groupId}/report", [HttpMethod.POST]],
      [
        "/groups/{groupId}/members/{accountId}",
        [HttpMethod.PUT, HttpMethod.DELETE],
      ],
      ["/invites/{token}", [HttpMethod.POST]],
      // The account's own deletion. `GET /me` stays on the identity handler —
      // one says who you are, the other unpicks everything you touched.
      ["/me", [HttpMethod.DELETE]],
    ] as [string, HttpMethod[]][]) {
      api.addRoutes({ path: path_, methods, integration: groupsRoute });
    }

    /**
     * Access logs, and a ceiling.
     *
     * The log line names the caller's `sub`, which is what turns "something is
     * erroring" into "this account, this route, this request id". It carries no
     * headers and no body: the `Authorization` header is a bearer token, and a
     * log that contains one is a credential store nobody is treating as one.
     *
     * The throttle is not capacity planning — a home poker app does not need
     * 10,000 requests a second, and the number exists so that a client stuck in
     * a retry loop costs a rejection rather than a bill.
     *
     * **It is per route, shared by everybody**, which is the honest limitation:
     * one account hammering `POST /groups/{groupId}/games` returns 429 to
     * everybody recording a game, so it protects the bill and not
     * availability. HTTP APIs
     * have no per-caller quota — usage plans are a REST API feature — so the
     * fix when it is needed is a WAF rate rule keyed on IP or on the caller,
     * which costs about $5 a month for a web ACL. Not worth it before anybody
     * has connected; worth knowing before somebody wonders why one bad client
     * took everybody's boards down.
     */
    const accessLogs = new LogGroup(this, "ApiAccessLogs", {
      retention: settings.logRetention,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const stage = api.defaultStage!.node.defaultChild as CfnStage;
    stage.accessLogSettings = {
      destinationArn: accessLogs.logGroupArn,
      format: JSON.stringify({
        requestId: "$context.requestId",
        route: "$context.routeKey",
        method: "$context.httpMethod",
        status: "$context.status",
        latencyMs: "$context.responseLatency",
        integrationStatus: "$context.integrationStatus",
        // Who, not what they sent.
        accountId: "$context.authorizer.claims.sub",
      }),
    };
    stage.defaultRouteSettings = {
      throttlingRateLimit: 50,
      throttlingBurstLimit: 100,
    };

    /**
     * The handful of things worth being woken up for.
     *
     * Deliberately few. An alarm nobody acts on trains everybody to ignore the
     * next one, so each of these has an answer to "and then what?" — and each
     * says so in its description, because that description is what arrives in
     * an email at an inconvenient moment.
     */
    observability.watch("IdentityErrors", {
      metric: identityHandler.metricErrors({ period: Duration.minutes(5) }),
      threshold: 0,
      meaning:
        "Sign-in is broken from the app's point of view, which looks to a player like the whole app being down.",
    });
    /**
     * Somebody reported a board.
     *
     * **Threshold 0, so a single report pages.** Every other alarm here is
     * about a rate, because one slow request is not an incident. This one is
     * not a health metric at all: one person saying "there is something
     * offensive on this board" is the whole event, and a threshold that waits
     * for a second one is a threshold that ignores the first.
     */
    observability.watch("ContentReports", {
      metric: reportsMetric.metric({ period: Duration.minutes(5) }),
      threshold: 0,
      meaning:
        "Somebody reported content on a shared board. Read the REPORT# rows on that group in DynamoDB, act on it, and reply — both app stores require reports to be handled, not just collected.",
    });
    observability.watch("ApiServerErrors", {
      metric: serviceMetric({
        namespace: "AWS/ApiGateway",
        metricName: "5xx",
        dimensions: { ApiId: api.apiId },
      }),
      threshold: 0,
      meaning:
        "The API is failing before a handler runs — an authorizer, an integration, or a throttle at the gateway.",
    });
    observability.watch("ApiClientErrors", {
      // Every 4xx, not just 429: HTTP APIs publish no throttle-specific metric.
      // So this catches a retry loop hitting the shared throttle *and* expired
      // tokens *and* a scanner poking the public `execute-api` hostname, and
      // says so rather than claiming to mean one of them.
      metric: serviceMetric({
        namespace: "AWS/ApiGateway",
        metricName: "4xx",
        dimensions: { ApiId: api.apiId },
        statistic: "Sum",
      }),
      threshold: 100,
      evaluationPeriods: 2,
      meaning:
        "Sustained 4xx. Could be a client in a retry loop hitting the shared throttle and 429ing every table, expired tokens after a client change, or somebody scanning the endpoint. The access log says which.",
    });
    /**
     * Summed across operations, with the gaps filled in.
     *
     * CDK's `…ForOperations` helpers build metric math that **drops any
     * timestamp missing from an operand** — and a throttle almost always hits
     * one operation, so the sum has a hole exactly where the number was. `FILL`
     * makes an absent operand a zero, which is what "no throttles on GetItem"
     * actually means.
     */
    const acrossOperations = (metricName: string, label: string) =>
      new MathExpression({
        expression: "FILL(put,0) + FILL(get,0) + FILL(query,0)",
        usingMetrics: {
          put: dynamoMetric(table.tableName, metricName, Operation.PUT_ITEM),
          get: dynamoMetric(table.tableName, metricName, Operation.GET_ITEM),
          query: dynamoMetric(table.tableName, metricName, Operation.QUERY),
        },
        label,
        period: Duration.minutes(5),
      });

    observability.watch("TableThrottled", {
      metric: acrossOperations("ThrottledRequests", "Throttled"),
      threshold: 0,
      meaning:
        "On-demand DynamoDB should not throttle. If it is, something is writing far more than a poker game ever would.",
    });
    observability.watch("TableSystemErrors", {
      metric: acrossOperations("SystemErrors", "System errors"),
      threshold: 0,
      meaning:
        "DynamoDB itself is erroring. Nothing to fix here; worth knowing before a player reports it.",
    });

    /**
     * Two players acting on the same instant, repeatedly.
     *
     * A single failed conditional write is **not** a fault — it is optimistic
     * concurrency doing its job, and the client is told `stale` and decides
     * again. A sustained rate of them is two clients fighting, or a client
     * retrying against a version it will never win against.
     *
     * Hence a threshold well above zero and two periods: the alarm is about a
     * *pattern*, and one at zero would fire on an ordinary busy hand.
     */
    observability.watch("TableContention", {
      metric: dynamoMetric(
        table.tableName,
        "ConditionalCheckFailedRequests",
        Operation.PUT_ITEM,
      ),
      threshold: 20,
      evaluationPeriods: 2,
      meaning:
        "Conditional writes are failing repeatedly. One is normal — the client is told the table moved and decides again — but a sustained rate means two clients are fighting or one is retrying a decision it cannot win.",
    });

    /**
     * Mail reputation — **prod only, and that is not a shortcut.**
     *
     * `Reputation.BounceRate` and `Reputation.ComplaintRate` are account-wide
     * and region-wide: SES publishes one figure for the whole account, not one
     * per stack. Both stages live in the same account, so watching them from
     * each would put two alarms on the same number and send two emails about
     * one problem. Prod is the stack that owns the consequence, so prod is
     * where it is watched.
     *
     * The thresholds are AWS's own review points rather than numbers picked
     * here: sustained bounce above 5% or complaints above 0.1% puts an account
     * under review, and roughly double either gets sending paused. The alarm
     * has to fire while there is still room to act, so it sits at the review
     * line and not at the pause line.
     *
     * **This is what the production-access request said would exist.** That
     * request described relying on the suppression list plus the fact that
     * nothing here can retry to a bad address, and undertook to add these.
     *
     * `Maximum`, not `Sum` — these are rates, and a sum of rates is not a
     * number that means anything. Over an hour, because the figure is a rolling
     * reputation that moves slowly and a five-minute window is noise.
     */
    if (settings.stage === "prod") {
      observability.watch("MailBounceRate", {
        metric: serviceMetric({
          namespace: "AWS/SES",
          metricName: "Reputation.BounceRate",
          dimensions: {},
          statistic: "Maximum",
          period: Duration.hours(1),
        }),
        threshold: 0.05,
        meaning:
          "SES bounce rate is above 5%, which is the point AWS puts an account under review; near 10% it pauses sending. Every message here is a sign-up or password-reset code somebody asked for, so a real bounce rate means addresses are being accepted that should not be — check for sign-up abuse before anything else.",
      });
      observability.watch("MailComplaintRate", {
        metric: serviceMetric({
          namespace: "AWS/SES",
          metricName: "Reputation.ComplaintRate",
          dimensions: {},
          statistic: "Maximum",
          period: Duration.hours(1),
        }),
        threshold: 0.001,
        meaning:
          "SES complaint rate is above 0.1% — AWS's review threshold. People are marking a confirmation code they requested as spam, which usually means somebody is putting other people's addresses into the sign-up form.",
      });
    }

    // Everything watched above, laid out. After the last `watch`, or the
    // dashboard is missing whatever came later.
    observability.summarise();

    new CfnOutput(this, "AlarmTopicArn", {
      value: observability.alarms.topicArn,
    });
    new CfnOutput(this, "DashboardName", {
      value: observability.dashboard.dashboardName,
      description: "CloudWatch > Dashboards",
    });
    // **The name to put in the app**, which is the custom one when there is
    // one. Reading the generated endpoint here would bake the disposable host
    // into a build even after the durable name existed.
    new CfnOutput(this, "ApiUrl", {
      value: domain ? `https://${domain.hostName}` : api.apiEndpoint,
    });
    if (domain) {
      new CfnOutput(this, "ApiEndpointGenerated", {
        value: api.apiEndpoint,
        description:
          "The AWS-generated host. Do not ship this — it changes if the API is recreated.",
      });
    }
    new CfnOutput(this, "Stage", { value: settings.stage });
    if (mail) {
      new CfnOutput(this, "MailFrom", {
        value: mail.email
          ? `noreply@${mail.domain}`
          : `${mail.domain} (identity created; pool still on Cognito's sender — redeploy with -c mailVerified=true once SES has verified it)`,
        description:
          "Sender for confirmation codes. Delivers only to verified addresses until SES production access is granted.",
      });
    }
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new CfnOutput(this, "AuthDomain", {
      value: authDomain.baseUrl(),
      description:
        "Cognito's hosted OAuth endpoint. Federated sign-in goes through it.",
    });
    new CfnOutput(this, "AuthCallbackUrl", {
      /**
       * **The value that gets pasted into Google and Apple**, published so it
       * is read off the stack rather than assembled by hand from a domain and a
       * path somebody half-remembers. A wrong redirect URI fails at the
       * provider with a message that does not name the mismatch.
       */
      value: `${authDomain.baseUrl()}/oauth2/idpresponse`,
      description: "Redirect URI to register with each identity provider.",
    });
    new CfnOutput(this, "TableName", { value: table.tableName });
  }
}
