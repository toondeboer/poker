/**
 * The parts of the backend no screen can reach yet, exercised from a laptop.
 *
 * `GET /me` can be checked with `curl` and a token. The table cannot: **no
 * route creates one**, so `POST /tables/{id}/actions` answers `404 no such
 * table` until a row exists, and the subscribe guard has nothing to guard. That
 * is not an oversight — a table is created by a game starting, and the app side
 * of that is unbuilt — but it does mean the two most interesting pieces of the
 * stack are unreachable without something like this.
 *
 * So this seeds a hand, subscribes the way a phone would, sends one action, and
 * asserts what came back on each channel. What it proves, in one run:
 *
 * 1. Cognito issues tokens for a real account, using the same request shaping
 *    the phone uses.
 * 2. The HTTP API's JWT authorizer accepts them.
 * 3. The action handler reads DynamoDB, runs the `@poker/core` rules, writes
 *    back under a version check, and publishes.
 * 4. **Hole cards go only where they should.** The shared channel carries a
 *    hand with every hole card stripped; the private channel carries exactly
 *    the caller's two.
 * 5. A replayed request is refused as stale rather than folding a hand twice.
 * 6. With `--as-stranger`: a signed-in account that is not at the table cannot
 *    subscribe to it. This is the check worth doing by hand however good the
 *    unit tests look, because it is the one whose failure is silent.
 *
 * ## What it deliberately does not do
 *
 * It never signs up. Both accounts must exist and be confirmed already, which
 * keeps the pool free of accounts nobody meant to create and keeps the emailed
 * confirmation code — the one step a script cannot do honestly — a thing a
 * person did once.
 *
 * It has no unit tests, and should not. Everything it drives is already covered
 * by the suite; its correctness is that it imports `@poker/core` and
 * `tableStore` rather than restating them, so a hand or an item it builds
 * cannot drift from the ones the handler expects.
 *
 * ## Running it
 *
 * ```
 * export SMOKE_EMAIL=you@example.com SMOKE_PASSWORD='…'
 * npm run smoke -w @poker/infra
 *
 * export SMOKE_STRANGER_EMAIL=other@example.com SMOKE_STRANGER_PASSWORD='…'
 * npm run smoke -w @poker/infra -- --as-stranger
 * ```
 */

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  accountFromIdToken,
  legalActions,
  playerChannel,
  signInCall,
  startHand,
  tableChannel,
  tokensFrom,
  type BettingAction,
  type CognitoConfig,
  type CognitoTokens,
  type Hand,
} from "@poker/core";
import { itemFor, tableKey } from "../lib/lambda/tableStore";

/**
 * Node has had a global `WebSocket` since 22, and `@types/node@22` does not
 * declare one — so it is typed here rather than by widening `lib` to `dom`,
 * which would put `document` and `window` in scope for a CDK app.
 */
type SocketEvent = { data?: unknown };
type Socket = {
  send(data: string): void;
  close(): void;
  addEventListener(
    type: "open" | "message" | "error" | "close",
    handler: (event: SocketEvent) => void,
  ): void;
};
type SocketConstructor = new (url: string, protocols?: string[]) => Socket;

// ---------------------------------------------------------------------------
// Arguments and stack outputs
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const has = (flag: string): boolean => args.includes(flag);
const value = (flag: string, fallback: string): string => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const STACK = value("--stack", "PokerBackend-dev");
const REGION = value("--region", "us-east-1");
const KEEP = has("--keep");
const AS_STRANGER = has("--as-stranger");

/**
 * How long to wait for an event that should already be on its way.
 *
 * The publish happens before the HTTP response returns, so an event that has
 * not arrived a few seconds later is not late — it is not coming, and waiting
 * longer only makes the failure slower to find.
 */
const EVENT_TIMEOUT_MS = 8_000;

/**
 * Read the deploy's own outputs rather than asking anybody to retype them.
 *
 * Retyped ids are how a smoke test ends up passing against the wrong stack,
 * which is the one outcome worse than failing.
 */
