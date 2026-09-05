# `@poker/infra` — the backend

AWS CDK. Accounts, groups, cloud sync, the shared clock and the multiplayer table.

**Both stages are deployed** — account `096695166445`, region `us-east-1`.

Dev has been exercised end to end: sign-up with a real emailed code, sign-in, `GET /me`, a hand
seeded and acted on, events arriving on both channels, a replay refused as stale, and a non-member
refused from both channels. **35 checks**, run by [`scripts/smoke.ts`](./scripts/smoke.ts) with
`--as-stranger`.

**Prod exists as of 2026-09-04** and was stood up by walking *Standing up production* below, in two
deploys as that section requires. It answers `200` on `/config` and `401` on `/me` without a token,
sends from its own DKIM-verified domain, and holds zero users and zero rows. The smoke script
**refuses to run against it** by design — it writes a hand into the table — so what has been checked
there is the configuration, read back from the live resources, and the two public routes.

`cdk synth` and the tests still run with no credentials, which is what lets CI check the whole stack
without anybody holding a key. What the first deploy proved is that this is necessary and not
sufficient — see _What only a deploy could tell us_, below.

## Where prod is

| Output             | Value                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| `ApiUrl`           | `https://poker-api.toondeboer.com`                                        |
| `UserPoolId`       | `us-east-1_vJMiOQqvI`                                                     |
| `UserPoolClientId` | `3qj1r450ssj3jba0g57dd8jnga`                                              |
| `EventApiDns`      | `rmwfm4dlvnh5flzrm7mznoauvu.appsync-realtime-api.us-east-1.amazonaws.com` |
| `TableName`        | `PokerBackend-prod-TableCD117FA1-R5UX8NJ0TCR2`                            |
| `MailFrom`         | `Poker Blinds Timer <noreply@poker.toondeboer.com>`                       |
| `DashboardName`    | `poker-prod`                                                              |

**Out of the SES sandbox as of 2026-09-04.** `aws sesv2 get-account` reports
`ReviewStatus: GRANTED` and a `Max24HourSend` of 50,000 against the sandbox's 200 — that quota is
the signal worth checking, because `ProductionAccessEnabled` reads `true` from the moment the
request is *filed* and says nothing about whether it was granted. Prod can now deliver a sign-up
code to an address nobody has verified by hand, which is what makes real users possible at all.

It was granted in minutes rather than the day or two budgeted for it, which is worth knowing but
not worth planning around: it is still a review, and a different account or a less transactional
use case can still wait. Ask first anyway — see step 1 of *Standing up production*.

## Where dev is

| Output             | Value                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| `ApiUrl`           | `https://poker-api-dev.toondeboer.com`                                    |
| `UserPoolId`       | `us-east-1_6iwLdpBIy`                                                     |
| `UserPoolClientId` | `2lahhup3m7il6iqusctitu6lbc`                                              |
| `EventApiDns`      | `55bempvj4fh2fcvzcy7x26vgy4.appsync-realtime-api.us-east-1.amazonaws.com` |
| `TableName`        | `PokerBackend-dev-TableCD117FA1-FLOO5GQYD00E`                             |

`ApiUrl` is **a name we own**, and that is the point of it: the generated
`https://<id>.execute-api.<region>.amazonaws.com` is baked into every shipped build, and the id
belongs to the API Gateway resource — recreate the stack and every installed copy of the app is
permanently broken with no way to tell it the new address. The generated host still answers (it is
published as `ApiEndpointGenerated`, as a way back in if DNS or the certificate has a bad day) and
must never be the one that ships.

**The API sits beside the website, not beneath it, and that is not cosmetic.** `poker-timer.
toondeboer.com` is served from Vercel, which publishes CAA records on the name it manages
authorising Let's Encrypt, Google, GlobalSign and Sectigo — **and not Amazon**. CAA is inherited by
every name below it, so ACM cannot issue for anything under that subtree. It fails after about two
minutes with `Certificate validation failed with status: FAILED`, which reads exactly like a DNS
propagation problem and is nothing of the sort: no amount of waiting fixes it. The apex has no CAA,
so a name beside the site issues fine.

None of these are secrets — a user pool id and a public app client id are public by design. They are
mirrored in `DEV_BACKEND` in
[`apps/mobile/src/services/backendConfig.ts`](../mobile/src/services/backendConfig.ts), where
`backendConfig` is still `null` on purpose so a 1.2.0 build cannot ship pointing at a development
stack.

## What only a deploy could tell us

