# Changelog

All notable user-facing changes to the **Poker Blinds Buzzer** mobile app are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the app
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Add changes under `[Unreleased]` as you merge them; roll that section into a dated,
platform-tagged heading (e.g. `## [1.1.3] - 2026-07-20 — Android`) when you cut a release.

## [Unreleased]

### Added
- Mobile: blind levels now have their own **Blind structure** screen, reached from Settings,
  replacing the fixed-height scrollable list that was nested inside the scrolling Settings page
  (a scroll-inside-a-scroll that made a 30-level schedule awkward to edit). The new screen is a
  single list, so the whole schedule scrolls normally.
- Mobile: a level can now be inserted or duplicated anywhere in the schedule, not just appended to
  the end. New levels inserted between two others are interpolated from their neighbours and
  rounded to chip-friendly numbers.
- Mobile: a structure **generator** — pick a starting small blind, a number of levels and a speed
  (Slow / Standard / Turbo), preview the result, and replace the whole schedule in one go instead
  of hand-editing every row. It follows the way real published structures are built rather than a
  flat percentage: each speed walks a ladder of round numbers (1, 1.5, 2, 3, 4, 6 …) that wraps
  into the next power of ten, so every blind is a value you can make with chips, the steps ease off
  within each decade, and the top end is predictable — the sheet states how many levels it takes to
  reach 10×. Slow keeps every step in the 20–33% band recommended for keeping players from lurching
  between deep- and short-stacked.
- Mobile: the generator takes a **smallest chip** (1 / 5 / 25 / 100), and every blind it produces is
  a multiple of it — no more levels like 6/12 that can't be posted at a table whose smallest chip is
  a 5. Where the next step would round back onto the previous level, the schedule advances by exactly
  one chip instead. It's seeded from the structure you're already editing, so it usually needs no
  thought. With 25-chips at slow speed this reproduces the standard casino sheet almost exactly:
  25/50 → 50/100 → 75/150 → 100/200 → 125/250 → 150/300 → 200/400 → 250/500.
- Mobile: tap a level number in the editor to jump the running tournament straight to that level
  (the web app has had this; mobile only had next/previous).
- Mobile: the editor marks which level the tournament is currently on, and the Settings entry point
  shows an "Unapplied changes" badge when the editor holds edits that haven't been applied yet.
- Web: new `/guide` page — "How to Run a Home Poker Tournament" — covering buy-ins, blind
  structures, payouts, and a blind-structure explainer, with `HowTo`/`FAQPage` structured data.
  Cross-linked from `/timer`.
- Mobile: Pause/Resume and Stop buttons on the Android foreground-service timer notification and
  the iOS Live Activity/Dynamic Island — previously read-only display, with no way to control the
  timer without reopening the app. Each side updates its own visible UI immediately (no
  round-trip through JS needed) and separately persists the action so the app reconciles its timer
  state next time it's foregrounded or launched, covering both "app still running in the
  background" and "app was fully killed" cases. iOS additionally required adding an App Group
  entitlement (`group.com.toondeboer.pokerkit`) shared between the app and widget extension, since
  a Live Activity button's `LiveActivityIntent` runs in the widget extension's own process.
- Mobile: Android's foreground-service notification now has a small permanent note — "Don't force
  quit the app, or the blind level shown here may fall behind" — matching the iOS Live Activity's
  existing force-quit caption. Covers a narrow, accepted limitation specific to actually force-
  quitting (not ordinary backgrounding): the notification can't advance its own displayed blind
  level across multiple expire-and-resume cycles while the app stays fully killed (reopening
  always catches it up correctly).
- Mobile: the generator and Pro sheets can now be dismissed by **dragging the handle down** or
  tapping the dimmed area outside them. The handle was previously decorative — it looked draggable
  but did nothing — and tapping outside had no effect either, so on iOS the only way out was a
  button.

### Changed
- Mobile: the dimmed backdrop behind those sheets now **fades in place** instead of sliding up with
  the sheet, and lightens as you drag one down, so the sheet reads as sitting over the screen rather
  than being part of it.
- Mobile: removed the small ✕ from the corner of both sheets. Each already has a labelled way out —
  "Cancel" on the generator, "Maybe later" on the Pro sheet — so it was a second, unlabelled control
  competing with them.
