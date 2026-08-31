# `@poker/infra` — the backend

AWS CDK. Accounts, groups, cloud sync, the shared clock and the multiplayer table.

**`PokerBackend-dev` is deployed and has been exercised end to end** — account `096695166445`,
region `us-east-1`. Sign-up with a real emailed code, sign-in, `GET /me`, a hand seeded and acted
on, events arriving on both channels, and a non-member refused: 19 checks, run by
[`scripts/smoke.ts`](./scripts/smoke.ts). Prod has still never been deployed.

`cdk synth` and the tests still run with no credentials, which is what lets CI check the whole stack
without anybody holding a key. What the first deploy proved is that this is necessary and not
sufficient — see *What only a deploy could tell us*, below.

## Where dev is

| Output             | Value                                                             |
| ------------------ | ----------------------------------------------------------------- |
| `ApiUrl`           | `https://hv0qrcgmt4.execute-api.us-east-1.amazonaws.com`          |
| `UserPoolId`       | `us-east-1_6iwLdpBIy`                                             |
| `UserPoolClientId` | `2lahhup3m7il6iqusctitu6lbc`                                      |
| `EventApiDns`      | `55bempvj4fh2fcvzcy7x26vgy4.appsync-realtime-api.us-east-1.amazonaws.com` |
| `TableName`        | `PokerBackend-dev-TableCD117FA1-FLOO5GQYD00E`                     |

None of these are secrets — a user pool id and a public app client id are public by design. They are
mirrored in `DEV_BACKEND` in
[`apps/mobile/src/services/backendConfig.ts`](../mobile/src/services/backendConfig.ts), where
`backendConfig` is still `null` on purpose so a 1.2.0 build cannot ship pointing at a development
stack.

## What only a deploy could tell us

Four things, none of which a synth, a unit test or a review had any way to catch. They are the
argument for standing dev up before writing anything else against it.

1. **`TableNamespace` failed with `DataSource not found`, and rolled the whole stack back.** The
   channel namespace names its data source with a plain string — that is the shape AppSync's API
   takes — so CloudFormation saw no dependency and created both in parallel. An explicit
   `addDependency` fixes it. **Invisible in `cdk synth` and invisible on every deploy after the
   first**, because by then the data source exists; only a create-from-nothing shows it. There is
   now a test asserting the `DependsOn`.
2. **The production gate pointed at an environment Vercel owns.** GitHub environment names are
   case-insensitive, and `production` resolves to the `Production` environment the website's Vercel
   integration created. A required reviewer there would have gated every web deploy — and the OIDC
   subject carries the stored casing, so it would not have matched the trust policy anyway. The gate
   is now `backend-production`.
3. **The account already had a GitHub OIDC provider**, so `PokerDeployment` needs
   `-c existingProviderArn=…`. The documented path worked; it just is not optional here. The
   `deploy:roles` script carries the flag.
4. **`cdk deploy` does not undo an out-of-band change.** After breaking the action handler's
   `TABLE_NAME` by hand to test an alarm, a redeploy answered `✅ no changes` and left it broken:
   CloudFormation compares templates, not live resources. **Anything changed with
   `aws lambda update-function-configuration` has to be changed back the same way** — or the stack
   forced with `cdk deploy --force`. A green deploy is not evidence the resource matches the code.

---

## What exists today

