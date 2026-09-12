# Roadmap

What's still open, for the next release and beyond. Where an item was already investigated, the
root cause / current state is noted inline so it doesn't need re-discovering — see
[CLAUDE.md](./CLAUDE.md) for the release process and [ARCHITECTURE.md](./ARCHITECTURE.md) for the
full design.

**Completed work does not live here.** Once something ships it's described in
[CHANGELOG.md](./CHANGELOG.md) and the reasoning is in the commit that landed it, so finished items
are removed from this file when a release is cut rather than accumulating as ✅ history.

**Legend:** 🚧 in progress · 🔍 investigated, not yet fixed · 🟡 known gap, accepted · ⬜ not started

## Gambling classification — blocking 1.2.0

**Two things are being removed before 1.2.0 ships: the dealt game's betting engine, and money from
the leaderboard.** This section is the record of why. The betting engine in particular is about to
look like a half-finished feature somebody abandoned, and the next person to find it will be tempted
to finish it. Don't.

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

- **Entitlements cannot cross platforms today.** `revenueCatProvider.ts` calls
  `Purchases.configure({ apiKey })` with no `appUserID` and never calls `logIn()`, so entitlements
  belong to the App Store / Play account rather than the Cognito account. A Pro purchase on iOS has
  no mechanism to unlock anything on the web.
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

### Action items

**The ten items that forced the release's shape are closed and are not repeated here** — the
betting engine and the money on the leaderboard are gone, the table backend with them, and both
questionnaires are answered (4+ on Apple, PEGI 3 on Google, with **Brazil 14+** the one region
above 3). What each one did is in [CHANGELOG.md](./CHANGELOG.md) and the commit that landed it, and
the questionnaire answers themselves are recorded in [STORE_LISTING.md](./STORE_LISTING.md) so the
next release is checked against them rather than re-derived. The reasoning above this heading is
what stays, because it is the evidence base and it is cited from four other files.

**What is left is accepted rather than done:**

1. 🟡 **Residual surface, accepted.** With the betting engine and the leaderboard money gone the app deals cards without wagering and
   keeps a board of games and wins without money — both shapes with 4+ precedent. What remains is
   the **payout calculator**, which computes a prize pool from a real buy-in. Poker Payout Calc does
   exactly that at 4+, so the precedent is good, but it is the last gambling-adjacent surface and
   the one a reviewer would ask about. **The rating is answered per app, not per screen**, so the
   composition argument — a poker app that deals, calculates prize money and keeps a board — is the
   one to expect to lose if one is lost. Accepted deliberately: removing the calculator too would
   gut the feature the release is built on, and it is the single best-evidenced 4+ component in the
   whole product.
2. 🟡 **Guideline 1.2 (user-generated content) — three of four met, and the gap is not the one it
   looks like.** Declaring UGC on the age-rating questionnaire brings the app under 1.2, which asks
   for four things:

   | Requirement                        | State | Where                                                                                                                                 |
   | ---------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
   | Filter objectionable material      | ✅    | `moderation/textFilter.ts`, tested, refuses names and board names                                                                     |
   | Report mechanism + timely response | ✅    | `ReportBoardSheet` → `POST /groups/{id}/report`, a `ContentReports` alarm so a report is actually noticed, and `/support` explains it |
   | **Block abusive users**            | 🟡    | Any member may **leave** a board; an admin may **remove** a member. There is no per-user block                                        |
   | Published contact information      | ✅    | `poker.blinds.buzzer@gmail.com` on `/support`, with a 2-business-day commitment                                                       |

   **The block requirement is defensible as built, and here is the argument.** Nobody can reach you
   unless you redeemed their invite link — there is no discovery, no feed, no messaging, and no way
   to be added to a board you did not join. The only content another person can put in front of you
   is a board name or a player name, and **leaving the board removes all of it**. For a closed,
   invite-only group, "leave" _is_ the block. Apple's own February 2026 clarification points the
   other way — it extended 1.2 to apps that "connect strangers even briefly", which this
   deliberately does not.

   **The real gap is a EULA, and it is cheaper to close.** There is **no terms page, no EULA link
   and no zero-tolerance statement anywhere** in the app or on the site — and a EULA with a
   zero-tolerance clause is the item 1.2 rejection letters cite most often, more than the block.
   Closing it needs **no binary change**: set the License Agreement field in App Store Connect (the
   standard Apple EULA is accepted) and publish a short `/terms` page carrying the zero-tolerance
   clause. Both are console and web only, so neither risks the build.

   **Do both before submitting**, and say the block argument in the review notes rather than waiting
   to be asked — see the hand-off section in [STORE_LISTING.md](./STORE_LISTING.md). A per-user
   block is worth building if a reviewer pushes back, and not before: it would mean deciding what
   blocking even means on a shared board somebody else administers.

