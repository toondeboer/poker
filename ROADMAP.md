# Roadmap

What's still open, for the next release and beyond. Where an item was already investigated, the
root cause / current state is noted inline so it doesn't need re-discovering — see
[CLAUDE.md](./CLAUDE.md) for the release process and [ARCHITECTURE.md](./ARCHITECTURE.md) for the
full design.

**Completed work does not live here.** Once something ships it's described in
[CHANGELOG.md](./CHANGELOG.md) and the reasoning is in the commit that landed it, so finished items
are removed from this file when a release is cut rather than accumulating as ✅ history. **The
exceptions are decision records** — the rating evidence and the monetization rules below — which
stay because code and other docs cite them.

**Legend:** 🚧 in progress · 🔍 investigated, not yet fixed · 🟡 known gap, accepted · ⬜ not started · ✅ met (decision records only)

## 1.2.2 — scope decided 2026-11-26

Kept lean so the full-screen ads start earning (they only do once they are in the stores):

- ✅ **Full-screen ads at every round change** — #346, on `main`.
- ⬜ **The round-end alert says rounds ran out "while the app was closed" when an ad was open.** An
  ad left open longer than a whole round triggers the missed-rounds wording; the app was not closed.
- ⬜ **Blinds back to level 1 after recording a game** — the first item under _Carried into 1.2.2_.
- ✅ **CI on `release/**` pushes** — `ci.yml` now runs on pushes to `release/**` (tooling, on `main`).

Sentry moved to 1.2.3 (see _Monitoring_).

## Carried into 1.2.2 — still open from the 1.2.0 release review

- ⬜ **Recording a game does not start a new one — the blinds stay where they were.** Raised while
  running §12 on TestFlight build 30, as a question: reset only re-clocks the round, so after a
  tournament ends on level 12 the next one starts on level 12.

  **Reset's behaviour is right and should not change.** A blinds timer has no "tournament over"
  button, and a host who resets to re-clock a level after an interruption must not lose their place
  in the structure — that would be destructive with no undo. `useEndOfGamePrompt.ts` says as much,
  and the end-of-game prompt is built on exactly that reasoning: resetting _after progressing_ is
  the closest honest proxy for a finished game.

  **The seam is one step later.** Tapping **Record** and completing the sheet is the only
  unambiguous "this game is over" signal the app has — the host has just said so in as many words.
  That is the moment where returning the blinds to level 1 is both safe and expected, and nothing
  does it. So the app asks whether the game finished, is told yes, and then leaves the next game
  starting mid-structure.

  Not changed in 1.2.0: it is timer behaviour reached through the leaderboard, so it would reopen
  rows in both §2 and §12 that the pass has already closed. Worth deciding properly rather than
  late.

  A side effect worth keeping in mind for the next pass: §12's _"resetting on level 1 does not
  prompt"_ row cannot be reached by resetting at all — you have to navigate back to level 1 by hand
  first.

- ⬜ **There is no password reset, and this file assumed there was.** Found on the 1.2.0 TestFlight
  pass of §14, by looking for the button. `cognitoAuthProvider` has no `forgotPassword` or
  `confirmForgotPassword`, `AuthContext` does not expose one, and no screen offers it — while the
  sign-in decision record below says "Password reset stays SES's job". It was intended and never
  built, which is why the checklist row expected it.

  **Bounded by the linking case.** Signing in with a provider on the _same address_ returns you to
  the _same_ account, so anyone whose address is a Google or Apple account already has a way back
  in. The genuinely locked-out case is an address that is neither, with a forgotten password — and
  email/password is the deliberate fallback path, not the primary one.

  **Accepted for 1.2.0**: nobody is at risk on the day it ships, and two new Cognito calls plus a
  screen and its error states is new surface in a candidate whose pass is nearly finished. When it
  is built, mind that an account confirmed administratively is `email_verified: false` and Cognito
  will refuse to send to it at all — a failure that reads exactly like broken mail.

- ⬜ **Swipe-back does nothing in the blind editor while a draft is unapplied (iOS).** The 1.2.0 fix
  for D6 turns the gesture off rather than making it work: `useUnsavedChangesGuard` sets
  `gestureEnabled: false` whenever the guard is armed, so on iOS the header back button becomes the
  only way out. Verified on candidate 5 — the screen can always be reopened now, which is what D6
  was about — but a gesture that silently does nothing is a stopgap, not the finished behaviour.

  **Why `beforeRemove` alone was not enough.** It works cleanly for a plain back event and not for
  an interactive gesture: by the time the listener runs the swipe has already begun committing, and
  re-dispatching its action after the screen springs back leaves the navigator's current route out
  of step with what is on screen. That is what made the editor unreachable — pushing it read as
  already-current and did nothing, with no error. Android is unaffected either way, since its back
  is an event with no gesture in flight.

  **What "working" should mean in 1.2.1:** swiping back with unapplied changes raises the same
  Apply / Discard / Keep editing dialog the header button does, and the screen springs back intact
  if the choice is to keep editing. The likely route is `usePreventRemove` from React Navigation,
  which is the supported replacement for the `beforeRemove` + `preventDefault` pattern and is meant
  to handle the interactive case — it ships inside
  `expo-router/build/react-navigation/core` and is not re-exported publicly, so reaching it needs
  care. Worth confirming against the gesture on a device before believing it; this is exactly the
  class of thing that looks right in a simulator.

- 🟡 **A Live Activity outlives the round that started it, and there is no Stop control.** Found on
  the 1.2.0 TestFlight pass of §6. Reset leaves the card on the Lock Screen, and there is no Stop
  button anywhere to clear it — swiping it away by hand is the only way. **Accepted for 1.2.0**: a
  stale card is untidy rather than misleading, since it stops counting, and the cost of dismissing
  it is one swipe.

  Worth pairing with the existing decision that the Live Activity carries **no Pause/Resume/Stop
  buttons** — that was built and then pulled, and this is the other half of the same gap: nothing on
  the card controls the timer, and nothing in the app clears the card.

- ⬜ **There is no "notifications are off" card on iOS, and `hasPermission` is hard-coded `true`
  there.** Raised while running §6 on TestFlight, where the card's absence is _correct_ and the row
  passes — `NotificationsBlockedCard` returns `null` off Android by design.

  **Android's version exists because denial there is catastrophic and silent**: a second denial
  blocks `POST_NOTIFICATIONS` permanently, the foreground service then refuses to start, and the
  background timer stops with no dialog and no way back. iOS does not have that failure — the Live
  Activity path does not depend on the permission, so a denied user still gets the clock on screen.

  What a denied iOS user _does_ lose is the expiry alert while backgrounded, which is not nothing.
  Adding a card would mean first making `hasPermission` a real check on iOS rather than a constant,
  so it is not a UI-only change. Deliberately not done in 1.2.0: new behaviour in a release
  candidate, for a smaller failure than the one the Android card answers.