Six things, none of which a synth, a unit test or a review had any way to catch. They are the
argument for standing an environment up before writing anything else against it — and items 5 and 6
came from **prod**, months after dev was working, which is the argument for reading a new
environment back rather than assuming it matches the one you already trust.

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

5. **The prod table had no deletion protection, while the user pool did.** `settings.
   deletionProtection` existed and was already `true` for prod; it was passed to the pool and never
   to the table. Nothing failed, no test caught it, and `RETAIN` looked like it covered the case —
   it does not. `RETAIN` is a CloudFormation instruction that stops a stack update or a `cdk
   destroy`; a direct `DeleteTable` call is untouched by it, and this account also runs
   `sailor-prod` and `investments-tracker-prod`. **Found by reading the live table back**, not by
   reading the code. Two tests now assert the pair together so they cannot drift apart again.

6. **The alarm subscription sits at `PendingConfirmation` until somebody clicks the email.** The
   stack reports `CREATE_COMPLETE`, all ten alarms report `OK`, `ActionsEnabled` is `true` — and
   every one of them is firing into nothing. There is no state anywhere in CloudFormation that says
   so; the only way to know is
   `aws sns list-subscriptions-by-topic`, where the subscription ARN is the literal string
   `PendingConfirmation`. Worth checking after **any** deploy that creates a topic, because
   everything about it looks finished.

## What exists today

|                    |                                                                                                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cognito**        | User pool + client, email recovery, `RETAIN`                                                                                                                                                                                                                                                             |
| **DynamoDB**       | `TableV2`, single-table `pk`/`sk`, on-demand billing, PITR on, `RETAIN`, `expiresAt` TTL for live hands                                                                                                                                                                                                  |
| **AppSync Events** | Cognito to connect and subscribe, **IAM to publish**. Namespaces `table` (shared) and `player` (private); the private one carries an APPSYNC_JS subscribe handler enforcing `segments[2] === ctx.identity.sub`                                                                                           |
| **Action Lambda**  | `NodejsFunction`, Node 22, esbuild inlines the workspace-private `@poker/core` — the same rules run on the phone and here. Explicit `LogGroup`                                                                                                                                                           |
| **Publishing**     | Signed with the Lambda's own IAM credentials (SigV4 by hand, `node:crypto`, checked against AWS's published vectors). The shared channel gets a hand with every hole card stripped; each player's own cards go to a channel only they can subscribe to                                                   |
| **HTTP API**       | Sixteen routes — identity, the poker table, and the shared leaderboard (groups, players, games, claims, invites, members, `DELETE /me`) — all behind a Cognito JWT authorizer that is the API's **default**, so a route added later is authenticated because nobody did anything. Access logs, throttled |
| **Groups**         | Shared boards: several admins, anybody may add a player or record a game, only an admin may remove one. Invite links that do not expire and are revoked by rotation. **Every read is authorized, not merely authenticated** — see [SYNC.md](./SYNC.md)                                                   |
| **Environments**   | `PokerBackend-dev` and `PokerBackend-prod`, plus `PokerDeployment` for the GitHub OIDC roles                                                                                                                                                                                                             |
| **Telemetry**      | X-Ray `Tracing.ACTIVE` on all three functions, CloudWatch metrics and structured logs, and a `poker-<stage>` dashboard built in CDK from the alarm definitions. No third-party export — see decision 2                                                                                                   |
| **Alarms**         | Ten, into an SNS topic, each carrying what it means; a forecast budget alarm alongside. One has been seen to fire                                                                                                                                                                                        |
| **Tests**          | 277, covering the synthesised template and the handlers' decision-making                                                                                                                                                                                                                                 |

**Hole cards are private because of where they are published**, not because a client declines to
draw them. Both sides build channel paths from `playerChannel` in `@poker/core`, because the two
disagreeing about a path is a silent security bug — and was one, until a review caught the guard
sitting on a namespace those channels never touch.

## What does not exist

1. ~~**Production access for SES.**~~ **Done, 2026-09-04.** Requested with
   `aws sesv2 put-account-details` and granted the same day; `ReviewStatus` is `GRANTED` and the
   daily quota is 50,000. Prod delivers to any address, so a stranger's sign-up code now arrives.
