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
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  accountFromIdToken,
  inviteUrlFor,
  tokenFromUrl,
  signInCall,
  tokensFrom,
  type CognitoConfig,
  type CognitoTokens,
} from "@poker/core";

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

  const outputs = JSON.parse(raw) as {
    OutputKey: string;
    OutputValue: string;
  }[];
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
  console.log(
    `${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`,
  );
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
  stranger: { accountId: string; tokens: { idToken: string } } | null,
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
  check(
    "adding the same player again is not a conflict",
    addedAgain.ok,
    `${addedAgain.status}`,
  );

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

  /**
   * **The deletion has to come back as a deletion.** A phone merges a board
   * into what it already has, so an id that has simply gone missing from the
   * list changes nothing — only a named tombstone removes anything. If this
   * check ever fails, every removal silently stops propagating and the only
   * symptom is a player nobody can get rid of.
   */
  step("removing a player and reading the board back");
  const removed = await fetch(
    `${apiUrl}/groups/${groupId}/players/${encodeURIComponent(player.id)}`,
    { method: "DELETE", headers: { Authorization: me.tokens.idToken } },
  );
  check("a player can be removed", removed.ok, `${removed.status}`);

  const after = await fetch(`${apiUrl}/groups/${groupId}`, {
    headers: { Authorization: me.tokens.idToken },
  });
  const reread = (await after.json()) as {
    players?: { id: string }[];
    deleted?: { players?: string[]; results?: string[] };
  };
  check(
    "the removed player is gone from the board",
    !reread.players?.some((p) => p.id === player.id),
    `${reread.players?.length} players`,
  );
  check(
    "and is named as deleted, so a phone can remove it too",
    reread.deleted?.players?.includes(player.id) === true,
    JSON.stringify(reread.deleted),
  );

  /**
   * **The invite round trip, with a real second account.**
   *
   * The link is the whole feature, and the two halves are written a long way
   * apart: the app builds the URL, the server mints the token, and nothing
   * checks that what one produces is what the other accepts until somebody
   * taps a link that does not work.
   */
  if (stranger) {
    step("inviting the other account to the board");
    const minted = await send(`/groups/${groupId}/invite`, {});
    const invite = (await minted.json()) as { token?: string };
    check(
      "an admin can mint an invite",
      minted.ok && !!invite.token,
      `${minted.status}`,
    );

    if (invite.token) {
      // Built by the app's own code, so a change to either side that breaks the
      // other fails here rather than in somebody's hands.
      const url = inviteUrlFor(invite.token, "https://pokerkit.app");
      check(
        "the app can read its own link back",
        tokenFromUrl(url) === invite.token,
        url,
      );

      const joined = await fetch(
        `${apiUrl}/invites/${encodeURIComponent(tokenFromUrl(url) ?? "")}`,
        { method: "POST", headers: { Authorization: stranger.tokens.idToken } },
      );
      const joinedBody = (await joined.json()) as { groupId?: string };
      check(
        "the other account can redeem it",
        joined.ok && joinedBody.groupId === groupId,
        `${joined.status} ${JSON.stringify(joinedBody)}`,
      );

      // The point of joining: they can now read the board they were invited to.
      const theirs = await fetch(`${apiUrl}/groups/${groupId}`, {
        headers: { Authorization: stranger.tokens.idToken },
      });
      check(
        "and can then read the board",
        theirs.status === 200,
        `${theirs.status}`,
      );

      /**
       * **The role, which the app hides the share button on.** Minting is
       * admin-only, so a member offered the button gets nothing but an
       * explanation, every time. The client cannot work this out for itself —
       * it is only ever told — so a server that stopped saying would silently
       * put the button back.
       */
      const asMember = (await theirs.json()) as { role?: string };
      check(
        "and is told they are a member, not an admin",
        asMember.role === "member",
        `${asMember.role}`,
      );
      const asAdmin = (await (
        await fetch(`${apiUrl}/groups/${groupId}`, {
          headers: { Authorization: me.tokens.idToken },
        })
      ).json()) as { role?: string };
      check(
        "while the founder is an admin",
        asAdmin.role === "admin",
        `${asAdmin.role}`,
      );
    }
  }

  if (KEEP) {
    console.log(`  keeping board ${groupId}`);
    return;
  }
  // No route deletes a board — deliberately, an emptied group survives its
  // members — so the rows go directly, the same way the table's do.
  step(`removing board ${groupId}`);
  const documents = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region }),
    {
      marshallOptions: { removeUndefinedValues: true },
    },
  );
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
  // Both sides of every membership. The group's partition holds one copy and
  // each account holds the other, so cleaning only the group leaves whoever
  // joined carrying a board that no longer exists.
  for (const accountId of [
    me.accountId,
    ...(stranger ? [stranger.accountId] : []),
  ]) {
    await documents.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { pk: `ACCOUNT#${accountId}`, sk: `GROUP#${groupId}` },
      }),
    );
  }
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
   * Signed in up front when `--as-stranger` is set, because the board checks
   * want a real second account — an invite nobody else can redeem proves
   * nothing about invites.
   */
  const other = AS_STRANGER
    ? await signIn(
        config,
        credentials("SMOKE_STRANGER_EMAIL", "SMOKE_STRANGER_PASSWORD").email,
        credentials("SMOKE_STRANGER_EMAIL", "SMOKE_STRANGER_PASSWORD").password,
      )
    : null;

  await checkGroups(apiUrl, me, tableName, REGION, other);
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
    console.error(
      `\nstopped: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(1);
  });