- ⬜ **Nothing notices when prod's alarm topic has no subscribers.** Found on 2026-09-19 filing a
  report for §15b: the report landed, the metric filter raised `ContentReports`, the alarm went
  `OK → ALARM` — and SNS delivered to **nobody**, because
  `PokerBackend-prod-ObservabilityAlarms` had zero subscriptions. Production had **no alerting of
  any kind**, API 5xx included, and had not had since the subscription went.

  **CloudFormation reported success throughout.** It still records the subscription as
  `CREATE_COMPLETE` against a real ARN that answers `Subscription does not exist`, so every deploy
  since has been green over a phantom. The likely route out is the **unsubscribe link in an SNS
  alarm email** — one click, no confirmation, permanent, and invisible to the stack.

  Re-subscribed by hand, which fixes today and not tomorrow: the new subscription lives outside
  CloudFormation, and an email subscription that is never confirmed is **discarded after 3 days,
  silently**. So the same hole can reopen with nothing reporting it.

  **What would actually close it:** something that checks the topic has a confirmed subscriber and
  complains when it does not — a scheduled check, or a deploy-time assertion. An alerting channel
  whose only failure signal is the absence of alerts is not one. Worth pairing with the push-receipt
  reader above; both are the same shape of problem, which is that silence is indistinguishable from
  health.