2. **No third-party telemetry, deliberately.** This exported OpenTelemetry to Grafana Cloud, it
   worked, and it was removed once there was a number attached to it. Measured, n=6 per function,
   forced parallel cold starts:

   | Function            | No telemetry | ADOT → Grafana | X-Ray (now)  |
   | ------------------- | ------------ | -------------- | ------------ |
   | Identity            | 142.9 ms     | 1889.2 ms      | **127.0 ms** |
   | TableAction         | 302.0 ms     | 2267.5 ms      | **310.2 ms** |
   | SubscribeAuthorizer | 277.4 ms     | 2160.9 ms      | **315.0 ms** |

   The figure everyone quotes for that layer is 50–200 ms. It was **~1.9 seconds**, and this app is
   the worst case for it: a table plays one evening a week, so almost every invocation is a cold
   start rather than a rounding error on a warm fleet — and `SubscribeAuthorizer` runs before a
   player can see a table, on a three-second timeout that ~2.2 s of init nearly exhausts.

   `Tracing.ACTIVE` costs within noise of nothing, because the X-Ray daemon is part of the execution
   environment rather than a Go binary each function has to start.

   **The other half of the bill was the scrape.** Grafana cannot see API Gateway 5xx, DynamoDB
   throttles or AppSync connection errors on its own — those are CloudWatch metrics — so the plan
   was its CloudWatch scrape, at roughly **$3–9/month against an account that spends $0.64**. That
   is paying to copy metrics out of the place they already are, in order to look at them.

   What was given up is vendor neutrality, which was the original argument and the weakest one
   here: the backend is Cognito, AppSync Events, DynamoDB and CDK. Telemetry was the one portable
   piece of something entirely AWS-specific.

3. **The throttle protects the bill, not availability.** It is per route and shared by everybody,
   so one account hammering a route returns 429 to every player at every table. HTTP APIs have no
   per-caller quota — usage plans are a REST API feature — so the fix, when somebody is actually
   connected, is a WAF rate rule at roughly $5 a month for a web ACL.
4. **No considered dashboard.** There is one — `poker-<stage>`, in CDK, an alarm status row over a
   graph per alarm — but it was generated from the alarm definitions rather than designed. One of
   those alarms has been seen to fire: the action handler was pointed at a table it had no
   permission to read, and `ActionErrors` reached `ALARM` about a minute later and emailed.
5. **No custom domain.** The API answers on its generated `execute-api` hostname, which is fine
   until the day the stack is replaced and the hostname changes with it.
6. **No federated sign-in.** Apple and Google need real client ids and secrets, and App Store
   guideline 4.8 requires Sign in with Apple alongside any other third-party provider.
   6a. **No dashboard beyond the one in code.** `poker-<stage>` is built by CDK from the same `watch`
   calls that declare the alarms, so the two cannot drift. It is a starting point, not a considered
   layout.
   6b. **`UserPoolEmail.withCognito()` is a development setting.** It delivers — both test sign-ups
   arrived — but **into the spam folder**, because `no-reply@verificationemail.com` is AWS's shared
   sender and nothing authenticates it as this app. It is also capped at **50 messages a day** with
   no way to raise it, which is a cap on sign-ups per day for the whole app. Production wants
   `withSES()` against a verified domain with SPF/DKIM/DMARC. Fine for dev; not a launch
   configuration.
7. **Nothing in the app points at it yet** — `backendConfig` is `null` deliberately, not for want of
   somewhere to point. **This is the largest caveat on the group backend**: every route has been
   exercised by hand, and none has ever been called by a phone, replayed from an offline queue, or
   merged against local state. Those are the parts most likely to be wrong.
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

### 2. CloudWatch, X-Ray and a dashboard in code — after trying the other thing

**This decision was made twice.** It read _"OpenTelemetry to Grafana Cloud, with CloudWatch for what
OTel cannot see"_, on the argument that vendor-neutral instrumentation keeps all three signals in one
place and ties nothing to AWS. It was built, it was deployed, it worked — traces reached Grafana —
and it was then removed. The original text is in the history; what replaced it is below, and the
reason is a number.

**The collector layer cost ~1.9 s of cold start**, against a published 50–200 ms (measured table at
the top of this file). This app is the worst possible case for that: a table plays one evening a
week, so cold starts are the _common_ case rather than a rounding error on a warm fleet, and
`SubscribeAuthorizer` runs before a player can see a table on a three-second timeout.

**And the infrastructure half would have cost more than the whole backend.** OTel runs _inside_ a
Lambda, so it cannot see API Gateway 5xx, DynamoDB throttles, AppSync connection errors or cold
starts — those happen outside the function and are CloudWatch metrics. Reaching them from Grafana
means its CloudWatch scrape, at roughly **$3–9/month against an account that spends $0.64** — to
copy metrics out of the place they already were so they could be looked at elsewhere.

