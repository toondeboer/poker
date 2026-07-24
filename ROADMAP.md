# Roadmap

Checklist for v1.1.4 and beyond. Where an item was already investigated while drafting this
list, the root cause / current state is noted inline so it doesn't need re-discovering — see
[CLAUDE.md](./CLAUDE.md) for the release process and [ARCHITECTURE.md](./ARCHITECTURE.md) for the
full design.

**Legend:** ✅ done · 🚧 in progress · 🔍 investigated, not yet fixed · ⬜ not started

## Android Play Store listing refresh
- ✅ **Feature graphic** — added at
  [`store-assets/android/feature-graphic.png`](./store-assets/android/feature-graphic.png)
  (1024×500, no alpha, verified via `sharp` metadata). Generated from
  `store-assets/android/generate-feature-graphic.js` rather than hand-drawn, reusing the exact
  colors sampled from the app icon so it reads as the same brand. Documented in
  [STORE_LISTING.md](./STORE_LISTING.md#android--google-play-reuse-at-launch--p1-item-4).
  **Still needed:** upload it to the Play Console store listing (manual console step) and confirm
  it renders correctly there.
- 🚧 **App icon has sharp corners on Android instead of the OS mask (round/squircle)** — fixed,
  pending on-device verification. Root cause was confirmed: `mipmap-anydpi-v26/` was empty (no
  `ic_launcher.xml`/`ic_launcher_round.xml`) and `app.json` had no `android.adaptiveIcon` at all, so
  Android rendered the flat legacy square icon with no mask applied. Fix landed:
  - Added a safe-zone-compliant foreground layer
    (`apps/mobile/src/assets/images/icon-adaptive-foreground.png` — chip artwork chroma-keyed
    transparent and scaled to ~62% of the canvas, comfortably inside Android's ~66% adaptive-icon
    safe zone) plus `android.adaptiveIcon.backgroundColor` (`#0D3827`, matching the icon's own
    background) in `app.json`.
  - Ran `expo prebuild --platform android` to regenerate the native resources:
    `mipmap-anydpi-v26/ic_launcher.xml` + `ic_launcher_round.xml` now exist, `AndroidManifest.xml`
    gained `android:roundIcon`, `colors.xml`'s `iconBackground` updated, and per-density
    `ic_launcher_foreground.webp`/new `ic_launcher_round.webp` regenerated correctly (spot-checked
    visually — chip renders masked into a clean circle).
  - Prebuild also silently reverted `styles.xml`'s `AppTheme` from `Theme.EdgeToEdge` back to the
    old `Theme.AppCompat.DayNight.NoActionBar` + manual transparent bar colors — i.e. it undid the
    v1.1.3 edge-to-edge fix (the prebuild logged
    `EDGE_TO_EDGE_PLUGIN: 'edgeToEdgeEnabled' customization is no longer available` while running).
    Manually reverted `styles.xml` back to `Theme.EdgeToEdge` so that regression didn't ship. See
    the new item below — `edgeToEdgeEnabled` needs a real fix, this was just contained.
  - **Still needed:** on-device confirmation the round icon actually shows (**local
    `./gradlew assembleDebug` currently fails on this checkout** for an unrelated,
    **pre-existing** reason — see below — so verify via an EAS build instead, or a working local
    setup).
- ⬜ **New: `android.edgeToEdgeEnabled` in `app.json` is stale/no-op** — Android 16 makes
  edge-to-edge mandatory, and the version of the edge-to-edge config plugin bundled with this
  Expo SDK no longer honors that app.json key (logs a deprecation warning and, when prebuild
  regenerates `styles.xml` from scratch, drops back to the pre-v1.1.3 `Theme.AppCompat` + manual
  transparent-bar-color approach instead of `Theme.EdgeToEdge`). Currently harmless only because
  the committed `styles.xml` still has the correct `Theme.EdgeToEdge` setup and nothing has
  re-run prebuild clean since — but the next prebuild (e.g. an unrelated native-config change)
  will silently regress this again unless the `edgeToEdgeEnabled` key is removed/replaced with
  whatever the current plugin actually expects.
- ⬜ **New: local Android Gradle builds are currently broken on a fresh checkout, independent of
  the above** — `cd apps/mobile/android && ./gradlew :app:assembleDebug` fails during
  `processDebugResources` with `resource style/Theme.EdgeToEdge ... not found` /
  `resource style/Theme.SplashScreen ... not found`, even on an unmodified `release/1.1.4`
  checkout (confirmed by stashing all icon-fix changes and reproducing the same failure) — so
  it's pre-existing, not caused by this fix. `react-native-edge-to-edge` and `expo-splash-screen`
  are both present in `node_modules` and do provide those styles, so this looks like an
  autolinking-resolution problem rather than a missing dependency. Not investigated further here
  since it's outside this fix's scope, but it blocks verifying *any* native Android resource
  change locally (including this one) until fixed — worth prioritizing.
- ⬜ Update Play Store long description / screenshots to reflect current feature set once the
  website/app feature-parity pass (bottom of this list) is done.

## Cross-device QA
- ⬜ Confirm the app works correctly on **small phones** (e.g. iPhone SE-class, small Android
  screens) — check the timer and settings layouts don't clip or require scrolling.
- ⬜ Confirm the app works correctly on **tablets**, both iPad and Android — `PokerSettings.tsx`
  already has an `isTablet` layout branch and `useWindowDimensions()`-based reactive sizing (from
  the v1.1.3 Play Console large-screen fixes), but that hasn't been re-verified against the newer
  settings/blind-level UI changes since.
- ⬜ Spot-check both platforms on at least one physical small device and one tablet each — a
  simulator/emulator pass alone previously missed real inset/rotation behavior (see v1.1.3
  edge-to-edge history in git log).

## Android notification-permission double prompt
- 🔍 **Likely still present** — `TimerContext.tsx` uses both `useTimerNotification()` and
  `useNotificationPermission()` at once. `useTimerNotification`'s
  `registerForPushNotificationsAsync` calls `Notifications.getPermissionsAsync()` /
  `requestPermissionsAsync()` (expo-notifications) on mount; independently,
  `useNotificationPermission`'s `checkPermission()` runs in its own `useEffect` on mount and calls
  `liveActivityService.requestNotificationPermission()`, which (on Android) goes through
  `PermissionsAndroid.request(POST_NOTIFICATIONS)`. Two independent permission-request code paths
  firing near-simultaneously on mount would produce exactly the double-prompt symptom reported
  previously. Needs on-device confirmation, then consolidating to a single permission-request path
  (have one hook own the request, the other just read status).

## Live Activity / foreground service controls
- 🔍 **Pause is not currently exposed as an action** — the Android foreground-service notification
  category (`NOTIFICATION_CATEGORY = "timerActions"` in `useTimerNotification.ts`) only defines a
  `"stop"` action button; there's no pause/resume action wired in, even though `LiveActivityService`
  already tracks a `paused` state internally. Investigate adding pause/resume + stop actions to
  both the Android foreground-service notification and the iOS Live Activity/Dynamic Island UI, and
  wire them back to `TimerContext`.

## Website landing page
- 🔍 **Confirm contact email is correct** — currently `poker.blinds.buzzer@gmail.com`, hardcoded in
  `apps/web/src/app/privacy-policy/page.tsx`. The landing page itself (`LandingPage.tsx`) doesn't
  surface an email at all currently — decide whether it should, and confirm the gmail address above
  is still the one actively monitored.

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

## Settings page UX — blind levels
- 🔍 **Confirmed scroll-inside-scroll** — `PokerSettings.tsx` (~line 344) has a fixed-height inner
  `ScrollView` (`nestedScrollEnabled={true}`, a workaround rather than a fix) for the blind-level
  list, nested inside the screen's outer `ScrollView` (~line 210). Redesign so blind levels aren't
  a scrollable island inside a scrollable screen — options: let the blind-level list flow inline
  in the outer scroll (drop the inner `ScrollView` entirely), or move blind-level editing to its
  own dedicated screen/modal instead of a card on the settings screen.

## Pro feature: Leaderboard
- ⬜ Track who's won the most games among a friend group (local group, not global/online ranking).
- ⬜ Data model + storage: likely local-first (matches the app's no-account philosophy — see
  `StorageAdapter` pattern in [CLAUDE.md](./CLAUDE.md)) rather than requiring sign-in; needs
  design decisions:
  - How a "game" and its winner get recorded (manual entry at game end vs. derived from timer
    session).
  - Whether this is single-device only or needs to sync across players' phones somehow (multi-device
    sync would be a much bigger scope — a shared account/backend — vs. one host's device being the
    source of truth for their group).
