# Store listing copy (ASO)

Source of truth for App Store / Play Store listing text. Optimized for the
keyword phrases people actually search: **poker timer, blinds timer, tournament
clock, poker clock, blinds buzzer**.

> On-device name (home screen) stays short — keep `app.json` `name: "Poker
> Timer"`. The fields below are the **store-listing** name/subtitle, set in App
> Store Connect / Play Console, which are separate from the installed app name.

## iOS — App Store Connect

### App Name (≤30 chars) — `27`
```
Poker Blinds Timer & Buzzer
```
Seeds the highest-weight field with *poker, blinds, timer, buzzer*.

### Subtitle (≤30 chars) — `30`
```
Tournament clock & blind timer
```
Adds *tournament, clock* (→ "tournament clock", "poker clock") without repeating
the title.

### Keywords (≤100 chars, comma-separated, NO spaces) — `99`
```
holdem,texas,card,game,night,countdown,chips,dealer,level,structure,alarm,home,casino,stopwatch,bet
```
Rules applied: no spaces after commas (wasted chars), no word already in the
name/subtitle (Apple indexes those automatically — don't repeat *poker, blinds,
timer, buzzer, tournament, clock*), singulars only. Apple recombines single
words across name+subtitle+keywords into phrases, so e.g. "card" + "game" →
"card game", "poker" + "night" → "poker night".

### Promotional text (≤170 chars, editable anytime without review)
```
The dead-simple blinds clock for home poker night. Big readable timer, custom blind levels, and a loud buzzer when it's time to raise. Live Activities on the Lock Screen.
```

### Description (≤4000 chars)

**Currently live** (stale — doesn't mention Pro, tournament presets, or Sound Packs, unlike the
Play long description; same root cause as the `pro_lifetime` IAP copy gap above), `790` chars:
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
Lock Screen bullet already promised in the promotional text above. **`2064` chars** as of 1.2.0,
against a 4,000 limit:
```
The simple poker timer & tournament clock for home poker night. A big, easy-to-read blinds timer and a loud buzzer mean nobody has to squint at their phone mid-hand to know when it's time to raise.

Built for real Texas Hold'em tournament nights, not a casino app full of settings you'll never touch:

• Big, glanceable timer — read the clock from across the table
• Fully custom blind levels — set your own blind structure and round lengths, add or remove levels anytime, free
• Loud buzzer & notification when a level ends, even if your phone is locked or the app is in the background
• Live Activities on the Lock Screen — check the current blind level without unlocking your phone
• Clean, distraction-free interface — no account, no sign-up, no clutter
• Work out the payouts (Pro) — enter the buy-in and the app splits the pool across the places that pay, with bounties, rebuys and add-ons counted. Every place below the winner is a round number you can count straight out of the pot
• Chop the last pot (Pro) — ending early? Everyone left keeps the lowest prize still live and the rest splits by chip stack, so nobody drops below the place they'd locked up
• Keep a leaderboard (Pro) — who's won most across the season, with a separate board for each group you play with. Recording a night is two taps per player and no typing
• Share to the group chat (Pro) — send the table the payouts before you start, or the standings after
• Save tournament presets (Pro) — store your blind structure & round length, load them in one tap
• Choose your alarm sound (Pro) — pick from a few bundled alarm packs beyond the default

Whether it's a casual poker night with friends or a bigger home tournament, Poker Blinds Buzzer keeps the blinds clock visible and on schedule so everyone can focus on the cards, not the clock — and settles the money before it turns into an argument.

Go Pro to remove ads, work out the payouts, chop the last pot, keep a leaderboard, save presets and pick your alarm sound — or just support an indie developer. The timer itself stays free.
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
  mined from the long description, so the phrases (*poker timer, blinds timer,
  tournament clock, poker clock, blind levels, poker night, Texas Hold'em*) are
  woven into the first two sentences (the part visible before "Read more") and
  the feature bullets below.
  ```
  The simple poker timer & tournament clock for home poker night. A big, easy-to-read blinds timer and a loud buzzer mean nobody has to squint at their phone mid-hand to know when it's time to raise.

  Built for real Texas Hold'em tournament nights, not a casino app full of settings you'll never touch:

  • Big, glanceable timer — read the clock from across the table
  • Fully custom blind levels — set your own blind structure and round lengths, add or remove levels anytime, free
  • Loud buzzer & notification when a level ends, even if your phone is locked or the app is in the background
  • Keeps timing in the background — the clock won't drop out mid-tournament
  • Clean, distraction-free interface — no account, no sign-up, no clutter
  • Work out the payouts (Pro) — enter the buy-in and the app splits the pool across the places that pay, with bounties, rebuys and add-ons counted. Every place below the winner is a round number you can count straight out of the pot
  • Chop the last pot (Pro) — ending early? Everyone left keeps the lowest prize still live and the rest splits by chip stack, so nobody drops below the place they'd locked up
  • Keep a leaderboard (Pro) — who's won most across the season, with a separate board for each group you play with. Recording a night is two taps per player and no typing
  • Share to the group chat (Pro) — send the table the payouts before you start, or the standings after
  • Save tournament presets (Pro) — store your blind structure & round length, load them in one tap
  • Choose your alarm sound (Pro) — pick from a few bundled alarm packs beyond the default

  Whether it's a casual poker night with friends or a bigger home tournament, Poker Blinds Timer & Buzzer keeps the blinds clock visible and on schedule so everyone can focus on the cards, not the clock — and settles the money before it turns into an argument.

  Go Pro to remove ads, work out the payouts, chop the last pot, keep a leaderboard, save presets and pick your alarm sound — or just support an indie developer. The timer itself stays free.
  ```
  Updated for **v1.2.0**: the four capabilities that release adds behind the
  paywall — payouts, the chop, the leaderboard and sharing — are now called out
  as bullets. They are also the reason the closing line changed from
  "everything else stays free" to "the timer itself stays free": Pro is no
  longer a cosmetic tier, and describing it as if it were sets up a refund
  request.

  `2077` chars, against a 4,000 limit — up from ~1,264, and still less than
  two-thirds of the way there. Play mines keywords from the first two
  sentences (the part visible before "Read more"), which are deliberately
  unchanged.

## In-app purchase — `pro_lifetime` description (keep in sync with the paywall)

The paywall (`PRO_FEATURES` in `apps/mobile/src/components/paywall/Paywall.tsx`)
promises **six** things as of 1.2.0 — **remove ads · buy-ins, payouts and
bounties · a leaderboard across game nights · save & load tournament presets ·
choose your alarm sound · support the dev**. Update the store IAP copy in all
three consoles to match.

This has now drifted twice: the paywall was found still selling the 1.1.4
feature set during the 1.2.0 cycle, and the store copy one level out had the
same problem. **The paywall is the source of truth** — read `PRO_FEATURES` and
work outwards, rather than editing these fields from memory.

### App Store Connect — In-App Purchase → `pro_lifetime`
- **Display Name (≤30 chars):** `Pro — Payouts, Board & More` (`27`)
- **Description** (short field — **verify the limit in the console**, it's tight):
  ```
  No ads, payouts, leaderboard.
  ```
  `29` chars.

### Google Play — Monetize → Products → `pro_lifetime`
- **Name (≤55 chars):** `Pro — Payouts, Leaderboard & No Ads` (`35`)
- **Description (≤200 chars):**
  ```
  Unlock Pro: work out payouts and bounties, chop the last pot, keep a leaderboard per group, save presets, pick your alarm sound, and remove all ads. One-time purchase.
  ```
  `166` chars.

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

**A good deal is in the binary and deliberately unreachable**, and none of it is mentioned here,
because none of it is something anybody can use: the account screens, the shared clock, and the
whole of shared boards — syncing, invite codes, joining, and the Club subscription. Two separate
switches keep them off, and both are deliberate: `backendConfig` is `null` in
`apps/mobile/src/services/backendConfig.ts`, and nothing grants the `club` entitlement because the
subscription does not exist in either store yet.

**The backend itself is deployed now** — this section used to say it never had been. It is real, in
`096695166445`/`us-east-1`, and 1.2.0 simply does not point at it. That distinction matters when
somebody reads this while writing a submission: nothing here is waiting on infrastructure, it is
waiting on a deliberate switch that belongs to a later release.

The **website already describes this feature set** (PR #155, merged), so store copy and landing-page
copy are in step. Check it still reads true before submitting rather than assuming — it describes
the app that ships, not the one in the repository.

### iOS — "What's New in This Version" (App Store Connect)

**No emoji in this field** — see [the note below](#ios-metadata-emoji). Bullets are the typographic
`•` (U+2022), which is punctuation rather than emoji and renders everywhere.

```
• Play a hand (Pro). The app deals. When you have chips but no cards — or nobody can find the deck — pass the phone round the table and it runs the whole game: blinds, betting, side pots, the showdown, and who is out. Your cards stay hidden until you tap, and hide again the moment the turn passes.

