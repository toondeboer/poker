# `@poker/infra` — the backend

AWS CDK. Accounts, groups, cloud sync, the shared clock and the multiplayer table.

**Nothing here has ever been deployed.** `cdk synth` and the tests run with no credentials, which is
what lets CI check the whole stack without anybody holding a key — and also why every gap below is
still a gap: the parts that cannot be exercised without a deployment were deliberately not written
blind.

---

## What exists today

|                    |                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cognito**        | User pool + client, email recovery, `RETAIN`                                                                                                                                                                   |
| **DynamoDB**       | `TableV2`, single-table `pk`/`sk`, on-demand billing, PITR on, `RETAIN`, `expiresAt` TTL for live hands                                                                                                        |
| **AppSync Events** | Cognito to connect and subscribe, **IAM to publish**. Namespaces `table` (shared) and `player` (private); the private one carries an APPSYNC_JS subscribe handler enforcing `segments[2] === ctx.identity.sub` |
| **Action Lambda**  | `NodejsFunction`, Node 22, esbuild inlines the workspace-private `@poker/core` — the same rules run on the phone and here. Explicit `LogGroup`                                                                 |
| **HTTP API**       | `GET /me` and `POST /tables/{tableId}/actions`, both behind a Cognito JWT authorizer that is the API's **default** — a route added later is authenticated because nobody did anything. Access logs, throttled  |
| **Environments**   | `PokerBackend-dev` and `PokerBackend-prod`, plus `PokerDeployment` for the GitHub OIDC roles                                                                                                                   |
| **Tests**          | 67, covering the synthesised template and the handlers' decision-making                                                                                                                                        |

**Hole cards are private because of where they are published**, not because a client declines to
draw them. Both sides build channel paths from `playerChannel` in `@poker/core`, because the two
disagreeing about a path is a silent security bug — and was one, until a review caught the guard
sitting on a namespace those channels never touch.

## What does not exist

1. **Nothing has been deployed.** Every item below follows from that, and the four steps under
   "Standing it up" are what changes it.
2. The action handler **throws on purpose** — no DynamoDB read/write, no publish. `POST
/tables/{id}/actions` therefore reaches a function that fails, which is a deliberate step up
   from a route that did not exist.
3. The shared `table` namespace is **authenticated but not authorized**. A signed-in account holding
   a table id could stream a stranger's game. Not exploitable — nothing connects — and it must be
   closed before anything does.
4. **No observability at all**: no alarms, no dashboard, no metric filters, no notification path.
   Access logs exist; nothing reads them.
5. **No custom domain.** The API answers on its generated `execute-api` hostname, which is fine
   until the day the stack is replaced and the hostname changes with it.
6. **No federated sign-in.** Apple and Google need real client ids and secrets, and App Store
   guideline 4.8 requires Sign in with Apple alongside any other third-party provider.
7. Nothing in the app points at any of it.

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

Four steps, in order. **All of them need credentials, so all of them are yours.** After the last
one, nothing in this repository ever needs an AWS key again.

```bash
# 1. Bootstrap the account. Once per account+region, and CDK will tell you to
#    do this if you forget.
cd apps/infra
npx cdk bootstrap aws://<account>/<region>

# 2. Deploy the roles GitHub Actions will assume. A role that deploys a stack
#    cannot be created by the stack it deploys, so this one goes by hand.
npx cdk deploy PokerDeployment -c account=<account> -c region=<region>

#    If the account already has a GitHub OIDC provider — there can only be one —
#    reuse it instead of failing on EntityAlreadyExists:
#    -c existingProviderArn=arn:aws:iam::<account>:oidc-provider/token.actions.githubusercontent.com

# 3. Deploy dev once by hand, to see it work before CI does it.
npx cdk deploy PokerBackend-dev -c account=<account> -c region=<region>
```

**4. Then in GitHub**, under Settings:

- **Variables** (not secrets — neither is sensitive, and a variable is visible in the log, which is
  what you want when a deploy goes to the wrong place): `AWS_ACCOUNT_ID` and `AWS_REGION`.
- **Environments → `production`**, with a required reviewer. That environment is not decoration:
  the prod role's trust policy only accepts a token whose subject is
  `repo:<owner>/<repo>:environment:production`, so **the approval is what makes the credentials
  issuable at all**. Without the environment, the prod deploy cannot authenticate, gate or no gate.

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

## What cannot be done from here

- **Deploying anything.** No credentials, and standing up billable cloud resources is not something
  to do on somebody's behalf.
- **`cdk bootstrap`**, the OIDC provider, and the Grafana Cloud account.
- **Apple and Google sign-in credentials**, and the RevenueCat/App Store/Play console work.
- **Anything needing two physical devices**, which is most of what D is for.

What _can_ be done from here is everything else: the CDK, the handler, the app wiring, the tests,
and the dashboards-as-code. That is most of the work, and none of it needs a key.