|                    |                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cognito**        | User pool + client, email recovery, `RETAIN`                                                                                                                                                                                                           |
| **DynamoDB**       | `TableV2`, single-table `pk`/`sk`, on-demand billing, PITR on, `RETAIN`, `expiresAt` TTL for live hands                                                                                                                                                |
| **AppSync Events** | Cognito to connect and subscribe, **IAM to publish**. Namespaces `table` (shared) and `player` (private); the private one carries an APPSYNC_JS subscribe handler enforcing `segments[2] === ctx.identity.sub`                                         |
| **Action Lambda**  | `NodejsFunction`, Node 22, esbuild inlines the workspace-private `@poker/core` — the same rules run on the phone and here. Explicit `LogGroup`                                                                                                         |
| **Publishing**     | Signed with the Lambda's own IAM credentials (SigV4 by hand, `node:crypto`, checked against AWS's published vectors). The shared channel gets a hand with every hole card stripped; each player's own cards go to a channel only they can subscribe to |
| **HTTP API**       | `GET /me` and `POST /tables/{tableId}/actions`, both behind a Cognito JWT authorizer that is the API's **default** — a route added later is authenticated because nobody did anything. Access logs, throttled                                          |
| **Environments**   | `PokerBackend-dev` and `PokerBackend-prod`, plus `PokerDeployment` for the GitHub OIDC roles                                                                                                                                                           |
| **Telemetry**      | ADOT layer on both functions, exporting OTLP to Grafana Cloud through a bundled collector config; credential from Secrets Manager by dynamic reference                                                                                                 |
| **Alarms**         | Seven, into an SNS topic, each carrying what it means; a forecast budget alarm alongside                                                                                                                                                               |
| **Tests**          | 166, covering the synthesised template and the handlers' decision-making                                                                                                                                                                               |

**Hole cards are private because of where they are published**, not because a client declines to
draw them. Both sides build channel paths from `playerChannel` in `@poker/core`, because the two
disagreeing about a path is a silent security bug — and was one, until a review caught the guard
sitting on a namespace those channels never touch.

## What does not exist

1. **Prod has never been deployed.** Dev has, and everything below is written from that side of the
   line now.
2. **Telemetry works, and costs about ten times what this file used to claim.** Measured, n=6 per
   function, forced parallel cold starts:

   | Function             | Telemetry off | Telemetry on | Delta               |
   | -------------------- | ------------- | ------------ | ------------------- |
   | Identity             | 142.9 ms      | 1889.2 ms    | **+1746 ms** (13×)  |
   | TableAction          | 302.0 ms      | 2267.5 ms    | **+1966 ms** (7.5×) |
   | SubscribeAuthorizer  | 277.4 ms      | 2160.9 ms    | **+1884 ms** (7.8×) |

   The published figure, repeated below in *The four decisions*, is 50–200 ms. **It is not 50–200 ms
   here.** Two things make that worse than the numbers alone suggest: this app's traffic is almost
   entirely cold starts, because a table plays one evening a week; and `SubscribeAuthorizer` has a
   **3-second timeout** and runs before a player can see a table, so ~2.2 s of init is most of its
   budget on the one path somebody actually waits on.

   Memory tripled too — `Max Memory Used` went 76 MB → 189 MB on a 256 MB function, which puts
   Identity near its ceiling and means it is CPU-starved during init as well (Lambda scales CPU with
   memory). Raising memory would buy some of the time back, at a price per invocation.

   **The documented fallback exists for exactly this**: export metrics and logs only, and get the
   infrastructure picture from the CloudWatch scrape instead. **Deliberately not taken** — telemetry
   is left on, with the cost known and written down rather than discovered later.

   Getting there took three separate faults, none of which a synth or a test could have found, and
   each of which broke *every route* rather than merely losing telemetry:

   | What                                            | Symptom                                                                 |
   | ----------------------------------------------- | ----------------------------------------------------------------------- |
   | `OPENTELEMETRY_COLLECTOR_CONFIG_URI` had no scheme | Config never fetched. `otelcol state is Closed`, no reason given        |
   | `batch` processor is not in this layer          | `unknown type: "batch" ... (valid values: [])` — **no processors at all** |
   | esbuild's non-configurable `handler` export     | `TypeError: Cannot redefine property: handler`, uncaught, at init        |

   The first one is the nastiest, and worth knowing for its own sake: **because the config was never
   parsed, raising `service.telemetry.logs.level` inside it changed nothing.** The obvious debugging
   move produced no new output, which reads like "the setting is not working" rather than "we never
   got as far as your file".

3. **The throttle protects the bill, not availability.** It is per route and shared by everybody,
   so one account hammering a route returns 429 to every player at every table. HTTP APIs have no
   per-caller quota — usage plans are a REST API feature — so the fix, when somebody is actually
   connected, is a WAF rate rule at roughly $5 a month for a web ACL.
