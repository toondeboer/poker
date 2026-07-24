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
- ✅ **App icon has sharp corners on Android instead of the OS mask (round/squircle)** — fixed and
  verified on-device (Pixel_10 emulator, launcher screenshot: icon renders as a clean circle,
  matching Phone/Messages/Chrome). Root cause was confirmed: `mipmap-anydpi-v26/` was empty (no
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
  - **Verified:** built `app-debug.apk` locally (now that the local-build breakage below is
    fixed), installed it on a `Pixel_10` emulator, and confirmed via screenshot that the launcher
    icon renders as a clean circle — matches Phone/Messages/Chrome exactly, no sharp corners.
    Nothing left on this item.
- ✅ **Fixed: `android.edgeToEdgeEnabled` in `app.json` was stale/no-op** — confirmed root cause
  by reading `@expo/prebuild-config`'s `withEdgeToEdge`/`withRestoreDefaultTheme` source: every
  prebuild now unconditionally resets `AppTheme` to `Theme.AppCompat.DayNight.NoActionBar` and
  warns that `edgeToEdgeEnabled` is no longer honored (Android 16 makes edge-to-edge mandatory),
  *unless* the `react-native-edge-to-edge` config plugin is explicitly listed in `plugins` — in
  which case it reapplies `Theme.EdgeToEdge` afterward. That plugin was never added to `app.json`,
  so the correct theme only survived because the v1.1.3 icon-fix commit manually patched
  `styles.xml` by hand after a prebuild; the next clean prebuild would have silently wiped it
  again. Fix: removed the dead `android.edgeToEdgeEnabled` key and added
  `"react-native-edge-to-edge"` to `plugins`. Verified with a clean `expo prebuild --platform
  android` — `styles.xml` regenerates with `parent="Theme.EdgeToEdge"` automatically, no
  deprecation warning, no manual patch needed — followed by a full `./gradlew :app:assembleDebug`
  (after clearing the build dirs) which succeeded.
- ✅ **Fixed: local Android Gradle builds were broken on a fresh checkout** —
  `./gradlew :app:assembleDebug` was failing during `processDebugResources` with
  `resource style/Theme.EdgeToEdge ... not found` / `resource style/Theme.SplashScreen ... not
  found`, reproducible even on an unmodified `release/1.1.4` checkout. Root cause: Gradle caches
  the resolved native-module autolinking list at
  `apps/mobile/android/build/generated/autolinking/autolinking.json`, and only re-runs the
  resolution command when a lockfile hash changes (see `ReactSettingsExtension.kt` in
  `@react-native/gradle-plugin`) — it does **not** re-run just because the cache is wrong. That
  cache had been captured at some point while the documented broken-shim state (see the
  `expo run:android` gotcha elsewhere in this doc / CLAUDE.md) was active, which truncated the
  resolved dependency list to 9 entries and silently dropped `react-native-edge-to-edge` (and
  anything else affected) from it — so every subsequent build kept reading that same wrong,
  cached list, no matter how many times the node_modules shims themselves got cleaned up
  afterward. Confirmed by inspecting the cached JSON directly (`node -e` one-liner parsing
  `autolinking.json`, showing only 9 deps, no `react-native-edge-to-edge` entry) and by walking
  `ReactSettingsExtension.checkAndUpdateCache` to see it's keyed on lockfile hashes, not content
  correctness.
  - **Fix:** `rm -rf apps/mobile/android/build apps/mobile/android/app/build` (a gitignored build
    directory — safe to delete) forces the cache to regenerate. Combined with the existing
    documented shim fix, `./gradlew :app:assembleDebug` now succeeds cleanly and reproducibly —
    verified twice in a row including after a full `./gradlew --stop` (cold daemon).
  - **Also worth knowing for next time:** the shim corruption this cache captured wasn't only
    triggered by `expo run:android` as CLAUDE.md's existing note says — it recurred here purely
    from background Gradle syncs. This machine had **Android Studio and the VS Code Gradle
    extension both open against this project simultaneously**, each running its own Gradle
    daemon (four different Gradle versions were running at once: 8.9, 8.13, 9.2.0, 9.3.1) and
    independently re-triggering the autolinking resolution in the background, outside of any
    terminal command. If local Android builds seem to spontaneously re-break after being fixed,
    check for concurrent IDE Gradle syncs before assuming the shim fix didn't take.
  - Folded into CLAUDE.md's existing shim gotcha (the `expo run:android` bullet under "Things that
    bite in this monorepo") so this doesn't need rediscovering next time.
- ⬜ Update Play Store long description / screenshots to reflect current feature set once the
  website/app feature-parity pass (bottom of this list) is done.

## Cross-device QA
- ✅ **Small phones (iPhone SE-class) — confirmed fine.** Booted a fresh iPhone SE (3rd gen)
  simulator (matches the iPhone 8 form factor, 375×667pt — the smallest iOS screen still sold) and
  loaded the Timer screen. `PokerTimer.tsx`'s measure-and-scale approach (`handleColumnLayout` /
  `MIN_SCALE = 0.6`) holds up: the whole card — timer, blinds, next-level preview, Start/Reset,
  Previous/Next, Settings button, ad banner, and the share row — fits in one screen with no
  clipping or scrolling, even at this smallest width. Nothing to fix here.
