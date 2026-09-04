/**
 * The backend for accounts, groups and the multiplayer game.
 *
 * Everything the app cannot do on a phone: who you are, which groups you
 * belong to, and one authoritative copy of a poker table that several people
 * are looking at from different rooms.
 *
 * **Nothing in here decides anything about poker.** The rules live in
 * `@poker/core` and run in a Lambda, which is the point: the phone and the
 * server run the same function, so optimistic prediction on the client is
 * provably the same code as the authority on the server.
 *
 * ## Both channels are guarded, and differently on purpose
 *
 * A **private** channel is guarded by an APPSYNC_JS handler comparing a path
 * segment to the caller's own subject: no I/O, nothing to fail, nothing to be
 * down. A **shared table** cannot be guarded that way, because membership is a
 * fact about the game rather than about the path — so it is a Lambda that
 * reads the table and refuses anybody not at it.
 *
 * Until that Lambda existed, this namespace was authenticated but not
 * authorized: a subscriber had to be signed in, sign-up is open, and so an
 * account holding a table id could stream a stranger's game.
 */

import {
  CfnOutput,
  Duration,
  Fn,
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
  CfnApi,
  CfnChannelNamespace,
  CfnDataSource,
} from "aws-cdk-lib/aws-appsync";
import {
  AccountRecovery,
  UserPool,
  UserPoolClient,
  UserPoolEmail,
} from "aws-cdk-lib/aws-cognito";
import {
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import {
  HttpNoneAuthorizer, HttpApi, HttpMethod, type CfnStage } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { PLAYER_NAMESPACE, TABLE_NAMESPACE } from "@poker/core";
import { settingsFor, type StageSettings } from "./stage";
import { domainFor } from "./apiDomain";
import { mailFor } from "./mailIdentity";
import { Observability, serviceMetric } from "./observability";
import { MathExpression } from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";
import * as path from "node:path";

/**
 * Rejects a subscription to somebody else's cards.
 *
 * Hole cards are never broadcast. Each player subscribes to the table's shared
 * channel *and* to `/player/{their own sub}/table/{tableId}`, and the private
 * cards are published only to the second. Secrecy is then a property of where
 * a thing is published rather than of client-side filtering — there is no code
 * on a phone deciding what not to show you, which is the code that eventually
 * shows you the wrong thing.
 *
 * **The path shape is load-bearing.** AppSync takes the *first* segment as the
 * namespace, and a namespace is the only place a subscribe guard can be
 * attached — so the player id has to lead. An earlier version of this used
 * `/table/{id}/player/{sub}`, which reads better and is unguardable: its
 * namespace is `table`, so it landed under the shared rules and this handler
 * never ran at all. Any signed-in account could read anyone's cards. The path
 * is now built by `playerChannel` in `@poker/core`, shared with the app, so the
 * two sides cannot disagree about it again.
 *
 * Written as an AppSync JS handler rather than a Lambda authorizer because it
 * is one comparison, on the subscribe path of every player, every hand.
 */
const PRIVATE_CHANNEL_HANDLER = `
import { util } from '@aws-appsync/utils';

export function onSubscribe(ctx) {
  // /player/{playerId}/table/{tableId}
  const segments = ctx.info.channel.path.split('/');
  if (segments.length !== 5 || segments[3] !== 'table') {
    util.unauthorized();
  }
  const owner = segments[2];
  if (!owner || owner !== ctx.identity.sub) {
    util.unauthorized();
  }
}

export function onPublish(ctx) {
  // Namespace handlers run for every publish whatever the auth mode, so this
  // has to pass the events through — rejecting here would block the server's
  // own IAM publish, which is the only publish there is.
  return ctx.events;
}
`;

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
     * What a budget would need to filter on. The `poker-dev`
     * budget currently forecasts the *whole account*, because `CfnBudget` has no
     * cost filter and this account runs other projects; filtering it means
     * activating `project` as a cost allocation tag in Billing and waiting for
     * AWS to backfill it.
     */
    Tags.of(this).add("project", "poker");
    Tags.of(this).add("stage", settings.stage);

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
     * `Tracing.ACTIVE` costs single-digit milliseconds because the X-Ray daemon
     * is part of the execution environment rather than a Go binary this
     * function has to start. What it gives up is vendor neutrality — and that
     * was always the weakest argument here, in a backend welded to Cognito,
     * AppSync Events, DynamoDB and CDK. The telemetry was the one portable
     * piece of something entirely AWS-specific.
     *
     * The infrastructure half needs no export at all: API Gateway 5xx, DynamoDB
     * throttles and AppSync connection errors are already CloudWatch metrics,
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
     * Email sign-in to start with. **Apple and Google are deliberately absent:**
     * both need real client ids and secrets, and App Store guideline 4.8
     * requires Sign in with Apple alongside any other third-party sign-in — so
     * they are a deliberate, credential-bearing addition rather than something
     * to scaffold with placeholders that would silently ship broken.
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
      // No `oAuth` block: the app signs in through SRP, not a hosted UI. CDK
      // fills an omitted `callbackUrls` with `https://example.com`, which is
      // inert without a hosted-UI domain and a perfectly valid redirect target
      // the moment one exists.
      // Long enough that a monthly player is not signed out between game
      // nights; the access token stays short.
      refreshTokenValidity: Duration.days(90),
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      preventUserExistenceErrors: true,
    });

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
      // Live table state is worth keeping only while a hand is being played,
      // and a tombstone only until every phone that might resurrect the thing
      // it deleted has seen it — see SYNC.md.
      timeToLiveAttribute: "expiresAt",
    });

    /**
     * The realtime bus.
     *
     * Events rather than GraphQL: this is publish/subscribe, and a schema would
     * be a layer describing messages that already have a shape in `@poker/core`.
     *
     * Clients connect and subscribe with their Cognito token. **Publishing is
     * IAM-only**, so nothing reaches a table except through the action handler
     * — which is what makes the server authoritative rather than merely
     * well-behaved.
     */
    const eventApi = new CfnApi(this, "EventApi", {
      name: `${this.stackName}-events`,
      eventConfig: {
        authProviders: [
          {
            authType: "AMAZON_COGNITO_USER_POOLS",
            cognitoConfig: {
              userPoolId: userPool.userPoolId,
              awsRegion: this.region,
            },
          },
          { authType: "AWS_IAM" },
        ],
        connectionAuthModes: [{ authType: "AMAZON_COGNITO_USER_POOLS" }],
        defaultSubscribeAuthModes: [{ authType: "AMAZON_COGNITO_USER_POOLS" }],
        defaultPublishAuthModes: [{ authType: "AWS_IAM" }],
      },
    });

    /**
     * Who may watch a table, checked on subscribe.
     *
     * A Lambda rather than an APPSYNC_JS handler because **membership is a
     * fact about the game, not about the path**: the private `/player/…`
     * channels can be guarded by comparing a path segment to the caller's own
     * subject, and a shared table needs a lookup that an APPSYNC_JS handler
     * cannot do.
     *
     * `REQUEST_RESPONSE`, not `EVENT`: an asynchronous invocation cannot
     * refuse anything — AppSync does not wait for it — so an authorizer in
     * event mode is a log line, not a guard.
     */
    const subscribeAuthorizer = new NodejsFunction(this, "SubscribeAuthorizer", {
      entry: path.join(__dirname, "lambda", "subscribeAuthorizer.ts"),
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      // Short on purpose: this runs before somebody sees a table, so its
      // latency is felt. A read that has not answered in three seconds is not
      // going to.
      timeout: Duration.seconds(3),
      environment: { ...functionEnvironment, TABLE_NAME: table.tableName },
      tracing: Tracing.ACTIVE,
      logGroup: new LogGroup(this, "SubscribeAuthorizerLogs", {
        retention: settings.logRetention,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      bundling: handlerBundling,
    });
    // Read only. An authorizer has no business writing to the thing it is
    // deciding about.
    table.grantReadData(subscribeAuthorizer);

    const authorizerRole = new Role(this, "SubscribeAuthorizerRole", {
      assumedBy: new ServicePrincipal("appsync.amazonaws.com"),
      description: "Lets AppSync invoke the subscribe authorizer",
    });
    subscribeAuthorizer.grantInvoke(authorizerRole);

    const authorizerSource = new CfnDataSource(this, "SubscribeAuthorizerDs", {
      apiId: eventApi.attrApiId,
      name: "SubscribeAuthorizer",
      type: "AWS_LAMBDA",
      lambdaConfig: { lambdaFunctionArn: subscribeAuthorizer.functionArn },
      serviceRoleArn: authorizerRole.roleArn,
    });

    // What everyone at a table sees: the board, the bets, whose turn it is —
    // and now only if they are at it.
    const tableNamespace = new CfnChannelNamespace(this, "TableNamespace", {
      apiId: eventApi.attrApiId,
      name: TABLE_NAMESPACE,
      handlerConfigs: {
        onSubscribe: {
          behavior: "DIRECT",
          integration: {
            dataSourceName: authorizerSource.name,
            lambdaConfig: { invokeType: "REQUEST_RESPONSE" },
          },
        },
      },
    });

    /**
     * Build the data source first. **CloudFormation cannot work this out.**
     *
     * `dataSourceName` above is a plain string — `"SubscribeAuthorizer"`, not a
     * `Ref` or a `GetAtt` — because that is the shape AppSync's API takes. A
     * string carries no dependency, so CloudFormation is free to create the
     * namespace and the data source in parallel, and on a first deploy it does:
     * the namespace goes first and fails with `DataSource not found`, rolling
     * the whole stack back.
     *
     * It is invisible in `cdk synth` and invisible on every *subsequent* deploy,
     * because by then the data source already exists. Only a create from
     * nothing shows it, which is exactly what a first deploy is — and was.
     */
    tableNamespace.addResourceDependency(authorizerSource);

    // What only one player sees. The handler is the entire secrecy mechanism.
    new CfnChannelNamespace(this, "PlayerNamespace", {
      apiId: eventApi.attrApiId,
      name: PLAYER_NAMESPACE,
      codeHandlers: PRIVATE_CHANNEL_HANDLER,
    });

    /**
     * The only thing allowed to change a table.
     *
     * Reads the hand, runs the `@poker/core` reducer, and writes back on a
     * version check. Two players acting at the same instant means one write
     * wins and the other retries against fresh state — optimistic concurrency
     * *is* the serialization here, so there is no lock to hold and nothing to
     * time out.
     */
    const actionHandler = new NodejsFunction(this, "TableAction", {
      entry: path.join(__dirname, "lambda", "tableAction.ts"),
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        ...functionEnvironment,
        TABLE_NAME: table.tableName,
        EVENT_API_HTTP: Fn.getAtt(eventApi.logicalId, "Dns.Http").toString(),
      },
      tracing: Tracing.ACTIVE,
      // An explicit log group rather than `logRetention`, which is deprecated
      // and, more to the point, deploys a second Lambda whose only job is to
      // call PutRetentionPolicy on the first one's log group.
      logGroup: new LogGroup(this, "TableActionLogs", {
        retention: settings.logRetention,
        // Logs are always disposable, in both stages: what they are worth is
        // debugging the thing that just happened, and the retention above is
        // what decides how long that lasts.
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      // `@poker/core` is a private workspace package, so it is bundled rather
      // than installed. esbuild follows the workspace link and inlines it,
      // which is why the same rules can run here and on the phone.
      bundling: handlerBundling,
    });

    table.grantReadWriteData(actionHandler);
    actionHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ["appsync:EventPublish"],
        resources: [`${eventApi.attrApiArn}/*`],
      }),
    );

    /**
     * How the app asks for something to happen.
     *
     * **Nothing could invoke the action handler at all before this** — no API,
     * no function URL, no mutation. The rules ran on a phone and on a Lambda
     * nobody could reach.
     *
     * The shape is deliberate, and it is the part worth understanding: **a
     * client never learns the result of its action from this response.** The
     * response says accepted or rejected; the *truth* arrives on the AppSync
     * channel, the same way it reaches everybody else at the table. One code
     * path for state instead of two that can disagree — and it is what makes
     * optimistic prediction on the phone safe, because the phone runs the same
     * `@poker/core` locally and the authoritative event either confirms what it
     * predicted or replaces it.
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
        FEATURE_ACCOUNTS: (this.node.tryGetContext("featureAccounts") as string) ?? "on",
        FEATURE_SHARING: (this.node.tryGetContext("featureSharing") as string) ?? "on",
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
     * The shared leaderboard.
     *
     * One function behind every group route, because they share the thing that
     * matters — each authorizes before it acts, and one entry point is how that
     * stays true of a route somebody adds later. Its own function rather than a
     * branch inside the action handler: a leaderboard write must not be able to
     * fail because a poker hand was slow.
     */
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
      logGroup: new LogGroup(this, "GroupsLogs", {
        retention: settings.logRetention,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
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
      ["/groups/{groupId}/members/{accountId}", [HttpMethod.PUT, HttpMethod.DELETE]],
      ["/invites/{token}", [HttpMethod.POST]],
      // The account's own deletion. `GET /me` stays on the identity handler —
      // one says who you are, the other unpicks everything you touched.
      ["/me", [HttpMethod.DELETE]],
    ] as [string, HttpMethod[]][]) {
      api.addRoutes({ path: path_, methods, integration: groupsRoute });
    }

    api.addRoutes({
      path: "/tables/{tableId}/actions",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("ActionRoute", actionHandler),
    });

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
     * one account hammering `/tables/{id}/actions` returns 429 to every player
     * at every table, so it protects the bill and not availability. HTTP APIs
     * have no per-caller quota — usage plans are a REST API feature — so the
     * fix when it is needed is a WAF rate rule keyed on IP or on the caller,
     * which costs about $5 a month for a web ACL. Not worth it before anybody
     * has connected; worth knowing before somebody wonders why one bad client
     * took the table down.
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
     * The seven things worth being woken up for.
     *
     * Deliberately few. An alarm nobody acts on trains everybody to ignore the
     * next one, so each of these has an answer to "and then what?" — and each
     * says so in its description, because that description is what arrives in
     * an email at an inconvenient moment.
     */
    observability.watch("ActionErrors", {
      metric: actionHandler.metricErrors({ period: Duration.minutes(5) }),
      threshold: 0,
      // Until storage is wired this handler throws on every invocation, so any
      // call at all alarms. That is correct rather than noisy: nothing should
      // be calling it, and if something is, somebody should hear about it.
      meaning:
        "The action handler is throwing. Either the rules are rejecting real actions, or something broke: check the logs for the account and table in the line.",
    });
    observability.watch("ActionSlow", {
      metric: actionHandler.metricDuration({
        period: Duration.minutes(5),
        statistic: "p99",
      }),
      threshold: 2_000,
      evaluationPeriods: 2,
      meaning:
        "A table is waiting on a turn that will not land. Usually DynamoDB contention, or a cold start on a function nobody has invoked all week.",
    });
    observability.watch("IdentityErrors", {
      metric: identityHandler.metricErrors({ period: Duration.minutes(5) }),
      threshold: 0,
      meaning:
        "Sign-in is broken from the app's point of view, which looks to a player like the whole app being down.",
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
     * The failure nobody reports.
     *
     * **This is the one thing a Lambda cannot see about itself.** A player whose
     * subscription drops mid-hand does not get an error; the table simply stops
     * updating on their phone, and they put it down to the wifi. Nothing in the
     * handler logs, and no request fails — the connection is what broke, and it
     * broke in AppSync rather than in any code here.
     *
     * Server errors only. `ConnectClientError` and `SubscribeClientError` are
     * the guard doing its job — a refused subscribe is a *success* for the
     * thing that refuses non-members — so alarming on them would page somebody
     * every time the security boundary worked.
     */
    observability.watch("RealtimeConnectFailures", {
      metric: serviceMetric({
        namespace: "AWS/AppSync",
        metricName: "ConnectServerError",
        dimensions: { EventAPIId: eventApi.attrApiId },
      }),
      threshold: 0,
      meaning:
        "Players cannot connect to the realtime API. Nobody will report this — a table that stops updating looks like a bad connection from the phone.",
    });
    observability.watch("RealtimeSubscribeFailures", {
      metric: serviceMetric({
        namespace: "AWS/AppSync",
        metricName: "SubscribeServerError",
        dimensions: { EventAPIId: eventApi.attrApiId },
      }),
      threshold: 0,
      meaning:
        "Subscriptions to a table are failing server-side — which is the subscribe authorizer erroring, not refusing. A refusal is a client error and is the guard working.",
    });

    // Everything watched above, laid out. After the last `watch`, or the
    // dashboard is missing whatever came later.
    observability.summarise();

    new CfnOutput(this, "AlarmTopicArn", { value: observability.alarms.topicArn });
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
    new CfnOutput(this, "TableName", { value: table.tableName });
    new CfnOutput(this, "EventApiDns", {
      value: Fn.getAtt(eventApi.logicalId, "Dns.Realtime").toString(),
    });
  }
}
