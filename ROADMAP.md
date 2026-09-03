# Roadmap

What's still open, for the next release and beyond. Where an item was already investigated, the
root cause / current state is noted inline so it doesn't need re-discovering — see
[CLAUDE.md](./CLAUDE.md) for the release process and [ARCHITECTURE.md](./ARCHITECTURE.md) for the
full design.

**Completed work does not live here.** Once something ships it's described in
[CHANGELOG.md](./CHANGELOG.md) and the reasoning is in the commit that landed it, so finished items
are removed from this file when a release is cut rather than accumulating as ✅ history.

**Legend:** 🚧 in progress · 🔍 investigated, not yet fixed · 🟡 known gap, accepted · ⬜ not started

## When you are back: the week, in order

Everything below was built while you were away and **none of it has been run by a human**. That is
the whole shape of the week: there is no more code that can be usefully written without somebody at
a keyboard with a phone and an AWS account, and there is a lot that cannot be trusted until there is.

The order matters. Each step is cheap to do and expensive to skip, and the later ones are worthless
if an earlier one is broken.

### 1. Ship 1.2.0, before touching the backend

The release is the thing with a date on it, and the backend is the thing that can wait. Doing them
the other way round means a half-deployed backend competing for attention with an App Store review.

- **Run the manual pass.** ~151 unrun rows in [RELEASE_TESTING.md](./RELEASE_TESTING.md), heaviest
  in _Play a hand_ (64), _Leaderboard_ (49), the blind editor (30) and _Payouts_ (29). §1 billing
  blocks submission and cannot be exercised from a local build at all.
- **Android has seen almost none of this.** Eight features were looked at on an iOS simulator only,
  and simulator synthetic taps do not work here — so **nothing in the new UI has ever been pressed
  by hand on either platform**. Assume the first real tap finds something.
- Then the cutting steps in [CLAUDE.md](./CLAUDE.md): roll the changelog, clear the finished items
  out of this file and reset `RELEASE_TESTING.md`, build and submit from the release branch to the
  **testing track**, promote, merge PR #147, tag the built commit, delete the branch.

### 2. ✅ The backend is standing up

Done, in `096695166445` / `us-east-1`. Bootstrap, `PokerDeployment` (reusing the account's existing
GitHub OIDC provider), `PokerBackend-dev`, the GitHub variables, and the approval environment —
which is named `backend-production`, not `production`, because the latter turned out to belong to
Vercel. Details and the exact outputs are in [`apps/infra/README.md`](./apps/infra/README.md).

**The first deploy did fail**, as predicted, on a missing CloudFormation dependency between the
channel namespace and its authorizer data source — a fault that can only appear on the first deploy
of a fresh environment, and is invisible to `cdk synth`. Fixed with a regression test.

### 3. Then, and only then, the things that need a deployment

1. ✅ **`GET /me` with a real token.** Works, all three ways: the ID token answers 200, an access
   token is refused with `send the id token`, and no token is 401 from the authorizer. The
   `identified` log line and the API access log both appear. Sign-up used a real emailed code, so
   Cognito's email delivery is proven too. **Delete this line when 1.2.0 is cut.**
2. ✅ **The ADOT cold start is measured, and it ended the OpenTelemetry export.** n=6 per function:
   Identity 142.9 → **1889.2 ms**, TableAction 302.0 → **2267.5 ms**, SubscribeAuthorizer
   277.4 → **2160.9 ms**, against a published 50–200 ms. Telemetry now goes through X-Ray
   `Tracing.ACTIVE` instead, at 127.0 / 310.2 / 315.0 ms — within noise of no telemetry at all.
   **Delete this line when 1.2.0 is cut.**
3. ✅ **Observability is AWS-native, and that is the second answer to this question.** Grafana Cloud
   was set up, exported traces successfully, and was removed: the collector cost ~1.9 s of cold
   start on an app where almost every invocation is a cold start, and the CloudWatch scrape needed
   to see API Gateway 5xx and DynamoDB throttles would have cost **$3–9/month against an account
   that spends $0.64** — to copy metrics out of the place they already were. What replaced it:
   X-Ray traces, CloudWatch metrics and logs, seven alarms, and a `poker-<stage>` dashboard built in
   CDK from the alarm definitions so the two cannot drift. **Delete this line when 1.2.0 is cut.**
   - 🟡 **The dashboard is generated, not designed.** An alarm status row over a graph per alarm. It
     is a starting point and will want a real layout once somebody has used it during a game night.
   - The vendor-neutrality argument that originally chose Grafana is recorded in
     [`apps/infra/README.md`](./apps/infra/README.md) decision 2, along with what it would take to
     go back — one layer, one config file, and the esbuild footer that ADOT's handler wrap needs.