- Mobile: updated RevenueCat (`react-native-purchases` 10.4.0 → 10.4.4, which moves the native SDK
  from 5.78.0 to 5.81.1 via `PurchasesHybridCommon` 18.22.2). Purchase and restore should be
  smoke-tested on a real device before this release is submitted.
- Mobile: applying edited blind levels now **keeps your place in the tournament** instead of
  silently restarting at Level 1 — the current level is clamped into the new schedule, and you're
  only moved (to the new last level) if the level you were on no longer exists, which the Apply
  button warns about before you confirm. Loading a preset or resetting to defaults still restarts
  at Level 1, since those replace the whole tournament setup rather than editing the one you're
  playing.
- Mobile: round duration is now a minutes + seconds pair rather than a raw seconds field, and
  applies as you edit instead of needing a separate "Save Timer Settings" button. Changing it
  mid-round no longer requires a save step and still leaves a running round's remaining time alone.
- Mobile: Settings redesigned — Pro, Tournament (round length + blind structure), Presets and Sound
  Pack sections built on a shared theme and real icons instead of emoji placeholders, with the Pro
  card collapsing to a single line once unlocked.
- Mobile: numeric fields no longer turn into a literal `0` when you clear them — an empty field
  stays empty while you retype, and reverts to its previous value if you leave it blank.
- Mobile: saving a preset now captures the *active* blind structure rather than the editor's
  working copy, so a preset can't silently record edits you never applied.
- Mobile: recolored the Android foreground-service notification and iOS Live Activity/Dynamic
  Island to match the app's own timer palette (`#10B981` green / `#F59E0B` amber / `#DC2626` red)
  instead of each platform's own approximate shades — the iOS Live Activity's Pause/Resume button
  previously had no tint at all and rendered in the system default blue. Also added two visual
  states neither platform distinguished before: an expired round (red + alarm icon on iOS) and a
  low-time warning at 60s or less remaining (amber, matching Android's existing threshold).
- Mobile: the Android foreground-service notification's Pause/Resume and Stop actions are no
  longer stock `NotificationCompat` text-link actions (which can't be individually colored) — a
  custom `RemoteViews` layout gives them real colored pill/circle buttons (green/amber to
  resume/pause, red to stop), matching the iOS Live Activity's button styling instead of looking
  like generic platform chrome next to it. Collapsed view keeps icon-only circular buttons to fit
  the narrower space; expanded view mirrors the iOS Lock Screen's layout (header, timer+blinds,
  buttons, force-quit caption).
- Mobile: the paused state's icon/timer-text color on both the Android notification and iOS Live
  Activity changed from gray to amber, matching the Pause button and simplifying the palette to
  green (active) / amber (paused or low-time) / red (stop/expired).

### Fixed
- Mobile: on iOS, `NavRow`'s badge (e.g. the "Unapplied changes" pill on Settings' Blind structure
  row) was invisible to VoiceOver — `NavRow.tsx`'s `TouchableOpacity` sets an explicit
  `accessibilityLabel` that collapses its whole subtree, including the badge, into one opaque
  string. Added a `badgeLabel` prop that folds the badge's text into that same label
  (`"<title>. <summary>. <badgeLabel>"`), so a VoiceOver user now hears about the unapplied draft
  instead of just the title and summary. Found while building iOS Maestro coverage.
- Mobile: a `NumberField` (round duration's seconds, or any numeric field with a
  stricter clamp layered on top by its parent) could keep showing a stale, out-of-range
  digit string after blurring — e.g. typing `99` into the round-duration seconds field
  and tapping away left the box reading "99" even though the round was already
  correctly capped to 59 seconds underneath. `onBlur` was recomputing its own clamp
  from just `min`, overwriting the display with that instead of trusting the already
  fully-clamped `value` it had been passed. Found while building Maestro coverage for
  `RELEASE_TESTING.md`.
- Mobile: the Timer screen card no longer stretches edge-to-edge on tablets — capped it at the
  same tablet-aware `maxWidth` + centered layout `PokerSettings.tsx` already used, so blind values
  and buttons don't end up spread across the full iPad-width card. Found during a cross-device QA
  pass (see `ROADMAP.md`).
- Mobile: the Timer screen now fits on the smallest phones (iPhone SE-class) without feeling
  cramped or overflowing — the whitespace between sections (progress bar, Current Blinds, Next
  Level, etc.) now shrinks faster than text does as the screen gets tighter, instead of both
  shrinking at the same rate down to the same floor.
