# Store listing copy

**Everything that gets typed into a store console, and nothing else.** Optimised for the phrases
people search: **poker timer, blinds timer, tournament clock, poker clock, blinds buzzer**.

**Copy the blocks verbatim.** Every character count here has been measured rather than estimated,
and the ones that sit exactly on a limit say so.

> The on-device name stays short — `app.json` `name: "Poker Timer"`. The name and subtitle below are
> the **store-listing** ones, which are separate fields.

## Submitting 1.2.1 — everything to paste

**Candidate 2:** iOS **1.2.1 (35)** and Android **1.2.1 (23)**, built from `0651755`. Candidate 1
(iOS 34, Android 22) is superseded; do not pick it.

**Only the fields below change.** Name, subtitle, keywords, promotional text, descriptions, age
rating, App Privacy and Data Safety all stay as they are; they are recorded further down for
reference.

### iOS — App Store Connect, on the 1.2.1 version page

1. **Build:** select **1.2.1 (35)**.
2. **In-App Purchases and Subscriptions:** click **+** and add **14-day Trial** (`pro_trial_14d`).
   It is reviewed together with this version. If it is not offered, check that it still reads
   _Ready to Submit_ on its own page.
3. **Screenshots:** the iPhone 6.9", iPhone 6.3" and iPad 13" sets uploaded on 2026-11-15 should
   already be there.
