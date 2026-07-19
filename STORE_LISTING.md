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

  Whether it's a casual poker night with friends or a bigger home tournament, Poker Blinds Timer & Buzzer keeps the blinds clock visible and on schedule so everyone can focus on the cards, not the clock.

  Go Pro to remove ads for a clean, full-screen timer — or just support an indie developer. Everything else stays free.
  ```
  `1077` chars. **Deliberately doesn't mention tournament presets** — that
  feature is iOS-only as of v1.1.2 (Android is still on 1.1.1). Add a bullet
  for it once presets ship to Android in **v1.1.3** (see P4 Pro-copy sync item
  in [ROADMAP.md](./ROADMAP.md)), so the listing doesn't promise a feature the
  current Android binary doesn't have.

## In-app purchase — `pro_lifetime` description (keep in sync with the paywall)

The paywall (`PRO_FEATURES` in `apps/mobile/src/components/paywall/Paywall.tsx`)
now promises three things — **remove ads · save & load tournament presets ·
support the dev**. Update the store IAP copy in all three consoles to match
(this is the P4 sync item). Presets shipped in v1.1.2, so the earlier
"remove-ads + support-the-dev only" description is now out of date.

### App Store Connect — In-App Purchase → `pro_lifetime`
- **Display Name (≤30 chars):** `Pro — Remove Ads & Presets` (`26`)
- **Description** (short field — **verify the limit in the console**, it's tight):
  ```
  Remove ads + save tournament presets.
  ```
  `37` chars. If the field allows more:
  `No ads, save tournament presets, support the dev.` (`49`)

### Google Play — Monetize → Products → `pro_lifetime`
- **Name (≤55 chars):** `Pro — Remove Ads & Tournament Presets` (`37`)
- **Description (≤200 chars):**
  ```
  Unlock Pro: remove all ads for a clean full-screen timer, save & load your tournament presets (blind structure + round length), and support an indie developer. One-time purchase.
  ```

### RevenueCat
- The `pro_lifetime` product description mirrors the store; if you keep an
  internal description/notes field, match the copy above so the dashboard reads
  the same. No entitlement/offering changes — just the text.

## Notes
- Re-validate char counts in the console before saving (emoji/locale can shift).
- Keep title/subtitle stable once ranked; iterate keywords + screenshots first.