const stackOutputs = (stackName: string): Record<string, string> => {
  // A refusal rather than a flag, because there is nothing this script does to
  // production that anybody wants: it writes a hand into the table and sends an
  // action as a real account.
  if (stackName.endsWith("-prod")) {
    throw new Error(`refusing to run against ${stackName}`);
  }

  const raw = execFileSync(
    "aws",
    [
      "cloudformation",
      "describe-stacks",
      "--stack-name",
      stackName,
      "--region",
      REGION,
      "--query",
      "Stacks[0].Outputs",
      "--output",
      "json",
    ],
    { encoding: "utf8" },
  );

  const outputs = JSON.parse(raw) as { OutputKey: string; OutputValue: string }[];
  return Object.fromEntries(
    outputs.map((output) => [output.OutputKey, output.OutputValue]),
  );
};

const required = (outputs: Record<string, string>, key: string): string => {
  const found = outputs[key];
  if (!found) throw new Error(`${STACK} has no output named ${key}`);
  return found;
};

const credentials = (
  emailVar: string,
  passwordVar: string,
): { email: string; password: string } => {
  const email = process.env[emailVar];
  const password = process.env[passwordVar];
  if (!email || !password) {
    throw new Error(
      `set ${emailVar} and ${passwordVar} — this script signs in, it never signs up`,
    );
  }
  return { email, password };
};

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const results: { name: string; ok: boolean; detail: string }[] = [];

const check = (name: string, ok: boolean, detail = ""): boolean => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
};

const step = (message: string): void => console.log(`\n· ${message}`);

// ---------------------------------------------------------------------------
// Cognito
// ---------------------------------------------------------------------------

/**
 * Sign in with the app's own request shaping.
 *
 * `signInCall` and `tokensFrom` are the exact functions the phone runs, so a
 * change that breaks sign-in on a device breaks this too — which is the point
 * of using them rather than `aws cognito-idp initiate-auth`.
 */
const signIn = async (
  config: CognitoConfig,
  email: string,
  password: string,
): Promise<{ tokens: CognitoTokens; accountId: string }> => {
  const call = signInCall(config, email, password);
  const response = await fetch(call.url, {
    method: "POST",
    headers: call.headers,
    body: call.body,
  });
  const body: unknown = await response.json();

  const tokens = tokensFrom(body, Date.now());
  if (!tokens) {
    throw new Error(`sign-in failed for ${email}: ${JSON.stringify(body)}`);
  }

  const account = accountFromIdToken(tokens.idToken);
  if (!account) throw new Error("the id token carries no subject");
  return { tokens, accountId: account.id };
};

// ---------------------------------------------------------------------------
// AppSync Events over WebSocket
// ---------------------------------------------------------------------------

/**
 * The HTTP host, derived from the realtime one.
 *
 * The stack outputs `Dns.Realtime` because that is what a client connects to,
 * but **the authorization object names the HTTP host** — AppSync validates the
 * connection against it even though the socket is opened on the other one. The
 * two differ by a single label, so deriving it beats carrying a second output
 * that could get out of step.
 */
const httpHostFrom = (realtimeDns: string): string =>
  realtimeDns.replace("appsync-realtime-api", "appsync-api");