- ⬜ **A player on a board is not tied to an account, and removing a member does not remove their
  player.** Found on the 1.2.0 candidate-3 pass. The members sheet (#256) removes an **account's**
  access to a board; the leaderboard's player rows are separate records that stay exactly where they
  were. So removing somebody revokes their access and leaves their name on the standings, which
  reads as the removal half-failing.

  **The shape it wants:** every account on a board links to one player, but **not** every player
  links to an account — adding people who do not have the app is the common case and must keep
  working. That asymmetry is the whole design; a scheme that requires an account per player breaks
  the kitchen-table use it exists for.

  **Deferred out of 1.2.0 deliberately.** It changes what a player record _is_, which reaches the
  board schema, the merge, and `visibleTo`'s stripping of other people's `accountId` before a board
  leaves the server — and that stripping is why the members sheet identifies people by role and join
  date rather than by name in the first place. Not a change to make against a release candidate.

- ⬜ **A refund never revokes the entitlement — Google Play RTDN has never been configured.**
  Found on the 1.2.0 candidate-3 pass (D2 at the time; now under Known-and-accepted in [RELEASE_TESTING.md](./RELEASE_TESTING.md)). Refunding
  a Pro order in Play Console with _revoke access_ ticked leaves RevenueCat showing the entitlement
  active and the app still holding Pro. Play Console → Monetization setup →
  **Real-time developer notifications** has no Pub/Sub topic, so Google's
  `ONE_TIME_PRODUCT_CANCELED` never reaches RevenueCat and it is never told.

  **Accepted for 1.2.0 because it is not this release's defect** — the channel has never existed, so
  1.1.4 behaves the same way, and a subscription's normal lapse runs off the expiry timestamp
  RevenueCat already holds rather than off a notification. What it costs in the meantime is real
  though: **a customer who is refunded keeps the paid features**, and nothing re-checks, because
  entitlements are read from RevenueCat and RevenueCat is waiting on a message nobody sends.

  **The fix is console-only — no binary.** Create a Pub/Sub topic in the Google Cloud project linked
  under Play Console → Setup → API access, grant
  `google-play-developer-notifications@system.gserviceaccount.com` the **Pub/Sub Publisher** role on
  it, point Play Console's RTDN field at it, and attach RevenueCat. **The blocker last time was
  RevenueCat's _Connect to Google_ listing no topics** even after the topic existed — likely the
  OAuth'd identity lacking permission to list them on that project. That attempt was reverted; start
  from RevenueCat's own RTDN docs rather than repeating it blind.

  Verify with the behaviour, not the configuration: refund a test purchase with revoke, and watch
  the entitlement drop. That is §1's `A refund revokes the entitlement` row, currently 🟡 on both
  platforms — **iOS is unchecked too**, since App Store Server Notifications have never been
  confirmed either.

- 🔍 **Purchases follow the app account — built, then deferred out of 1.2.0.** #262 handed
  RevenueCat the Cognito `sub` on sign-in and, on sign-out, called `logOut()` then
  `restorePurchases()`. Read against RevenueCat's docs that cannot keep its own promises:
  - Under the **default "Transfer to new App User ID"** behaviour the restore moves the account's
    purchases to the new anonymous user, and the next `logIn` merges them into whoever signs in
    next — so a second account on the same phone inherits the first one's Club.
  - Under **"Keep with original App User ID"** the restore errors, and the anonymous user owns
    nothing — so Pro disappears on sign-out, the other promise.
  - RevenueCat documents that `restorePurchases` **must not run without a user tap**, because it can
    raise an OS-level Apple ID prompt; `syncPurchases` is the programmatic one.

  Removed before any build carried it, so nobody is identified and nothing needs migrating; the
  code is in `43a3df7`. **Before rebuilding it, decide:** which transfer behaviour the project uses
  (read it off the dashboard, do not assume the default); what signing out should mean for a
  purchase made on this phone's store account; and whether Pro — a one-time purchase that runs on
  the phone — should follow the account at all, or only Club. Then write the §16d rows against that
  decision _before_ the code, since they were written after it last time and asserted the
  impossible. **And update the disclosures in the same PR**: the privacy policy tells people
  RevenueCat receives "an app-generated identifier", and Play's Data Safety / Apple's App Privacy
  answers would newly link the account's User ID to purchase history. #262 changed neither.

- ⬜ **Club is enforced only in the client.** Hosting a board and hosting a clock are refused by the
  app (`clubPolicy`, `SharedSessionContext`), and the backend has no way to check: it never sees an
  entitlement. A modified client hosts for free. Cheap today and not worth a release, but it is
  the thing the item above unlocks — once RevenueCat knows the Cognito `sub`, a RevenueCat webhook
  writing an entitlement row, or its REST API, lets `groups.ts` and `sessions.ts` refuse on the
  server.
- ⬜ **The mobile app has no tests below the screen, and 1.2.0's worst defects were exactly that
  kind.** Push registration was refused by the server for every device and the app never read the
  status, shared boards could not remove anything, because nothing called the delete routes, and
  the shared clock shipped to the release branch broken three ways, all in the wiring rather
  than the rules: `startHosting`/`join` kept the first render's refusal, `useSessionSync` never
  cleared a reload mark so no press was ever published, and the HTTP transport dropped every
  heartbeat. The protocol in `@poker/core` has a two-phone test suite and passed throughout; the
  hook and the transport had nothing, and §18 had never been run. A `jest-expo` + React Native
  Testing Library harness for the contexts that make decisions (`SharedSession`, `Premium`,
  `GroupSync`, `Leaderboard`) would have caught it in CI. It is new tooling in `apps/mobile`, so it
  wants its own PR rather than riding along with a fix.
- 🔍 **A shared-clock press takes 6–16 seconds to arrive, not the ~4 the design assumed.** Measured
  on 2026-09-13. The session is one DynamoDB row, last write wins, and every device rewrites it on a
  five-second heartbeat — so a newer press is routinely overwritten by an older heartbeat before the
  other phone polls, and only gets through on a later beat. It converges, so it is not a release
  blocker, but a pause arriving fifteen seconds late at a poker table reads as broken. Two shapes
  would fix it: a conditional write in `sessionStore.publish` that refuses a lower version than the
  one stored (the comment there says "no version check happens here" deliberately — revisit that
  with this measurement), or a row per sender so writers stop overwriting each other. Also seen
  once and not explained: a joiner's countdown standing still for ~7 seconds after a resume.
- ⬜ **Renaming a shared board only renames it on the admin's phone.** No route renames a board, so
  `mergeBoard` keeps the local name and members see whatever the board was called when they joined.
  1.2.0 made rename admin-only, which stops a guest's board silently disagreeing with the host's,
  but the admin's own rename still does not reach anybody. A `PATCH /groups/{groupId}` behind the
  existing `rename` permission, sent online the way removal is, would close it.
- ⬜ **Push delivery failures are invisible.** Expo reports some errors when a message is sent
  (now logged) and the rest only in a **receipt**, fetched separately, later — `BadDeviceToken`,
  an APNs key for the wrong environment, a revoked FCM key. Nothing fetches receipts, so a
  credentials problem that stops every notification in production would leave no trace. A scheduled
  Lambda that stores ticket ids briefly and reads their receipts fifteen minutes later is the
  standard shape. Found when the 2026-09-14 §19 run got `ok` from Expo and no notification.

  **1.2.0 raised the priority of this from "nice" to "the only safety net".** Delivery was proven on
  candidate 3 — a game recorded on one phone notified the other, naming the board — but the five
  rows _around_ delivery were deliberately not run and accepted as risk: the cold-start tap, the
  offline receiver, the outbox replaying without re-notifying, a failed push not failing the write,
  and an uninstalled receiver not erroring the sender. **The stated mitigation for accepting them is
  this item**, so until it exists the release has no signal of any kind: a regression in any of the
  five produces no error, no log and no alert, and surfaces only when somebody reports it. Build the
  receipt reader before assuming push is healthy in production.

- ⬜ **One Lambda still runs on `nodejs20.x`, which AWS has deprecated** — `LinkAccounts`, the
  Cognito `PreSignUp` trigger in `pokerStack.ts`. The other four functions are already on
  `nodejs22.x`; this entry claimed _every_ Lambda until 2026-09-18, which made the job look far
  bigger than it is. Deprecated 2026-04-30, **creation disabled 2027-02-01 and updates disabled
  2027-03-03** — after which that handler cannot be redeployed at all. Move it onto the same runtime
  as the rest, in its own PR with a dev deploy and the infra tests, not inside a feature change.
- ⬜ **Four `react-hooks/exhaustive-deps` warnings remain**, all in long-shipped timer code
  (`TimerContext`, `useTimerEngine` ×2, `useTimerNotification`). Each may be deliberate — omitting
  `timeLeft` from an effect is often the point — but none says so. Either document the omission
  with an `eslint-disable-next-line` and a reason, or fix it, so that a new warning is noticed
  instead of joining a list everybody has learnt to ignore. Not in a release: this is the timer.
- ⬜ **The docs are too long to be read, which is how they go stale.** `CHANGELOG.md`'s 1.2.0
  section is the worst of it — most of it rationale that is also in the commits — and `CLAUDE.md` is
  loaded into every agent session. Every stale claim the 1.2.0 review found sat in prose nobody
  re-read, including three in this file. `RELEASE_TESTING.md` has had its run history cut back to
  what a future tester needs, which is the shape the rest should follow: at the next cut,
  user-facing changelog entries of a few lines each, with the reasoning left in the commit — which
  is what this file already says about itself. Don't write counts or line totals into any of them;
  `npm run testing:status` measures the one that matters.

## Gambling classification — the rating record

**The dealt game's betting engine and money on the leaderboard were removed before 1.2.0 shipped.**
This section is the record of why. The betting engine is archived at the `archive/betting-engine`
tag and looks like a half-finished feature somebody abandoned; the next person to find it will be
tempted to finish it. Don't.

### What forced it

The live app (1.1.4) is a timer and is rated **4+ Apple / 3+ Google**. Everything money-related is
new in 1.2.0 and the rating has never been tested against any of it.

**Two separate triggers, found in that order.**

**1. Betting.** Apple defines **Simulated Gambling** as _"Betting or wagering without using real
money or in-game currency that can be exchanged for real money"_ — 13+ if infrequent, 18+ if
frequent. The betting engine (`bettingRound.ts`'s fold/check/call/raise, the Min/Pot/All-in
controls) is betting, and as a headline Pro feature playable every game night it is frequent.

**2. Tracking real money over time.** This one was missed at first and is the more surprising of the
two. Comparable apps on the App Store today:

| App                          | What it does                                           | Rating  | Descriptor                            |
| ---------------------------- | ------------------------------------------------------ | ------- | ------------------------------------- |
| Deck of Cards — Virtual deal | Deals and shuffles cards                               | **4+**  | none                                  |
| Poker Payout Calc            | Computes payouts for 3–18 players                      | **4+**  | none                                  |
| Cash Out Poker               | Home-game scorekeeper: buy-in, cash-out, who owes whom | **18+** | `Gambling`                            |
| Poker Bankroll Tracker       | Sessions, chip graphs, odds calculator, multi-currency | **18+** | `Frequent/Intense Simulated Gambling` |
| Bink Poker Bankroll Tracker  | A bankroll tracker of the same shape as the row above  | **12+** | `Infrequent/Mild Simulated Gambling`  |

**The line is not dealing, and it is not calculating — it is accumulating real money across
sessions.** A one-shot payout calculation is 4+. A running total of what each player has won is 18+
in both examples found. The leaderboard as built stores `totalWon` and renders "8 games · 3 wins ·
won 120 · 5 KOs", which is functionally a bankroll tracker.

**Every rating in that table was read back from the App Store on 2026-09-08** via the public lookup
API, not from memory — an earlier pass asserted Cash Out was safe precedent without checking it, and
it is the 18+ row. Re-check them rather than trusting this table; a rating can change whenever its
developer answers the questionnaire again. Note the API still returns the **legacy `17+`** label for
the two 18+ rows: that is the pre-2025 tier, and both map to 18+ under the current table.

**Interpret that evidence carefully.** App Store ratings are **self-declared** through the
questionnaire, not assigned by Apple. Poker Payout Calc (4+) and Cash Out (18+) do broadly similar
things and landed at opposite ends, and the two bankroll trackers — same shape, one 18+ and one
12+ — disagree with each other. The questionnaire is genuinely ambiguous here and developers resolve
it differently. This is evidence about how the question tends to be answered, not proof of what
Apple would force.

**What is safe, with precedent:** the timer, the payout calculator as a one-shot tool, the chop,
accounts, and shared boards. **Dealing cards is also safe** — "Deck of Cards — Virtual deal" is a
virtual dealer at 4+ with no descriptors at all, which is why dealer mode did not need a ruling from
App Review.

**13+ was never reachable.** Three independent reasons, each sufficient:

1. Apple's 13+ needs _infrequent_ simulated gambling, which a full no-limit engine is not — and
   under-declaring is the one thing that genuinely endangers a developer account.
2. **PEGI put gambling content at 18 in 2020**, and PEGI reaches Google Play through IARC. There was
   no 13+ door in Europe for a betting engine.
3. The account rule below does not care about the tier.

**The PEGI claim used to be stated more broadly than PEGI states it, and the correction matters.**
This said "auto-rated _any_ simulated gambling 18". PEGI's own wording is narrower: the descriptor is
for a game that "contains elements that **encourage or teach gambling**", where "these simulations of
gambling refer to games of chance that are normally carried out in **casinos or gambling halls**".
Betting chips in a no-limit engine is squarely inside that. A dealer that holds no chips is not
obviously inside it at all.

**And there is a precedent that cuts both ways, which this section did not have.** _Balatro_ — a
poker-shaped roguelike with no money in it — was rated **PEGI 18 for explaining poker hands**, and
had it **reduced to PEGI 12 on appeal**, the Complaints Board finding its fantastical elements
mitigating. PEGI then said it would build more granular criteria, keeping 18 for games that
"simulate gambling typically played in casinos and betting halls".

Read honestly, that is **one signal in each direction**:

- **Against us:** the thing that first drew an 18 was _explaining poker hands_, and the showdown
  names hands ("pair", "high card") with none of Balatro's fantastical mitigation. This app is a
  literal poker dealer.
- **For us:** the 18 did not survive contact with the appeal, and the category PEGI kept 18 for is
  casino-and-betting-hall gambling, which a dealer holding no chips and settling nothing is not.

**It does not change the answer given** — the app contains no betting, so "does it contain gambling
or simulated gambling" is still honestly No, and IARC asks that, not "does it name a poker hand".
What it changes is that the **Google 3+ carries a risk this section previously did not acknowledge
at all**, because PEGI was only ever invoked here to close off 13+ for the engine. If a rating comes
back higher than 3+ from Play, this is the reason, and Balatro is the appeal precedent to cite.

**The account rule is what actually decided it.** This account is enrolled as an **Individual**.
Apple: _"we are no longer allowing gambling apps submitted by individual developers"_ — explicitly
_"this includes both real money gambling apps as well as apps that simulate a gambling experience."_
Guideline 5.1.1(ix) still lists gambling among fields that should be submitted by a legal entity.

That quote traces to an **October 2018** announcement and could not be confirmed in writing as
enforced verbatim today; the current guideline says "provide _services_ in" regulated fields, which
arguably excludes a play-money game. **It is an unresolved risk, not a certainty** — but the
asymmetry settles it. If the rule bites, the failure is not a rating bump, it is a rejection curable
only by forming a legal entity and migrating the account. The feature being protected is a hand
dealer whose use case is "a table that has chips but no cards", and a group that owns chips owns a
deck.

### What is explicitly _not_ the problem

- **This is not real-money gambling and needs no licence.** Verified in code: no consumable IAP, no
  chip purchase, no chip↔money conversion, and no currency symbol rendered anywhere — every amount
  is a bare integer. The app holds no chips at all now; the only place the word appears in the UI is
  the chop sheet, where the host types the stacks that are sitting on the real table.
- **Legal exposure is close to nil.** The category actually criminalised in Europe is paid loot
  boxes (Belgium: fines to €800,000). There is no purchasable randomness anywhere in this repo.
- **A second app does not help**, and was rejected: the restriction attaches to the _submitting
  account_, not the app, so a second app from the same Individual account meets the identical rule.
  It isolates only the rating, and only pays off in the world where the restriction is not enforced
  — in which case one app at 18+ would have shipped anyway. Against that: two listings, two review
  cycles, two testing passes, two RevenueCat configs, and a new listing starting at zero ratings.

### Keeping the betting engine for the web only — considered, rejected

Store guidelines and PEGI/IARC govern apps distributed through stores and have no jurisdiction over
the website. The ad-revenue half of that argument — that AdSense restricts only _real-money_
gambling, so play-money poker on the site would not touch it — **was never actually checked against
Google's publisher policy, and is not relied on here**: the option was rejected on everything below,
and anyone reviving it has to verify that first. **On the store rules, this was clean.** It failed on
everything else:

- **Entitlements cannot cross platforms.** `revenueCatProvider.ts` configures RevenueCat with no
  `appUserID` and never calls `logIn()`, so an entitlement belongs to the App Store / Play account
  on the device. Tying it to the app account was built for 1.2.0 and deferred — see _Carried into
  1.2.2_.
- **The web app has no billing at all** — no Stripe, no RevenueCat Web. The `pro`/`premium` strings
  in `apps/web` are marketing copy about the mobile purchase. Charging for it means a second payment
  integration plus account linking; not charging for it undercuts the mobile paywall, where dealing
  is one of seven Pro bullets.
- **The UI does not port.** `packages/core/src/poker/` is framework-agnostic and would move as-is —
  that is the valuable, tested part. But `apps/mobile/src/components/game/` is ~800 lines of React
  Native and this repo does not use `react-native-web`, so the table would be rewritten, not ported.
- **The UX premise does not survive the move.** The whole design is pass-the-phone with tap-to-peek
  hole cards. In a laptop browser that becomes passing the laptop around the table, which is worse
  than the deck of cards the feature exists to replace.

**One rule to respect anyway:** do not link the mobile app to any web poker content. A reviewer
following a link from the app to a poker table is a conversation the release does not need.

### Where the rating stands

Both questionnaires are answered — **4+ on Apple, PEGI 3 on Google**, with **Brazil 14+** the one
region above 3 — and the answers are recorded in [STORE_LISTING.md](./STORE_LISTING.md) so the next
release is checked against them rather than re-derived. What is left is accepted rather than done:

1. 🟡 **Residual surface, accepted.** With the betting engine and the leaderboard money gone the app deals cards without wagering and
   keeps a board of games and wins without money — both shapes with 4+ precedent. What remains is
   the **payout calculator**, which computes a prize pool from a real buy-in. Poker Payout Calc does
   exactly that at 4+, so the precedent is good, but it is the last gambling-adjacent surface and
   the one a reviewer would ask about. **The rating is answered per app, not per screen**, so the
   composition argument — a poker app that deals, calculates prize money and keeps a board — is the
   one to expect to lose if one is lost. Accepted deliberately: removing the calculator too would
   gut the feature the release is built on, and it is the single best-evidenced 4+ component in the
   whole product.
2. ✅ **Guideline 1.2 (user-generated content) — all four requirements met.** Declaring UGC on the age-rating questionnaire brings the app under 1.2, which asks
   for four things:

   | Requirement                        | State | Where                                                                                                                                  |
   | ---------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
   | Filter objectionable material      | ✅    | `moderation/textFilter.ts`, tested, refuses names and board names                                                                      |
   | Report mechanism + timely response | ✅    | `ReportBoardSheet` → `POST /groups/{id}/report`, a `ContentReports` alarm so a report is actually noticed, and `/support` explains it  |
   | **Block abusive users**            | ✅    | Any member may **leave**; an admin may **remove** somebody, which also rotates the invite code so it is revocation rather than a pause |
   | Published contact information      | ✅    | `poker.blinds.buzzer@gmail.com` on `/support`, with a 2-business-day commitment                                                        |

   **"Leave" alone was not a block**: it works when the board is somebody else's and does nothing
   when the board is yours and somebody on it is the problem — which is why removal was built, and
   why it rotates the invite code. Still worth saying in the review notes: no discovery, no feed, no
   messaging, and no way onto a board except by redeeming a code. `/terms` carries the
   zero-tolerance clause 1.2 rejection letters cite most often; App Store Connect's License
   Agreement field has to point at it — set for 1.2.0, and worth confirming it still does.

   A **per-user block** — as distinct from removal — is still unbuilt, and still only worth building
   if a reviewer asks: it would mean deciding what blocking means on a board somebody else
   administers.

3. 🟡 **UMP consent is wired in code and waiting on the AdMob console.** `services/adsConsent.ts`
   gathers consent through Google's UMP SDK for free users and gates the ads SDK on the answer.
   Still open:
   - **The GDPR message is published in AdMob → Privacy & messaging** (2026-11-15), with
     "Consent", "Do not consent" and "Manage options" on the first screen. **Do not add an IDFA/ATT
     message there**: UMP would start raising the tracking prompt, and the app has no
     `NSUserTrackingUsageDescription`. Before it existed the SDK answered "no form(s) configured for
     the input app ID" and still reported `canRequestAds: true`, so a build without it behaves like
     1.2.0 for ads rather than worse.
   - **Checked on an Android emulator against that message** (2026-11-15, `FORCE_EEA_IN_DEV` on):
     the form shows before any ad; "Do not consent" and "Consent" both close it and a banner loads;
     it does not return on relaunch; "Ad privacy choices" appears in Settings and reopens it.
     On the **iPhone simulator** (2026-11-15, no debug toggle) the form also shows on first launch,
     and "Do not consent" closes it and a banner loads; the relaunch and Settings-link checks were
     not repeated there. A real device is still unchecked.
   - **The form's wording is Google's and asks for more than the app uses**: it names "personalised
     advertising" and precise geolocation, while every request stays non-personalized. It also
     calls the app "Poker Timer", the name AdMob has on file. Trimming the purposes in AdMob is
     possible and not investigated.
   - Run the consent rows in `RELEASE_TESTING.md` on both platforms during the 1.2.1 pass. iOS can
     only be checked on an EAS build while local builds are blocked on Xcode 27.
   - Compare AdMob match rate per version and country afterwards (FR, UK and DE were 20–38% on
     1.2.0).
   - **Ads stay non-personalized regardless of the answer**, because the privacy policy and store
     declarations say so. Personalized ads for consenting Android users would mean rewriting the
     policy's Advertising section and Play's Data Safety answers first; not planned.

### Honest declaration is the whole strategy

Apple removes developers for _"trying to trick the review process"_ and _"manipulate ratings"_, and
says plainly: _"if you're dishonest, we don't want to do business with you."_ **The route to a ban is
under-declaring a poker game, not having one.** Answer both questionnaires from the built binary
rather than from the listing copy, and record the answers given so the next release can be checked against
them. Apple's and Play's IARC are independent and need not agree.

**Write the listing from the built binary, every time.** "Buy-in", "prize", "pot", "payout" and
"winnings" are fine and correct — this is what a tournament calculator is for, and a listing that
will not say what the app does is worse than one that does. What is not fine is copy describing
betting the binary no longer has, or describing the dealt game as less than it is to duck a rating:
both are the same metadata-accuracy failure pointed in opposite directions.

### Raising the rating does not bring betting back — decided 2026-11-13

Asked after 1.2.0 shipped: if the app were rated 13+ or 18+, could the betting engine and money on
the leaderboard return? **No — and the owner has decided not to take the route that would allow it.**
Staying clear of legal and store-policy trouble outranks those features.

- **13+ is not enough.** A betting engine used every game night is _frequent_ simulated gambling,
  which is 18+ on Apple; PEGI rates gambling content 18 on Google Play. See _13+ was never
  reachable_ above.
- **The rating is not the blocker; the account is.** The Individual-account rule above applies at
  any tier. Lifting it means enrolling as an **organization**, which needs a legal entity (Apple
  directs sole proprietors and one-person businesses to the Individual track) and a D-U-N-S number,
  then transferring the app. **Not doing this.**
- **If it is ever revisited, the order is fixed:** legal entity → organization account → app
  transfer → honest 18+ on both stores → restore from `archive/betting-engine`. Never ship betting
  from the Individual account, and never under-declare it to keep a lower rating.
- **What a higher rating can do without any of that** is widen the ads. Guideline 2.5.18 requires
  ads to be _"appropriate for the app's age rating"_, which is why 1.2.0 caps AdMob at `G` for 4+.
  An iOS-only **13+** via App Store Connect's _Override to Higher Age Rating_ would allow AdMob's `T`
  rating, which still excludes `MA`, where gambling ads sit. Optional, and not yet decided. **18+ is
  rejected**: it hides the app from minors and parental filters, and the only extra it unlocks is
  `MA` — gambling ads in a poker app.
- The same guideline requires that apps with ads _"include the ability for users to report any
  inappropriate or age-inappropriate ads"_. Covered by the _"Seen an inappropriate ad? Report
  it"_ link under the Pro card (#327), which mails support. Keep it while the app shows ads.

## Monetization: Pro keeps the phone, Club buys the hosting — decided

**Pro does not change and nobody who bought it loses anything.** Everything it unlocks runs on the
phone — leaderboard, payouts, dealing a hand, no ads, presets, sound packs — and costs nothing per
person, so none of it moves. There is nothing to migrate either: `club` is a separate RevenueCat
entitlement, so it cannot affect `pro`. No restore edge case, no receipt to rewrite.

**The host pays; guests do not.** This is the decision the feature lives or dies on. An invite that
asks five friends to subscribe to a poker timer is a feature nobody ever uses, and a board costs the
same whether one person is on it or eight. So:

|                                                                | Needs                   |
| -------------------------------------------------------------- | ----------------------- |
| Your own boards, the leaderboard, payouts, dealing a hand      | **Pro** (one-time)      |
| Making a board of your own shareable, and inviting people      | **Club** (subscription) |
| Joining a board somebody sent you, reading it, recording on it | **nothing**             |

A guest joining free has to be able to _see_ the board, so **a shared board is visible without
Pro** — `boardIsVisible`. Pro is for keeping your own score; a board somebody else keeps is theirs.
That is also the better funnel: a guest sees what a season of game nights looks like and then wants
one of their own.

**Club grants Pro, and that is a rule rather than a convenience.** A shared board _is_ a
leaderboard, and the leaderboard is Pro — so a subscriber without it would host a board they could
not open. Not an awkward state: a broken one, sold deliberately. It is enforced in
`entitlementsFrom` **as well as** in the RevenueCat product, because configuration is one forgotten
checkbox away from shipping exactly that. The reverse does not hold: Pro has never included
hosting.

**Priced at the bottom of the category — decided.** **€2.99 a month or €19.99 a year**, matching
Pro's €2.99 exactly on the monthly — see _What a lapsed subscriber keeps_ below, where that parity
does real work. The reasoning is worth keeping, because the market medians argue for four times that
and they are wrong for this app:

- Every serious poker-timer competitor is **one-time**, between $2.99 and $7.99 — NextBlind $7.99,
  PokerTimer $6.99, Texas Holdem "The Works" $5.99, Easy Poker Timer $2.99. The subscription
  outliers charge $9.99–14.99 a month for a timer, which is how an app earns one-star reviews.
- RevenueCat's 2026 utilities medians ($7.99–9.99/month, $30–39.99/year) are set by health, fitness
  and AI apps with far broader appeal. Only ~10% of apps run a hybrid model at all.
- **The server bill was never the reason.** It is pennies now and stays small at ten to fifty times
  this size. The reason to charge is that **you can always stop charging and can never start**: fold
  hosting into Pro and every past and future one-time buyer has it forever, unrevocably. That is an
  argument for charging _something_, not for charging a lot.

**Named for the axis, not the tier.** "Pro+" would say the thing people already bought had been
demoted. "Club" also outlives shared boards: the shared clock and playing a hand together belong to
the same subscription and will not need it renamed.

### What Club is

Club launched with three features rather than one: **hosting a shared board, the shared clock, and
push notifications** when somebody records a game. Playing a hand together is **permanently dead** —
it needs the deleted table backend, and multiplayer betting is the 18+ trigger.

**One correction worth keeping** from building push the cheap way (Expo's push service): "Expo holds
the credentials" is only half true. Expo's service still needs _your_ APNs key and _your_ FCM v1
service-account key uploaded to EAS, and without them nothing is delivered.

### Dealing across phones — the strongest Club feature not yet built

**This is not the "playing a hand together" row above, and the difference is the whole point.** That
one is permanently dead because _multiplayer betting_ is the 18+ trigger and it needed the deleted
table backend. This is **dealing only**: each player sees their own two cards on their own phone
instead of one handset going round the table. No chips, no betting round, nothing settled — so it
stays on the 4+ side of the line the rest of this file draws, beside the virtual-dealer precedent
that made dealer mode safe in the first place. Anyone reviving it must keep that distinction; the
moment a bet goes in, the rating argument above applies in full.

**It is Club by the same test everything else here passes.** A hand in progress is a row other
phones poll for as long as the table is playing it — a cost that keeps arriving, which is the only
thing this file lets Club charge for.

**The local dealer stays Pro, and must.** It runs entirely on one phone, it is listed in the
paywall's Pro features, and the people who have already bought Pro bought it partly for that.
Retracting a one-time purchase into a subscription is the one move that earns refund requests and
one-star reviews; a networked version is a _new_ capability sold alongside it, not a repossession.

**The machinery already exists**, which is what makes this worth writing down rather than filing
under someday. The shared clock shipped a polling transport and a `SESSION#`-shaped row on a TTL; a
hand is the same shape with a different payload and a shorter life. That is markedly cheaper than it
looked when this file wrote Club's future off, and it is a far better reason to subscribe than a
synced countdown.

**A web view of your board needs two things that do not exist:** RevenueCat knowing which account
subscribes (deferred — see _Carried into 1.2.2_), and a way to charge on the web at all — no Stripe,
no RevenueCat Web. Ordinary work once the first is done, not something the architecture forbids.

**None of these touches the rating.** It turns on betting, wagering and accumulating money across
sessions. A synced countdown, a reminder and a standings page are none of those.

### The number that should temper all of this

**Pro has sold 9 copies in two months at €2.99** — roughly €10/month net, as of 2026-09-09. Packaging
is not what limits that; discovery is. Club with three features will not change it either, and the
honest reading is that **weeks of transport and push work are a poor trade against an audience of
nine payers** unless the install and conversion numbers say something different. Get those before
committing to the build. This section describes the right shape for Club when it is worth building —
not an argument that now is the moment.

### The seam, and why a dev build cannot see sharing

`ENTITLEMENT_CLUB` is read alongside `pro`, exposed as `hasClub`, and `clubPolicy` in `@poker/core`
holds every rule above — tested, because the mistakes are all of the kind that are invisible in
review and obvious in a store review. **Which boards reach the server is a per-board question**
(`boardSyncs`): a shared board always syncs because the host is paying for it, a local board only
if you host. A board that does not sync is never announced _and_ never queues writes.

- 🟡 **Sharing cannot be exercised from a dev build**: a dev client cannot buy `club`, so a build
  pointed at `DEV_BACKEND` announces no board, queues no write and shows no share button — silently
  and correctly. Set `FORCE_PRO_IN_DEV` in `PremiumContext`, which forces both entitlements, to run
  the sharing rows. Worth knowing before somebody concludes sync is broken.

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

**Only a paid period counts — changed 2026-11-15 for the free trial.** `clubEver` used to be "the
entitlement has ever existed". With a free trial on Club that hands out permanent Pro to anybody who
starts one and cancels, so it is now "the last period was not a trial" (`clubPeriodKeepsPro`, read
from RevenueCat's `periodType`). During a trial Pro is unlocked because Club is active; a trial
cancelled before its first charge leaves nothing behind. The paywall line says "once you've paid for
Club" for the same reason.

**One month of Club is a permanent Pro — and at parity that costs nothing.** Pro is €2.99, and so is
the Club monthly, so subscribing-and-cancelling costs exactly what buying Pro costs and the
arbitrage disappears by construction: no receipt logic, no minimum-months rule.

**The annual is where the thinking should go instead.** €2.99/month is €35.88 a year against a
€2.99 app — a 12× ratio, and a lot to ask of this audience. €19.99/year is the realistic seller;
treat the monthly as the trial rather than the plan.

Guests are unaffected either way. They never paid.

- 🟡 **Whether a lapsed host's boards should keep syncing is open.** `boardSyncs` keeps sending for
  any board already on the server, because the other direction silently strands the members reading
  it. Revisit if lapsed hosts turn out to be a real cost.

### The Club free trial — decided 2026-11-15, built for 1.2.1

**Fourteen days free on both Club plans, as a store introductory offer.** The owner's reasoning: Pro
is easy to imagine before paying (the ads go away), while Club is the thing nobody can picture
until they have put a clock on a friend's phone, and it is the purchase that recurs.

- **It has to be the store's offer**, not something the app grants. A free period on an
  auto-renewing subscription is an introductory offer on that product in both stores; the Pro
  trial's free non-consumable is Apple's route for a one-time unlock and does not extend to a
  subscription. It also converts by default, which an app-granted trial would not.
- **The app shows it only to somebody the store says is eligible.** Unknown eligibility is shown the
  ordinary price, since "14 days free" to somebody who will be charged today is a false price claim.
- **Kept alongside the Pro trial, by decision.** The paywall can therefore offer two different free
  trials. Watch for confusion; if one has to go, the Pro one is the one the owner thinks is needed
  less.
- **The honest prior**: Club has had one subscriber, who left after a month, and nothing in the
  1.2.0 data pointed at "could not try it" as the reason. The bigger limit may be how few people
  reach the Club offer at all. Cheap to try; do not read much into a small number either way.
- **Offers configured 2026-11-15**: a free 2-week introductory offer on `club_yearly` and
  `club_monthly` in App Store Connect, and an active 14-day free-trial offer on both base plans in
  Play Console.
- ⬜ **Untested against a real offer.** The layout was checked on the iPhone simulator with the
  trial label forced; eligibility, the Play free phase and the purchase itself need the offers live.
- ⬜ **Hosting given away**: a trial user can share boards and run clocks for a fortnight. What
  happens to those boards afterwards is the same open question as for any lapsed host, above.

### The Pro trial — decided 2026-11-15, built for 1.2.1

**Fourteen days of Pro, started by the user, once.** It exists because the locked features are
ones nobody sees before paying, and at roughly one sale a week it cannot be A/B tested, so it is a
judgement call and should be read as one.

- **Opt-in, not automatic, on both platforms.** Giving every new user Pro silently from first launch
  was the original idea and is not available on iOS: Guideline 3.1.1 allows a trial in a
  non-subscription app only as a free non-consumable named "XX-day Trial", and forbids an app
  unlocking features by a mechanism of its own. Android could have been automatic; it was kept the
  same so there is one behaviour to explain and test. The cost is reach: fewer people start a trial
  than would have been handed one.
- **Fourteen days, not seven**, because a home game is weekly at best and a trial nobody played a
  hand in shows them nothing. Apple's route is a day count, so "three game nights" is not on offer.
- **Nothing is deleted when it ends.** Ads return and the Pro screens lock; a leaderboard or presets
  made during the trial stay on the phone and come back with Pro.
- **A trial is never told to anybody as ownership**, and never touches Club: `ownsProOutright`
  stays false and `hasClub` is unaffected. `proTrial` on `Entitlements` is what UI checks before
  `isPremium`.
- **Android's start date is on the device**, so reinstalling offers the trial again. Accepted
  knowingly: the alternative is a server record keyed on a device id.
- ⬜ **iOS is untested**: it needs the product in the sandbox. Android was checked on an emulator,
  including the expiry, by moving the device clock.
- ⬜ **What to watch afterwards**: trials started against Pro purchases. A trial start sets a
  `pro_trial_started` attribute (the date) on the RevenueCat customer on both platforms, so starters
  can be listed and counted there; RevenueCat's own trial charts only cover Club's.
- 🟡 **Reinstalling on Android offers the trial again — raised by the owner 2026-11-16, accepted.**
  It is self-limiting: the start date sits in the same storage as the leaderboard, presets and blind
  structure, so a reinstall that clears one clears the rest, and a backup that restores the data
  restores the date. The alternatives weighed were a sign-in requirement (backend change, fewer
  trials started), a device record on the server (a device identifier to collect and declare), and
  no Pro trial on Android at all. **The attribute above cannot show repeats**: a reinstall is a new
  anonymous RevenueCat customer, so the same person starting twice looks like two people.

## Payouts — open question

- ⬜ **The calculator pays at most six places, and a large field cannot change that.** Raised during
  the 1.2.0 pass by entering a very high player count and noticing the number never moves.

  **It is structural rather than a chosen limit.** `MAX_PAID_PLACES` is `PAYOUT_SPLITS.length`, and
  `PAYOUT_SPLITS` defines exactly six tables, ending at `[30, 23, 17, 13, 10, 7]`. The field-size
  rule tops out to match — `MIN_ENTRANTS_FOR_PLACES` ends at 25 — so **25 entrants already reaches
  the maximum** and everything above it is identical. The reasoning is in the file: _"Beyond six a
  home game is splitting hairs."_

  **Fine for what this is**, and worth revisiting only if the app stops being a home-game tool. A
  real tournament pays roughly 10–15% of the field, so 100 players would expect 10–15 places, not
  six. Raising it is **not a constant change**: every additional place needs its own split table,
  chosen deliberately, and `distribute()`'s largest-remainder behaviour re-checked against each —
  the top place absorbs the indivisible part, and that gets more visible as the shares get smaller.

  Recorded so the reasoning is not rediscovered from scratch next time somebody types 100 into the
  players field.

## Deal a hand — known gaps

- 🟡 **The game cannot know who finished where, and must not pretend to.** Busting is a chip event;
  with no chips there is nothing to observe. Nights are recorded by hand through
  `RecordResultSheet`.
- 🟡 **Progressive bounties went with the betting engine.** They need knockout attribution, which
  needs pots. Flat bounties survive — they are just a number in the payout calculator.
- 🟡 **The deal is not cryptographic.** `Math.random` is passed straight to the engine rather than
  a seeded PRNG, which avoids the brute-forceable 32-bit seed space that `createRandom` warns
  about — but it is still not a cryptographic source. Accepted for a table passing one phone
  around.

## Backend — open items

The architecture, observability, environments, deploys and cost model are in
[`apps/infra/README.md`](./apps/infra/README.md).

- 🟡 **Nothing has ever called it from a phone.** Every route was exercised by hand against dev, but
  no offline queue has replayed against it and no merge has run. Six `/code-review` rounds found
  ~50 issues; the ones most likely to remain are exactly the ones review cannot reach.
- 🟡 **An emptied group is never deleted.** Deciding "nobody else is here" from a read and getting it
  wrong destroys somebody's season, so nothing does. Cleaning them up wants a deliberate sweep.
- ⬜ **Whoever inherits a group has to be told.** Being silently made responsible for a board is
  indistinguishable from a bug, and this is the first thing in the app to need a notification path.
- ⬜ **Invite links need universal links to work from a phone.** `pokerkit://` is owned by the Expo
  dev launcher, so a cold-launch deep link cannot even be tested from a dev client.
- ⬜ **Hide My Email revocation is invisible to the backend.** If somebody turns their relay address
  off, mail to them stops and password reset fails silently. Apple's server-to-server notification
  endpoint is what would tell us, and it is deliberately not built — worth it only once there are
  enough Apple sign-ins for a silent reset failure to be a support problem.
- 🟡 **The dashboard is generated, not designed.** An alarm status row over a graph per alarm. It
  will want a real layout once somebody has watched it during a game night.

### Sign in with Apple and Google — the two decisions to keep

**Social becomes the primary path and email/password the fallback.** Not because it is fashionable,
but for one measurable reason: the emailed confirmation code is the highest-drop-off step in any
sign-up, and Apple and Google have already verified the address. It also takes SES off the critical
path, so a code that never arrives stops being the difference between having users and not.

**Not social-only.** Keeping email/password costs little now that it is built, and buys three
things: somebody who wants neither a Google nor an Apple account can still sign up, the website has
a path if accounts ever reach it, and nobody is locked to a platform account for a board that is
supposed to follow _them_ across phones. Password reset stays SES's job — a much safer place for it
than every new user.

**Never `UserPoolIdentityProviderOidc` for Google or Apple.** Social providers built in with
`UserPoolIdentityProviderGoogle`/`...Apple` bill on the 10,000-MAU Essentials tier; the same
provider added as generic OIDC looks identical on the login screen and bills every user on the
50-MAU federated tier. See
[`apps/infra/README.md`](./apps/infra/README.md#social-sign-in-bills-on-the-normal-tier--resolved-2026-09-05).

**A completed sign-in against prod has not been run on either platform** — it is §14b in
[RELEASE_TESTING.md](./RELEASE_TESTING.md), and part of the shortest pass.

## Monitoring — decided 2026-11-18: Sentry first, now in 1.2.3

**Where it stood when 1.2.1 was submitted.** The backend is watched; the app is not.

- **Backend:** nine CloudWatch alarms in prod (API 5xx/4xx, identity errors, content reports, mail
  bounce and complaint, three DynamoDB health checks) to an SNS topic with one confirmed email
  subscriber, a `poker-prod` dashboard and a cost budget. All nine read OK on 2026-11-18. The two
  gaps are the items under "Backend — open items": the subscription can vanish silently, and push
  receipts are never read.
- **App:** no crash reporting, no analytics, and `logger` is a no-op in release builds, so every
  `logger.warn` in production goes nowhere. What exists comes free from the platforms:
  - App Store Connect crashes and App Analytics (opted-in users only);
  - Play's Android vitals;
  - RevenueCat (purchases, Club trials, and the `pro_trial_started` attribute);
  - AdMob (impressions and match rate by country and version).

**The real blind spot is JavaScript errors.** A screen that throws is caught by
`AppErrorBoundary` and never crashes, so neither store sees it. A fatal JS error does crash, but the
store shows a native stack with no source line. A one-off "app left the foreground" seen on the
iPhone simulator while testing 1.2.1 was never explained, and in production it would leave no
trace.

### ⬜ Sentry, for 1.2.3

**Moved out of 1.2.2 on 2026-11-26** so the full-screen ads ship sooner: Sentry brings a native
module, new dev clients and new store privacy declarations, which is a release of its own.

Chosen over Crashlytics because it maps JS errors to source lines through Expo's tooling, and
because it has an EU data region.

- **Setup:**
  - `@sentry/react-native` with its Expo config plugin.
  - Source maps uploaded from the EAS build.
  - The DSN in `app.json` `extra`, like the RevenueCat keys.
  - A native module, so it needs `npm run pods` and new dev clients on both platforms (see the
    native-module note in `CLAUDE.md`).
- **Conservative configuration, because that is the line this project holds:**
  - EU region (`de.sentry.io`).
  - `sendDefaultPii: false`, no session replay, no performance tracing to start with.
  - No user id attached, and `beforeSend` scrubbing anything that looks like an email.
  - Errors from release builds only; dev builds keep the console.
- **`logger.error` becomes a Sentry event and `logger.warn` a breadcrumb** in release builds, so the
  warnings already written throughout the app start meaning something. `AppErrorBoundary` reports
  what it catches.
- **Declarations, in the same release, before submitting:**
  - App Store Connect App Privacy: **Crash Data** and **Other Diagnostic Data**, used for App
    Functionality, not linked to the user, not used for tracking. "Used for Tracking: No" stands.
  - Play Data Safety: **App info and performance → Crash logs and Diagnostics**, collected, not
    shared, for app functionality. Sentry is a processor here, not a third party the data is shared
    with, but check the form's wording at the time.
  - Privacy policy: a "Crash reports" entry naming Sentry, the EU region, what a report contains
    (device model, OS and app version, the error and its stack, recent in-app steps), and that it
    holds no account, email or board content.
- **Done when** a deliberate test error in a release build shows in Sentry with a readable source
  line, and the declarations above are live.

### Later, and only if a question needs it

- **Usage analytics stays out for now.** An identifier stored on the device generally needs consent
  in the EU, it changes the privacy labels, and at about one sale a week the numbers are too small
  to act on. Read the store dashboards, RevenueCat and AdMob after 1.2.1 first. If one specific
  question cannot be answered there, a minimal anonymous count sent to our own backend is the
  lowest-risk route; it needs a route and a prod deploy.
- **No cost, do now:** confirm App Store Connect and Play Console send crash and vitals emails to an
  address that is read. Until Sentry ships, it is the only crash alerting the live version has.

## Store listing and assets

**This is what stands between a finished 1.2.0 and a store page that represents it.** None of it
blocks a review; all of it is what a person sees before deciding to install.

- **Screenshots: live on both stores** — Play's since 2026-11-15 as a listing change (with the
  feature graphic), the App Store's with 1.2.1 on 2026-11-20, since App Store Connect only takes
  screenshots on a new version. Kept here for how they are made. Five captioned shots each (timer, blind structure, payouts, leaderboard, dealer):
  - Android phone (1080×1920) and tablet (1600×2560) in
    [`store-assets/android/screenshots/`](./store-assets/android/screenshots/).
  - iPhone 6.9" (1320×2868) and iPad 13" (2064×2752) in
    [`store-assets/ios/screenshots/`](./store-assets/ios/screenshots/), plus an iPhone 6.3" set
    (1206×2622) composed from the same captures. **Each App Store Connect slot only accepts its own
    sizes**: dropping the 6.9" files into the 6.1"/6.3" slot is refused with "File dimensions are
    invalid". Use the 6.9" tab for the 6.9" files, or the 6.3" set where that is the slot shown.
  - **No shared-clock or Club shot, on purpose.** It needs a signed-in account against a backend,
    and the listing leads with what sells Pro.
  - **How they are made**, since it is not obvious: raw captures go in `store-assets/raw/<set>/`
    and `node store-assets/generate-screenshots.js` composes the captioned versions. The raw
    captures came off a dev client with `FORCE_PRO_IN_DEV` flipped locally, which unlocks the Pro
    and Club screens without a store, so the old worry that those screens need a device with a real
    entitlement does not hold. Two things a dev client draws have to be switched off first: Expo's
    floating gear (`showFab` false in the app's `expo.modules.devmenu.sharedpreferences.xml`, via
    `adb shell run-as`) and the dev error toast (`LogBox.ignoreAllLogs(true)`, locally, never
    committed). The status bar is cleaned with Android's SystemUI demo mode.
  - **iOS came off an EAS simulator build**, since local iOS builds are blocked on Xcode 27:
    `eas build --profile development-simulator --platform ios`, then `xcrun simctl install`. The
    gear is `defaults write com.toondeboer.pokerkit EXDevMenuShowFloatingActionButton -bool NO`
    through `xcrun simctl spawn`, the status bar is `xcrun simctl status_bar … override`, and
    Maestro drives the taps. The data was not re-entered by hand: the Android emulator's
    AsyncStorage was exported and written back on iOS by a temporary `setMany` at startup.
  - **Start the emulator with `-no-snapshot`** when seeding data for screenshots. An AVD started
    from a quick-boot snapshot throws away everything written since that snapshot the next time it
    boots, which cost the phone's seeded leaderboard once already.
- ⬜ **Re-shoot `store-assets/ios/paywall-club-review.png`.** It was last taken for #265 and #276
  added a line to Club's feature list afterwards, so it is one release behind. **Submitted
  deliberately as-is for 1.2.0**: every Guideline 3.1.2 element it has to show — plan names, both
  periods, both prices, the renewal sentence naming the App Store, and both legal links — is
  unchanged. Needs a non-subscriber view on a device where the products are live, which is the same
  state §16c's price-claim row is waiting for.

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
- ⬜ **Sitting out is dead code.** `GameContext` exposes `toggleSittingOut` and `@poker/core`
  implements and tests `sitOut`, but no component calls it — there is no control anywhere in the
  dealer UI. Either wire it up or delete the path; until then a player who leaves is unseated and a
  new game started.

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
