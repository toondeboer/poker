# Before 1.2.0 ships — review, learning plan and testing order

Prepared from `release/1.2.0` at `9dc022c` (4 September 2026), against PR #147.

Web version: https://claude.ai/code/artifact/74b32c66-6eab-4575-bfcc-edfed1c8ca0b

The release: **73 commits, 69 merged PRs, 12 days, 234 files, +46,607 / −6,164 lines.**
386 unchecked cells in `RELEASE_TESTING.md`.

---

## 1. What was verified, and what was not

Clean install of the release branch, then the same commands CI runs. All green:

| Check | Result | Detail |
|---|---|---|
| `npm run test` | pass | 1,305 tests / 69 files — 989 in `@poker/core`, 316 in `@poker/infra` |
| Coverage | 99.1% | statements in core; 97.2% branches, threshold enforced in CI |
| `npm run typecheck` | pass | 4 workspaces, zero errors |
| `npm run lint` | pass | 0 errors, 8 warnings (7 `exhaustive-deps`, 1 stale eslint-disable) |
| Secret scan | clean | no AWS keys, tokens or private keys in any tracked file |
| Lambda IAM | tight | subscribe authorizer read-only; `AdminDeleteUser` scoped to the one pool |
| CI coverage | yes | `on: pull_request` is unfiltered, so all 69 PRs into the branch were checked |

**Not verified, and it matters:**

- **No AWS credentials in that session.** Every claim about what is *deployed* — here and in the
  repo's docs — is a claim about intent, not an observation.
- **No devices.** The 386 open cells exist because unit tests cannot see rendering, notifications,
  billing or cold launch.
- **The tests share an author with the code.** 99% coverage means every line runs, not that every
  line is right.