const authProtocol = (authorization: Record<string, string>): string =>
  `header-${Buffer.from(JSON.stringify(authorization))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;

type Arrival = { channel: string; event: unknown };

type Connection = {
  subscribe(channel: string): Promise<{ ok: boolean; error?: string }>;
  arrivals: Arrival[];
  close(): void;
};

/**
 * Connect and stay connected, collecting whatever arrives.
 *
 * Subscriptions are correlated by the id sent with each `subscribe`, which is
 * also how the arrivals are attributed back to a channel: the `data` message
 * names the subscription, not the path.
 */
const connect = async (
  realtimeDns: string,
  idToken: string,
): Promise<Connection> => {
  const Constructor = (globalThis as { WebSocket?: SocketConstructor })
    .WebSocket;
  if (!Constructor) {
    throw new Error(`this Node (${process.version}) has no global WebSocket`);
  }

  const host = httpHostFrom(realtimeDns);
  // The ID token, not the access token: the pool is the connection's auth mode
  // and the guard reads `identity.sub`, which both carry — but `/me` refuses an
  // access token, and sending two different tokens from one script is how a
  // failure gets blamed on the wrong half.
  const authorization = { host, Authorization: idToken };

  const socket = new Constructor(`wss://${realtimeDns}/event/realtime`, [
    "aws-appsync-event-ws",
    authProtocol(authorization),
  ]);

  const arrivals: Arrival[] = [];
  const channels = new Map<string, string>();
  const pending = new Map<
    string,
    (result: { ok: boolean; error?: string }) => void
  >();
  let acknowledged: (() => void) | null = null;
  let failed: ((error: Error) => void) | null = null;

  socket.addEventListener("error", () => {
    // The event carries nothing useful — a browser-shaped `error` event has no
    // reason on it — so the honest message is that the handshake did not
    // complete, which is nearly always the subprotocol or an expired token.
    failed?.(new Error("the WebSocket refused to connect"));
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as {
      type?: string;
      id?: string;
      event?: unknown;
      errors?: unknown;
    };

    switch (message.type) {
      case "connection_ack":
        acknowledged?.();
        return;
      case "subscribe_success":
        pending.get(message.id ?? "")?.({ ok: true });
        return;
      case "subscribe_error":
        pending.get(message.id ?? "")?.({
          ok: false,
          error: JSON.stringify(message.errors),
        });
        return;
      case "data": {
        const channel = channels.get(message.id ?? "") ?? "unknown";
        // The documented shape is an array of stringified JSON, and a bare
        // string has been observed too. Both are handled because guessing wrong
        // would look exactly like an event that never arrived.
        const payloads = Array.isArray(message.event)
          ? (message.event as unknown[])
          : [message.event];
        for (const payload of payloads) {
          arrivals.push({
            channel,
            event: typeof payload === "string" ? JSON.parse(payload) : payload,
          });
        }
        return;
      }
      default:
        // `ka` and anything else added later. Nothing to do: the connection is
        // short-lived enough that the keep-alive timeout cannot be reached.
        return;
    }
  });

  await new Promise<void>((resolve, reject) => {
    acknowledged = resolve;
    failed = reject;
    socket.addEventListener("open", () =>
      socket.send(JSON.stringify({ type: "connection_init" })),
    );
    setTimeout(() => reject(new Error("no connection_ack")), EVENT_TIMEOUT_MS);
  });

  return {
    arrivals,
    close: () => socket.close(),
    subscribe: (channel) =>
      new Promise((resolve) => {
        const id = randomBytes(8).toString("hex");
        channels.set(id, channel);
        pending.set(id, resolve);
        socket.send(
          JSON.stringify({ type: "subscribe", id, channel, authorization }),
        );
        setTimeout(
          () => resolve({ ok: false, error: "no answer to subscribe" }),
          EVENT_TIMEOUT_MS,
        );
      }),
  };
};

/** Wait for an arrival matching, or give up. */
const waitFor = async (
  connection: Connection,
  matches: (arrival: Arrival) => boolean,
): Promise<Arrival | null> => {
  const deadline = Date.now() + EVENT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const found = connection.arrivals.find(matches);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
};

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/**
 * The shared-board routes, and the one property the phone depends on most.
 *
 * **A queued write is replayed whenever its answer went missing**, which on a
 * phone is often — the request reached the server, the response did not, and
 * the outbox has no way to tell that apart from never having been sent. So
 * every write here is sent twice and expected to succeed twice. A route that
 * answers "already exists" to the second one is a route that turns a lost
 * response into a permanent refusal, cascading to everything queued behind it.
 *
 * This is worth doing against the real thing rather than trusting the suite: a
 * transaction earlier in this cycle passed a unit test that asserted the wrong
 * condition, and only failed when a real member claimed a real seat.
 */
