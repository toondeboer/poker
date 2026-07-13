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
- **Long description:** Play has no keyword field — keywords are mined from the
  long description, so weave the phrases above (*poker timer, blinds timer,
  tournament clock, poker clock, blind levels, poker night, Texas Hold'em*)
  naturally into the first two sentences and a feature bullet list. Reuse the
  promo text as the opening line.

## Notes
- Re-validate char counts in the console before saving (emoji/locale can shift).
- Keep title/subtitle stable once ranked; iterate keywords + screenshots first.