So:

- **Traces:** Lambda `Tracing.ACTIVE`. The X-Ray daemon is part of the execution environment rather
  than a Go binary each function starts, and it costs within noise of nothing.
- **Metrics:** CloudWatch, where they already are, with no export step to break.
- **Logs:** CloudWatch, structured JSON from `lib/lambda/logging.ts`, queryable with Logs Insights.
- **Dashboard:** `poker-<stage>`, built in CDK from the same `watch()` calls that declare the
  alarms — so a metric worth alarming on is automatically a metric worth looking at, and the two
  cannot drift.

**What this gives up is vendor neutrality**, and it is worth being honest that this was the whole
original argument. It is also the weakest one here: the backend is Cognito, AppSync Events, DynamoDB
and CDK. Telemetry was the single portable piece of something otherwise welded to AWS, and it was
being paid for in cold-start latency on every invocation. If this project ever spans two clouds, the
instrumentation is one layer and one config file away from going back — **and the footer in
`handlerBundling` has to come back with it**, or ADOT's handler wrap throws `Cannot redefine
property: handler` and fails every invocation.

**What to alert on** (an alert nobody acts on is worse than no alert):

| Alarm                       | Metric                                    | Why it is worth waking up for                                       |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| `ActionErrors`              | Lambda `Errors`                           | The rules are rejecting real actions, or something is throwing      |
| `ActionSlow`                | Lambda `Duration` p99                     | A table is waiting on a turn that will not land                     |
| `IdentityErrors`            | Lambda `Errors`                           | Sign-in is broken from the app's point of view                      |
| `ApiServerErrors`           | API Gateway `5xx`                         | The API is failing before a handler runs                            |
| `ApiClientErrors`           | API Gateway `4xx`                         | Sustained 4xx — a client version that no longer agrees with the API |
| `TableThrottled`            | DynamoDB `ThrottledRequests`              | On-demand should not throttle; if it does, something is very wrong  |
| `TableSystemErrors`         | DynamoDB `SystemErrors`                   | DynamoDB itself is erroring                                         |
| `TableContention`           | DynamoDB `ConditionalCheckFailedRequests` | Optimistic concurrency thrashing — two clients fighting             |
| `RealtimeConnectFailures`   | AppSync `ConnectServerError`              | Players cannot connect — **the failure nobody reports**             |
| `RealtimeSubscribeFailures` | AppSync `SubscribeServerError`            | The subscribe authorizer is erroring rather than refusing           |
| Monthly spend > a threshold | Budgets, forecast                         | The only alarm that catches a loop nobody noticed                   |

**This table used to be a design and is now a description.** Three of the alarms it once listed did
not exist — and the gap survived a review, because a documented alarm reads exactly like a real one.
Two of them are now built. The third is not, and cannot be as written:

- **Cognito sign-in failure rate is not buildable from a metric.** `AWS/Cognito` publishes
  `SignInSuccesses` and `SignInThrottles`, and nothing for failures. It needs user-pool logging plus
  a metric filter, which is a different piece of work; it is listed here as absent rather than
  implied by a table.

**Client errors are deliberately not alarmed on the realtime API.** `ConnectClientError` and
`SubscribeClientError` are what a refused non-member looks like — the subscribe guard working — so
paging on them would mean an email every time the security boundary did its job.

All ten are CloudWatch alarms into an SNS topic, delivered by email, and **one of them has been
seen to fire** — the action handler was pointed at a table it could not read, and `ActionErrors`
alarmed about a minute later. They were always going to be CloudWatch rather than declared in the
telemetry backend, for a reason that survived the rewrite: **an alert defined in the telemetry
pipeline stops working when the telemetry pipeline is what broke.**

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
and that is load-bearing.** CDK context is not sticky: a deploy _without_ them does not leave the
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

**4. There is no step 4 any more.** It used to be _"then in Grafana Cloud"_ — create a stack,
generate an OTLP token, put it in Secrets Manager, redeploy with `-c telemetry=true`, add the
CloudWatch metrics scrape. All of that was done, and then undone; see decision 2 for the numbers.
Telemetry now needs no account, no credential and no step: `Tracing.ACTIVE` and CloudWatch are on
from the first deploy.

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
part that already runs.

**The prod path, by contrast, is fully proven.** Both of prod's deploys went through
*Actions → Infra → Run workflow → prod*: the job held at `waiting` on the `backend-production`
environment, an approval released it, and the run assumed the prod role over OIDC and deployed. That
gate is not decoration — the prod role's trust policy only accepts a token whose subject names that
environment, so the approval is what makes the credentials issuable at all. It had never been
exercised before this.

## Standing up production

**Walked on 2026-09-04, and it held.** Prod was created in two deploys exactly as written below,
with no rollback: the first left the pool on Cognito's sender while the SES identity verified, the
second moved it across. Kept as the runbook because it is what a rebuild, or a second account,
would need — and because **step 1 is still outstanding**.

The order matters: two of these steps cannot be undone by the next deploy, and one of them has a
queue measured in days.

What it cost, for calibration: about fifteen minutes of wall time, most of it CloudFormation. Two
things turned up that no synth could show — see items 5 and 6 of *What only a deploy could tell
us*.

### Before touching AWS: ask for SES production access

**Do this first, because it is the only step here that waits on somebody else.** A new SES account
is in the *sandbox*, where mail is delivered only to addresses that have themselves been verified.
That is fine for the smoke accounts and useless for real users: every sign-up would send a code
that never arrives.

There is a console route — Support → *Account and billing* → *Service limit increase* → *SES
Sending Limits*, or the "Request production access" button — but the CLI files the same request and
keeps the wording in a file worth revising:

```bash
aws sesv2 put-account-details \
  --production-access-enabled \
  --mail-type TRANSACTIONAL \
  --website-url "https://poker-timer.toondeboer.com" \
  --contact-language EN \
  --use-case-description "file://ses-usecase.txt" \
  --additional-contact-email-addresses "poker.blinds.buzzer@gmail.com"
