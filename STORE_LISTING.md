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

## Android — Google Play (reuse at launch — P1 item 4)

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
  • Save tournament presets (Pro) — store your blind structure & round length, load them in one tap
  • Choose your alarm sound (Pro) — pick from a few bundled alarm packs beyond the default

  Whether it's a casual poker night with friends or a bigger home tournament, Poker Blinds Timer & Buzzer keeps the blinds clock visible and on schedule so everyone can focus on the cards, not the clock.

  Go Pro to remove ads, save tournament presets, and pick your alarm sound — or just support an indie developer. Everything else stays free.
  ```
  `1264` chars. Updated for v1.1.3: previously deliberately omitted tournament
  presets since that feature was iOS-only as of v1.1.2 (Android was still on
  1.1.1) — now that presets **and** Sound Packs both ship to Android in
  **v1.1.3**, both are called out as Pro bullets above.

## In-app purchase — `pro_lifetime` description (keep in sync with the paywall)

The paywall (`PRO_FEATURES` in `apps/mobile/src/components/paywall/Paywall.tsx`)
now promises **four** things — **remove ads · save & load tournament presets ·
choose your alarm sound · support the dev**. Update the store IAP copy in all
three consoles to match (this is the P4 sync item). Presets shipped in v1.1.2
(iOS)/v1.1.3 (Android); Sound Packs are new in v1.1.3 on both platforms — the
copy below adds the sound-pack mention that was still missing.

### App Store Connect — In-App Purchase → `pro_lifetime`
- **Display Name (≤30 chars):** `Pro — Ads, Presets & Sounds` (`27`)
- **Description** (short field — **verify the limit in the console**, it's tight):
  ```
  No ads, presets & custom sounds.
  ```
  `32` chars.

### Google Play — Monetize → Products → `pro_lifetime`
- **Name (≤55 chars):** `Pro — Remove Ads, Presets & Sound Packs` (`39`)
- **Description (≤200 chars):**
  ```
  Unlock Pro: remove all ads for a clean full-screen timer, save & load tournament presets, choose your alarm sound from bundled packs, and support an indie developer. One-time purchase.
  ```
  `184` chars.

### RevenueCat
- The `pro_lifetime` product description mirrors the store; if you keep an
  internal description/notes field, match the copy above so the dashboard reads
  the same. No entitlement/offering changes — just the text.

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
