# Roadmap

Checklist for v1.1.4 and beyond. Where an item was already investigated while drafting this
list, the root cause / current state is noted inline so it doesn't need re-discovering — see
[CLAUDE.md](./CLAUDE.md) for the release process and [ARCHITECTURE.md](./ARCHITECTURE.md) for the
full design.

**Legend:** ✅ done · 🚧 in progress · 🔍 investigated, not yet fixed · ⬜ not started

## Android Play Store listing refresh
- ⬜ **Feature graphic** — Play Console requires a 1024×500 feature graphic for the store listing;
  none exists in the repo yet (checked, no `feature-graphic`/`play-store-assets` files anywhere).
  Needs to be designed from scratch and added under an assets folder (e.g. alongside
  [STORE_LISTING.md](./STORE_LISTING.md)).
- 🔍 **App icon has sharp corners on Android instead of the OS mask (round/squircle)** —
  root cause found: `apps/mobile/android/app/src/main/res/mipmap-anydpi-v26/` exists but is
  **empty** (no `ic_launcher.xml` / `ic_launcher_round.xml`), and `app.json`'s `android` block has
  no `adaptiveIcon` key at all — only `icon.png` is set. Without an adaptive-icon XML + background/
  foreground layers, Android falls back to the flat legacy mipmap webp icons instead of letting
  the launcher mask the shape, which is exactly this symptom. Fix: add an `android.adaptiveIcon`
  (`foregroundImage` + `backgroundColor` or `backgroundImage`) to `app.json`, run `expo prebuild`
  to regenerate `mipmap-anydpi-v26/ic_launcher.xml` + `ic_launcher_round.xml`, verify on-device.
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
