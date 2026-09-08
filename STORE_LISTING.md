# Store listing copy (ASO)

Source of truth for App Store / Play Store listing text. Optimized for the
keyword phrases people actually search: **poker timer, blinds timer, tournament
clock, poker clock, blinds buzzer**.

> On-device name (home screen) stays short — keep `app.json` `name: "Poker
Timer"`. The fields below are the **store-listing** name/subtitle, set in App
> Store Connect / Play Console, which are separate from the installed app name.

## iOS — App Store Connect

### App Name (≤30 chars) — `27`

```
Poker Blinds Timer & Buzzer
```

Seeds the highest-weight field with _poker, blinds, timer, buzzer_.

### Subtitle (≤30 chars) — `30`

```
Tournament clock & blind timer
```

Adds _tournament, clock_ (→ "tournament clock", "poker clock") without repeating
the title.

### Keywords (≤100 chars, comma-separated, NO spaces) — `99`

```
holdem,texas,card,game,night,countdown,chips,dealer,level,structure,alarm,home,stopwatch,payout,pot
```

Rules applied: no spaces after commas (wasted chars), no word already in the
name/subtitle (Apple indexes those automatically — don't repeat _poker, blinds,
timer, buzzer, tournament, clock_), singulars only. Apple recombines single
words across name+subtitle+keywords into phrases, so e.g. "card" + "game" →
"card game", "poker" + "night" → "poker night".

**`casino` and `bet` were removed in 1.2.0, and should not go back.** They were
there for recombination — "casino clock", "poker bet" — and they were never
worth much: nobody looking for a home-game blinds timer searches either. What
changed is the downside. **Keywords are metadata a reviewer reads**, and this
release is one where the app has to answer a gambling question convincingly (see
[Age rating](#age-rating) below). Volunteering the two words that most look like
real-money gambling, in a field a reviewer scans, is asking a question you do not
want asked. `payout` and `pot` replace them at exactly the same character count
and describe features the app actually has.

### Promotional text (≤170 chars, editable anytime without review)

**Stale as of 1.2.0** — it describes the 1.1.x app. Replacement:

```
The blinds clock for home poker night — and now it deals, too. Big readable timer, custom levels, payouts worked out, and a leaderboard for your group.
```

`154` chars. Re-count in the console before saving.

Previous, kept as the record of what was live:

```
The dead-simple blinds clock for home poker night. Big readable timer, custom blind levels, and a loud buzzer when it's time to raise. Live Activities on the Lock Screen.
```

### Description (≤4000 chars)

**Currently live** (stale, and more so with every release — no Pro, no presets, no Sound Packs, and
now no dealt game, accounts or boards either. Same root cause as the `pro_lifetime` IAP copy gap
above), `790` chars. **Replace it with the draft below when 1.2.0 goes up**; this block is kept only
as the record of what was live:

```
Make every poker night a professional experience. Poker Blinds Buzzer is designed for players and hosts who want to focus on the game, not the clock. Whether you're running a friendly home game or a competitive tournament, Poker Blinds Buzzer keeps the action flowing and everyone on the same page.

Features:
Customizable blind levels – Set duration, small blind and big blind values to fit your game.

Automatic blind increases – Blinds update seamlessly without interrupting gameplay.

Clear audio alerts – Know exactly when it's time to raise the stakes or take a break.

Optimized for iPhone – Clean, intuitive design that's quick to set up.

No more arguments about when blinds should go up or when the next break starts — Poker Blinds Buzzer handles it all so you can enjoy the game.
```

**Drafted replacement** — mirrors the Play long description's structure (glanceable timer, custom
blinds, background alerts, Pro bullets, CTA), swapping in Live Activities for the iOS-specific
Lock Screen bullet already promised in the promotional text above.

**Rewritten for 1.2.0.** The previous draft described an app with no dealt game and told people
there was "no account, no sign-up" — both false by the time this ships, and the second one is the
kind of false that reads as a bait-and-switch when the app then asks for an email. `2775` chars,
against a 4,000 limit:

```
The simple poker timer & tournament clock for home poker night. A big, easy-to-read blinds timer and a loud buzzer mean nobody has to squint at their phone mid-hand to know when it's time to raise. And when nobody brought a deck, it deals.

Built for real Texas Hold'em tournament nights at somebody's kitchen table:

• Big, glanceable timer — read the clock from across the table
• Fully custom blind levels — set your own blind structure and round lengths, add or remove levels anytime, free
• Loud buzzer & notification when a level ends, even if your phone is locked or the app is in the background
• Live Activities on the Lock Screen — check the current blind level without unlocking your phone
• Deal a hand (Pro) — no cards, or nobody can find the deck? Pass the phone round and the app deals: two cards each, then the flop, turn and river when the table is ready, and it reads the showdown at the end. Your own two cards stay hidden until you tap. You play with the chips already in front of you
• Work out the payouts (Pro) — enter the buy-in and the app splits the pool across the places that pay, with bounties, rebuys and add-ons counted. Every place below the winner is a round number you can count straight out of the pot
• Chop the last pot (Pro) — ending early? Everyone left keeps the lowest prize still live and the rest splits by chip stack, so nobody drops below the place they'd locked up
• Keep a leaderboard (Pro) — who's won most, with a separate board for each group you play with. Recording a night is two taps per player and no typing
• Share a board with your table (Club) — send a code, they paste it in, and the whole board is on their phone too. Joining is free: only the person who shares a board subscribes
• Save tournament presets (Pro) — store your blind structure & round length, load them in one tap
• Choose your alarm sound (Pro) — pick from a few bundled alarm packs beyond the default

An account is optional and only takes an email — you need one to share a board or to have your boards follow you to a new phone. The timer, the structures and a leaderboard of your own all work without one.

Whether it's a casual poker night with friends or a bigger home tournament, Poker Blinds Buzzer keeps the blinds clock visible and on schedule so everyone can focus on the cards, not the clock — and settles who won what before it turns into an argument.

Go Pro to remove ads, deal a hand, work out the payouts, chop the last pot, keep a leaderboard, save presets and pick your alarm sound — or just support an indie developer. The timer itself stays free.
```

## Android — Google Play (reuse at launch — P1 item 4)

- **Feature graphic (1024×500, required for the store listing):**
  [`store-assets/android/feature-graphic.png`](./store-assets/android/feature-graphic.png) —
  reuses the app icon's own colors (sampled directly from
  `apps/mobile/src/assets/images/icon.png`) so it reads as the same brand rather than a redesign.
  Generated from `store-assets/android/generate-feature-graphic.js` (an SVG built in code,
  rasterized with `sharp`) rather than a static PNG, so copy/color tweaks are a text edit + re-run
  (`node store-assets/android/generate-feature-graphic.js`) instead of redoing it in a design tool.