3. 🟡 **UMP/ATT consent is still a placeholder** (`useAdsConsent.ts`). Serving AdMob to EEA/UK
   without a certified CMP is a live gap, pre-existing and separate from this work.

### How the listing copy is judged — moved here from `STORE_LISTING.md`

Both of these were in the listing file, where they sat between blocks of copy somebody was trying to
paste. They are decisions about the copy rather than copy, so they belong with the rest of the
record — and keeping the reasoning in one place is what stops two files disagreeing, which is
exactly what happened when both described the Individual-developer-account rule and only one of them
called it unresolved.

### Honest declaration is the whole strategy

Apple removes developers for _"trying to trick the review process"_ and _"manipulate ratings"_, and
says plainly: _"if you're dishonest, we don't want to do business with you."_ **The route to a ban is
under-declaring a poker game, not having one.** Answer both questionnaires from the built binary
rather than from the listing copy, and record the answers given so the next release can be checked against
them. Apple's and Play's IARC are independent and need not agree.

### Copy that reads badly next to a gambling question

Not errors — the listing is honest — but each of these is a sentence a reviewer weighing a gambling
question will read, so each is worth a deliberate decision rather than inheriting it:

| Where                  | Text                                                   | Why it is worth changing                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS keywords           | `casino`, `bet`                                        | **Changed.** See the keywords section — removed and replaced at the same character count.                                                                                                               |
| Both long descriptions | "not a casino app full of settings you'll never touch" | **Changed** to "at somebody's kitchen table". It was a line about simplicity, but it put `casino` in the copy of an app that now deals cards.                                                           |
| Both long descriptions | "settles the money before it turns into an argument"   | **Kept, softened** to "settles who won what". The original is a good line and true of a payout calculator; "the money" beside a dealt game invites the real-money question the app does not need asked. |
| Play release notes     | "half in cash, half onto your own head"                | **Moot** — progressive bounties are removed with the betting engine, so the sentence goes with the feature. It was the most gambling-flavoured line in the listing.                                     |
| iOS release notes      | "Knockouts are tracked, and bounties finally add up"   | **Moot** — knockout attribution needs pots, which are gone.                                                                                                                                             |
| Both                   | "buy-in", "prize", "pot", "payout", "winnings"         | Fine, and correct — this is what a tournament calculator is for. Do not sanitise these into vagueness; a listing that will not say what the app does is worse than one that does.                       |
| Both long descriptions | "blinds, **betting**, side pots, the showdown"         | **Changed.** It described a betting game the binary no longer contains — the same metadata-accuracy failure as under-declaring, pointed the other way.                                                  |

**What not to do, in both directions.** Do not describe the dealt game as less than it is to duck a
rating — that is the failure mode that costs a rejection _and_ the resubmission. And now that the
betting is going, do not leave copy describing betting that the binary no longer has: an app that
under-delivers against its own listing is the same accuracy problem wearing the other hat. **Write
the listing from the built binary, every time.**

## The week, in order