const checkGroups = async (
  apiUrl: string,
  me: { accountId: string; tokens: { idToken: string } },
  tableName: string,
  region: string,
): Promise<void> => {
  const groupId = `smoke-${randomBytes(6).toString("hex")}`;
  const send = (path: string, body: unknown) =>
    fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: me.tokens.idToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  step(`creating board ${groupId}`);
  const created = await send("/groups", {
    groupId,
    name: "Smoke Thursday",
    createdAt: Date.now(),
  });
  check("a board can be created", created.status === 201, `${created.status}`);

  const again = await send("/groups", {
    groupId,
    name: "Smoke Thursday",
    createdAt: Date.now(),
  });
  check(
    "creating the same board again is not a conflict",
    again.status === 201 || again.status === 200,
    `${again.status} — a 409 here is a permanent refusal on the phone`,
  );

  const player = { id: `p-${randomBytes(4).toString("hex")}`, name: "Ann" };
  const added = await send(`/groups/${groupId}/players`, { player });
  check("a player can be added", added.ok, `${added.status}`);
  const addedAgain = await send(`/groups/${groupId}/players`, { player });
  check("adding the same player again is not a conflict", addedAgain.ok, `${addedAgain.status}`);

  const result = {
    id: `r-${randomBytes(4).toString("hex")}`,
    playedAt: Date.now(),
    playerIds: [player.id],
    placings: [{ playerId: player.id, place: 1, winnings: 20 }],
    buyIn: 10,
    bounty: 0,
  };
  const recorded = await send(`/groups/${groupId}/games`, { result });
  check("a game can be recorded", recorded.ok, `${recorded.status}`);
  const recordedAgain = await send(`/groups/${groupId}/games`, { result });
  check(
    "recording the same game again is not a conflict",
    recordedAgain.ok,
    `${recordedAgain.status}`,
  );

  const board = await fetch(`${apiUrl}/groups/${groupId}`, {
    headers: { Authorization: me.tokens.idToken },
  });
  const drawn = (await board.json()) as {
    players?: unknown[];
    results?: unknown[];
  };
  // The point of replaying: twice sent, once stored. A duplicate here would
  // double-count somebody's night on the leaderboard.
  check(
    "the board holds one of each, not two",
    drawn.players?.length === 1 && drawn.results?.length === 1,
    `${drawn.players?.length} players, ${drawn.results?.length} games`,
  );

  if (KEEP) {
    console.log(`  keeping board ${groupId}`);
    return;
  }
  // No route deletes a board — deliberately, an emptied group survives its
  // members — so the rows go directly, the same way the table's do.
  step(`removing board ${groupId}`);
  const documents = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const rows = await documents.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `GROUP#${groupId}` },
    }),
  );
  for (const row of rows.Items ?? []) {
    await documents.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { pk: row.pk as string, sk: row.sk as string },
      }),
    );
  }
  await documents.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { pk: `ACCOUNT#${me.accountId}`, sk: `GROUP#${groupId}` },
    }),
  );
};