4. **No dashboards.** Alarms are code, and one of them has now been seen to fire — the action
   handler was pointed at a table it had no permission to read, and `ActionErrors` went to `ALARM`
   about a minute later and emailed. A Grafana dashboard is still console work, as is the
   CloudWatch metrics scrape that fills in what OTel cannot see (API Gateway 5xx, DynamoDB
   throttles, cold starts) — that scrape is the half of the picture worth doing first.
5. **No custom domain.** The API answers on its generated `execute-api` hostname, which is fine
   until the day the stack is replaced and the hostname changes with it.
6. **No federated sign-in.** Apple and Google need real client ids and secrets, and App Store
   guideline 4.8 requires Sign in with Apple alongside any other third-party provider.
6a. **`UserPoolEmail.withCognito()` is a development setting.** It delivers — both test sign-ups
   arrived — but **into the spam folder**, because `no-reply@verificationemail.com` is AWS's shared
   sender and nothing authenticates it as this app. It is also capped at **50 messages a day** with
   no way to raise it, which is a cap on sign-ups per day for the whole app. Production wants
   `withSES()` against a verified domain with SPF/DKIM/DMARC. Fine for dev; not a launch
   configuration.
7. **Nothing in the app points at it yet** — `backendConfig` is `null` deliberately, not for want of
   somewhere to point.
8. **No route creates a table.** A table is created by a game starting, and the app side of that is
   unbuilt, so `POST /tables/{id}/actions` answers `404 no such table` until a row exists. This is
   why the smoke script seeds one directly.
9. **The budget is account-wide, despite being named `poker-dev`.** `CfnBudget` is created with no
   `CostFilters`, so it forecasts the whole account — which here also runs `sailor-prod` and
   `investments-tracker-prod`. At $0.64/month across everything it will not misfire, and it will
   still catch a runaway loop, so it is left alone. Filtering it properly means activating the
   `aws:cloudformation:stack-name` cost allocation tag in Billing and waiting ~24h for it to apply.

---

## The four decisions

### 1. Requests over HTTP, events over WebSocket

```
app ──POST /tables/{id}/actions──▶ HTTP API ──▶ Lambda
                                  (JWT authz)    │
                                                 ├──▶ DynamoDB  (conditional write on version)
                                                 └──▶ AppSync   (EventPublish)
app ◀──────────── subscribe ─────────────────────── AppSync Events
```

An **API Gateway HTTP API** with a Cognito JWT authorizer in front of the action Lambda, keeping
AppSync Events for the push side. Roughly $1 per million requests, per-route CloudWatch metrics for
free, throttling and stage variables when they are needed.

The alternatives were considered and rejected for concrete reasons rather than taste. A **function
URL** is cheaper and means verifying JWTs by hand and losing per-route metrics and throttling —
which are exactly the things this plan is being asked to provide. **Direct Lambda invoke** from the
client puts AWS credentials on every phone. **Full AppSync GraphQL** would replace a working Events
API with a schema describing messages that already have a shape in `@poker/core`.

**Requests go out, events come back.** A client never learns the result of its action from the HTTP
response — it learns it from the event, the same way every other player does. The response says
"accepted" or "rejected"; the truth arrives on the channel. That keeps one code path for state
rather than two that can disagree, and it is what makes optimistic prediction on the client safe:
the phone runs `@poker/core` locally, and the authoritative event either confirms it or replaces it.

### 2. OpenTelemetry to Grafana Cloud, with CloudWatch for what OTel cannot see

**App telemetry** — traces, spans, custom metrics, structured logs from the Lambda — is emitted as
OTLP and shipped to Grafana Cloud. Vendor-neutral instrumentation, one place for all three signals,
and nothing that ties the next decision to AWS.

**Infrastructure metrics are a separate path, and this is the part that is easy to get wrong.** OTel
runs _inside_ the Lambda, so it cannot see API Gateway 5xx, DynamoDB throttles, AppSync connection
errors, or Lambda concurrency and cold starts. Those are CloudWatch service metrics. Grafana Cloud
pulls them with its **CloudWatch metrics scrape** (or a metric stream via Firehose, which is
lower-latency and costs more). Both signals then sit in one place.

On the Lambda side there is a real trade to make, not a free lunch:

