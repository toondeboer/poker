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
 * ## Known gap, before anything connects to this
 *
 * The shared `table` namespace is **authenticated but not authorized**: a
 * subscriber must be signed in, but nothing ties them to the table they are
 * subscribing to, so any account holding a table id could stream a stranger's
 * game. It is not exploitable today — nothing publishes and no app code
 * connects — but it must be closed before either changes.
 *
 * The fix is a Lambda authorizer on subscribe: membership lives in DynamoDB, so
 * it needs a read, which an AppSync JS handler cannot do. Deliberately not
 * written blind here, since it cannot be exercised without a deployment.
 * Tracked in ROADMAP.md.
 */

import {
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import { AttributeType, Billing, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { CfnApi, CfnChannelNamespace } from "aws-cdk-lib/aws-appsync";
import {
  AccountRecovery,
  UserPool,
  UserPoolClient,
  UserPoolEmail,
} from "aws-cdk-lib/aws-cognito";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { PLAYER_NAMESPACE, TABLE_NAMESPACE } from "@poker/core";
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

export class PokerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /**
     * Who you are.
     *
     * Email sign-in to start with. **Apple and Google are deliberately absent:**
     * both need real client ids and secrets, and App Store guideline 4.8
     * requires Sign in with Apple alongside any other third-party sign-in — so
     * they are a deliberate, credential-bearing addition rather than something
     * to scaffold with placeholders that would silently ship broken.
     */
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
      email: UserPoolEmail.withCognito(),
      // Losing the user pool loses every account and every link between an
      // account and a player. Nothing about a stack update should be able to
      // do that by accident.
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const userPoolClient = new UserPoolClient(this, "MobileClient", {
      userPool,
      // A phone cannot keep a secret, so it does not get one.
      generateSecret: false,
      authFlows: { userSrp: true },
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
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
      // Live table state is worth keeping only while a hand is being played.
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

    // What everyone at a table sees: the board, the bets, whose turn it is.
    //
    // **This namespace is authenticated but not yet authorized** — see the
    // note at the top of this file. Nothing connects to it yet, and nothing
    // should until a membership check exists.
    new CfnChannelNamespace(this, "TableNamespace", {
      apiId: eventApi.attrApiId,
      name: TABLE_NAMESPACE,
    });

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
        TABLE_NAME: table.tableName,
        EVENT_API_HTTP: Fn.getAtt(eventApi.logicalId, "Dns.Http").toString(),
      },
      // An explicit log group rather than `logRetention`, which is deprecated
      // and, more to the point, deploys a second Lambda whose only job is to
      // call PutRetentionPolicy on the first one's log group.
      logGroup: new LogGroup(this, "TableActionLogs", {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      bundling: {
        // `@poker/core` is a private workspace package, so it is bundled rather
        // than installed. esbuild follows the workspace link and inlines it,
        // which is why the same rules can run here and on the phone.
        minify: true,
        sourceMap: true,
        target: "node22",
      },
    });

    table.grantReadWriteData(actionHandler);
    actionHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ["appsync:EventPublish"],
        resources: [`${eventApi.attrApiArn}/*`],
      }),
    );

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