const main = async (): Promise<void> => {
  step(`reading the outputs of ${STACK}`);
  const outputs = stackOutputs(STACK);
  const apiUrl = required(outputs, "ApiUrl").replace(/\/$/, "");
  const realtimeDns = required(outputs, "EventApiDns");
  const tableName = required(outputs, "TableName");
  const config: CognitoConfig = {
    region: REGION,
    userPoolId: required(outputs, "UserPoolId"),
    clientId: required(outputs, "UserPoolClientId"),
  };
  console.log(`  api    ${apiUrl}`);
  console.log(`  events ${realtimeDns}`);
  console.log(`  table  ${tableName}`);

  const primary = credentials("SMOKE_EMAIL", "SMOKE_PASSWORD");

  step(`signing in as ${primary.email}`);
  const me = await signIn(config, primary.email, primary.password);
  check("cognito issued tokens", true, `sub ${me.accountId}`);

  step("GET /me with the id token");
  const identity = await fetch(`${apiUrl}/me`, {
    headers: { Authorization: me.tokens.idToken },
  });
  const identityBody = (await identity.json()) as { accountId?: string };
  check(
    "/me answers 200 with this account",
    identity.status === 200 && identityBody.accountId === me.accountId,
    `${identity.status} ${JSON.stringify(identityBody)}`,
  );

  const withAccessToken = await fetch(`${apiUrl}/me`, {
    headers: { Authorization: me.tokens.accessToken },
  });
  check(
    "/me refuses an access token",
    withAccessToken.status === 400,
    `${withAccessToken.status}`,
  );

  const unauthenticated = await fetch(`${apiUrl}/me`);
  check(
    "/me refuses a request with no token",
    unauthenticated.status === 401,
    `${unauthenticated.status}`,
  );

  /**
   * Alphanumeric and dashes only, and short.
   *
   * AppSync limits a channel segment to 50 characters of `[A-Za-z0-9-]`, so an
   * id with anything else in it fails at subscribe time with an error about the
   * channel rather than about the id — which is a long way from the cause.
   */
  const tableId = `smoke-${randomBytes(6).toString("hex")}`;
  const opponent = "smokebot";

  await checkGroups(apiUrl, me, tableName, REGION);

  step(`seeding table ${tableId}`);
  const hand: Hand = startHand({
    seats: [
      { playerId: me.accountId, stack: 1000 },
      { playerId: opponent, stack: 1000 },
    ],
    // Heads-up, the button posts the small blind and acts first before the
    // flop — so seat 0 being us is what makes the action below ours to send.
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    random: Math.random,
  });

  const toAct = legalActions(hand);
  if (!check(
    "the seeded hand is ours to act on",
    toAct?.playerId === me.accountId,
    `${toAct?.playerId}`,
  )) {
    throw new Error("the seed is wrong; nothing below would mean anything");
  }

  const documents = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: REGION }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  // `itemFor` rather than a hand-rolled item: a shape that drifts from the
  // handler's own would fail in a way that reads like a handler bug.
  await documents.send(
    new PutCommand({
      TableName: tableName,
      Item: itemFor(
        tableId,
        { hand, version: 0, members: [me.accountId] },
        Date.now(),
      ),
    }),
  );
  check("the table is in DynamoDB", true, `version 0, members [${me.accountId}]`);

  try {
    step("subscribing the way a phone would");
    const connection = await connect(realtimeDns, me.tokens.idToken);
    try {
      const shared = await connection.subscribe(tableChannel(tableId));
      check("subscribed to the shared table channel", shared.ok, shared.error ?? "");

      const mine = await connection.subscribe(
        playerChannel(me.accountId, tableId),
      );
      check("subscribed to our own private channel", mine.ok, mine.error ?? "");

      const someoneElses = await connection.subscribe(
        playerChannel(opponent, tableId),
      );
      check(
        "refused somebody else's private channel",
        !someoneElses.ok,
        someoneElses.error ?? "it was allowed",
      );

      step("sending one action");
      const action: BettingAction = { type: "call" };
      const body = JSON.stringify({
        tableId,
        playerId: me.accountId,
        action,
        expectedVersion: 0,
      });
      const send = () =>
        fetch(`${apiUrl}/tables/${tableId}/actions`, {
          method: "POST",
          headers: {
            Authorization: me.tokens.idToken,
            "content-type": "application/json",
          },
          body,
        });

      const applied = await send();
      const appliedBody = (await applied.json()) as {
        status?: string;
        version?: number;
        published?: boolean;
      };
      check(
        "the action was applied and published",
        applied.status === 202 &&
          appliedBody.status === "applied" &&
          appliedBody.version === 1 &&
          appliedBody.published === true,
        `${applied.status} ${JSON.stringify(appliedBody)}`,
      );

      step("waiting for the events");
      const publicEvent = await waitFor(
        connection,
        (arrival) =>
          arrival.channel === tableChannel(tableId) &&
          (arrival.event as { type?: string }).type === "table",
      );
      const publicHand = (publicEvent?.event as { hand?: Hand } | undefined)
        ?.hand;
      check(
        "the shared channel carried the hand",
        publicHand !== undefined,
        publicEvent ? "" : "nothing arrived",
      );
      check(
        "no hole cards on the shared channel",
        publicHand !== undefined &&
          publicHand.seats.every((seat) => seat.hole.length === 0),
        JSON.stringify(publicHand?.seats.map((seat) => seat.hole)),
      );
      check(
        "no deck on the shared channel",
        publicHand?.deck.length === 0,
        `${publicHand?.deck.length} cards`,
      );

      const privateEvent = await waitFor(
        connection,
        (arrival) =>
          arrival.channel === playerChannel(me.accountId, tableId) &&
          (arrival.event as { type?: string }).type === "cards",
      );
      const hole = (privateEvent?.event as { hole?: unknown[] } | undefined)
        ?.hole;
      check(
        "our own two cards arrived on our own channel",
        hole?.length === 2,
        privateEvent ? JSON.stringify(hole) : "nothing arrived",
      );

      step("replaying the same request");
      const replay = await send();
      const replayBody = (await replay.json()) as { status?: string };
      check(
        "a replay is refused as stale, not applied twice",
        replay.status === 409 && replayBody.status === "stale",
        `${replay.status} ${JSON.stringify(replayBody)}`,
      );

      step("acting for somebody else");
      const impersonation = await fetch(
        `${apiUrl}/tables/${tableId}/actions`,
        {
          method: "POST",
          headers: {
            Authorization: me.tokens.idToken,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            tableId,
            playerId: opponent,
            action,
            expectedVersion: 1,
          }),
        },
      );
      check(
        "acting as another player is refused",
        impersonation.status === 403,
        `${impersonation.status}`,
      );
    } finally {
      connection.close();
    }

    if (AS_STRANGER) {
      const other = credentials(
        "SMOKE_STRANGER_EMAIL",
        "SMOKE_STRANGER_PASSWORD",
      );
      step(`subscribing as ${other.email}, who is not at this table`);
      const stranger = await signIn(config, other.email, other.password);
      check(
        "the stranger is a different account",
        stranger.accountId !== me.accountId,
        `sub ${stranger.accountId}`,
      );

      const strangerConnection = await connect(
        realtimeDns,
        stranger.tokens.idToken,
      );
      try {
        // Connecting proves the point about the namespace: being signed in is
        // enough to reach the socket, and the guard is the only thing between a
        // signed-in stranger and somebody else's game.
        const watched = await strangerConnection.subscribe(tableChannel(tableId));
        check(
          "a non-member cannot subscribe to the table",
          !watched.ok,
          watched.error ?? "IT WAS ALLOWED",
        );

        const peeked = await strangerConnection.subscribe(
          playerChannel(me.accountId, tableId),
        );
        check(
          "a non-member cannot subscribe to our private channel",
          !peeked.ok,
          peeked.error ?? "IT WAS ALLOWED",
        );
      } finally {
        strangerConnection.close();
      }
    }
  } finally {
    if (KEEP) {
      console.log(`\n· keeping ${tableId} — delete it yourself when done`);
    } else {
      step(`removing ${tableId}`);
      await documents.send(
        new DeleteCommand({ TableName: tableName, Key: tableKey(tableId) }),
      );
    }
  }
};

main()
  .then(() => {
    const failures = results.filter((result) => !result.ok);
    console.log(
      `\n${results.length - failures.length}/${results.length} checks passed`,
    );
    // Exit code, not just words: this is the kind of script somebody eventually
    // runs from CI, and one that always exits 0 teaches nobody anything.
    process.exit(failures.length === 0 ? 0 : 1);
  })
  .catch((error: unknown) => {
    console.error(`\nstopped: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