- The **collector layer** (ADOT or the upstream OpenTelemetry Lambda layer) batches and exports out
  of band, and adds roughly **50–200 ms to a cold start**. AWS's newer collector-free layers are
  faster and export only to X-Ray and CloudWatch, so they cannot reach Grafana.
- **In-process OTLP export** avoids the layer but has to flush before the invocation returns, which
  puts the export latency in the request path.

For a table that plays one evening a week, cold starts are the common case, so this matters more
here than it would under steady traffic. **Start with the collector layer, measure a cold start
before and after, and write the number down.** If it is unacceptable, fall back to exporting
metrics and logs only and leave tracing to X-Ray.

Grafana Cloud's free tier is 10,000 active series, 50 GB of logs, 50 GB of traces and 14-day
retention, with no card required — comfortably above this project's volume, and worth re-checking at
sign-up rather than trusting a number written down here.

**What to alert on** (an alert nobody acts on is worse than no alert):

| Alarm                                       | Why it is worth waking up for                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Action Lambda error rate > 1% over 5 min    | The rules are rejecting real actions, or something is throwing                     |
| Action Lambda p99 > 2 s                     | A table is waiting on a turn that will not land                                    |
| DynamoDB conditional-check failures spiking | Optimistic concurrency thrashing — two clients fighting                            |
| DynamoDB throttles > 0                      | On-demand should not throttle; if it does, something is very wrong                 |
| AppSync connection errors / 5xx             | Players silently disconnected mid-hand — the failure nobody reports                |
| Cognito sign-in failure rate                | An expired Apple key or a broken client config, which looks like "the app is down" |
| Monthly spend > a threshold                 | The only alarm that catches a loop nobody noticed                                  |

Alerts are declared in Grafana (so they live beside the dashboards) and delivered by email; a
CloudWatch billing alarm into SNS is the one exception, because it has to work even when the
telemetry pipeline is the thing that broke.

### 3. Two stacks in one account, deployed by GitHub Actions over OIDC

`PokerBackend-dev` and `PokerBackend-prod` in the same AWS account, deployed from CI with a role
assumed via GitHub's OIDC provider — **no long-lived AWS keys anywhere**, not in the repo, not on a
laptop.

Dev exists for one reason: it is where the things that cannot be tested without a deployment finally
get tested. The subscribe authorizer, the conditional-write retry loop, the event fan-out, the
Cognito flows. Every one of those is currently unwritten _because_ it cannot be exercised, and dev
is what turns that from a standing excuse into a task.

Two accounts would be stronger isolation and is the right answer at scale; it costs an
Organization, SSO, two bootstraps and cross-account roles now. One account with two stacks and
distinct resource names is the honest trade for a one-person project, and moving later is a
migration of data, not of code.

Deploy flow: `cdk diff` on every PR touching `apps/infra` (posted to the PR), `cdk deploy` to dev on
merge, and **prod on a tag or a manual approval** — never automatically, because prod holds the
leaderboards.

### 4. First slice: accounts, end to end

The account screens are **already written, reviewed, and dark** — they run against a stub that signs
nobody up. Deploying Cognito and swapping one import turns them on.

It is the right first slice not because it is small but because it exercises **the entire chain with
the least that can go wrong**: IaC → bootstrap → deploy pipeline → app configuration → real users →
monitoring → alerting. Every later slice depends on all of that working, and none of it has ever
run. Getting the poker table working first would prove the same chain plus the hardest security
boundary in the system, all at once, on a first deployment.

---

## Standing it up

**Steps 1–3 and 5 are done for `096695166445` / `us-east-1`.** They are kept because they are what
a second account, or a rebuild of this one, would need — and because step 4 has not been done.

```bash
# 1. Bootstrap the account. Once per account+region. [done]
cd apps/infra
npx cdk bootstrap aws://096695166445/us-east-1

# 2. The roles GitHub Actions assumes. A role that deploys a stack cannot be
#    created by the stack it deploys, so this one goes by hand. [done]
npm run deploy:roles

#    That script carries `-c existingProviderArn=…` because this account
#    already had a GitHub OIDC provider and there can only be one. Without it
#    the deploy fails on EntityAlreadyExists.

# 3. Dev, by hand, to see it work before CI does. [done]
npm run deploy:dev
```