4. ✅ **Break something on purpose.** The action handler was pointed at a table it cannot read;
   `ActionErrors` went to `ALARM` about a minute later and emailed, carrying its description.
   Recovery is _not_ `cdk deploy` — that answered "no changes" and left it broken, because
   CloudFormation compares templates rather than live resources. **Delete this line when 1.2.0 is
   cut.**
5. ✅ **The subscribe guard, from the wrong account.** A second signed-in account is refused on the
   shared channel with `not a member of this table`, and on somebody else's private channel by the
   APPSYNC_JS guard. Both are asserted by `npm run smoke -w @poker/infra -- --as-stranger`, so it is
   a check that can be re-run rather than a thing that was once true. **Delete this line when 1.2.0
   is cut.**
6. ⬜ **Resolve the Cognito federated-MAU question** before wiring Apple or Google — $0 against
   roughly $14/month at 1,000 users, and the pricing page names neither provider.

### 4. What is still code, for when you want me building again

Nothing below needs you present once the above is done:

- **The app side of the shared leaderboard** — the offline queue, the merge, and somewhere to say a
  queued write was refused. The server half is built and deployed (see below); this is the half that
  will actually exercise it, and the replay and merge rules are what six review rounds could not
  validate.
- The app side of the table: subscribe, apply events, predict optimistically, reconcile.
- The real `SessionTransport`, replacing the shared clock's loopback — which also needs a `session`
  namespace in the stack, since only `table` and `player` exist.
- Linking the account screens into Settings.
- Sign in with Apple and Google, once the credentials exist.

## Carried over from 1.1.4 — needs verification

