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
  OAuthScope,
  UserPool,
  UserPoolClient,
  UserPoolEmail,
} from "aws-cdk-lib/aws-cognito";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "node:path";

/**
 * Rejects a subscription to somebody else's private channel.
 *
 * Hole cards are never broadcast. Each player subscribes to the table's shared
 * channel *and* to `/table/{tableId}/player/{their own sub}`, and the private
 * cards are published only to the second. That means secrecy is a property of
 * the channel topology rather than of client-side filtering — there is no code
 * on a phone deciding what not to show you, which is the kind of code that
 * eventually shows you the wrong thing.
 *
 * Written as an AppSync JS handler rather than a Lambda authorizer because it
 * is one comparison and runs on the subscribe path of every player, every hand.
 */
const PRIVATE_CHANNEL_HANDLER = `
import { util } from '@aws-appsync/utils';

export function onSubscribe(ctx) {
  const segments = ctx.info.channel.path.split('/');
  // /table/{tableId}/player/{userId}
  const owner = segments[4];
  if (!owner) {
    util.unauthorized();
  }
  if (owner !== ctx.identity.sub) {
    util.unauthorized();
  }
}

export function onPublish(ctx) {
  // Only the server publishes here; clients reach the table through the action
  // handler so that every change goes through the rules once.
  util.unauthorized();
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
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.PROFILE],
      },
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
    new CfnChannelNamespace(this, "TableNamespace", {
      apiId: eventApi.attrApiId,
      name: "table",
    });

    // What only one player sees. The handler is the entire secrecy mechanism.
    new CfnChannelNamespace(this, "PlayerNamespace", {
      apiId: eventApi.attrApiId,
      name: "player",
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