- Android: fixed tablets being letterboxed into a narrow portrait strip (black bars either side)
  regardless of the device's actual screen size. `MainActivity` locked the whole app to portrait
  via the manifest, but Android 12L+ letterboxes fixed-orientation activities on large screens
  instead of ignoring the restriction (the opposite of what an earlier fix assumed) — moved the
  portrait lock into code (`MainActivity.kt`, based on `smallestScreenWidthDp`) so it still applies
  to phones with no exceptions, while tablets get `SCREEN_ORIENTATION_UNSPECIFIED` and the OS stops
  letterboxing them. Tablets now use the full landscape screen, correctly triggering the existing
  tablet layouts (Settings' side-by-side cards, Timer's centered column).
- Android: app icon now has proper round/squircle corners matching the rest of the launcher —
  added the missing adaptive-icon config (`app.json` had none), so the OS was rendering the flat
  legacy square icon with no mask applied at all.
- Android: edge-to-edge display now survives a clean `expo prebuild` instead of silently
  reverting to the pre-v1.1.3 `Theme.AppCompat` theme. The `android.edgeToEdgeEnabled` app.json
  key stopped being honored by this Expo SDK (Android 16 makes edge-to-edge mandatory, so Expo's
  base prebuild config always resets `AppTheme` to the default theme now) and needed the
  `react-native-edge-to-edge` config plugin registered in `plugins` to reapply `Theme.EdgeToEdge`
  afterward — removed the stale key and added the plugin.
- Mobile: the Android notification/iOS Live Activity Pause/Resume button no longer gets stuck
  offering "Pause" once a round expires — it now correctly switches to "Resume" (Android also
  restores the "Active"/green title once resumed). Resuming an already-expired round no longer
  instantly re-expires it, and now correctly advances to the next blind level and starts a fresh
  round instead of restarting the same (already-finished) one.
- Mobile: the in-app "Time's Up" alert (and its alarm sound) could silently fail to show when a
  round expired while the app was genuinely in the foreground — it would auto-advance the blind
  level with no alert or sound instead, as if the app had been backgrounded the whole time.
- Android: reopening the app after force-quitting (swiping away from Recents) mid-round no longer
  resets the timer to the default 10-minute duration and blind Level 2 — a stale-closure race
  meant a pending notification action could be reconciled against pre-load default values instead
  of what was actually persisted.
- Android: fixed a "Poker Timer keeps stopping" crash (`NullPointerException` in react-native's
  `ReactActivityDelegate`) that could happen whenever the app was paused, resumed, or reconfigured
  before the JS bridge finished attaching — most likely right after a fresh launch. `MainActivity`
  now guards the affected lifecycle callbacks. See CLAUDE.md for the full root-cause writeup.
- Mobile: the Timer card no longer visibly resizes a few times right after a fresh launch. Its
  auto-fit-to-screen pass converges over several measure-and-rescale rounds, and does so
  non-monotonically (measured on a small Android screen: 1.00 → 0.78 → 0.92 → 0.81), so every one
  of those intermediate sizes was being painted. The card now stays hidden behind the native
  splash screen (a dependency that was installed but never actually invoked before now) until that
  fit has genuinely settled *and* the persisted timer state has loaded, then the splash lifts and
  the card appears in the same frame — so the first thing you see is the final layout. Capped at
  4s so a slow or stuck load can't hold the splash indefinitely.
- Mobile: the card no longer resizes when the ad banner appears, which on iOS happened around half
  a second after the app was already on screen (and on Android could be nearly three seconds in).
  An adaptive banner has no height until it has loaded, so the slot used to jump from nothing to
  full height under an already-visible layout; it now reserves that space up front, so the banner
  arriving changes nothing.
- Mobile: the auto-fit now converges in a couple of steps instead of visibly hunting for the right
  size — its size estimate systematically overshot, so it used to ping-pong around the answer (11
  steps in one measured case) and could come to rest on a size that still overflowed the screen
  slightly.
- Android: the Pause/Resume and Stop buttons on the collapsed foreground-service notification no
  longer risk getting clipped at the bottom — shrank the button circles (36dp → 30dp) and their
  padding, since `DecoratedCustomViewStyle` imposes its own overall height budget on the
  system-drawn header plus our custom content combined, tighter on some devices/notification-shade
  implementations than the previous size left room for.

## [1.1.3] - 2026-07-21 — iOS & Android

