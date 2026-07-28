# Changelog

All notable user-facing changes to the **Poker Blinds Buzzer** mobile app are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the app
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Add changes under `[Unreleased]` as you merge them; roll that section into a dated,
platform-tagged heading (e.g. `## [1.1.3] - 2026-07-20 — Android`) when you cut a release.

## [Unreleased]

### Added
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
- Mobile: Android's foreground-service notification now has a small permanent note — "Blind level
  may lag behind here if more than one round expires before you reopen the app" — matching the
  iOS Live Activity's existing force-quit caption. Covers a narrow, accepted limitation: the
  notification can't advance its own displayed blind level across multiple expire-and-resume
  cycles while the app stays fully killed (reopening always catches it up correctly).

### Fixed
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