4. **What's New in This Version:** paste this. No emoji, on purpose (see
   [Field rules](#field-rules-what-each-store-actually-accepts)).

```
• Try Pro free for 14 days. Everything unlocks and the ads go. Nothing is charged, nothing renews, and what you make during the trial is kept.

• Club has a 14-day free trial too, on both the monthly and the annual plan. Cancel before it ends and you pay nothing.

• A simpler upgrade screen. If you only want the ads gone, the one-time purchase is the first thing you see.

• Report an ad. If an ad turns up that should not be there, a link in Settings sends it to us.

• Ad privacy choices. Where the law asks for it, the app asks before showing ads, and you can change your answer in Settings at any time.

Thanks for playing — feedback always welcome.
```

`655` chars, against a 4,000 limit.

5. **App Review Information → Notes:** keep the paragraph about money that is already there, and
   replace the "New in this version" part below it with this:

```
New in this version:

- A free 14-day trial of Pro. Settings > "Unlock Pro / Remove Ads" opens the paywall; the trial is the "Start 14-day free trial" button under "Unlock Pro". It is the free non-consumable "14-day Trial" (pro_trial_14d), submitted with this version, as Guideline 3.1.1 describes. The text above the button states the trial length, what locks again when it ends, and the price of the full unlock. Nothing is charged and nothing renews. It is only offered to an account that has bought nothing and has not had a trial.
- A 14-day free trial on both Club subscriptions, as a standard introductory offer. The paywall shows it to eligible accounts with the price that follows and the renewal terms; "See Club" on the paywall expands it.
- Google's consent form (UMP) before the first ad in the EEA, UK and Switzerland, and "Ad privacy choices" in Settings to change the answer. Ads stay non-personalized for everyone; there is no tracking and no App Tracking Transparency prompt.
- "Seen an inappropriate ad? Report it" under the Pro card in Settings (Guideline 2.5.18).
```

6. **Add for Review**, then **Submit for Review**.

**If Apple rejects the 14-day Trial but not the app:** delete the first bullet ("Try Pro free for
14 days…") from What's New before resubmitting. The app hides the offer when the product is not
there, so the note would be the only place it exists.

### Android — Play Console

1. **Test and release → Testing → Internal testing**, on release **1.2.1 (23)**: **Promote release
   → Production**.
2. **Release notes:** paste this.

```
🎁 Try Pro free for 14 days: everything unlocked, no ads, nothing charged.
👥 Club has a 14-day free trial too. Cancel before it ends and you pay nothing.
⭐ A simpler upgrade screen: the one-time purchase comes first.
🚩 Report an ad that shouldn't be there, from Settings.
🔒 Ad privacy choices, where the law asks for them.
```

`325` chars, against a 500 limit. The console counts UTF-16 code units; emoji outside the
basic plane count twice, and this number already does.

3. **Rollout:** 100%, or start lower and raise it.
4. **Next → Save → Send for review.** Managed publishing holds the approved release at _Ready to
   publish_; it goes live when you click **Publish** on the Publishing overview.

### After both are live

Correct the date on `CHANGELOG.md`'s 1.2.1 heading to the ship date, merge the release PR into
`main`, and tag the built commit: `git tag -a v1.2.1 0651755`. The full list is step 8 of the release
process in `CLAUDE.md`.

---

## Contents

**This release**

- [Submitting 1.2.1 — everything to paste](#submitting-121--everything-to-paste)

**What is live, field by field** — unchanged in 1.2.1

- [At a glance — the short fields](#at-a-glance--the-short-fields)
- [App Store Connect](#app-store-connect--every-field)
- [Google Play](#google-play--every-field)
- [In-app purchases and subscriptions](#in-app-purchases-and-subscriptions)

**The answers recorded for review and privacy**

- [Submission checklist — age rating, privacy, review notes](#submission-checklist--every-console-step)
- [Age rating, and the review note](#age-rating-and-the-review-note)

**Rules and upkeep**

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

**Live since 1.2.0, unchanged in 1.2.1.** Can be edited at any time without a new version.

```
The blinds clock for home poker night — and now it deals, too. Big readable timer, custom levels, payouts worked out, and a leaderboard for your group.
```

`151` chars.

### Description (≤4000 chars)

**Live since 1.2.0, unchanged in 1.2.1.** `2864` chars, against a 4,000 limit:

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

An account is optional — sign in with Apple, Google or an email. You need one to share a board or to have your boards follow you to a new phone. The timer, the structures and a leaderboard of your own all work without one.

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

  An account is optional — sign in with Apple, Google or an email. You need one to share a board or to have your boards follow you to a new phone. The timer, the structures and a leaderboard of your own all work without one.

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

  `2849` chars, against a 4,000 limit — the block above is indented two spaces to
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

### App Store Connect — In-App Purchase → `pro_trial_14d` (new in 1.2.1)

**The Pro trial, and it only exists on iOS.** App Review Guideline 3.1.1 allows a time-limited
trial in a non-subscription app only as a **free non-consumable** named "XX-day Trial". Google Play
has no free one-time product, so there is nothing to create there; Android records the start date on
the device.

| Field              | Value                                                              |
| ------------------ | ------------------------------------------------------------------ |
| Type               | Non-Consumable                                                     |
| Product ID         | `pro_trial_14d` — must match `PRODUCT_PRO_TRIAL` in `@poker/core`  |
| Reference Name     | `Pro 14-day Trial`                                                 |
| Price              | **Free** (price tier 0)                                            |
| Display Name (≤30) | `14-day Trial` — the naming convention the guideline requires      |
| Review screenshot  | The paywall with the "Start 14-day free trial" button and its text |

**Description:**

```
Try every Pro feature free for 14 days.
```

- **Until this product exists and is at least Ready to Submit, the app shows no trial button on
  iOS.** `isProTrialAvailable` asks the store for it and hides the offer when it is not there, so
  shipping the code before the product is safe.
- **Add it to the 1.2.1 submission**, the same way the Club subscriptions were added to 1.2.0's: a
  new in-app purchase is reviewed together with an app version.
- **RevenueCat: add the product, attach it to no entitlement.** A non-consumable's entitlement
  never expires, which is the opposite of a trial. The app reads the product's purchase date from
  `allPurchaseDates` and counts fourteen days itself. It does not need to be in an offering either;
  the app fetches it by id.
- **The length is in three places that must agree**: the product id, the display name, and
  `PRO_TRIAL_DAYS` in `@poker/core`. Changing it means a new product.

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

### Club free trial — the introductory offer (new in 1.2.1)

**A free trial on a subscription is the store's own offer, set on the product, in both consoles.**
The app has no length of its own: it shows whatever the store returns for this user, and nothing
when the store returns no offer. So this can be configured before or after the code ships.

**App Store Connect** → Subscriptions → the Club group → `club_yearly`, then again for
`club_monthly`:

1. **Subscription Prices** → **+** → **Create Introductory Offer**.
2. Countries: all. Start date: today, no end date.
3. Type: **Free**. Duration: **2 weeks**.
4. Save. An introductory offer does not need its own review.

Apple gives each customer one introductory offer **per subscription group**, so somebody who has
tried the monthly cannot try the annual afterwards. That is the behaviour wanted.

**Play Console** → Monetize → Subscriptions → `club` → for the monthly base plan, then the annual:

1. **Add offer**. Offer ID: `free-trial-14d`.
2. Eligibility: **New customer acquisition** → **Never had this subscription**.
3. Add phase → **Free trial** → **14 days**.
4. **Activate** the offer. A saved offer that is not activated is not returned to the app.

**RevenueCat needs nothing.** It reads the offers from the stores. On Play it selects the
free-trial offer as the default option automatically; if the dashboard has a specific offer pinned
for the product, unpin it.

**What the app does with it**, so the result can be recognised: an eligible user sees
"Annual · 14 days free" with "then €19.99 a year" beneath, the same for monthly, and a terms line
saying it renews at that price unless cancelled a day before the trial ends. Somebody who has had
the trial sees the ordinary prices.

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

## Submission checklist — every console step

**The answers given for 1.2.0, and still the answers for 1.2.1.** Nothing in sections 1–3 needs
re-entering for 1.2.1; they are recorded so each release can be checked against them rather than
re-derived. For what to do _this_ release, see
[Submitting 1.2.1](#submitting-121--everything-to-paste) at the top.

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

**Both consoles were filled in during the 1.2.0 console pass (2026-09-08 – 09-11)** — App Store
Connect's App Privacy and Play's Data Safety, which are separate forms asking different questions in
different places. Sections 1 and 2 carried a stamp like this and section 3 did not, which is how it
became unclear what had been done; the point of recording it is that the next release is checked
against these rather than re-derived under time pressure.

⚠️ **One answer in both consoles predates the push notifications and needs revisiting** — see the
Device ID note below. Everything else in the table stands.

**The app no longer qualifies as "Data Not Collected".** Re-derived from the code: `apps/mobile`
declares exactly two third-party SDKs that collect anything — `react-native-google-mobile-ads` and
`react-native-purchases`. **There is no crash reporter and no analytics SDK in the mobile app**, so
nothing to declare under Diagnostics.

| Data                            | Collected           | Linked to the user | Purpose                 | Where it comes from                                      |
| ------------------------------- | ------------------- | ------------------ | ----------------------- | -------------------------------------------------------- |
| **Email address**               | Yes, if you sign up | Yes                | App Functionality       | Cognito username _and_ attribute — see `auth/cognito.ts` |
| **User ID** (Cognito `sub`)     | Yes, if you sign up | Yes                | App Functionality       | `ACCOUNT#<accountId>` in DynamoDB                        |
| **Other User Content**          | Yes, if you share   | Yes                | App Functionality       | Board names, player names, report free-text              |
| **Purchase history**            | Yes                 | Yes                | App Functionality       | RevenueCat entitlement state                             |
| **Device ID / advertising ID**  | Yes, free tier only | No                 | Third-Party Advertising | AdMob                                                    |
| **Device ID** (Expo push token) | Yes, if you sign in | **Yes**            | App Functionality       | `ACCOUNT#<id>`/`PUSH#<token>` — `pushStore.ts`           |

**Device ID is declared twice, on purpose, and both consoles allow it.** AdMob's advertising id is
**not** linked to the user and exists for advertising; the **Expo push token** is stored against the
account (`ACCOUNT#<id>`/`PUSH#<token>`) and so _is_ linked, for App Functionality. Declaring only the
first — which is what this table did until push shipped — understates it. In App Store Connect that
is one Device ID entry with both purposes and both linked/unlinked ticked; in Play's Data Safety it
is _Device or other IDs_, collected, with the same two purposes.

**The shared clock adds nothing to declare, and it is worth writing down why** so nobody re-derives
it. A `SESSION#<code>` row holds seconds remaining, round length, paused, blind index, a `sender`
that is a **random id generated per app launch** (`DEVICE_ID = generateId()` in
`SharedSessionContext.tsx` — not a device identifier and not persisted), and a six-hour TTL. No
names, no account id, no cards, no amounts.

**Not collected, and worth stating because a poker app invites the question:** no location of any
precision, no contacts, no photos, no health data, no browsing history, no financial information —
and **no monetary amount of any kind**. Money came off the leaderboard deliberately; `groups.ts`
whitelists fields so a stale client sending `winnings`, `buyIn` or `bounty` has them stripped
server-side.

**"Used for Tracking": No — and this is load-bearing.** `BannerAdSlot.tsx` sets
`requestNonPersonalizedAdsOnly: true`, so the app does not ask for personalized ads and does not
join identifiers across apps. **Do not answer Yes here**, and do not turn personalized ads on
without an ATT prompt on iOS and a rewritten privacy policy; the consent form below does not
change this.

**Consent, as of the release after 1.2.0.** `services/adsConsent.ts` runs Google's UMP flow for
free users: the consent form is shown where GDPR applies, the ads SDK starts only once the answer
allows a request, and Settings has an "Ad privacy choices" link to reopen it. There is still **no
ATT prompt and no `NSUserTrackingUsageDescription`** in `Info.plist`, on purpose: every request
stays non-personalized whatever the form's answer, which is what keeps the "Used for Tracking: No"
answer above true. 1.2.0 and earlier shipped a placeholder that resolved immediately and showed no
form.

### 4. Notes for Review (App Store Connect)

The notes field has two parts: the **money paragraph** from
[Paste-ready review note](#paste-ready-review-note) below, which stays the same every release, and
a **"New in this version"** part, which changes. The 1.2.1 version of the second part is in
[Submitting 1.2.1](#submitting-121--everything-to-paste).

## Age rating, and the review note

**4+ on Apple, PEGI 3 on Google**, answered 2026-09-11. The reasoning — the two triggers, the
comparable-app evidence, PEGI's actual wording, the Individual-developer-account question — lives in
[the gambling section of ROADMAP.md](./ROADMAP.md#gambling-classification--the-rating-record) and is not
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

Everything above, in the form the App Review notes field wants. The same claim is published at
[/support](https://poker-timer.toondeboer.com/support) under "Money, and what the app does with it", so a
reviewer who checks finds the two agreeing. **The page says "its own in-app purchases" rather than
naming them**, deliberately: it is served from `main` and is live now, when the only purchase is
Pro, and it has to stay true on the day Club appears without a deploy timed to the minute.

```
Nothing is wagered, staked or paid through this app. There is no way to bet in it, buy chips in it,
or cash anything out of it — no wallet, no balance, and no payment of any kind between players. The
only money the app handles is its own in-app purchases — a one-time Pro unlock and the Club
subscription — taken by Apple.

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