**Release notes (App Store / Play Console "What's New" text) are drafted in
[STORE_LISTING.md](./STORE_LISTING.md#release-notes--v113)** — kept there
alongside the rest of the store copy rather than duplicated here. iOS's notes
cover only what's new since the live v1.1.2; Android's cover two versions'
worth since it's live at v1.1.1 (presets are new to Android users here, not
just Sound Packs).

### Added
- Sound Pack (Pro) — choose the alarm that plays when a round ends. Three bundled alternatives
  (Classic Beep, Bell Chime, Double Buzz) alongside the original Classic Alarm, picked from a new
  "Sound Pack" card in Settings, with a 3-second preview per option.
- A subtle "Share Poker Blinds Buzzer" row below the timer, so players at the table can share the
  app with one tap.
- Dev-only `FORCE_FREE_IN_DEV` toggle in `PremiumContext.tsx` (mirrors the existing
  `FORCE_PRO_IN_DEV`), for testing the free/ad experience on a device whose Apple/Google account
  already owns `pro_lifetime`. Always `false` in release builds; no user-facing effect.

### Changed
- Android: release builds now enable R8 code shrinking/obfuscation and resource shrinking
  (previously shipped unminified) — smaller, faster app for a smoother experience.

### Fixed
- Sound preview in Settings no longer plays the alarm's full length (up to ~11s) — capped at 3
  seconds and stoppable early.
- Selecting a new sound pack now applies immediately instead of only after restarting the app.
- Android: real edge-to-edge display instead of the transparent-status/nav-bar-color trick —
  content now respects safe-area insets and the system bars use `react-native-edge-to-edge`
  instead of deprecated `Window.setStatusBarColor`/`setNavigationBarColor` APIs.
- Android: two components that read window dimensions once at load time
  (`TimerExpirationAlert`, `PokerSettings`' tablet-layout check) now recompute reactively instead
  of staying stale, so tablets/foldables that get resized by Android 16 (which can still happen
  regardless of the app's portrait setting) don't end up with mis-sized layouts.
- Android: settings screen now pads for the left/right safe-area inset (previously only handled
  by the OS-provided header), fixing content clipping under the navigation bar on large-screen
  devices.
- Android: the timer screen now measures its own content and scales font sizes/spacing to fit one
  screen without scrolling — previously the ad banner could push the "Share" row off-screen with
  no way to reach it. The ad banner also moved to sit between the timer card and the share row
  instead of below both, and the screen now pads for all four safe-area insets instead of only
  the top.
- Android: portrait-only lock kept on `MainActivity` deliberately (product decision) —
  Android 16's large-screen orientation override only affects tablets/foldables anyway, so phones
  still honor it.
- iOS: locked iPhone to portrait only (was allowing all four orientations), matching the
  portrait-only decision already made for Android phones. iPad is unaffected — still supports all
  orientations.

## [1.1.2] - 2026-07-17 — iOS only

_Live on the App Store. Not shipped to Android (this version has Android-only bugs); the Android
fixes land in 1.1.3._

### Added
- Saved tournament presets (Pro) — save the current blind structure and round length, then
  load any of them in one tap.
- In-app review prompt, shown after 5 rounds played.

### Fixed
- The "Save current setup" preset field no longer lets the on-screen keyboard cover the Save
  Preset button or the preset list.

## [1.1.1] - 2026-06-19

_Also the version Android first launched with. Reconstructed from build history — approximate._

### Fixed
- Post-launch stability and App Store compliance fixes following the monetization release.

## [1.1.0] - 2026-06-17 — iOS only

_Before Android's launch. Reconstructed from build history — approximate._

### Added
- Monetization: an AdMob banner and a one-time **Pro / Remove Ads** purchase (RevenueCat), plus
  a Ko-fi tip jar on the web timer.
- iPad support — the app now ships universal (iPhone + iPad).

### Changed
- Upgraded to Expo SDK 56 / React Native 0.85.

## [1.0.0] - 2025-07 — iOS only

_Before Android's launch. Reconstructed from build history — approximate._

### Added
- Initial App Store release: a poker tournament timer with configurable blind levels, a
  per-round countdown, background timing, iOS Live Activities, and an Android foreground service.

[Unreleased]: https://github.com/toondeboer/poker/compare/v1.1.3...HEAD
[1.1.3]: https://github.com/toondeboer/poker/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/toondeboer/poker/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/toondeboer/poker/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/toondeboer/poker/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/toondeboer/poker/releases/tag/v1.0.0