• A game the app deals puts itself on the leaderboard (Pro). It watched every hand, so it already knows who went out fourth. One button saves the night, priced from your payout setup for the field that actually sat down.

• Knockouts are tracked, and bounties finally add up (Pro). The app knows whose chips took whom out — including which side pot the last of them went into — so bounty money lands on the leaderboard instead of being remembered wrong at the end of the night.

• Progressive bounties (Pro). Knock somebody out and half their bounty is yours in cash; the other half goes on your own head. Whoever is winning becomes the one worth beating. It is the format nobody can run on paper, and the app keeps the whole ledger.

• A leaderboard for every group you play with (Pro). Thursdays and the office game are different seasons, kept apart, each with their own players and history.

• Payouts and the chop (Pro). Set a buy-in and see exactly what each place wins, bounties, rebuys and add-ons included. When the table agrees to end it early, the chop splits what is left by chip stack without anybody dropping below the place they had already locked up.

• Share the payouts or the standings straight to your group chat.

• A game in progress now survives the app closing. Shut it between hands, or have the phone die mid-evening, and reopening puts you back at the same table with the same stacks.

• Android no longer asks twice for notification permission, and stale Live Activities are cleared away instead of piling up on the lock screen.

Thanks for playing — feedback always welcome.
```

Re-count in App Store Connect before saving; the limit is 4000 characters and this is well inside it.

### Android — "Release notes" (Play Console, ≤500 chars per language)
```
🃏 Play a hand (Pro): no cards? The app deals. Blinds, betting, side pots, showdown.
🏆 A dealt game saves itself to the leaderboard, knockouts and all.
💰 Progressive bounties (Pro): half in cash, half onto your own head.
👥 A leaderboard per group — Thursdays and the office game kept apart.
♻️ Games survive the app closing.
```
`323` chars — fits the 500-char Play Console limit. Re-count in the
console before saving, since emoji and locale can shift it.

**Deliberately not mentioned:** the account and shared-clock screens, which are in the binary but
unreachable; the record-a-game prompt's conditions; and that progressive bounties only work for a
game the app deals. Those nuances belong in the app, not in 500 characters of store copy.

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

| | |
|---|---|
| Format | Plain text only. No Markdown, no HTML, no rich text — `**bold**` renders as literal asterisks. Line breaks and blank lines *are* preserved, so paragraphs and `•` bullets are the whole formatting toolkit. |
| Length | 4000 characters (not stated in Apple's own help pages; it's what the field enforces). |
| Emoji | **Don't.** See below. |

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