Overall: this is careful work — reasoning written down, failure modes named, guards that fail
closed, and one commit (#201) that is a self-review finding thirteen real bugs. But it has never
been run by a person on a phone, and three things are out of step.

---

## 2. Three blockers, before any device

### B1 — Production may be running Lambda code that predates a security fix

Prod was stood up in #199/#200 on 4 Sep. **Two commits then changed deployable code:**

| PR | Changed | Why it matters in prod |
|---|---|---|
| #201 | `tableAction.ts`, `tablePublisher.ts` | **Information disclosure.** The action handler read `members` and never consulted it, so any signed-in account holding a table id learned whether it existed, its live version, and the Cognito subject of whoever was to act. Sign-up is open, so "signed in" is anybody. |
| #202 | `observability.ts`, `pokerStack.ts` | Scoped each stage's budget to its own `billingScope` tag. Before it, the prod budget forecast the whole AWS account. |

The README — written in #203, *after* #202 — still says "`poker-prod` keeps forecasting the whole
account until prod is next deployed."

```bash
aws cloudformation describe-stacks --stack-name PokerBackend-prod \
  --query 'Stacks[0].{Updated:LastUpdatedTime,Status:StackStatus}'

# authoritative: an empty diff means prod matches this branch
npm run diff -w @poker/infra -- PokerBackend-prod \
  -c account=096695166445 -c region=us-east-1
```

Fix: Actions → Infra → Run workflow → `prod`, approve the `backend-production` gate. Do it before
any §14–§17 testing.

### B2 — Running the test pass as checked out writes into production

`9dc022c` flipped `backendConfig` from `null` to `PROD_BACKEND`. Three docs still describe the old
world:

| Document | Still says | Status |
|---|---|---|
| `RELEASE_TESTING.md` §0 | "ships as `null`, so accounts and sharing are absent" | fixed in PR #205, **unmerged** |
| `ARCHITECTURE.md:115` | "nothing in the app calls any of it… `backendConfig` is `null` on purpose" | **not fixed anywhere** |
| `ARCHITECTURE.md:13,33` | "Deployed to a dev environment; nothing in the app calls it" / "(not deployed)" | **not fixed anywhere** |

The consequence inverted: §14–§17 used to pass by being invisible; now a pass run as checked out
creates real accounts, boards and games in the production pool, which today holds zero.

Merge #205 first, then fix `ARCHITECTURE.md` (#205 does not touch it). Point at dev for the pass,
and make this the habit before `eas build`:

```bash
git diff apps/mobile/src/services/backendConfig.ts   # must print nothing
```

### B3 — The Club subscription does not exist in either store

ROADMAP step 4, unstarted, while 1–3 are done. Blocks §15 (32 cells) and §16 (14 cells) behind
`FORCE_PRO_IN_DEV`, which proves the UI and nothing about billing. A further **16 cells are blocked
outright** until the build is on a store track. Create the products today — a paywall offering a
product that does not exist is a dead feature and a store-review rejection.

---

## 3. What is running on the AWS account

Account `096695166445`, `us-east-1`. `PokerBackend-dev`, `PokerBackend-prod`, `PokerDeployment`.

All serverless and pay-per-use — no always-on compute, no NAT gateway, no provisioned capacity.
Estimate in the repo: **$10–28/month at ~1,000 MAU**; pennies at zero users.

| Resource | Billing | Runaway risk |
|---|---|---|
| HTTP API + 5 Lambdas | per request | Capped — 50 req/s, 100 burst |
| DynamoDB single table | on-demand | Bounded by the API throttle |
| Cognito | per MAU | 10,000 free; open sign-up |
| AppSync Events | connection-minutes + messages | **Not behind the HTTP throttle**; subscribe is authorized, connect is any signed-in account |
| SES | per email | Open sign-up means anybody can make you send mail |
| CloudWatch (7 alarms, dashboard, X-Ray) | flat-ish | ≈ $1/month |

The throttle is **per route, shared by everybody** — one client in a retry loop 429s every player at
every table. It protects the bill, not availability. Documented fix is a WAF rate rule, ~$5/month.

### The budget alert does not currently alert

Each stage has a $25 budget filtered on `billingScope`, but that tag has **not been activated** as a
cost allocation tag — so the filter matches nothing and the budget never fires. Fails safe, but it
is not a safety net.

```bash
aws ce update-cost-allocation-tags-status \
  --cost-allocation-tags-status TagKey=billingScope,Status=Active
aws ce list-cost-allocation-tags --status Active --output table
```

Activation is **not retroactive** — do it while prod is still empty. Also confirm the SNS
subscription email was clicked, or all seven prod alarms fire into nothing.

### The dev deploy role trusts any ref of a public repository

Not flagged anywhere in the repo. The repo is public and forkable.

```
prod → repo:toondeboer/poker:environment:production   # gated on approval
dev  → repo:toondeboer/poker:*                        # any ref, any event
```

Both roles then get the *same* policy: `sts:AssumeRole` on `cdk-hnb659fds-*-role-<account>-*`. Those
CDK bootstrap roles are not scoped per stack — they can deploy any stack in the account. So the
production environment gate is a gate on the workflow, not a boundary in IAM.

What holds it shut today is a GitHub platform behaviour (fork PRs are not granted
`id-token: write`), not the trust policy. Worth confirming rather than assuming. Real mitigation
that *is* in the code: prod carries `deletionProtection` and `RemovalPolicy.RETAIN`.

Worth doing, not urgent: narrow the dev subject from `:*` to specific refs in `subjectFor`.

---

## 4. Reading the codebase in four layers

46,607 added lines is not readable linearly, and commit order means watching decisions get made and
unmade. ~1 day for all four; L1 and L3 are the ones that pay.

### L1 — The four documents, in this order (~90 min)

1. `ARCHITECTURE.md` — the shape, plus two Mermaid diagrams worth the file. Ignore the stale lines.
2. `apps/infra/SYNC.md` — the DynamoDB schema, the first version, why it was replaced. Densest thing here.
3. `apps/infra/README.md` — "The four decisions", "What only a deploy could tell us", the runbook.
4. `CHANGELOG.md` `[Unreleased]` — the user-facing diff of the release.

> Can you say, without looking, why membership is written under both the group and the account —
> and what breaks if it were written once?

### L2 — The backend, by tracing one request (~2 hrs)

Don't read `pokerStack.ts` top to bottom. Follow one action from phone to phone:

- `lib/pokerStack.ts` lines 560–745 — API, Cognito authorizer, the deliberately-public `/config`
- `lib/lambda/tableAction.ts` — the only writer; read the version check
- `lib/lambda/tablePublisher.ts` — `publicView` vs `privateView`, where hole cards get stripped
- `lib/lambda/subscribeAuthorizer.ts` — 150 lines, the best file in the repo, every branch fails closed
- `packages/core/src/realtime/channels.ts` — both sides build channel paths from here, on purpose

> Why is the private-channel guard an AppSync JS resolver while the shared-table guard has to be a
> Lambda? The answer is the first paragraph of the authorizer, and it explains the security model.

### L3 — The offline queue: the genuinely unproven part (~2 hrs)

**Spend your scepticism here.** Everything else is either curl-verified or pure logic at 99%
coverage. The repo says it itself: "what is proven is that the routes answer correctly to a person
with curl."

- `packages/core/src/sync/pendingWrites.ts` (412 lines) — what retries, what is refused permanently
- `packages/core/src/sync/mergeBoard.ts` (246) — what wins when server and phone disagree
- `packages/core/src/sync/drain.ts` — when the queue replays
- `apps/mobile/src/hooks/useGroupSync.ts` — where all three meet the UI

Three of #201's thirteen findings were here, including a deleted board that came back forever
because a spread was rewritten field by field. Hunt that class: silent data loss on a path a unit
test can assert is working.

> Record a game in airplane mode, force-quit, fly, land, open the app. Trace the exact path. Where
> could it be recorded twice?

### L4 — The poker engine (~1 hr, optional)

Pure reducers, no clock/network/screen — which is why the same code runs on the phone and in a
Lambda. `cards → evaluate → handValue`, then `bettingRound → pots`, then `table → session`. Skip
this layer if short on time: well-tested, entirely pure, and a bug in it is loud.

---

## 5. Tomorrow, in order

**386 cells is not one day** — closer to three or four. Triage: new, risky and irreversible first;
the mature 1.1.x surfaces last.

**Setup (~1 hr)** — clear B1/B2/B3; activate the cost tag; confirm the alarm email. Then two devices
on a dev-pointed build: `backendConfig = DEV_BACKEND` (uncommitted), `FORCE_PRO_IN_DEV` on,
`npm run pods -w @poker/mobile`, rebuild the dev client on **both** platforms — native modules moved
this release and a stale dev client red-screens at runtime with nothing at build time to warn you.

**Day 1 — the new surface**
- **§14 Accounts (26)** — never once run from the app. The row the release rests on: sign up with a
  real address and have the code arrive in the inbox, not spam. Then the password-reset row, which
  proves real sign-up sets `email_verified`.
- **§17 Kill switch (8)** — run against **prod**. Small, fast, and an untested switch is worse than
  none. Include the airplane-mode row: unreachable must read as off, not as a queue.
- **§15 Shared boards (32)** — two devices, one row needs three. Prioritise the four rows about
  *losing* things: record with no signal then reconnect; a local delete that stays deleted; a board
  deleted locally not re-added by sync; a rename that does not revert.
- **§16 Club/Pro (14)** — one question: is anybody told to buy something they already own?

**Day 2 — §13 Play a hand (75, largest and entirely new UI), §12 Leaderboard (49), §11 Payouts (29).**

**Day 3 — §1–§10.** Android has seen almost none of this release; assume the first real Android tap
finds something. §10 on iOS still needs a real device.

**Then the store** — `git diff` on `backendConfig.ts` empty, build from the release branch,
`npm run eas:submit -w @poker/mobile` (passes `--profile internal`). **Never a bare `eas submit`** —
with no profile it silently uses the profile *named* `production`, which is how 1.1.4 reached Play
production with its billing rows never run. Then the 16 blocked cells; keep managed publishing on.

---

## 6. Reviewing from here

Not reading every diff — at 69 PRs in 12 days you would never catch up. Knowing which diffs deserve
the reading.

**Read the claim, then check the claim.** The commit messages are unusually good, which is a risk as
well as a gift: a confident explanation is persuasive whether or not it is true. #204 says the pool
ids came from `describe-stacks` rather than being copied — exactly right, and still a claim in a
commit message. Every commit saying "verified against the live stack" is worth two minutes with the
console, because those are the ones CI cannot check.

**Distrust the boundary between the code and the world.** Everything wrong in this RC is there: docs
describing a previous reality, a stack deployed before its last fix, a budget whose filter matches
nothing, a product that does not exist. None of it is a code bug; none could be caught by a test.

**Ask what a change makes impossible.** The best decisions here removed a class of mistake rather
than fixing an instance — one seat per board is a key collision not a check; the API authenticates
by default so a public route is a deliberate act; every branch of the subscribe guard returns a
refusal so nothing succeeds by running out of reasons to say no.

**Keep the honest gaps honest.** The docs are unusually good at recording what is *not* proven. The
failure mode is a doc quietly ageing into a lie — which is exactly B2. Update the file in the same
sitting as the test.

### Where to push back

Two decisions worth making consciously rather than inheriting:

- **Deleting the Maestro e2e suite** in the same release that added a backend, an offline queue and
  multiplayer. Defensible on its own terms — it had rotted, CI would have been slow — but 1.2.0's
  riskiest code now has no automated end-to-end coverage, and the manual pass is the only thing
  standing there.
- **One AWS account for both stages.** Right at this size, but the CDK bootstrap roles make it a
  softer boundary than the two stack names suggest.

Neither is wrong. Both should be your decision rather than a default you adopted.