```

Say what the mail is (transactional confirmation codes for a mobile app's sign-up), who receives it
(only somebody who just typed their own address into the app), how they stop receiving it — they
never receive another one, there is no list to unsubscribe from — and how bounces are handled.
**Do not claim monitoring that does not exist.** The answer for the 2026-09-04 request was the SES
account-level suppression list plus the fact that mail is only ever sent on a live user action, so
no queue or retry can repeat delivery to a bad address — and an undertaking to add alarms, which
[`observability.ts`](./lib/observability.ts) now honours: `Reputation.BounceRate` at 5% and
`Reputation.ComplaintRate` at 0.1%, AWS's own review thresholds rather than its pause thresholds, so
there is still room to act when one arrives.

Those two are **prod only**, deliberately. SES publishes one reputation figure per account and
region rather than one per stack, so watching it from both stages would put two alarms on the same
number and send two emails about one problem.

It is **per account and region**, so `us-east-1` covers both stages. Budget a day or two; the
2026-09-04 request came back granted in minutes, which is not a promise.

**Check the quota, not the flag.** `ProductionAccessEnabled` flips to `true` the moment the request
is *filed*, so it does not distinguish "asked" from "granted". `Details.ReviewDetails.Status` and
`SendQuota.Max24HourSend` do — 200/day is the sandbox, 50,000 is production:

```bash
aws sesv2 get-account --query \
  '{Status:Details.ReviewDetails.Status,Max24Hour:SendQuota.Max24HourSend}'
```

Re-running `put-account-details` while a review is pending updates it in place rather than opening
a second case, which is how the contact address was corrected without disturbing the request.

The request is stronger once the dev identity has been sending, which it has.

### 1. Deploy prod once, to create the identity

```bash
# Actions → Infra → Run workflow → prod, which waits on the `backend-production`
# environment approval. Or, from a laptop:
cd apps/infra
npx cdk deploy PokerBackend-prod -c account=096695166445 -c region=us-east-1
```

This creates everything except the mail sender: the pool, the table, the API and its domain, and
the SES identity `poker.toondeboer.com` with its three DKIM records — but it leaves the pool on
Cognito's own sender, because `cdk.json` says `mailVerified: { "dev": true }` and prod is not in
that list yet.

**That is deliberate and is not a step to skip.** Cognito validates the identity at the moment the
pool is updated, and SES verifies asynchronously, so a deploy that did both at once rolls the entire
stack back with *"Email address is not verified"*. It happened twice on dev.

**Then confirm the alarm subscription email.** SNS sends a confirmation link to
`poker.blinds.buzzer@gmail.com`; until somebody clicks it, every alarm in prod fires into nothing.

### 2. Wait for SES, then flip prod on

```bash
aws sesv2 get-email-identity --email-identity poker.toondeboer.com \
  --query '{Verified:VerifiedForSendingStatus,Dkim:DkimAttributes.Status}'