- 🟡 **Keep-awake release: verified on Android, still unverified on iOS** (was D11). The screen is
  held while a round counts down and released on pause/stop. The 1.1.4 fix — routing every
  transition through one module-level queue in `apps/mobile/src/hooks/useKeepScreenAwake.ts` —
  **shipped untested and does work**: on an API 35 emulator with a 30s timeout, `FLAG_KEEP_SCREEN_ON`
  goes 0 → 1 on Start and 1 → 0 on both Pause and Reset, and the screen is `Asleep` ~50s after a
  pause. What's left is the same check on iOS, which **can't be done on the Simulator** (it has no
  auto-lock) and so needs a real device.
  - **Measure the flag, don't watch the screen**, and take the reading from a force-stopped
    baseline — a relaunch can restore a _running_ tournament and re-acquire the lock before you
    touch anything, which inverts the meaning of the next tap. See §10 of
    [RELEASE_TESTING.md](./RELEASE_TESTING.md#10-screen-stays-awake).

## Android Play Store listing refresh

- ⬜ **Upload the feature graphic to the Play Console** — the asset exists at
  [`store-assets/android/feature-graphic.png`](./store-assets/android/feature-graphic.png)
  (1024×500, no alpha, generated by `store-assets/android/generate-feature-graphic.js` from the
  colours sampled off the app icon, documented in
  [STORE_LISTING.md](./STORE_LISTING.md#android--google-play-reuse-at-launch--p1-item-4)). What's
  left is the manual console step: upload it and confirm it renders correctly there.
- ⬜ Update Play Store long description / screenshots to reflect current feature set once the
  website/app feature-parity pass (bottom of this list) is done.

## Store assets refresh — screenshots for all platforms & device sizes

- ⬜ Existing App Store / Play Store screenshots predate the cross-device QA pass (tablet layout fix
  for Timer, small-phone spacing fix, Android tablet no longer letterboxed) — capture fresh
  screenshots so the listings reflect what the app actually looks like now, not the pre-fix layouts.
- ⬜ **iOS App Store:** iPhone screenshots (6.9"/6.5" size classes Apple requires) plus iPad
  screenshots (`supportsTablet: true` means the listing needs its own iPad set, not just scaled
  iPhone shots) — capture Timer, Settings, and Paywall on at least one iPhone and one iPad size.
- ⬜ **Google Play:** phone screenshots plus a tablet set (Play Console separates these) — same
  screens, phone and tablet, now that the tablet orientation fix means tablet screenshots will
  actually show the intended side-by-side/centered layouts instead of a letterboxed phone view.
- ⬜ Decide whether to keep hand-picked simulator/emulator screenshots or invest in an automated
  screenshot pipeline (e.g. `fastlane snapshot`/`fastlane frameit`) given how many size
  combinations this now covers (iPhone × iPad × Android phone × Android tablet).

## Cross-device QA

- 🔍 **Physical-device spot-check (small phone + tablet, both platforms) still outstanding** —
  everything so far has been simulators/emulators plus an iPhone 13 Pro and one real Android phone.
- ⬜ **Sheets are capped at tablet width as of 1.2.0 — verify it on a real tablet.** This was the
  🟡 accepted gap in 1.1.4 (`Sheet.tsx` had no tablet-cap logic at all); it now caps at 640 and
  centres. Only checked on an iPad Pro simulator so far, and it was never clear whether Android's
  earlier tablet pass was judged at a capped width or the old full-bleed one, so both platforms
  want a look.
- 🟡 **iPad mini gets the phone layout.** `isTablet` is `width > 768` and an iPad mini (A17 Pro) is
  744×1133pt in portrait, just under it — confirmed by measuring rendered card widths
  pixel-for-pixel. This is how the threshold has always behaved on **both** Timer and Settings, not
  a Timer-specific gap, and changing it also changes Settings' long-shipped behaviour. Verified the
  threshold _does_ fire on a genuinely large tablet (iPad Pro 11", 834pt). If iPad mini should get
  the tablet treatment that's a one-line change in both files — but it's a deliberate call, not a
  bug fix.
- 🔍 **iOS Simulator touch-automation note (tooling limitation, not a product finding):** synthetic
  taps (`cliclick`/`CGEvent`) reliably hit native UIKit chrome (Safari's "Open in App?" handoff, the
  Expo dev-menu's own close button) but were unreliable against RN-rendered app content and the iOS
  notification-permission alert — worked sometimes, not others, no pattern found. Android's
  `adb shell input tap` had no such issue (real HID-level injection). A real device or Xcode's own
  UI-testing driver would sidestep this for iOS.

## Play a hand — known gaps

- 🟡 **Bet sizing is a field with three shortcuts, not a slider.** Any amount between the minimum
  raise and all-in can be typed, with Min / Pot / All in filling it in. A slider would be quicker
  to reach for at a table and is the obvious next step; the field is what makes the sizes reachable
  at all, which was the gap.
- ✅ A game now survives the app being killed as well as navigation, and is validated whole on
  load rather than partially recovered. **Delete this line when 1.2.0 is cut.**
- ✅ **A finished game now asks before it is thrown away.** The prompt hangs off **"New game"**,
  not off the game completing: an alert on completion covers the showdown, which is the one hand
  everybody wants to look at and the reason the table stays drawn. "New game" is also the only
  action that actually loses the night — a finished game survives the app closing and its Save
  button is still there next launch. Saving refuses when the players came from a board that is no
  longer active, and the prompt does not end the game unless the save really happened.
  **Delete this line when 1.2.0 is cut.**
- 🟡 **The deal is not cryptographic.** `Math.random` is passed straight to the engine rather than
  a seeded PRNG, which avoids the brute-forceable 32-bit seed space that `createRandom` warns
  about — but it is still not a cryptographic source. Accepted for a table passing one phone
  around; online play deals on the server, which is where a CSPRNG belongs.

## Accounts — screens built, entry point deliberately absent

- 🚧 **Nothing links to `/account`, and the reason has changed.** The screens are written and wired
  to Cognito — sign up, the emailed confirmation code, sign in, refresh, global sign-out and account
  deletion, with every Cognito error mapped to something a person can act on. **There is now a real
  backend to point them at**: `DEV_BACKEND` in `apps/mobile/src/services/backendConfig.ts` holds
  the live dev user pool, and sign-up/confirm/sign-in have been run against it from a script.
  - What is _not_ done is running them **from the app** — flip `backendConfig` to `DEV_BACKEND`
    locally, open `pokerkit://account`, and walk sign-up → emailed code → sign-in → sign-out →
    delete on a simulator. No dev-client rebuild is needed; nothing native changed.
  - `backendConfig` stays `null` in git deliberately. It is no longer "there is nothing to point
    at" — it is that a shipped 1.2.0 build must not put real accounts in a development pool that
    exists to be thrown away, and `/account` is reachable by URL. It goes to `PROD_BACKEND` when
    prod is deployed and the Settings row lands with it.
  - **No client library.** Cognito's user-pool API is JSON over HTTPS and the calls an app needs
    are unauthenticated in the SigV4 sense, so the request shaping lives in `@poker/core` with
    tests and the app supplies `fetch`. The alternative, `aws-amplify`, brings native modules —
    invalidating every dev-client binary and growing a release binary — to buy SRP. The trade
    taken instead is `USER_PASSWORD_AUTH`: the password crosses inside TLS rather than not at all.
    Switching to SRP later means adding a library and changing one file, because nothing above
    `AuthProvider` knows which is in use.
- ✅ Claiming is built, on the leaderboard's player rows rather than the account screen — that is
  where the names are. Invisible while signed out, so it degrades to nothing rather than to
  something broken. **Delete this line when 1.2.0 is cut.**
- ✅ In-app account deletion is built from the start rather than bolted on, because App Store
  guideline 5.1.1(v) requires it of any app offering account creation. **Delete this line when
  1.2.0 is cut.**

## Shared clock — built, transport absent

- 🚧 **Nothing links to `/session`, because `sessionTransport` is `null`.** The protocol, the join
  code, the screen and the whole send/receive loop are written and were looked at on a simulator
  against an in-process loopback transport. What is missing is a transport that reaches another
  phone: the AppSync Events API is deployed, but it carries only the `table` and `player` namespaces
  — there is no `session` one for a shared clock to publish on. A join code
  nobody else can join is worse than no join code, so the Settings row goes in with the transport —
  one constant in `loopbackSessionTransport.ts` decides it.
- ⬜ **The `session` namespace has no subscribe rule.** Anyone holding a code may watch a clock,
  which is the intended rule, but it still has to be written — and the code is six characters, so
  guessing one is not out of the question. A session carries no cards, so the worst case is a
  stranger watching a countdown; that is why this is not in the gate list below.
- ⬜ **Nothing has been verified between two devices.** Latency, a phone reconnecting mid-round,
  two people pausing at the same moment, and what a locked screen does to a subscription are all
  unexercised — the loopback transport has one clock and no network, so it can prove the wiring and
  nothing about the behaviour. Budget the ~10–12 manual rows scoped for this when a transport lands.

## Backend: groups, players and results — the server half is done

✅ **Shipped to dev in #180.** One DynamoDB table, no index: a group's partition holds the board and
its members, an account's holds its boards and its claims. Sixteen routes, all authorized rather
than merely authenticated. Account deletion releases claims, hands on a group whose last admin is
leaving, and deletes the Cognito user **last** — after which no token exists to retry with.
Design and reasoning in [`apps/infra/SYNC.md`](./apps/infra/SYNC.md). **Delete this line when 1.2.0
is cut.**

- 🟡 **Nothing has ever called it from a phone.** Every route was exercised by hand against dev, but
  no offline queue has replayed against it and no merge has run. Six `/code-review` rounds found
  ~50 issues; the ones most likely to remain are exactly the ones review cannot reach.
- 🟡 **An emptied group is never deleted.** Deciding "nobody else is here" from a read and getting it
  wrong destroys somebody's season, so nothing does. Cleaning them up wants a deliberate sweep.
- ⬜ **Whoever inherits a group has to be told.** Being silently made responsible for a board is
  indistinguishable from a bug, and this is the first thing in the app to need a notification path.
- ⬜ **Invite links need universal links to work from a phone.** `pokerkit://` is owned by the Expo
  dev launcher, so a cold-launch deep link cannot even be tested from a dev client.

## Monetization: Pro keeps the phone, Club buys the hosting — decided

**Pro does not change and nobody who bought it loses anything.** Everything it unlocks runs on the
phone — leaderboard, payouts, dealing a hand, no ads, presets, sound packs — and costs nothing per
person, so none of it moves. There is nothing to migrate either: `club` is a separate RevenueCat
entitlement, so it cannot affect `pro`. No restore edge case, no receipt to rewrite.

**The host pays; guests do not.** This is the decision the feature lives or dies on. An invite that
asks five friends to subscribe to a poker timer is a feature nobody ever uses, and a board costs the
same whether one person is on it or eight. So:

| | Needs |
| --- | --- |
| Your own boards, the leaderboard, payouts, dealing a hand | **Pro** (one-time) |
| Making a board of your own shareable, and inviting people | **Club** (subscription) |
| Joining a board somebody sent you, reading it, recording on it | **nothing** |

A guest joining free has to be able to *see* the board, so **a shared board is visible without
Pro** — `boardIsVisible`. Pro is for keeping your own score; a board somebody else keeps is theirs.
That is also the better funnel: a guest sees what a season of game nights looks like and then wants
one of their own.

**Club grants Pro, and that is a rule rather than a convenience.** A shared board *is* a
leaderboard, and the leaderboard is Pro — so a subscriber without it would host a board they could
not open. Not an awkward state: a broken one, sold deliberately. It is enforced in
`entitlementsFrom` **as well as** in the RevenueCat product, because configuration is one forgotten
checkbox away from shipping exactly that. The reverse does not hold: Pro has never included
hosting.

**Priced at the bottom of the category — decided.** Roughly **€2–3 a month or €12–15 a year**, and
the exact figure is set in the stores. The reasoning is worth keeping, because the market medians
argue for four times that and they are wrong for this app:

- Every serious poker-timer competitor is **one-time**, between $2.99 and $7.99 — NextBlind $7.99,
  PokerTimer $6.99, Texas Holdem "The Works" $5.99, Easy Poker Timer $2.99. The subscription
  outliers charge $9.99–14.99 a month for a timer, which is how an app earns one-star reviews.
- RevenueCat's 2026 utilities medians ($7.99–9.99/month, $30–39.99/year) are set by health, fitness
  and AI apps with far broader appeal. Only ~10% of apps run a hybrid model at all.
- **The server bill was never the reason.** It is pennies now and stays small at ten to fifty times
  this size. The reason to charge is that **you can always stop charging and can never start**: fold
  hosting into Pro and every past and future one-time buyer has it forever, unrevocably. That is an
  argument for charging *something*, not for charging a lot.

**Named for the axis, not the tier.** "Pro+" would say the thing people already bought had been
demoted. "Club" also outlives shared boards: the shared clock and playing a hand together belong to
the same subscription and will not need it renamed.

### The seam is built. What is left is store configuration and one decision.

`ENTITLEMENT_CLUB` is read alongside `pro`, exposed as `hasClub`, and `clubPolicy` in `@poker/core`
holds every rule above — tested, because the mistakes are all of the kind that are invisible in
review and obvious in a store review. **Which boards reach the server is a per-board question**
(`boardSyncs`): a shared board always syncs because the host is paying for it, a local board only
if you host. A board that does not sync is never announced *and* never queues writes.

- ⬜ **Create both subscription SKUs** — `club_monthly` and `club_yearly` — in both stores, then the
  `club` entitlement in RevenueCat with **`pro` attached to the same products**. Two SKUs because
  the annual price is decided; one because somebody read a doc that only mentioned the monthly one.
  **Both stores or neither.**
- ⬜ **A way to buy it, and any way at all to hear about it.** `purchasePro` buys the one-time
  unlock and nothing buys this. **Club currently has no surface in the app whatsoever**: the share
  button is hidden once the store confirms there is no subscription, so a non-subscriber never
  learns the feature exists. That is right while it cannot be bought — advertising an unbuyable
  product is worse — and it becomes wrong the moment it can. The paywall needs a second offering,
  which cannot be built honestly until there is a price.
- ⬜ **Sharing cannot be tested from a normal build until then.** Nothing grants `club`, so a build
  pointed at `DEV_BACKEND` announces no board, queues no write and shows no share button — silently
  and correctly. Set `FORCE_PRO_IN_DEV` in `PremiumContext`, which forces both entitlements, to run
  the sharing rows in `RELEASE_TESTING.md`. Worth knowing before somebody concludes sync is broken.
- ⬜ **Billing rows in `RELEASE_TESTING.md`** — purchase, restore, cancel and **expiry**, which the
  one-time product never had.
### What a lapsed subscriber keeps — decided

**Pro, once granted by Club, stays granted.** Somebody who subscribed and later stopped keeps the
leaderboard, their own boards and everything else Pro unlocks, forever. They lose **hosting**: they
cannot share a board or make a new one shareable. Read from the receipt (`entitlements.all`, not
`active`), so it survives a reinstall — a flag on the device would not, and then it would mean
nothing.

The alternative was that they become a free user again, which is coherent — losing Pro means losing
the leaderboard, and that is what Pro is — but it takes the sight of every board they own while
those boards carry on syncing for the members still reading them. Nothing is destroyed and it all
returns on resubscribing, but somebody would reasonably call that the app eating their season.

- 🟡 **The consequence: one month of Club is a permanent Pro.** So the monthly price has to be worth
  at least what Pro costs, or subscribing and cancelling is simply the cheaper way to buy Pro. With
  Pro around €5–6 and the monthly at €2–3, it *is* cheaper — **that is a live pricing decision, not
  a bug**. Either set the monthly at or above the Pro price, or accept the leak on the grounds that
  somebody doing it has still paid and probably was not going to buy Pro anyway. Worth settling
  before the products are created rather than after.

Guests are unaffected either way. They never paid.
- **Not before 1.2.0 ships.** §1 billing already blocks submission and can only be exercised from a
  Play track; a second product makes that pole longer.

## Backend: the plan

The architecture, the observability design, environments and deploys, the cost model and the build
order are in [`apps/infra/README.md`](./apps/infra/README.md). Decided: an **HTTP API + Lambda** for
requests with AppSync Events for push, **OpenTelemetry to Grafana Cloud** with CloudWatch scraped
for what OTel cannot see from inside a function, **two stacks in one account** deployed by GitHub
Actions over OIDC, and **accounts end-to-end as the first deployable slice**.

## Backend: before anything connects to it

- ⬜ **No route creates a table.** A table is created by a game starting and the app side of that is
  unbuilt, so `POST /tables/{id}/actions` answers `404 no such table` until a row exists. Not a bug
  — it is the next thing to build in D — but it is why `apps/infra/scripts/smoke.ts` seeds a table
  into DynamoDB directly, and why nothing can exercise the table from the app yet.

- ✅ **The shared `table` channel is authorized on subscribe.** A Lambda reads the table's
  membership and refuses anybody not at it; the private `/player/…` channels keep their APPSYNC_JS
  guard, which needs no I/O. Every other branch refuses too — a malformed channel, a table that
  does not exist, a read that throws, a caller with no subject — and they all refuse with the same
  message, so a caller learns whether they are a member and nothing else. **Delete this line when
  1.2.0 is cut.**
- ✅ **The action handler stores and publishes.** Reads the table, runs the rules, writes back on a
  version check, then publishes — in that order, because publishing first announces a hand that
  might not be stored. **Delete this line when 1.2.0 is cut.**
- ⬜ **Cognito's built-in email cannot go to production, and confirmation codes land in spam.**
  Both test sign-ups delivered, and **both went to the spam folder** — `no-reply@verificationemail.com`
  is AWS's shared sender, so nothing authenticates the mail as coming from this app. A confirmation
  code in spam is a sign-up that silently fails: the person is told to check their email, the email
  is not in their inbox, and there is nothing in the app that can tell them why.
  - The harder limit is separate and absolute: **Cognito's default email is capped at 50 messages a
    day**, per account, with no way to raise it. That is a cap on _sign-ups per day_ across the
    whole app, so it blocks launch on its own rather than merely degrading.
  - The fix for both is the same — `UserPoolEmail.withSES()` against a verified domain with SPF,
    DKIM and DMARC, which is what makes the mail authenticate and land in an inbox. It needs a
    domain and DNS records, so it is a credential-bearing step like Apple and Google below.
  - **Worth doing before any real user signs up, and it costs nothing to defer until then**: dev is
    fine on the built-in sender now that it is known where the mail goes.
- ⬜ **Account deletion has to become server-side, and the ordering is the whole problem.** Today
  the app calls Cognito's `DeleteUser` directly with its own access token, and that is _correct for
  now_: the only thing this backend writes is one `TABLE#<id>/STATE` item carrying `members: [sub]`,
  on a 24-hour TTL, so a deleted account leaves behind something that deletes itself by tomorrow.
  Nothing durable is keyed by an account yet.
  - **It stops being correct the moment groups, players and results land** (section C below), which
    is the first durable per-account data. Deletion must land **in the same pull request**, because
    the alternative is a period where the store requirement is live and unmet.
  - **The trap: once the Cognito user is gone, the client has no valid token**, so it cannot
    authenticate a cleanup call afterwards. That makes this a _replacement_ of the current seam
    rather than an addition — a `DELETE /me` route that removes the data first and the user second,
    server-side, with `AdminDeleteUser`. Getting it the other way round leaves orphaned rows nobody
    holds a credential for.
  - Make the data half idempotent and retryable: if the user delete fails after the data is gone,
    the account has to be deletable again on a second attempt rather than wedged.
- ⬜ **Sign in with Apple and Google.** Both need real client ids and secrets, and App Store
  guideline 4.8 requires Sign in with Apple alongside any other third-party provider — so they are
  a credential-bearing decision rather than something to scaffold with placeholders.
- 🔍 **Cognito's federated-MAU pricing is unresolved.** Users arriving via a SAML/OIDC provider bill
  on a separate free tier of 50 MAU and then $0.015/MAU, against 10,000 free on Essentials. Whether
  Apple and Google land in the normal tier or that one is the difference between $0 and ~$14/month
  at 1,000 users, and the pricing page names neither. Confirm against the docs or a throwaway pool
  before committing to the design.

## Apple Watch companion app

- ⬜ **Confirmed: no watch code exists in this repo currently** — no watchOS target under
  `apps/mobile/ios`, no `WatchConnectivity`/`WCSession`/`WKExtension` references anywhere in app
  code (only unrelated matches inside `Pods/`). Any earlier experiment either lived elsewhere or
  was never committed — this is a from-scratch build, not a resume.
- ⬜ Add a watchOS target/extension to the Xcode project (`apps/mobile/ios`), committed like the
  rest of the bare-workflow iOS project.
- ⬜ Sync running timer state (remaining time, current blind level, small/big blind, paused state)
  from phone to watch — likely via `WatchConnectivity` (`WCSession`), given the phone app already
  has a `LiveActivityService` tracking this exact state.
- ⬜ Auto-launch/activate the watch app when the timer starts on the phone.
- ⬜ Watch UI: remaining time + current blind level, readable at a glance (matching the "big,
  glanceable" design language used elsewhere in the app).
- ⬜ Decide packaging: framework-agnostic timer/blind math can be shared conceptually with
  `@poker/core`, but Swift/watchOS code itself stays in `apps/mobile/ios` per the
  platform-code-stays-in-the-app rule in [CLAUDE.md](./CLAUDE.md) — `@poker/core` has no Swift
  interop story.

## Pro feature: Leaderboard

- ✅ **Shipped in 1.2.0** (unreleased). Local-first, single-device, no accounts — the host's phone
  is the source of truth. Recording is manual but pre-filled from the payout setup; the timer offers
  to record when a game looks finished. Ranked by wins with a deterministic tie-break; shows prize
  money won rather than net profit — a bounty settled by hand can't be reconstructed after the fact,
  though one from a game the app dealt is counted.
  Standings can be shared to a group chat as plain text.
  The design questions this entry used to carry are answered in the changelog entry and the commits.
  **Delete this section when 1.2.0 is cut** (cutting step 3).

## Pro feature: Buy-in & payout structure

- ✅ **Shipped in 1.2.0** (unreleased). Flat bounties carved out of the buy-in rather than added on
  top; rebuys counted as further buy-ins and add-ons as pool-only money; payouts rounded to a chosen
  note size with the largest-remainder method, so the table sums to the pool exactly and no paid
  place ever wins nothing. A chop calculator splits the money left when the table agrees to end
  early, and the table can be shared to a group chat.
  Flat bounties are now _paid_ as well as priced, for a game the app dealt: it tracks who knocked
  whom out, so the leaderboard can count knockouts and put the money in the total.
  **Progressive bounties are in too**, on top of that tracking: half of each bounty is paid in cash
  and half moves onto the winner's head, with the last player standing collecting their own. Flat
  stays the default.
  **Delete this section when 1.2.0 is cut** (cutting step 3).
- ⬜ **ICM as a second chop method.** The shipped chop is chip-count based with a guaranteed floor,
  which is what home games agree to and is explainable in one sentence. ICM is the method serious
  players ask for by name and nobody can call unfair; it needs recursive finish-order equity, which
  is cheap at six players or fewer. Offered during 1.2.0 scoping and deliberately not taken, so this
  is a real option rather than an oversight.

## Website and store copy — written, waiting on the release

- 🚧 **PR #155 now targets `release/1.2.0`, so it ships when the app does.** The page advertises
  payouts, the chop, the leaderboard, groups, dealing a hand and sharing — none of it downloadable
  yet — and pushing to `main` deploys the site immediately. Retargeting means the RC merge at
  cutting step 8 is the deploy, which removes the standing promise to remember to merge it
  "alongside the submission". Recorded as a carve-out in CLAUDE.md; a web _fix_ still goes straight
  to `main`.
  - The landing page also gains a **Contact** link, which closes the old question about the contact
    address: `poker.blinds.buzzer@gmail.com` is right, and it lived in exactly one place
    (`privacy-policy/page.tsx`). Both pages now read one shared constant.
- ⬜ **Console work: paste the updated store copy in.** Both long descriptions and the
  `pro_lifetime` name/description are rewritten in [STORE_LISTING.md](./STORE_LISTING.md); what's
  left is entering them in App Store Connect and Play Console, and counting the fields there rather
  than trusting the counts in the file.

## Minor cleanups

- ⬜ **No `target` is set in `tsconfig.base.json`, so TypeScript compiles as ES5.** That makes
  `for (const x of someSet)` and `[...map.values()]` compile errors anywhere in the monorepo —
  `standings.ts` hit it and had to be written around. Vitest transpiles such code happily, so the
  suite passes while `tsc` fails, which is a confusing way to find out. Setting an explicit modern
  target would remove the trap, but it changes output for web and mobile alike, so it wants its own
  PR and its own verification rather than riding along with feature work.
- ⬜ **Leaderboard dates use `toLocaleDateString()`**, and Hermes' Intl support on Android is
  uneven — the format may differ from iOS or from what the locale implies. It won't crash. If it
  reads badly on a device, a fixed format is the fallback.
- ⬜ **`prettier --check` fails on files nobody touched** (e.g. `soundPackStorage.ts`), so it's
  version drift rather than a formatting regression. Nothing in CI runs it. Either pin prettier at
  the root and reformat once, deliberately, or drop the expectation that it passes — the current
  state means "prettier says no" carries no information.

## Android notification permission: no recovery path once blocked

- ✅ **There is a way back now.** `NotificationsBlockedCard` sits at the top of Settings whenever
  Android reports the permission denied, explains that the background timer cannot fire, and opens
  system settings; it re-checks on every foreground so it disappears the moment the permission is
  granted. Android-only and invisible otherwise. **Delete this line when 1.2.0 is cut.**
  - `showPermissionAlert` in `useNotificationPermission` **is finally called** — by the card, as the
    fallback when a request returns without showing anything, which is the permanently-blocked case
    it was written for. **Do not delete it with the rest of this section**: it is the only route to
    `Linking.openSettings()` for a user Android will not prompt again.
- The state it exists for is reachable: Android permanently blocks `POST_NOTIFICATIONS` after a
  second denial, after which every `PermissionsAndroid.request` returns `never_ask_again`
  immediately with no dialog. `ForegroundServiceModule.startService` then rejects with
  `PERMISSION_DENIED`, `LiveActivityService.isEnabled()` is false forever, and the background timer
  notification and its expiry alarm silently never fire. The app's only reaction is a `logger.warn`.
- **Not caused by dropping the permission rationale**, though that made the blocked state easier to
  reach. RN's rationale alert resolved `DENIED` in JS without calling the OS when the user picked
  "Cancel"/"Ask Me Later", so it burned no denial on _that_ path — but a user who tapped OK and then
  denied hit the same block, and everyone paid a permanent double dialog for the partial protection.
- **Not a launch-time modal**, which was the obvious idea and the wrong one: a blocked user would
  meet it on every cold launch, since the request returns instantly. A card in Settings is seen when
  somebody goes looking for why the timer is quiet, and is invisible the rest of the time. It is not
  dismissible either — dismissal is what an unwanted interruption needs, and hiding this would take
  away the only route back.

## Parked: Live Activity / foreground service controls

> **Descoped in 1.1.4, before ever shipping.** Pause/Resume/Stop buttons were built on both the
> Android foreground-service notification and the iOS Live Activity/Dynamic Island, then removed.
> Both surfaces remain, display-only — which is what they shipped as before, so nothing regressed
> for users. This entry is kept for whoever picks the idea back up; it is not a description of the
> current app, and it is not planned work.
>
> **What forced it.** The device pass found Pause setting the timer to 0:00, and Resume then jumping
> to a full round _and_ firing the "time's up" notification immediately. Resume's behaviour is
> downstream of Pause's: a stored `timeLeft` of 0 takes the `timeLeft > 0 ? timeLeft : timerDuration`
> fallback and reports `wasExpired`, which advances a blind level and reschedules the alert with a
> non-positive delay.
>
> **Best hypothesis for the zero, untested.** `TimerActionButtons(paused: paused || isExpired)` was
> evaluated at _render_ time, and WidgetKit does not re-render the Lock Screen view as the countdown
> runs — `Text(timerInterval:)` animates without one. So after expiry the button still read "Pause",
> and `state.timeLeft = max(0, state.timeRemaining)` on a negative remaining stores 0. An earlier
> Simulator sighting of the same class of failure was written off as Simulator flakiness; it
> reproduced on real hardware.
>
> **Why removal rather than a fix.** The buttons exist to let something _other than the app_ write
> timer state, and everything expensive here follows from that: an intent running in the widget
> extension's own process, an App Group write, a Darwin notification, a live JS event, a persisted
> snapshot reconciled against AsyncStorage in a specific order on next foreground, and a `wasExpired`
> flag so the widget can ask the app to do the level maths it can't. Four rounds of device debugging
> went into making that pipeline work and it still shipped broken. With the buttons gone the app is
> the sole writer of timer state, which is also the premise the backgrounded-expiry rule now rests
> on.
>
> **Kept on purpose:** the App Group entitlement (`group.com.toondeboer.pokerkit`) in `app.json` and
> both `.entitlements` files. Nothing reads it now. It stayed because removing an entitlement changes
> code signing on a release that's mid-submission-cycle, for no user-visible gain, and it's exactly
> what the buttons would need on the way back.
>
> **Known platform limits, if revisiting:** iOS Live Activity buttons go dead after the user
> force-quits the app (Apple refuses to run any of an app's App Intents until it's manually reopened
> — no API to override it), and neither native surface can advance the blind level on its own, since
> blind-level math lives in `@poker/core` by design.
>
> **Where to start:** confirm the stale-render hypothesis, with Console.app on a device filtered to
> subsystem `com.toondeboer.pokerkit` — the diagnostic `os.Logger` calls were in the deleted
> `TimerActionIntents.swift` and are worth restoring before anything else. A fix that doesn't depend
> on render-time freshness (deriving the action from the Activity's own state inside `perform()`,
> accepting that it may disagree with what was tapped) is the shape to try. The full build history
> is in git — the commits that added and then removed these buttons.