- 🔍 **Tablets — found a real gap: `PokerTimer.tsx` has no tablet layout, unlike
  `PokerSettings.tsx`.** Booted an iPad mini (A17 Pro) simulator (744×1133pt) and loaded both
  screens:
  - Settings (`PokerSettings.tsx`) is fine as-is — confirmed by reading the source, not just
    screenshotting: it has an `isTablet = screenWidth > 768` branch that switches the Timer
    Settings / Blind Levels cards to side-by-side (`cardsContainerTablet`, `flexDirection: "row"`,
    `maxWidth: 1200`), which is exactly the large-screen fix from v1.1.3 mentioned in the old
    version of this item.
  - **Timer (`PokerTimer.tsx`) has no equivalent.** `mainCard` and its parent `content` view have
    no `maxWidth`/`alignSelf` at any screen size, so on the iPad mini it stretches to ~1200pt wide
    edge-to-edge — confirmed visually (screenshot showed the "10:00" timer, blind values, and
    Start/Previous/Next/Settings buttons all stretched near-full-width). Nothing clips or
    overflows (the existing scale-to-fit logic still keeps it on one screen), but it reads as an
    unpolished phone layout blown up rather than a tablet-designed one — long thin buttons, blind
    values far apart from their labels. Needs the same treatment as Settings: cap `mainCard` at a
    `maxWidth` (e.g. ~500-600pt) and center it via `alignSelf: "center"` on the outer `content`
    view when `isTablet`.
  - Didn't get to Android tablet (Play Store large-screen requirements from v1.1.3 apply here too)
    — see tooling note below.
- 🔍 **Physical-device spot-check and Android emulator pass still outstanding — blocked by
  tooling, not attempted findings.** Two separate issues came up automating this:
  - iOS Simulator: synthetic taps (`cliclick`/`CGEvent`) reliably hit native UIKit chrome (Safari's
    "Open in App?" handoff, the Expo dev-menu's own close button) but never registered on the
    RN-rendered app content itself (Timer's Start/Settings buttons) or on the iOS notification
    permission alert, across many precisely-computed coordinate attempts. Root cause unconfirmed —
    possibly the system notification-permission alert (triggered on app launch) staying logically
    presented and eating touches even after visually appearing dismissed. Didn't chase further; a
    real device or Xcode's own UI-testing driver would sidestep this.
  - Android emulator (Pixel 10, API level matching current `compileSdk`): the debug APK
    (`app-debug.apk`) crash-loops on launch — `expo-dev-launcher` hits a connection error (Metro
    reachability from the emulator wasn't fully sorted despite `adb reverse tcp:8081 tcp:8081`),
    which triggers a real `NullPointerException` in
    `com.facebook.react.ReactActivityDelegate.onUserLeaveHint` (`mReactDelegate` is null) when the
    system backgrounds the erroring `DevLauncherActivity` mid-transition to
    `DevLauncherErrorActivity`. Reproduced identically after `pm clear` (ruled out stale cached
    dev-server URL). This is a dev-client-only failure mode — production/release builds don't
    bundle `expo-dev-launcher` — so it's not a shipped-app bug, but it did block getting any
    Android screenshots this session. Worth a from-scratch look (e.g. a release-config local build,
    or fixing the Metro/emulator networking) before the next attempt.
  - Physical-device spot-check (small phone + tablet, both platforms) from the original checklist
    is still untouched — needs an actual device in hand.

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