**1.2.0 ships _with_ the backend, and the backend is now up.** This section used to say the
opposite — "ship 1.2.0 before touching the backend" — which was written when 1.2.0 had no server
features in it and was exactly backwards. Sharing, accounts and the shared leaderboard are the
release.

The steps below are kept as the record of what had to happen before the build could be cut; the
ones that are done say so. What is left is Club products and the manual testing pass.

**Steps 1 to 3 are done and are not repeated here** — SES production access granted 2026-09-04,
`PokerBackend-prod` deployed, and `backendConfig` pointing at it (PR #204). The runbook for all
three lives in [`apps/infra/README.md`](./apps/infra/README.md#standing-up-production), which is
where it belongs: it is needed again the next time a stack is stood up, and never again for this
release.

One line from it is worth keeping in front of whoever works here next: **setting `backendConfig` to
`DEV_BACKEND` is the documented way to work against the throwaway stack, and that edit must never
be committed.**

### 4. Club products — done

`club_monthly`/`club_yearly` on Apple, one `club` subscription with `monthly` and `yearly` base
plans on Play, and both mapped in RevenueCat to **`club` _and_ `pro`**. The paste blocks and the two
traps — Play prices entered ex-tax, base plans starting inactive — are in
[STORE_LISTING.md](./STORE_LISTING.md).

**Apple has not approved the subscriptions yet**, and until it does §16b's 13 billing rows cannot
run. They attach to the 1.2.0 submission rather than being approved separately.

### 5. The testing pass

The bulk of [RELEASE_TESTING.md](./RELEASE_TESTING.md) is still unrun, heaviest in the
_Leaderboard_, the blind editor and _Payouts_. §14b has been opened on both pools — the provider
configuration is proven on prod, and a **completed** sign-in is not, which is the highest-value row
left in the file.

**It got shorter.** §13 was 38 rows and is now 17: the betting engine it tested is gone, so blinds
posting, fold/check/call, raise validation, side pots, finishing order and every save-to-leaderboard
row went with it. The replacements are the passing-the-phone rows, which are the only ones that
matter now — and the ones no synthetic tap could verify on the iOS simulator, so they have never
been exercised by anything but a human.

- **§14–§17 are new** and need the setup above plus **two devices** — one phone cannot see any of
  the sharing failures worth finding.
- **16 rows are blocked until the app is on a store track.** Play Billing cannot be exercised from a
  local build at all, so purchase, restore and cancel are unverifiable until then. That is why the
  submission goes to the **testing track first, never straight to production**.
- **Android has seen almost none of this.** Several features were looked at on an iOS simulator
  only, and synthetic taps do not work here — so assume the first real tap finds something.

### 6. Cut the release

The steps in [CLAUDE.md](./CLAUDE.md): roll the changelog into a dated heading, clear the finished
items out of this file and reset `RELEASE_TESTING.md`, build and submit **from the release branch**
to the testing track, promote once the blocked rows pass, merge PR #147, tag the built commit, then
delete the branch.

### Still open, not blocking the release

- 🟡 **The dashboard is generated, not designed.** An alarm status row over a graph per alarm. Fine
  as a starting point; it will want a real layout once somebody has watched it during a game night.

### What is still code, for when you want me building again

**Both things that used to sit here have shipped**, and the reasons given for them being hard were
wrong in the same way — each assumed a dependency that did not exist.

The shared clock's transport was said to need "the realtime API stood back up"; it needed three HTTP
routes and a polling loop. Sign in with Apple and Google were said to be waiting on credentials and
on the federated-MAU question; the credentials are in `cdk.json` and Secrets Manager, and the MAU
question was answered on 2026-09-05 (below, and it is the cheap answer).

What is left here is genuinely nothing. The next thing to build is whatever the testing pass turns
up.

**Not on this list, deliberately: the multiplayer table.** "The app side of the table — subscribe,
apply events, predict optimistically, reconcile" sat here for months and reads like the obvious next
thing to build. It is not available. A server-authoritative table is a betting engine, and betting
chips is simulated gambling under Apple's definition — 18+, PEGI 18, and on an Individual developer
account possibly no submission at all. See
[Gambling classification](#gambling-classification--blocking-120). Building it means accepting that,
deliberately, not discovering it afterwards.

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

**Read [Gambling classification](#gambling-classification--blocking-120) first.** The betting half of
this feature is being removed before 1.2.0 ships, so several items below describe behaviour that is
on its way out. They are kept until the work lands so the removal can be checked against them.

- ⛔ **Bet sizing, and every other betting gap, is moot.** Any amount between the minimum raise and
  all-in can currently be typed, with Min / Pot / All in filling the field. A slider was the obvious
  next step. **Do not build it** — the whole betting surface goes.
- 🟡 **After the cut, the game cannot know who finished where, and must not pretend to.** Busting is
  a chip event; with no chips there is nothing to observe. A host-entered "sitting out" flag is a
  statement of intent, not an observed elimination, so ordering by it would present a guess as a
  fact. Auto-recording a night to the leaderboard goes with it — nights are recorded by hand through
  `RecordResultSheet`, which already exists.
- 🟡 **Progressive bounties go with the betting engine.** They need knockout attribution, which needs
  pots. Flat bounties survive — they are just a number in the payout calculator.
- 🟡 **The deal is not cryptographic.** `Math.random` is passed straight to the engine rather than
  a seeded PRNG, which avoids the brute-forceable 32-bit seed space that `createRandom` warns
  about — but it is still not a cryptographic source. **This survives the cut**: dealer mode still
  deals, and the caveat still applies. Accepted for a table passing one phone around.

## Accounts — live as of 1.2.0

## Backend: groups, players and results — the server half is done

**Shipped in #180.** One DynamoDB table, no index: a group's partition holds the board and
its members, an account's holds its boards and its claims. Sixteen routes, all authorized rather
than merely authenticated. Account deletion releases claims, hands on a group whose last admin is
leaving, and deletes the Cognito user **last** — after which no token exists to retry with.

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

### Club does not launch on one feature — revisited 2026-09-09

**The removals cost Club its roadmap, not Pro its features.** Everything cut for the rating —
betting, money on the leaderboard, the auto-recorded game — was Pro. Pro lost surface area and kept
its shape. Club lost both of the features `products.ts` names as its future:

| Named as Club's future  | Status                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Playing a hand together | **Permanently dead.** It needs the deleted table backend, and multiplayer betting is the 18+ trigger. Do not revive it |
| The shared clock        | **Alive, and cheaper than this file assumed** — see the transport section                                              |

That left hosting as Club's only feature, which is the worst thing a subscription can be in a
category where every serious competitor is one-time €2.99–7.99. **So Club launches with three, or it
does not launch:**

| Club at launch — €2.99/mo, €19.99/yr                                    | State                                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| Host a shared board                                                     | ✅ shipped                                                 |
| **Shared clock**                                                        | 🚧 built; needs a transport, which is now a small job      |
| **Push notifications** — "game night tomorrow", "Ann recorded a result" | ⬜ not started; **there is no push infrastructure at all** |

**On notifications: `expo-notifications` is only used for local timer alerts.** No push tokens, no
APNs/FCM, nothing server-side. But the cheap path is real: `getExpoPushTokenAsync()` on the device,
the token stored on the account row, and the existing groups handler POSTing to **Expo's push
service** when a result is recorded. No new AWS services and no certificates — Expo holds the
credentials. That is the difference between a couple of days and a week.

**A web view of your board is blocked, and not by the rating.** `revenueCatProvider.ts` calls
`Purchases.configure({ apiKey })` with **no `appUserID` and never calls `logIn()`**, so entitlements
belong to the store account rather than the Cognito account and a website cannot tell whether a
visitor subscribes. Same blocker that killed web-only poker further up this file. It needs
`logIn(cognitoSub)`, which touches every purchase and restore path — worth doing one day, not before
Club launches.

**None of the three touches the rating.** It turns on betting, wagering and accumulating money
across sessions. A synced countdown, a reminder and a standings page are none of those.

### The number that should temper all of this

**Pro has sold 9 copies in two months at €2.99** — roughly €10/month net, as of 2026-09-09. Packaging
is not what limits that; discovery is. Club with three features will not change it either, and the
honest reading is that **weeks of transport and push work are a poor trade against an audience of
nine payers** unless the install and conversion numbers say something different. Get those before
committing to the build. This section describes the right shape for Club when it is worth building —
not an argument that now is the moment.

### The seam is built. What is left is store configuration and one decision.

`ENTITLEMENT_CLUB` is read alongside `pro`, exposed as `hasClub`, and `clubPolicy` in `@poker/core`
holds every rule above — tested, because the mistakes are all of the kind that are invisible in
review and obvious in a store review. **Which boards reach the server is a per-board question**
(`boardSyncs`): a shared board always syncs because the host is paying for it, a local board only
if you host. A board that does not sync is never announced _and_ never queues writes.

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

- ✅ **The consequence: one month of Club is a permanent Pro — and at parity that costs nothing.**
  This entry used to say Pro was "around €5–6" and conclude the leak was real and unresolved. **Pro
  is €2.99.** Setting the Club monthly to €2.99 as well makes subscribing-and-cancelling cost
  _exactly_ what buying Pro costs, so the arbitrage disappears by construction — no receipt logic,
  no minimum-months rule, nothing to build. The problem was an artefact of a wrong number, and it is
  worth recording that it took reading the store to find it.

  **The annual is where the thinking should go instead.** €2.99/month is €35.88 a year against a
  €2.99 app — a 12× ratio, and a lot to ask of this audience. €19.99/year is the realistic seller;
  treat the monthly as the trial rather than the plan.

Guests are unaffected either way. They never paid.

- **Not before 1.2.0 ships.** §1 billing already blocks submission and can only be exercised from a
  Play track; a second product makes that pole longer.

## Backend: the plan

The architecture, the observability design, environments and deploys, the cost model and the build
order are in [`apps/infra/README.md`](./apps/infra/README.md). Decided: an **HTTP API + Lambda** for
requests, **OpenTelemetry to Grafana Cloud** with CloudWatch scraped
for what OTel cannot see from inside a function, **two stacks in one account** deployed by GitHub
Actions over OIDC, and **accounts end-to-end as the first deployable slice**.

## Backend: before anything connects to it

### Sign in with Apple and Google — built, and reaching both providers

**Shipped in 1.2.0.** The buttons are the first two on the sign-in card, ahead of email; the
credentials are in `cdk.json` and Secrets Manager for both stages, and the prod pool carries both
identity providers. Checked on 2026-09-11 against `PROD_BACKEND`: both open
`pokerkit.auth.us-east-1.amazoncognito.com` and reach the provider's own page, with Apple's carrying
the app's icon and name from the Services ID record.

**A completed sign-in is still unverified** — that needs real provider credentials, and it is the
highest-value open row in `RELEASE_TESTING.md`. The reasoning below is kept because it is why the
providers sit ahead of email, which is a decision somebody will otherwise reverse.

**Social becomes the primary path and email/password the fallback.** Not because it is fashionable,
but for one measurable reason: the emailed confirmation code is the highest-drop-off step in any
sign-up, and Apple and Google have already verified the address. It also takes SES off the critical
path, so a code that never arrives stops being the difference between having users and not.

**Not social-only.** Keeping email/password costs little now that it is built, and buys three
things: somebody who wants neither a Google nor an Apple account can still sign up, the website has
a path if accounts ever reach it, and nobody is locked to a platform account for a board that is
supposed to follow _them_ across phones. Password reset stays SES's job — a much safer place for it
than every new user.

**Not before 1.2.0 ships.** It adds native modules, which invalidate every dev-client binary, to a
release that is feature-complete with an unrun testing pass. Nothing here is urgent enough to
reopen that.

#### The order, and what only a person can do

1. ⬜ **Credentials, and they gate everything below.** Google: an OAuth client in Google Cloud
   Console. Apple: a Services ID, Team ID, Key ID and a `.p8` private key from the Apple Developer
   portal. **The `.p8` is a real secret** — `.gitignore` already excludes `*.p8`, and it belongs in
   context or Secrets Manager, never in the repository.
2. ⬜ **Both, or neither, on iOS.** App Store guideline 4.8 requires Sign in with Apple wherever
   another third-party provider is offered. There is no ship-Google-first increment.
3. ⬜ **CDK: `UserPoolIdentityProviderGoogle` and `UserPoolIdentityProviderApple`.** Never
   `UserPoolIdentityProviderOidc` — it works, looks identical on the login screen, and bills every
   user on the 50-MAU federated tier instead of the 10,000-MAU one (see below). Follow
   `mailIdentity`/`apiDomain`: opt-in through `cdk.json` context, so `cdk synth` and the tests keep
   working with no credentials.
4. ⬜ **Decide account linking before writing the app half. This is the trap.** Cognito treats
   `Google_1234` and the email/password user as **two different accounts** even with the same
   address — so somebody who signed up with a password in 1.2.0 and later taps _Continue with
   Google_ silently gets a second, empty one, and their boards appear to have vanished. Either link
   on first federated sign-in with `AdminLinkProviderForUser`, or refuse and tell them to use their
   password. **Whichever is chosen needs a test**: the failure is silent, looks exactly like data
   loss, and only affects users who predate the feature — which by then is everybody.
5. ⬜ **App: `expo-apple-authentication`, plus Google.** Both native, so `npm run pods -w
@poker/mobile` and a rebuilt dev client on both platforms before anything on screen means
   anything.
6. ⬜ **`AuthProvider` grows one method, not a parallel path.** `AuthContext.tsx` already swaps
   `stubAuthProvider` for `createCognitoAuthProvider` behind that seam and nothing above it knows
   which it got. A `signInWithProvider(provider, idToken)` beside the existing `signIn` keeps that
   true; a second context beside it would not.
7. ⬜ **The account screen re-orders rather than grows.** Apple and Google above the fold, email and
   password behind a _Use email instead_ disclosure. The screens exist — layout, not new UI.
8. ⬜ **Hide My Email is not an error case.** Apple relays give a `@privaterelay.appleid.com`
   address that works and can later be revoked. Identity keys on the Cognito subject and survives
   that; anything assuming a reachable address does not. Nothing today emails users outside sign-up
   and reset, and that is now worth keeping deliberately.
9. ⬜ **Testing rows for §14** — first federated sign-up, returning federated sign-in, the linking
   case from step 4, Hide My Email, and cancelling the provider sheet halfway.

- ✅ **Cognito's federated-MAU pricing — resolved 2026-09-05, and the answer is the cheap one.**
  Social providers are _not_ federated for billing: AWS's pricing page puts them explicitly with
  direct sign-in — "users who sign in directly with their credentials from a user pool (includes
  social identity providers)" — so Apple and Google draw on the **10,000 free MAU** of Essentials,
  not the 50-MAU SAML/OIDC tier. Both pools are already `ESSENTIALS`, which is the default and is
  not set in the CDK. **The trap is a config choice, not the bill:** adding Google as a generic
  OIDC provider rather than the built-in Google one is billed federated and looks identical on the
  login screen. Use `UserPoolIdentityProviderGoogle`/`...Apple`, never `...Oidc`. See
  [`apps/infra/README.md`](./apps/infra/README.md#social-sign-in-bills-on-the-normal-tier--resolved-2026-09-05).

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