**`alertEmail` and `monthlyBudgetUsd` live in `cdk.json`'s `context` block, not on a command line,
and that is load-bearing.** CDK context is not sticky: a deploy *without* them does not leave the
existing alarm subscription and budget alone, it **deletes** them — and reports success, because a
template without them is a perfectly valid template. Every setting here degrades to something safe
and useless rather than to something wrong (alarms firing into a topic nobody reads, no budget,
nothing exported), which is exactly why losing one is quiet.

They were `-c` flags at first, and the workflow did not pass them, so the first CI deploy would have
destroyed both. The PR's own `cdk diff` printed `[-] AWS::SNS::Subscription … destroy` and that is
how it was caught. `cdk.json` is read by the CLI on **every** invocation, local or CI, which is what
makes the two agree without anybody remembering anything. A test asserts both keys are there.

Only account and region are still flags, because they legitimately differ between a laptop and CI —
the workflow passes them from repository variables.

**4. Then in Grafana Cloud** — free tier, no card:

- Create a stack, open the **OpenTelemetry** tile, and generate a token. It gives you an OTLP
  endpoint (`https://otlp-gateway-prod-<zone>.grafana.net/otlp`) and an `Authorization: Basic …`
  header built from the instance id and the token.
- Create the secret **yourself** — CDK imports it by name and never writes to it, so a deploy can
  never overwrite the value:

  ```bash
  aws secretsmanager create-secret --name poker/grafana-otlp --secret-string \
    '{"otlpEndpoint":"https://otlp-gateway-prod-<zone>.grafana.net/otlp","otlpAuth":"Basic <base64 of instanceId:token>"}'
  ```

- **Then** redeploy with telemetry on: `npx cdk deploy PokerBackend-dev -c telemetry=true …`.

  Telemetry is off until asked for, and the order matters: the collector refuses to start without
  an endpoint, so turning it on before the secret exists would take every route down with it and
  the cause would look like anything but a missing telemetry credential.

- Add the **CloudWatch metrics scrape** for this account. OTel cannot see API Gateway 5xx, DynamoDB
  throttles, AppSync connection errors or cold starts, because all of those happen outside the
  function it lives in. Without the scrape, half the dashboard is empty for reasons nobody can see.
  Log lines come this way too — a `console.log` is not OTLP, so the collector never sees one.

**5. Then in GitHub**, under Settings — **done**:

- **Variables** (not secrets — neither is sensitive, and a variable is visible in the log, which is
  what you want when a deploy goes to the wrong place): `AWS_ACCOUNT_ID` = `096695166445`,
  `AWS_REGION` = `us-east-1`.
- **Environments → `backend-production`**, with a required reviewer. That environment is not
  decoration: the prod role's trust policy only accepts a token whose subject is
  `repo:<owner>/<repo>:environment:backend-production`, so **the approval is what makes the
  credentials issuable at all**. Without the environment, the prod deploy cannot authenticate, gate
  or no gate.
  - **Not `production`.** GitHub environment names are case-insensitive and `Production` in this
    repository belongs to Vercel, which deploys the website on every push to `main`. A required
    reviewer there would gate the website, and the OIDC subject would carry the stored casing and
    not match the policy anyway. See `PRODUCTION_ENVIRONMENT` in `lib/deploymentStack.ts`.

Until `AWS_ACCOUNT_ID` is set, the workflow's AWS steps skip themselves and only `cdk synth` runs.
That is deliberate: a workflow that tried anyway would fail every run on credentials and teach
everybody to ignore a red tick.

### After that

|                                      |                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| A pull request touching `apps/infra` | `cdk synth`, then `cdk diff` against dev posted as a comment                       |
| A merge to `main`                    | deploys dev                                                                        |
| Production                           | **Actions → Infra → Run workflow → prod**, which waits on the environment approval |

Prod is never automatic. It holds the leaderboards.