- ⬜ UI: leaderboard view (wins per player, maybe games played / win rate).
- ⬜ Gate behind Pro entitlement (`EntitlementProvider`, `shouldShowAds`-style seam in
  `@poker/core`).

## Pro feature: Buy-in & payout structure
- ⬜ Let the host set a buy-in amount and get a recommended payout structure for the prize pool
  (e.g. standard splits like 50/30/20 or configurable place count).
- ⬜ Support **bounties** — a portion of each player's buy-in that goes to whoever eliminates
  them, on top of / instead of part of the standard prize pool. Needs design decisions:
  - Bounty amount as a flat fee per player vs. a percentage of buy-in.
  - How bounty payouts interact with the main payout structure (does bounty money come out of the
    pool before computing places, or is it separate money on top).
  - Whether to support progressive/knockout-style bounties (bounty grows as it's collected) or
    just flat bounties for v1.
- ⬜ Payout math is pure calculation — belongs in `@poker/core` alongside the existing blind/timer
  math, with the UI in the app.
- ⬜ Gate behind Pro entitlement.

## Docs & website parity
- ⬜ Update the website with all current app features (once the above Pro features and Watch app
  land, this should reflect the real feature set — check `apps/web/src/app/components/LandingPage.tsx`
  and the `/guide` page against what's actually in the app).
- ⬜ Update repo docs (`README.md`, `ARCHITECTURE.md`, `STORE_LISTING.md`) to match whatever
  actually shipped in this release, once the rest of this list is done.