- **Title (≤30 chars):** `Poker Blinds Timer & Buzzer`
- **Short description (≤80 chars):**
  ```
  Tournament blinds clock with a big timer, custom levels & a loud buzzer.
  ```
- **Long description (≤4000 chars):** Play has no keyword field — keywords are
  mined from the long description, so the phrases (_poker timer, blinds timer,
  tournament clock, poker clock, blind levels, poker night, Texas Hold'em_) are
  woven into the first two sentences (the part visible before "Read more") and
  the feature bullets below.

  ```
  The simple poker timer & tournament clock for home poker night. A big, easy-to-read blinds timer and a loud buzzer mean nobody has to squint at their phone mid-hand to know when it's time to raise. And when nobody brought a deck, it deals.

  Built for real Texas Hold'em tournament nights at somebody's kitchen table:

  • Big, glanceable timer — read the clock from across the table
  • Fully custom blind levels — set your own blind structure and round lengths, add or remove levels anytime, free
  • Loud buzzer & notification when a level ends, even if your phone is locked or the app is in the background
  • Keeps timing in the background — the clock won't drop out mid-tournament
  • Deal a hand (Pro) — no cards, or nobody can find the deck? Pass the phone round and the app deals: two cards each, then the flop, turn and river when the table is ready, and it reads the showdown at the end. Your own two cards stay hidden until you tap. You play with the chips already in front of you
  • Work out the payouts (Pro) — enter the buy-in and the app splits the pool across the places that pay, with bounties, rebuys and add-ons counted. Every place below the winner is a round number you can count straight out of the pot
  • Chop the last pot (Pro) — ending early? Everyone left keeps the lowest prize still live and the rest splits by chip stack, so nobody drops below the place they'd locked up
    • Keep a leaderboard (Pro) — who's won most, with a separate board for each group you play with. Recording a night is two taps per player and no typing
  • Share a board with your table (Club) — send a code, they paste it in, and the whole board is on their phone too. Joining is free: only the person who shares a board subscribes
  • Save tournament presets (Pro) — store your blind structure & round length, load them in one tap
  • Choose your alarm sound (Pro) — pick from a few bundled alarm packs beyond the default

  An account is optional and only takes an email — you need one to share a board or to have your boards follow you to a new phone. The timer, the structures and a leaderboard of your own all work without one.

  Whether it's a casual poker night with friends or a bigger home tournament, Poker Blinds Timer & Buzzer keeps the blinds clock visible and on schedule so everyone can focus on the cards, not the clock — and settles who won what before it turns into an argument.

  Go Pro to remove ads, deal a hand, work out the payouts, chop the last pot, keep a leaderboard, save presets and pick your alarm sound — or just support an indie developer. The timer itself stays free.
  ```

  Updated for **v1.2.0**: the capabilities that release adds behind the paywall
  — dealing a hand, payouts, the chop, progressive bounties, the leaderboard and
  sharing — are now called out as bullets. They are also the reason the closing
  line changed from "everything else stays free" to "the timer itself stays
  free": Pro is no longer a cosmetic tier, and describing it as if it were sets
  up a refund request.

  **Two removals matter more than the additions.** "No account, no sign-up, no
  clutter" is gone: 1.2.0 has accounts, and a listing that promises their absence
  is one that reads as a bait-and-switch the moment the app asks for an email.
  And "not a casino app full of settings you'll never touch" is gone with it —
  it was a good line about _simplicity_, but it puts the word `casino` in the
  first screen of copy on an app that deals cards and has to answer a gambling
  question at review. The replacement, "at somebody's kitchen table", says the
  same thing about scale without the word.

  **Rewritten again when the betting engine came out.** Both descriptions
  promised "blinds, betting, side pots, the showdown"; the binary now deals,
  turns the streets and reads the showdown, and nothing in it bets. Progressive
  bounties and the auto-record bullet went with the engine.

  In exchange the description now **says plainly that the account is optional**,
  which is the single most useful sentence in it: the misunderstanding likeliest
  to cost installs is somebody assuming a blinds timer now needs a login.

  `2775` chars, against a 4,000 limit. Play mines keywords from the first two
  sentences (the part visible before "Read more"); those keep the same opening
  and gain "it deals".

<a id="age-rating"></a>

## Age rating — the answer is "no simulated gambling", and here is why

**The app stays 4+ on Apple and 3+ on Google, and the honest answer to the simulated-gambling
question is no** — because two things are being removed before 1.2.0 ships: the betting engine, and
money from the leaderboard. See
[ROADMAP.md](./ROADMAP.md#gambling-classification--blocking-120) for the full decision record and
the comparable-app evidence.

**An earlier draft of this section said 18+, and that was right for the app as built.** Apple defines
Simulated Gambling as _"Betting or wagering without using real money or in-game currency that can be
exchanged for real money."_ The dealt game's fold/check/call/raise and Min/Pot/All-in controls are
betting, and as a headline Pro feature they are frequent, not infrequent — which is 18+. What
changed is the app, not the reading.

**13+ was never available**, for three separate reasons worth recording so nobody re-litigates it:
Apple's 13+ requires _infrequent_ simulated gambling; **PEGI has auto-rated any simulated gambling 18
since 2020** and reaches Google Play through IARC, so Europe has no 13+ tier for this; and Apple's
restriction on gambling apps from **Individual developer accounts** — which this is — would not care
about the tier either way.

**That last one is an unresolved risk, not a settled fact**, and this file used to state it as
though it were. It traces to an October 2018 announcement; the current guideline 5.1.1(ix) says apps
that _"provide services in"_ highly regulated fields — gambling among them — _"should be submitted
by a legal entity … and not by an individual developer"_, which arguably excludes a play-money game.
Against enforcement-as-written: **Cash Out Poker carries Apple's `Gambling` descriptor today and
ships under a seller name with no entity suffix.** It is moot for 1.2.0 regardless — with betting
gone there is no gambling descriptor for the rule to attach to — and matters only if betting ever
comes back. See [ROADMAP.md](./ROADMAP.md#gambling-classification--blocking-120).

**The second trigger was nearly missed.** Comparable apps show the line is not dealing and not
calculating, but **accumulating real money across sessions**: a virtual card dealer is 4+ and a
one-shot payout calculator is 4+, while a home-game buy-in/cash-out scorekeeper and a poker bankroll
tracker are both **18+**. The leaderboard as built kept a running "won 120" per player, which is the
bankroll-tracker shape. Money comes off the board for that reason.

### What to say if a reviewer asks

There is no real money in the app: no wagering, no purchase of chips, no cash-out, and no currency
symbol rendered anywhere. The payout screen is a calculator for money that changes hands at a
kitchen table and never touches the app, and nothing it produces is stored or synced. That is the
difference between simulated gambling (a rating) and real-money gambling (a different rulebook,
which this app is not in).

The app deals cards and evaluates a showdown; it holds no chips, no stakes and no pots. The
leaderboard records games played, wins and finishing positions — no amounts.

**Say it plainly and do not embroider it.** An earlier draft of this file had to hedge, because the
leaderboard was still syncing `buyIn`, `bounty` and `winnings` to a shared board. With money off the
board that hedge is gone and the simple claim is true. If a future change puts money back on the
board, this paragraph stops being accurate — check it before repeating it.

### Paste-ready review note

Everything above, in the form the App Review notes field wants. The same wording is published at
[/support](https://poker-timer.toondeboer.com/support) under "Money, and what the app does with it", so a
reviewer who checks finds the two agreeing.

```
Nothing is wagered, staked or paid through this app. There is no way to bet in it, buy chips in it,
or cash anything out of it — no wallet, no balance, and no payment of any kind between players. The
only money the app handles is its own one-time Pro purchase, taken by Apple.

The card table deals: it shuffles, deals two cards to each player, turns the flop, turn and river
when the host taps, and reads the showdown. It holds no chips and has no betting controls — players
use the physical chips already in front of them.

The payout screen is a calculator. Enter a buy-in and it works out what each place wins, the way a
spreadsheet would. It settles nothing and stores nothing.

The leaderboard records who played, who won and where people finished. No monetary amount is stored
or shared anywhere in the app.
```

**Check it against the binary before pasting it.** It is accurate as of the 1.2.0 build; it is a
statement Apple can hold the app to, and a wrong one is far more expensive than no statement.

### Honest declaration is the whole strategy

Apple removes developers for _"trying to trick the review process"_ and _"manipulate ratings"_, and
says plainly: _"if you're dishonest, we don't want to do business with you."_ **The route to a ban is
under-declaring a poker game, not having one.** Answer both questionnaires from the built binary
rather than from this file, and record the answers given so the next release can be checked against
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

## Submission hand-off — every console step, with the answers

**Nothing in this section has been entered anywhere yet.** It exists so the answers are decided
once, from the built binary and the code, and **recorded** — ROADMAP item 10 asks for exactly that,
so the next release can be checked against these rather than re-deriving them under time pressure.

Derived on 2026-09-08 from the code, not copied from a PR description. Where an answer turns on
something in the repo, the file is named so it can be re-checked.

### 1. Apple age rating (App Store Connect → App Information → Age Rating)

**Apple overhauled this questionnaire in July 2025.** The tiers are now 4+ / 9+ / **13+ / 16+ / 18+**
(12+ and 17+ are gone), and there is a **Capabilities** section that has nothing to do with
chance-based activities. Responses were required by 31 January 2026, so this may already be
half-answered on the existing listing — check what is there before assuming it is blank.

**Chance-Based Activities**

| Question               | Answer              | Why                                                                                                         |
| ---------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Gambling**           | **No**              | No real money and no in-game currency exchangeable for it. No wallet, no balance, no consumable IAP         |
| **Simulated Gambling** | **None**            | Apple's definition is "betting or wagering". The betting engine was removed before 1.2.0 — see `ROADMAP.md` |
| **Contests**           | **Infrequent/Mild** | The board records games held offline. Infrequent is 4+; frequent would be 13+                               |
| **Loot Boxes**         | **No**              | No purchasable randomness anywhere in the repo                                                              |

**Capabilities** — the new section, and the one most likely to be missed:

| Question                    | Answer  | Effect on the tier                                                                              |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| **User-Generated Content**  | **Yes** | Disclosure only. Player and board names are typed by one member and shown to the others         |
| **Advertising**             | **Yes** | Disclosure only. AdMob banner on the free tier                                                  |
| **Messaging and Chat**      | **No**  | There is no way to send anybody a message                                                       |
| **Social Media**            | **No**  | **Would force 13+.** A shared board is not a feed — no likes, comments, shares or amplification |
| **Unrestricted Web Access** | **No**  | **Would force 16+.** No embedded browser; the only external links open the system browser       |

**In-App Controls:** Parental Controls **No**, Age Assurance **No**. Both are disclosure-only.

**Expected result: 4+.** If the questionnaire returns anything else, stop and find out which answer
moved it rather than adjusting an answer to reach 4+ — under-declaring is the one thing that
genuinely endangers a developer account.

### 2. Google Play IARC (Play Console → Policy → App content → Content rating)

Answered **independently** of Apple's; the two need not agree, and IARC asks differently.

- **Does the app contain gambling or simulated gambling?** **No.** PEGI auto-rates _any_ simulated
  gambling 18, so this is the answer that matters most in Europe — and it is honest only because the
  betting engine went.
- **Does the app contain user-generated content shared with others?** **Yes.** Board and player
  names on a shared board. Declare it: the app has the filter, the report flow and the contact
  address that this answer commits you to.
- **Does the app share user-provided content?** **Yes**, between members of a board only.
- **Ads:** yes, and the app requests non-personalized only.
- **Purchases:** yes — one non-consumable and two subscriptions.

**Expected result: 3+ (PEGI 3).**

### 3. App Privacy (ASC) and Data Safety (Play)

**The app no longer qualifies as "Data Not Collected".** Re-derived from the code: `apps/mobile`
declares exactly two third-party SDKs that collect anything — `react-native-google-mobile-ads` and
`react-native-purchases`. **There is no crash reporter and no analytics SDK in the mobile app**, so
nothing to declare under Diagnostics.

| Data                           | Collected           | Linked to the user | Purpose                 | Where it comes from                                      |
| ------------------------------ | ------------------- | ------------------ | ----------------------- | -------------------------------------------------------- |
| **Email address**              | Yes, if you sign up | Yes                | App Functionality       | Cognito username _and_ attribute — see `auth/cognito.ts` |
| **User ID** (Cognito `sub`)    | Yes, if you sign up | Yes                | App Functionality       | `ACCOUNT#<accountId>` in DynamoDB                        |
| **Other User Content**         | Yes, if you share   | Yes                | App Functionality       | Board names, player names, report free-text              |
| **Purchase history**           | Yes                 | Yes                | App Functionality       | RevenueCat entitlement state                             |
| **Device ID / advertising ID** | Yes, free tier only | No                 | Third-Party Advertising | AdMob                                                    |

**Not collected, and worth stating because a poker app invites the question:** no location of any
precision, no contacts, no photos, no health data, no browsing history, no financial information —
and **no monetary amount of any kind**. Money came off the leaderboard deliberately; `groups.ts`
whitelists fields so a stale client sending `winnings`, `buyIn` or `bounty` has them stripped
server-side.

**"Used for Tracking": No — and this is load-bearing.** `BannerAdSlot.tsx` sets
`requestNonPersonalizedAdsOnly: true`, so the app does not ask for personalized ads and does not
join identifiers across apps. **Do not answer Yes here**, and do not turn personalized ads on
without first doing the UMP/ATT work below.

**The consent gap, stated plainly.** `useAdsConsent.ts` is a placeholder: it resolves immediately
and requests nothing. There is **no ATT prompt and no `NSUserTrackingUsageDescription`** in
`Info.plist`, and no Google UMP flow. Non-personalized-only is the reason this is currently
defensible, and it is the "simplest compliant posture" the hook's own comment claims. It is still a
live gap for EEA/UK, it is **pre-existing and not 1.2.0's doing**, and it is tracked in `ROADMAP.md`.
Serving personalized ads without a certified CMP would not be defensible.

### 4. Club products — sharing is unreachable without these

**The paywall currently sells something that cannot be bought.** Create in both stores, then map in
RevenueCat. Ids are in `packages/core/src/monetization/products.ts` and must match exactly:

| Product        | Type                        | Where                                                    |
| -------------- | --------------------------- | -------------------------------------------------------- |
| `pro_lifetime` | Non-consumable              | Already exists                                           |
| `club_monthly` | Auto-renewable subscription | ASC → Subscriptions, and Play → Monetize → Subscriptions |
| `club_yearly`  | Auto-renewable subscription | Same, same group as monthly                              |

**Both Club products must grant `club` _and_ `pro` entitlements in RevenueCat.** A shared board is a
leaderboard, so Club without Pro is a broken state. `entitlementsFrom` in `clubPolicy.ts` defends
against a missed checkbox, so it is survivable rather than shipped — but set it correctly.

**Both stores or neither.** One platform able to buy Club and the other not is worse than neither.

### 5. Store console copy

Everything above the age-rating section in this file, typed in as-is: name, subtitle, keywords,
promotional text, description — plus the **IAP descriptions in all three consoles** (ASC, Play, and
RevenueCat), which are the ones most often forgotten.

Android also still wants the feature graphic uploaded — `store-assets/android/feature-graphic.png`,
see `ROADMAP.md`.

### 6. Notes for Review (App Store Connect)

**Guideline 2.3.1 requires new functionality to be described with specificity** — "generic
descriptions will be rejected" — and this release changed a great deal. Paste the money paragraph
from _Paste-ready review note_ above, then this:

```
New in this version:

- Accounts (optional). Email/password, Sign in with Apple, and Sign in with Google, backed by
  Amazon Cognito. Everything in the app works signed out; an account exists only to keep boards
  across devices.
- Shared leaderboards. A host can invite others to a board by link. Members see the board's player
  names and the games recorded on it: who played, who won, and finishing positions. No monetary
  amount is stored or shared.
- Reporting and leaving a board, plus a name filter, because board and player names are
  user-generated and visible to other members.
- A card dealer. The phone shuffles and deals two cards per player, turns the flop, turn and river
  when the host taps, and reads the showdown. Each player's own cards stay hidden until they tap,
  and hide again when the phone moves on. It holds no chips and has no betting controls.
- A payout calculator and a chop calculator. Both are one-shot calculators for money that changes
  hands away from the phone. Neither settles nor stores anything.

Removed in this version: an earlier build of 1.2.0 contained a betting engine for the dealt game
(fold/check/call/raise, pots, side pots). It was removed before submission, along with all monetary
amounts on the leaderboard. There is no wagering anywhere in this app.

To review the dealer and the shared board, Pro and Club are required. Please use the demo account
below, which has both entitlements granted.
```

**Add this too, because Guideline 1.2 will otherwise be asked about.** The app declares
user-generated content, and 1.2 wants a way to block abusive users. Say the argument rather than
waiting for the question:

```
On user-generated content: the only content one person can put in front of another is a board name
or a player name, both filtered on entry and both limited to 40 characters. Boards are invite-only.
There is no discovery, no feed, no messaging, and no way to be added to a board you did not join by
redeeming a link. Any member can leave a board at any time, which removes every name on it from
their device; a board admin can remove a member outright. Offensive content can be reported from
inside the app, and reports are monitored and answered — see the Support page.
```

**Before submitting, close the EULA gap.** There is currently no terms page and no zero-tolerance
statement anywhere, and that is the item 1.2 rejection letters cite most often. Set the **License
Agreement** field in App Store Connect (Apple's standard EULA is accepted) and publish a short
`/terms` page with a zero-tolerance clause. Both are console and web only — **neither needs a new
binary**, so neither can delay the build.

**Leave a demo account and password in the review notes**, with Pro and Club granted in RevenueCat —
a reviewer who cannot get past the paywall cannot review the feature the release is built on, and
that is a rejection for reasons that have nothing to do with the app.

## In-app purchase — `pro_lifetime` description (keep in sync with the paywall)

The paywall (`PRO_FEATURES` in `apps/mobile/src/components/paywall/Paywall.tsx`)
promises **seven** things as of 1.2.0 — **remove ads · deal the cards · buy-ins,
payouts and bounties · a leaderboard for every group · save & load tournament
presets · choose your alarm sound · support the dev**. Update the store IAP copy
in all three consoles to match.

**This drifted again while 1.2.0 was being built**, exactly as the note below
warns: the list here said six and omitted dealing a hand, which is the headline
of the whole release. Read `PRO_FEATURES` before touching any of the fields
below, every time — it is one grep and it is the only thing that is definitely
right.

This has now drifted twice: the paywall was found still selling the 1.1.4
feature set during the 1.2.0 cycle, and the store copy one level out had the
same problem. **The paywall is the source of truth** — read `PRO_FEATURES` and
work outwards, rather than editing these fields from memory.

### App Store Connect — In-App Purchase → `pro_lifetime`

- **Display Name (≤30 chars):** `Pro — Deal, Payouts & Board` (`27`)
- **Description** (short field — **verify the limit in the console**, it's tight):
  ```
  No ads, deal a hand, payouts, leaderboard.
  ```
  `42` chars.

### Google Play — Monetize → Products → `pro_lifetime`

- **Name (≤55 chars):** `Pro — Deal, Payouts, Leaderboard & No Ads` (`41`)
- **Description (≤200 chars):**
  ```
  Unlock Pro: deal a hand when nobody brought cards, work out payouts and bounties, chop the last pot, keep a leaderboard per group, save presets, and remove all ads. One-time purchase.
  ```
  `183` chars.

### App Store Connect — Auto-Renewable Subscription → `club_monthly` **and** `club_yearly`

**Not created yet** — the price is decided (€2–3/month, €12–15/year) and nothing else here is.
See `ROADMAP.md` for why the figure sits well below the category's subscription medians.

- **Reference Name / Display Name:** Club — the working name; "Pro+" is deliberately avoided
  because it would say the thing people already bought had been demoted, and it has not changed.
- **Two SKUs in one subscription group**, monthly and annual, because both prices are decided.
- **Must grant both `club` and `pro` entitlements in RevenueCat.** A shared board is a leaderboard
  and the leaderboard is Pro, so a subscriber without it hosts a board they cannot open. The app
  enforces this too (`entitlementsFrom`), so a missed checkbox is survivable rather than shipped —
  but set it anyway, or restores and receipts disagree with the app.
- **Description must say joining is free**, or it reads as though every player at the table needs a
  subscription, which is the misunderstanding most likely to kill the feature.

### Google Play — Monetize → Subscriptions → `club_monthly` **and** `club_yearly`

Same product, same entitlements, same copy. **Both stores or neither** — one platform able to
subscribe and the other not is worse than neither.

### RevenueCat

- The `pro_lifetime` product description mirrors the store; if you keep an
  internal description/notes field, match the copy above so the dashboard reads
  the same. No entitlement/offering changes — just the text.

## Release notes — v1.2.0

**Both platforms together**, as in 1.1.4.

This is a much bigger release than 1.1.4, and **most of it is behind the paywall**: dealing a hand,
payouts, the chop calculator, leaderboards, groups and sharing are all Pro. The long description and
the Pro feature lists in both stores need updating too, not just these notes — the in-app paywall
was found still selling the 1.1.4 feature set during this cycle, and the store copy has exactly the
same failure mode one level out. See `ROADMAP.md`'s Play listing item.

**Accounts and shared boards are now in scope**, which they were not when the notes below were
drafted — so the bullets need a pass before they go in. What changed is a decision, not a
capability: the code shipped switched off because there was no production backend to point it at,
and now there is going to be. Three things gate it, and **none of them is code**:

- **SES production access.** Cognito's own sender is capped and lands in spam, so real sign-up
  depends on it. It is a support request with a queue, and until it is granted SES delivers only to
  addresses that have themselves been verified. **This is the one that cannot be patched afterwards**
  — shipping before it is granted means account creation is broken and a store update does not fix
  it, because the wait is on AWS either way.
- **`PokerBackend-prod` deployed**, and `backendConfig` pointed at it. A 1.2.0 build must never put
  real accounts in the development pool, which exists to be thrown away.
- **The Club subscription created in both stores.** Sharing is unreachable without it, so the
  bullets must not promise it until the products exist.

**There is a kill switch**, and it is worth knowing about before writing anything that promises
these features: `GET /config` on the backend turns accounts or sharing off in about ninety seconds,
without a store release. If something misbehaves after submission, that is the recovery — not a
patch.

**Two things stay out of the notes either way**: the shared clock, which still has no transport, and
Sign in with Apple and Google, which need credentials nobody has created. Neither is something a
person can use.

### iOS — "What's New in This Version" (App Store Connect)

**No emoji in this field** — see [the note below](#ios-metadata-emoji). Bullets are the typographic
`•` (U+2022), which is punctuation rather than emoji and renders everywhere.

```
• Deal a hand (Pro). When you have chips but no cards — or nobody can find the deck — pass the phone round the table and the app deals: two cards each, then the flop, turn and river when you are ready, and it reads the showdown at the end. Your own two cards stay hidden until you tap. You play with the chips already in front of you.

• A leaderboard for every group you play with (Pro). Thursdays and the office game are kept apart, each with their own players and history.

• Share a board with the people you play with (Club). Send them a code, they paste it in, and the board — every player, every night already on it — is on their phone too. Whoever recorded the game does not have to be the one who reads it out. Joining is free: only the person who shares a board subscribes.

• Your boards follow your account, not your phone (Club). Sign in somewhere else, or reinstall, and they come back. Record a night with no signal and it is kept and sent when there is some, so the pub with one bar of reception stops being a problem.

• An account, if you want one. Email and a password, a code to confirm it, and you can delete the account and everything on our servers from inside the app.

• Payouts and the chop (Pro). Set a buy-in and see exactly what each place wins, bounties, rebuys and add-ons included. When the table agrees to end it early, the chop splits what is left by chip stack without anybody dropping below the place they had already locked up.

• Share the payouts or the standings straight to your group chat.

• A game in progress now survives the app closing. Shut it between hands, or have the phone die mid-evening, and reopening puts you back at the same table with the same stacks.

• Android no longer asks twice for notification permission, and stale Live Activities are cleared away instead of piling up on the lock screen.

Thanks for playing — feedback always welcome.
```

Re-count in App Store Connect before saving; the limit is 4000 characters and this is well inside it.

### Android — "Release notes" (Play Console, ≤500 chars per language)

```
🃏 Deal a hand (Pro): no cards? The app deals. Flop, turn, river and the showdown.
👥 A leaderboard per group — Thursdays and the office game kept apart.
🔗 Share a board with your table (Club). Joining one is free.
♻️ Games survive the app closing, and sync when you have signal again.
```

`421` chars — fits the 500-char Play Console limit. Re-count in the
console before saving, since emoji and locale can shift it.

**"Joining one is free" earns its place in 500 characters**, because the misunderstanding most
likely to kill the feature is a table assuming all six of them need a subscription. One line, and it
is the line that decides whether anybody tries it.

**Deliberately not mentioned:** the shared clock, which has no transport and is unreachable; Sign in
with Apple and Google, which need credentials nobody has created; and the record-a-game prompt's
conditions. Those nuances belong in the app, not in 500 characters of store copy.

---

## Release notes — v1.1.4

**Symmetric this time.** Both platforms shipped v1.1.3 together, so both sets of notes cover the
same one version's worth of changes — unlike v1.1.3 below, where the two stores were a version
apart.

Everything headlined here is **free**, not Pro: the blind-structure screen, the generator and the
keep-awake behaviour are all available to every user. Nothing new was added behind the paywall in
this release, so the long description needs no change.

The **website** was updated for these features alongside the release (`apps/web`): the landing
page's feature grid gained a Structure Generator card and its Tournament Structures card now
describes the editor, and a claim that the app "works seamlessly in the background" was corrected —
it overstated what the app does now that a backgrounded round deliberately advances only one level.
Keep the two in step: store copy and landing-page copy describe the same app.

### iOS — "What's New in This Version" (App Store Connect)

**No emoji in this field** — see [the note below](#ios-metadata-emoji). Bullets are the typographic
`•` (U+2022), which is punctuation rather than emoji and renders everywhere.

```
• Blind structure now has its own screen. Edit every level in one place, insert or duplicate a level anywhere in the schedule, and tap a level number to jump the tournament straight to it.

• New structure generator. Pick a starting blind, how many levels, and a speed — Slow, Standard or Turbo — and get a schedule built the way real casino sheets are, with every blind a multiple of your smallest chip.

• The screen now stays on while a round is counting down, so the timer stays put on the table.

• Blinds are bigger and easier to read on the Lock Screen timer.

• Applying an edited structure keeps your place in the tournament instead of restarting at Level 1.

Thanks for playing — feedback always welcome.
```

`714` chars.

### Android — "Release notes" (Play Console, ≤500 chars per language)

```
♠️ Blind structure gets its own screen — edit every level in one place, insert or duplicate anywhere, and tap a level to jump straight to it.
✨ New structure generator: pick a starting blind, a level count and a speed, and get a casino-style schedule where every blind fits your smallest chip.
📱 The screen stays on while a round runs.
⏱️ Bigger, clearer blinds on the Lock Screen timer.
✅ Editing your structure now keeps your place in the tournament.
```

`452` chars — fits the 500-char Play Console limit, but with little room to spare: re-count in the
console before saving, since emoji and locale can shift it.

**Deliberately not mentioned:** the Pause/Resume/Stop buttons on the Live Activity and notification.
They were built during this cycle and descoped before shipping (see `ROADMAP.md`), so no user has
ever seen them and announcing their absence would only confuse.

<a id="ios-metadata-emoji"></a>

### Field rules: what each store actually accepts

**iOS "What's New" — plain text, and keep emoji out of it.**

|        |                                                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format | Plain text only. No Markdown, no HTML, no rich text — `**bold**` renders as literal asterisks. Line breaks and blank lines _are_ preserved, so paragraphs and `•` bullets are the whole formatting toolkit. |
| Length | 4000 characters (not stated in Apple's own help pages; it's what the field enforces).                                                                                                                       |
| Emoji  | **Don't.** See below.                                                                                                                                                                                       |

On emoji specifically, be clear about what is and isn't established, because this cost a submission
once and the reasoning matters more than the rule:

- **Apple publishes no rule against emoji in release notes.** Its App Store Connect help pages for
  app information and for localizable properties say nothing about character sets, formatting, HTML
  or emoji for this field — checked directly, not inferred. Plenty of shipping apps use emoji in
  "What's New" today.
- **What is documented is a pattern of rejections under guideline 5.2.5 (Intellectual Property) for
  using Apple's emoji**, applied inconsistently enough that
  [TechCrunch covered developers assuming a crackdown](https://techcrunch.com/2018/02/08/theres-no-app-store-emoji-apocalypse-just-inconsistent-policy-enforcement/)
  and concluded the policy hadn't changed, only its enforcement.
- **Our own v1.1.3 notes below still contain emoji**, and v1.1.3 shipped. Whatever happened on
  1.1.4, that's evidence the field doesn't reject them outright — which is the point: the risk is
  inconsistent review, not a validation error you'd find out about in seconds.
- So the decision here isn't "emoji are banned", it's **an asymmetric bet**: emoji buy a little
  scannability, and a metadata rejection costs a review cycle measured in days on a release that's
  already built and submitted. Write the iOS notes without them. The v1.1.3 block is left as it
  shipped rather than rewritten — this file is a record of what was submitted, not a style guide.

**Android "Release notes" — plain text too, but emoji are fine.** Play has no equivalent history of
emoji rejections, and the existing v1.1.3 notes shipped with them. Limit is 500 characters per
language, which is tight enough that emoji and locale shifts genuinely matter — re-count in the
console before saving. Play strips HTML in this field as well.

**Both stores:** typographic punctuation is safe on either side — `•`, `—`, `→`, curly quotes. It's
pictographic emoji that carry the risk, not Unicode in general.

## Release notes — v1.1.3

**Asymmetric on purpose:** iOS is live at v1.1.2 (already has tournament
presets + the in-app review prompt), so its notes only cover what's new since
then. Android is live at v1.1.1 (skipped 1.1.2 entirely — see `CHANGELOG.md`),
so its notes cover **two versions' worth** of changes: presets are new to
Android users here, not just Sound Packs.

### iOS — "What's New in This Version" (App Store Connect)

```
🔊 Sound Packs (Pro): choose the alarm that plays when a round ends — Classic Alarm, Classic Beep, Bell Chime, or Double Buzz — with a 3-second preview before you pick.
📣 Share Poker Blinds Buzzer with your table in one tap.
Thanks for playing — feedback always welcome!
```

`269` chars (App Store Connect's limit is generous, ~4000 — kept short on purpose).

### Android — "Release notes" (Play Console, ≤500 chars per language)

```
Big update!
📌 Tournament Presets (Pro): save your blind structure & round length, load them in one tap.
🔊 Sound Packs (Pro): pick your round-end alarm — Classic Alarm, Beep, Bell Chime, or Double Buzz — with a quick preview.
📣 Share the app with your table in one tap.
✨ Smoother, more polished experience throughout.
```

`317` chars — fits the 500-char Play Console limit.

## Notes

- Re-validate char counts in the console before saving (emoji/locale can shift).
- Keep title/subtitle stable once ranked; iterate keywords + screenshots first.
