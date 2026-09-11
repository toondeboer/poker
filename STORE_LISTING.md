# Store listing copy

**Everything that gets typed into a store console, and nothing else.** Optimised for the phrases
people search: **poker timer, blinds timer, tournament clock, poker clock, blinds buzzer**.

**Copy the blocks verbatim.** Every character count here has been measured rather than estimated,
and the ones that sit exactly on a limit say so.

> The on-device name stays short — `app.json` `name: "Poker Timer"`. The name and subtitle below are
> the **store-listing** ones, which are separate fields.

## Contents

**What to paste**

- [App Store Connect](#app-store-connect--every-field)
- [Google Play](#google-play--every-field)
- [In-app purchases and subscriptions](#in-app-purchases-and-subscriptions)
- [Release notes — v1.2.0](#release-notes--v120)
- [Notes for Review](#notes-for-review-app-store-connect)

**What to answer**

- [Submission checklist — every console step](#submission-checklist--every-console-step)

**Why the copy is what it is** — read once, not every release

- [Age rating, and the gambling question](#age-rating-and-the-gambling-question)
- [Field rules: what each store accepts](#field-rules-what-each-store-actually-accepts)
- [Housekeeping](#housekeeping)

---

## At a glance — the short fields

The long ones have their own blocks below; these are the ones that are a line each.

| Console  | Field              | Value                                                       |
| -------- | ------------------ | ----------------------------------------------------------- |
| **ASC**  | App Name (≤30)     | `Poker Blinds Timer & Buzzer` — 27                          |
| **ASC**  | Subtitle (≤30)     | `Tournament clock & blind timer` — 30, exactly on the limit |
| **ASC**  | Keywords (≤100)    | see [App Store Connect](#app-store-connect--every-field)    |
| **ASC**  | Privacy Policy URL | `https://poker-timer.toondeboer.com/privacy-policy`         |
| **ASC**  | Support URL        | `https://poker-timer.toondeboer.com/support`                |
| **ASC**  | License Agreement  | `https://poker-timer.toondeboer.com/terms`                  |
| **Play** | Delete account URL | `https://poker-timer.toondeboer.com/support#delete-account` |
| **Play** | Feature graphic    | `store-assets/android/feature-graphic.png`                  |

## App Store Connect — every field

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

`151` chars. Re-count in the console before saving.

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
kind of false that reads as a bait-and-switch when the app then asks for an email. `2848` chars,
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
• Run one clock on every phone at the table (Club) — start a shared clock, everybody types in the code, and the whole table watches the same countdown. Anybody can pause it or skip a level. Joining is free: only the person who starts the clock subscribes
• Save tournament presets (Pro) — store your blind structure & round length, load them in one tap
• Choose your alarm sound (Pro) — pick from a few bundled alarm packs beyond the default

An account is optional and only takes an email — you need one to share a board or to have your boards follow you to a new phone. The timer, the structures and a leaderboard of your own all work without one.

Whether it's a casual poker night with friends or a bigger home tournament, Poker Blinds Buzzer keeps the blinds clock visible and on schedule so everyone can focus on the cards, not the clock — and settles who won what before it turns into an argument.

Go Pro to remove ads, deal a hand, work out the payouts, chop the last pot, keep a leaderboard, save presets and pick your alarm sound — or just support an indie developer. The timer itself stays free.
```

## Google Play — every field

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
  • Run one clock on every phone at the table (Club) — start a shared clock, everybody types in the code, and the whole table watches the same countdown. Anybody can pause it or skip a level. Joining is free: only the person who starts the clock subscribes
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

  `2833` chars, against a 4,000 limit — the block above is indented two spaces to
  sit inside this list, so counting its lines as written overstates the text that
  actually gets pasted by two per line. Play mines keywords from the first two
  sentences (the part visible before "Read more"); those keep the same opening
  and gain "it deals".

<a id="age-rating"></a>

## In-app purchases and subscriptions

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

**Display Name (≤30):** `Pro — Deal, Payouts & Board` — 27

**Description** — short field, **verify the limit in the console**, it is tight:

```
No ads, deal a hand, payouts, leaderboard.
```

`42` chars.

### Google Play — Monetize → Products → `pro_lifetime`

**Name (≤55):** `Pro — Deal, Payouts, Leaderboard & No Ads` — 41

**Description (≤200):**

```
Unlock Pro: deal a hand when nobody brought cards, work out payouts and bounties, chop the last pot, keep a leaderboard per group, save presets, and remove all ads. One-time purchase.
```

`183` chars.

### Club — paste blocks

**Apple's limits are the binding constraint: 30 characters for a display name, 45 for a
description.** These fit, measured:

**`club_monthly`**

| Field                     | Value            | Count |
| ------------------------- | ---------------- | ----- |
| Reference Name (internal) | `Club Monthly`   | —     |
| Display Name (≤30)        | `Club — Monthly` | 14    |

```
Share boards and your clock. Joining is free.
```

`45` chars — **exactly on Apple's limit**. If a console rejects it, use
`Share a board and clock. Joining is free.` (41).

**`club_yearly`** — same description, and:

| Field                     | Value           | Count |
| ------------------------- | --------------- | ----- |
| Reference Name (internal) | `Club Yearly`   | —     |
| Display Name (≤30)        | `Club — Annual` | 13    |

**Subscription Group Display Name**, set once for the group:

```
Club
```

**Play's store listing for the subscription** (its own name and description field, separate from
the base plans):

```
Club
```

```
Share a leaderboard and a clock with the people you play with. Joining a board somebody shares is always free — only the person who shares it subscribes. Includes everything in Pro.
```

`181` chars. Play's limit is more generous than Apple's, so this is the version that can afford to
say the whole thing.

### Why "joining is free" is in a 45-character field

It is the misunderstanding most likely to kill the feature: without it the listing reads as though
every player at the table needs a subscription. In 45 characters there is room for the offer or for
that sentence, and that sentence wins.

### App Store Connect — Auto-Renewable Subscription → `club_monthly` **and** `club_yearly`

**Created 2026-09-09.** Two subscriptions in one group, **€2.99/month and €19.99/year** — the
monthly matching Pro's €2.99 exactly, which is what closes the subscribe-and-cancel arbitrage. See
the monetization section of `ROADMAP.md`.

**Apple's fields here are short: display name 30 characters, description 45.** These fit:

| Field                              | `club_monthly`                                  | `club_yearly`   |
| ---------------------------------- | ----------------------------------------------- | --------------- |
| Reference Name (internal)          | `Club Monthly`                                  | `Club Yearly`   |
| Display Name (customer-facing)     | `Club — Monthly`                                | `Club — Annual` |
| Description (**exactly 45 chars**) | `Share boards and your clock. Joining is free.` | same            |
| Subscription Group Display Name    | `Club` — set once for the group                 |                 |

If a console rejects the description on length, `Share a board and clock. Joining is free.` is 41.

- **"Joining is free" earns its place in 45 characters.** Without it the listing reads as though
  every player at the table needs a subscription, which is the misunderstanding most likely to kill
  the feature.
- **"Club", never "Pro+".** Pro+ would say the thing people already bought had been demoted, and it
  has not changed at all.
- **Each subscription needs a review screenshot** of the purchase UI — the Club section on the
  paywall, which exists as of the 3.1.2 work. Completing this metadata is what moves them to
  _Ready to Submit_, and that is when StoreKit starts returning them in sandbox, so the screenshot
  and the first sight of that section come at the same moment.
- **The first subscription must be submitted with an app version**, not on its own. It attaches to
  the 1.2.0 submission.

### Google Play — Monetize → Subscriptions → one `club` subscription, two base plans

**Not two subscriptions, and the difference matters.** Google models one subscription containing
base plans; two separate subscriptions would let somebody hold both at once, where base plans make
Google enforce one at a time and handle the monthly↔annual switch properly.

| Piece             | Value                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| Subscription ID   | `club` — permanent, never changeable                                           |
| Base plan         | `monthly`, auto-renewing, 1 month                                              |
| Base plan         | `yearly`, auto-renewing, 1 year                                                |
| Base plan ID rule | lowercase letters, digits and hyphens — **no underscores**, unlike product ids |

**Prices are entered ex-tax on Play, and that is not how Apple works.** Google adds VAT on top of
what you type and rounds to a tidy ending, so €2.99 entered shows a Dutch buyer €3.59. To land on
the same customer-facing price as Apple, enter **2.47** (→ €2.99) and **16.52** (→ €19.99), then
_read the displayed price back_ and nudge it, because the rounding is not fully predictable. Pro is
already priced this way — €2.47 entered, €2.99 shown — so this matches what is live rather than
introducing a second convention.

⚠️ **Base plans start inactive.** An inactive one cannot be bought and RevenueCat will not see it.

**Both stores or neither** — one platform able to subscribe and the other not is worse than neither.

### RevenueCat

**The four product identifiers, which do not match across stores and are not meant to:**

| Store     | Monthly        | Annual        |
| --------- | -------------- | ------------- |
| App Store | `club_monthly` | `club_yearly` |
| Play      | `club:monthly` | `club:yearly` |

Play's colon form is `subscriptionId:basePlanId`, which is Google's shape rather than a typo. **The
app never matches on these names** — `getClubPlans` finds the packages by `packageType`, precisely
because a name would work on one platform and silently return nothing on the other.

- **Attach all four to `club` _and_ to `pro`.** A shared board is a leaderboard and the leaderboard
  is Pro, so a subscriber without it hosts a board they cannot open. `entitlementsFrom` defends
  against the missed checkbox, so it is survivable rather than shipped — set it anyway, or restores
  and receipts disagree with the app.
- **Both Club packages go in the _current_ offering, beside Pro.** The app reads
  `offerings.current` and nothing else, and `getProPackage` finds Pro by product id rather than by
  position specifically so that a second product in the same offering cannot make the Pro button buy
  a subscription.
- The `pro_lifetime` product description mirrors the store; if you keep an
  internal description/notes field, match the copy above so the dashboard reads
  the same.

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

**The shared clock is in the notes now, and the reason it used to be out has gone.** This section
said it "still has no transport", which was true right up until 1.2.0 gave it one — three HTTP
routes and a polling transport, Club to host and free to join. Push notifications arrived in the
same stretch. Both are real features a person can use, so both are described below; leaving them out
would undersell the release for a reason that expired.

**One thing stays out either way**: Sign in with Apple and Google, which need credentials nobody has
created. That is not something a person can use.

**Notes are editable until the moment of submission** — in App Store Connect right up to _Submit for
Review_, in Play Console right up to rollout. §18 and §19 of `RELEASE_TESTING.md` have not been run
on two devices yet; if either feature does not survive that pass, these bullets come back out before
anything is submitted rather than being discovered by a reviewer.

### iOS — "What's New in This Version" (App Store Connect)

**No emoji in this field** — see [the note below](#ios-metadata-emoji). Bullets are the typographic
`•` (U+2022), which is punctuation rather than emoji and renders everywhere.

```
• Deal a hand (Pro). When you have chips but no cards — or nobody can find the deck — pass the phone round the table and the app deals: two cards each, then the flop, turn and river when you are ready, and it reads the showdown at the end. Your own two cards stay hidden until you tap. You play with the chips already in front of you.

• A leaderboard for every group you play with (Pro). Thursdays and the office game are kept apart, each with their own players and history.

• Share a board with the people you play with (Club). Send them a code, they paste it in, and the board — every player, every night already on it — is on their phone too. Whoever recorded the game does not have to be the one who reads it out. Joining is free: only the person who shares a board subscribes.

• One clock on every phone at the table (Club). Start a shared clock and the app gives you a code; everybody else types it in and watches the same countdown, with the same blinds and the same level. Anybody at the table can pause it or skip a level, because whoever is nearest the phone should not have to be the one who runs the game. Joining is free: only the person who starts the clock subscribes.

• Your boards follow your account, not your phone (Club). Sign in somewhere else, or reinstall, and they come back. Record a night with no signal and it is kept and sent when there is some, so the pub with one bar of reception stops being a problem.

• A buzz when somebody adds a game night to a board you are on. It names the board and nothing else, and it never goes to whoever just recorded the result — they were holding the phone.

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
⏱️ Run one clock on every phone at the table (Club) — same blinds, same countdown.
🔔 A buzz when somebody adds a game night to a board you're on.
♻️ Games survive the app closing, and sync when you have signal again.
```

`433` chars — inside the 500-char Play Console limit, with 67 to spare.

**433 and not 429, and the difference is the whole reason to state it.** A store counts UTF-16 code
units; four of those emoji (🃏 👥 🔗 🔔) are one code point each and two units each, so counting
characters the obvious way undercounts by four. The other two (⏱️ ♻️) are a BMP character plus a
variation selector and count the same either way, which is exactly why "count the emoji" is not a
rule that works. Every number in this file is the UTF-16 one, because that is the number the console
is comparing against its limit. A block that is 497 by one measure and 503 by the other is rejected.
`npm run check:listing` does this counting in node, whose `String.length` is UTF-16 — python's `len`
is code points and will disagree.

**"Joining one is free" earns its place in 500 characters**, because the misunderstanding most
likely to kill the feature is a table assuming all six of them need a subscription. One line, and it
is the line that decides whether anybody tries it.

**Deliberately not mentioned:** Sign in with Apple and Google, which need credentials nobody has
created; and the record-a-game prompt's conditions. Those nuances belong in the app, not in 500
characters of store copy. The shared clock used to be on this list for a reason that has since
expired — it has a transport now, and a line of its own above.

---

## Submission checklist — every console step

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

- **Does the app contain gambling or simulated gambling?** **No.** This is the answer that matters
  most in Europe, and it is honest only because the betting engine went. PEGI's descriptor is for
  content that "encourages or teaches gambling", meaning "games of chance normally carried out in
  casinos or gambling halls" — narrower than the "any simulated gambling" this file used to claim,
  and a dealer holding no chips is not in it. **If Play comes back above 3+, appeal**: _Balatro_ was
  rated PEGI 18 for explaining poker hands and had it cut to 12 on appeal. See `ROADMAP.md`.
- **Does the app contain user-generated content shared with others?** **Yes.** Board and player
  names on a shared board. Declare it: the app has the filter, the report flow and the contact
  address that this answer commits you to.
- **Does the app share user-provided content?** **Yes**, between members of a board only.
- **Ads:** yes, and the app requests non-personalized only.
- **Purchases:** yes — one non-consumable and two subscriptions.

**Result, answered 2026-09-11: PEGI 3.** North America all ages, most other regions 3+ or all
ages — and **Brazil 14+**, which is the only region above 3 and is expected rather than a warning.
ClassInd rates _jogos de azar_ on the theme rather than on mechanics, so a poker app lands there
whatever the betting engine does; it sets a minimum age in one market and blocks nothing. Worth
knowing so that "3+ on Google" is read as PEGI 3 with one regional variation rather than as a single
global number.

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
- A shared tournament clock. The host starts a session and the app shows a short code; other
  players type it in and see the same countdown, blind level and structure. The server holds one
  short-lived row per session containing the clock state and nothing else — no names, no amounts,
  no cards. It expires by itself after six hours.
- Push notifications, through Expo's push service, sent only to members of a board somebody else
  just recorded a game on. The notification contains the board's name and a fixed sentence; no
  player name and no amount ever appears on a lock screen.
- A card dealer. The phone shuffles and deals two cards per player, turns the flop, turn and river
  when the host taps, and reads the showdown. Each player's own cards stay hidden until they tap,
  and hide again when the phone moves on. It holds no chips and has no betting controls.
- A payout calculator and a chop calculator. Both are one-shot calculators for money that changes
  hands away from the phone. Neither settles nor stores anything.

Removed in this version: an earlier build of 1.2.0 contained a betting engine for the dealt game
(fold/check/call/raise, pots, side pots). It was removed before submission, along with all monetary
amounts on the leaderboard. There is no wagering anywhere in this app.

To review the dealer, the shared board and the shared clock, Pro and Club are required. Please use
the demo account below, which has both entitlements granted.
```

**The three blocks together are 3,442 characters against a 4,000-character field**, so they fit —
but only just. Anything added here from now on has to come out of something else; check the total in
the console rather than assuming there is room.

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

**The EULA gap is closed, bar one console field.**
[`/terms`](https://poker-timer.toondeboer.com/terms) is published and live, with the zero-tolerance
clause that 1.2 rejection letters cite most often. What is left is to point App Store Connect's
**License Agreement** field at it (Apple's standard EULA is also accepted). That is console only —
**it needs no new binary**, so it cannot delay the build.

**Leave a demo account and password in the review notes**, with Pro and Club granted in RevenueCat —
a reviewer who cannot get past the paywall cannot review the feature the release is built on, and
that is a rejection for reasons that have nothing to do with the app.

## Age rating, and the review note

**4+ on Apple, PEGI 3 on Google**, answered 2026-09-11. The reasoning — the two triggers, the
comparable-app evidence, PEGI's actual wording, the Individual-developer-account question — lives in
[the gambling section of ROADMAP.md](./ROADMAP.md#gambling-classification--blocking-120) and is not
repeated here. It used to be, and the two copies drifted apart: this file stated the
Individual-account rule as settled fact while ROADMAP correctly called it unresolved.

**The questionnaire answers themselves** are in
[the submission checklist](#submission-checklist--every-console-step) above, because those get typed
into a console.

What stays here is what gets **said to a reviewer**:

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

## Field rules: what each store actually accepts

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
- **Our own v1.1.3 notes contained emoji, and v1.1.3 shipped.** Whatever happened on 1.1.4, that
  is evidence the field does not reject them outright — which is the point: the risk is
  inconsistent review, not a validation error you would find out about in seconds. (Those notes
  are no longer in this file; `git log -- STORE_LISTING.md` has them.)
- So the decision here isn't "emoji are banned", it's **an asymmetric bet**: emoji buy a little
  scannability, and a metadata rejection costs a review cycle measured in days on a release that's
  already built and submitted. **Write the iOS notes without them.**

**Android "Release notes" — plain text too, but emoji are fine.** Play has no equivalent history of
emoji rejections, and v1.1.3 shipped with them. Limit is 500 characters per
language, which is tight enough that emoji and locale shifts genuinely matter — re-count in the
console before saving. Play strips HTML in this field as well.

**Both stores:** typographic punctuation is safe on either side — `•`, `—`, `→`, curly quotes. It's
pictographic emoji that carry the risk, not Unicode in general.

## Housekeeping

- Re-validate char counts in the console before saving (emoji/locale can shift).
- Keep title/subtitle stable once ranked; iterate keywords + screenshots first.