**Deploy-on-merge does not fire yet**, and not for a broken reason: every `apps/infra` commit is on
`release/1.2.0`, and `main` has none of them. It starts working when that branch merges. Until then
dev is deployed by hand with `npm run deploy:dev`, and the `cdk diff` job on a pull request is the
part that already runs — which is also the thing that proves the OIDC round trip works.

## Checking it still works

```bash
export SMOKE_EMAIL=poker.blinds.buzzer.smoke2@gmail.com SMOKE_PASSWORD='…'
npm run smoke -w @poker/infra

# The authorization check, which needs a second signed-in account:
export SMOKE_STRANGER_EMAIL=poker.blinds.buzzer.smoke1@gmail.com SMOKE_STRANGER_PASSWORD='…'
npm run smoke -w @poker/infra -- --as-stranger
```

19 checks against the live stack: sign-in, `/me` three ways, a seeded hand acted on, the shared
event with every hole card stripped, the private event with exactly two, a replay refused as stale,
acting as another player refused, and a non-member refused on both channels. It reads the stack's
own outputs, refuses to run against anything named `-prod`, and deletes the table it seeded.

**It signs in; it never signs up.** Both accounts must exist and be confirmed, which keeps the pool
free of accounts nobody meant to create.

---

## Build order

Each step is a PR, CI-checked, and each is deployable on its own.

**A. The ground floor**

1. Split the stack per environment, bind account and region, name resources per stage.
2. GitHub OIDC role + `cdk diff` on PRs, deploy-to-dev on merge, prod behind approval.
3. `cdk bootstrap` — **needs credentials, so this is yours to run.**

**B. Accounts** 4. HTTP API + Cognito JWT authorizer, with one trivial authenticated route to prove the chain. 5. OTel wiring: collector layer, OTLP export to Grafana, structured logs, a first dashboard, the
alarms above. Cold-start measured and recorded. 6. Replace `stubAuthProvider` with Cognito in the app; environment configuration for dev vs prod. 7. Link the account screens into Settings — the entry point that has been deliberately absent. 8. Account deletion actually deletes server-side data (App Store 5.1.1(v) — the screen exists, the
deletion does not).

**C. Sync** 9. The DynamoDB access patterns for groups, players and results; the read/write loop in the Lambda. 10. Groups and leaderboards sync across devices, guest players linkable to accounts.

**D. The table** 11. **Close the `table` namespace authorization gate.** A Lambda authorizer on subscribe checking
membership in DynamoDB. Nothing else in D lands before this. 12. The action handler's storage and publishing. 13. The shared clock's real `SessionTransport`, replacing the loopback. 14. Multiplayer table wired to the app; automatic recording into the leaderboard.

**E. Sign-in with Apple and Google** — needs credentials in both consoles, so it goes when you are
back at a machine that has them.

---

## Cost, at the scale this is actually at

At around 1,000 monthly actives with a tenth of them hosting, measured against published pricing:
**$10–28/month**, of which the server side is roughly $0.30–0.40 per hosting user — about 2% of any
plausible subscription price. Grafana Cloud is $0 on the free tier at this volume.

The one unresolved number: **Cognito bills users arriving through a SAML/OIDC identity provider on a
separate 50-MAU free tier**, then $0.015/MAU, against 10,000 free on Essentials. Whether Sign in
with Apple and Google land in the normal tier or that one is the difference between $0 and roughly
$14/month at 1,000 users, and the pricing page names neither provider. **Confirm it against the docs
or a throwaway pool before step E**, not after.

## What still cannot be done from here

The bootstrap, the OIDC provider and the first deploys are done, so that list is shorter than it
was. What is left needs an account somebody has to create or a console somebody has to open:

- **The Grafana Cloud account**, and therefore the OTLP credential, the telemetry deploy, the
  cold-start "after" number, the dashboards and the CloudWatch metrics scrape.
- **Apple and Google sign-in credentials**, and the RevenueCat/App Store/Play console work.
- **Anything needing two physical devices**, which is most of what D is for.
- **Prod.** One `workflow_dispatch` away, and there is no reason to reach for it before the app is
  actually talking to dev.

Everything else — the CDK, the handlers, the app wiring, the tests, the dashboards-as-code — needs
no key, and dev can now be checked against with `npm run smoke`.