# Wait for Verified: true, Dkim: SUCCESS. Minutes to a few hours.
```

Then add prod to the list in `cdk.json` — **in the file, not as a `-c` flag**:

```json
"mailVerified": { "dev": true, "prod": true }
```

and deploy again. Commit that change: **CDK context is not sticky**, so a flag typed on a command
line is undone by the next deploy that does not repeat it, and the deploy job passes only account
and region. That is exactly how it went wrong the first time — see `mailVerifiedFor`.

Confirm with a real sign-up, not with the console: `aws sesv2 get-account` reports sending is
enabled long before it proves a message arrived.

### 3. Point the app at prod

`apps/mobile/src/services/backendConfig.ts` — `backendConfig` is `null` in git so that no build can
ship pointing at dev. Set it to `PROD_BACKEND` in the release commit, and check the ids against the
prod stack's outputs rather than assuming they were filled in correctly.

### 4. Only then, the store

Club products in App Store Connect and Play Console, and the RevenueCat entitlement mapping. A
build that reaches a tester before the products exist shows a paywall that cannot be bought.

### What can be recovered afterwards, and what cannot

| | |
| --- | --- |
| SES sandbox | Out of it since 2026-09-04. Was never rushable by code — if a future account lands back in it, asking is the only move. |
| A feature misbehaving in prod | `-c featureSharing=off` — a stack update, about 90 seconds |
| The table or the user pool | `RemovalPolicy.RETAIN` on prod, so a stack delete does not take them |
| A bad prod deploy | Roll forward. There is no undo, and the data is real. |

## Turning a feature off without a release

**The only recovery a solo developer can actually use.** Every other way of
stopping a misbehaving feature is a new build and a store review — days, during
which it stays broken for everybody. `GET /config` is a flag on the server, read
at launch, and changing it is a stack update:

```bash
npm run deploy:dev -- -c featureSharing=off     # or featureAccounts=off
curl -s https://poker-api-dev.toondeboer.com/config
# {"accounts":true,"sharing":false}
```

Redeploying without the flag turns it back on. Verified in both directions
against dev; about 90 seconds each way.

**What each one actually does in the app**, because a switch nothing reads is a
string in a Lambda's environment:

- `featureSharing=off` — nothing syncs, and no board can be shared or joined.
  The outbox stops accepting writes, and minting or redeeming a link is refused
  rather than being allowed to write a membership for a board that can never
  then sync.
- `featureAccounts=off` — the Account row disappears from Settings. The
  `/account` route itself stays registered, because a confirmation email is a
  deep link that has to land somewhere. The case this is here for is concrete:
  sign-up depends on a code arriving, and this was the switch for the weeks when
  SES was still sandboxed and a code reached only addresses verified by hand.

- **The app treats unreachable as off** (`readFeatures`). That is the only safe
  direction: a backend that cannot be reached is one where none of this works
  anyway, so refusing early turns a queue of failing requests into a feature that
  is simply absent. The reverse would also stop it being a switch — turning
  something off would require every phone to successfully ask permission to stop.
- **It is the one unauthenticated route**, declared with an explicit
  `HttpNoneAuthorizer` rather than by omission, because a phone must be able to
  ask before it has an account — otherwise somebody signed out could never learn
  that sign-in has been switched off, which is the state it exists for. It says
  two booleans that are identical for everybody.
- Cached for 60 seconds. Long enough to cost nothing, short enough that throwing
  the switch takes effect while somebody is still watching.

**Faster, when 90 seconds is 90 seconds too many.** The deploy above is the
version that leaves a diff behind and is the one to reach for normally. When
something is actively going wrong, the flag is just an environment variable on
one Lambda, and it can be set directly:

```bash
CONFIG_FN=$(aws cloudformation list-stack-resources --stack-name PokerBackend-prod \
  --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function' \
           && starts_with(LogicalResourceId,'Config')].PhysicalResourceId" \
  --output text)

aws lambda update-function-configuration --function-name "$CONFIG_FN" \
  --environment 'Variables={FEATURE_SHARING=off,FEATURE_ACCOUNTS=on,NODE_OPTIONS=--enable-source-maps}'
```

Three things to know before using it. The lookup is a **prefix match, not the
construct name** — CDK appends a hash, so the logical id is `Config57D1D894` and
`--logical-resource-id Config` finds nothing. `--environment` **replaces the
whole map**, so every variable has to be listed; dropping `NODE_OPTIONS` costs
source maps in the traces. And the next `cdk deploy` puts the context value
back, so this is a stop-the-bleeding move and not a state anything should be
left in: follow it with the deploy that makes it real, or with the fix.

**What the switch does not do.** It stops *the app* using a feature; it does not
stop anything reaching the API. A client stuck in a retry loop, or anybody with
the URL, still gets as far as API Gateway — that is what the per-route throttle
is for, and it protects the bill rather than availability. If the problem is
spend rather than behaviour, the switch is the wrong lever; see the section
below.

## Seeing what this costs, on an account running other things

The stack tags every resource it creates:

| Tag | Value | For |
| --- | --- | --- |
| `project` | `poker` | Grouping in Cost Explorer |
| `stage` | `dev` / `prod` | Splitting the two stacks |
| `billingScope` | `poker-dev` / `poker-prod` | What the budget filters on |

**Activate them once, by hand, before any of it does anything.** CloudFormation
cannot do this — the API is account-level, not stack-level — and **activation is
not retroactive**: spend before the day you activate stays unattributed forever,
which is why it is worth doing while prod is still empty. Either Billing → Cost
allocation tags → Activate, or:

```bash
aws ce update-cost-allocation-tags-status \
  --cost-allocation-tags-status TagKey=project,Status=Active TagKey=stage,Status=Active
aws ce list-cost-allocation-tags --status Active --output table
```

`Status=Inactive` undoes it. Nothing here costs anything or touches data.

**A tag key cannot be activated until AWS has seen it on billed usage**, which
takes up to 24 hours after the deploy that first applies it — it is simply
absent from `list-cost-allocation-tags` until then, which reads like the command
being wrong rather than the key being new.

### State, as of 2026-09-04

| Tag | Status |
| --- | --- |
| `project` | **Active** |
| `stage` | **Active** |
| `billingScope` | **Not yet activatable** — applied to dev by the deploy that day, and AWS had not discovered the key |

**Outstanding**, and the only thing between here and a working dev budget alert:

```bash
aws ce update-cost-allocation-tags-status \
  --cost-allocation-tags-status TagKey=billingScope,Status=Active
```

Until that runs, `poker-dev`'s filter matches nothing, so **it does not alarm at
all** rather than alarming wrongly. Safe, but it is not a budget alert yet.
`poker-prod` keeps forecasting the whole account until prod is next deployed.

Then, for poker-only spend: Cost Explorer → Group by → Tag → `project`, or filter
to `project = poker` and group by `stage` to see the two stacks apart.

**The budget is scoped to match.** Each stage's `CfnBudget` filters on its own
`billingScope`, so `poker-dev` forecasts the dev stack and nothing else. It did
not always: with no filter at all it forecast the *whole account*, which on an
account running other projects is wrong in both directions — another project's
bill alone can hold the forecast over the limit so the warning is permanently on
and means nothing, while this stack running away stays invisible inside a much
larger number.

**One tag and not three, deliberately.** Budgets' `TagKeyValue` filter ORs the
values it is given, so listing `project$poker` beside `stage$dev` would match
either — every poker resource including prod, plus anything else in the account
somebody tagged `stage=dev`. That is why `billingScope` exists as a third tag
whose value is already unique per stack: it is the only shape that filter can
hold. Cost Explorer has no such limitation, which is why `project` and `stage`
are still the ones to read the bill with.

## Checking it still works

```bash
export SMOKE_EMAIL=poker.blinds.buzzer.smoke1@gmail.com SMOKE_PASSWORD='…'
npm run smoke -w @poker/infra

# The authorization check, which needs a second signed-in account:
export SMOKE_STRANGER_EMAIL=poker.blinds.buzzer.smoke2@gmail.com SMOKE_STRANGER_PASSWORD='…'
npm run smoke -w @poker/infra -- --as-stranger
```

**The two addresses must differ**, or `--as-stranger` signs in as the same account twice, fails the
script's own "the stranger is a different account" check, and proves nothing about the guard it
exists to test.

35 checks against the live stack: sign-in, `/me` three ways, a seeded hand acted on, the shared
event with every hole card stripped, the private event with exactly two, a replay refused as stale,
acting as another player refused, and a non-member refused on both channels. Then the shared-board
routes, where **every write is sent twice**: a phone replays anything whose answer went missing, so
a route that answers "already exists" to the second attempt turns a lost response into a permanent
refusal. That check found exactly that in `recordGame` on its first run. It reads the stack's own
outputs, refuses to run against anything named `-prod`, and deletes the table and board it seeded.

**It signs in; it never signs up.** Both accounts must exist and be confirmed, which keeps the pool
free of accounts nobody meant to create.

---

## Build order

Each step is a PR, CI-checked, and each is deployable on its own.

**A. The ground floor**

1. Split the stack per environment, bind account and region, name resources per stage.
2. GitHub OIDC role + `cdk diff` on PRs, deploy-to-dev on merge, prod behind approval.
3. `cdk bootstrap` — **needs credentials, so this is yours to run.**

**B. Accounts** 4. HTTP API + Cognito JWT authorizer, with one trivial authenticated route to prove the chain. 5. Telemetry: X-Ray tracing, structured logs, the dashboard and the alarms above. Cold-start
measured and recorded — which is what ended the OpenTelemetry export. 6. Replace `stubAuthProvider` with Cognito in the app; environment configuration for dev vs prod. 7. Link the account screens into Settings — the entry point that has been deliberately absent. 8. Account deletion actually deletes server-side data (App Store 5.1.1(v) — the screen exists, the
deletion does not).

**C. Sync** — ✅ **the server half.** The access patterns, the store, the routes and account
deletion are built, deployed and exercised by hand against dev; the design and the reasoning are in
[SYNC.md](./SYNC.md). ⬜ What is left is the **app** half: the offline queue, the merge, and
somewhere to say that a queued write was refused.

**D. The table** 11. **Close the `table` namespace authorization gate.** A Lambda authorizer on subscribe checking
membership in DynamoDB. Nothing else in D lands before this. 12. The action handler's storage and publishing. 13. The shared clock's real `SessionTransport`, replacing the loopback. 14. Multiplayer table wired to the app; automatic recording into the leaderboard.

**E. Sign-in with Apple and Google** — needs credentials in both consoles, so it goes when you are
back at a machine that has them.

---

## Cost, at the scale this is actually at

At around 1,000 monthly actives with a tenth of them hosting, measured against published pricing:
**$10–28/month**, of which the server side is roughly $0.30–0.40 per hosting user — about 2% of any
plausible subscription price. Observability adds about **$1/month** — seven alarms at $0.10 and a
dashboard — with X-Ray free at this volume. Exporting to Grafana Cloud instead would have added
$3-9/month for the CloudWatch scrape alone, which is what settled it.

### Social sign-in bills on the normal tier — resolved 2026-09-05

This was open, and the difference was $0 against roughly $14/month at 1,000 users. **Sign in with
Apple, Google, Facebook and Amazon count as ordinary user-pool MAUs**, not as federated ones. AWS's
pricing page settles it in a parenthesis:

> There is separate pricing for users who sign in directly with their credentials from a user pool
> **(includes social identity providers)**

So social sign-in draws on the **10,000 free MAU** of Essentials. The separate **50 free MAU, then
$0.015/MAU** applies to SAML and OIDC *enterprise* federation, which this app has no use for.

Both pools are on **`ESSENTIALS`** — AWS's default for a pool created new, and not set in the CDK,
so nothing has to be changed to get this. `aws cognito-idp describe-user-pool --user-pool-id <id>
--query 'UserPool.UserPoolTier'` confirms it.

**The one way to get this wrong is a configuration choice, not a pricing surprise.** Cognito can
add Google *either* as its built-in **Google** provider *or* as a generic **OIDC** provider, and
both work — the login screen is identical. The second bills every user on the 50-MAU federated
tier. So when Apple and Google are added, use the **built-in social provider types**
(`UserPoolIdentityProviderGoogle`, `UserPoolIdentityProviderApple` in CDK) and never
`UserPoolIdentityProviderOidc`, whatever a tutorial says. There is nothing to check afterwards on
the bill until it is already wrong.

## What still cannot be done from here

The bootstrap, the OIDC provider and the first deploys are done, so that list is shorter than it
was. What is left needs an account somebody has to create or a console somebody has to open:

- **Apple and Google sign-in credentials**, and the RevenueCat/App Store/Play console work.
- **Anything needing two physical devices**, which is most of what D is for.
- **Prod.** One `workflow_dispatch` away, and there is no reason to reach for it before the app is
  actually talking to dev.

Everything else — the CDK, the handlers, the app wiring, the tests, the dashboards-as-code — needs
no key, and dev can now be checked against with `npm run smoke`.
