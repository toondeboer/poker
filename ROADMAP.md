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

## Store assets refresh — screenshots for all platforms & device sizes
- ⬜ Existing App Store / Play Store screenshots predate the cross-device QA pass below (tablet
  layout fix for Timer, small-phone spacing fix, Android tablet no longer letterboxed) — capture
  fresh screenshots so the listings reflect what the app actually looks like now, not the
  pre-fix layouts.
- ⬜ **iOS App Store:** iPhone screenshots (6.9"/6.5" size classes Apple requires) plus iPad
  screenshots (`supportsTablet: true` means the listing needs its own iPad set, not just scaled
  iPhone shots) — capture Timer, Settings, and Paywall on at least one iPhone and one iPad size.
- ⬜ **Google Play:** phone screenshots plus a tablet set (Play Console separates these) — same
  screens, phone and tablet, now that the tablet orientation fix means tablet screenshots will
  actually show the intended side-by-side/centered layouts instead of a letterboxed phone view.
- ⬜ Decide whether to keep hand-picked simulator/emulator screenshots or invest in an automated
  screenshot pipeline (e.g. `fastlane snapshot`/`fastlane frameit`) given how many size
  combinations this now covers (iPhone × iPad × Android phone × Android tablet).

## Cross-device QA
- ✅ **Fixed: Timer didn't quite fit on the smallest phones.** Initially reported this as fine
  based on an iPhone SE (3rd gen) screenshot, but on a live look the user caught that it was
  actually tight — margins between the progress bar, Current Blinds, and Next Level were touching
  the readable-text floor (`MIN_SCALE = 0.6`) without room left to compress further. Fixed by
  decoupling whitespace from font-size scaling: card padding and section margins now follow
  `scale ** 3` (its own lower floor, `0.35`) instead of the same `scale` used for text, so gaps
  compress noticeably faster than text does as the screen gets tighter — verified visually,
  visibly tighter gaps on the same device. Android small phone (a `small_phone` AVD profile, API
  35, 720×1280) was checked too — Timer and Settings both render cleanly there, nothing clipped,
  real AdMob test ad renders correctly at the bottom of Timer.
- ✅ **Fixed: `PokerTimer.tsx` had no tablet layout, unlike `PokerSettings.tsx`** — see the
  "Timer card stretches full-width on iPad" fix already landed (CHANGELOG `[Unreleased]`,
  `fix/tablet-timer-layout`). Added the same `isTablet` / `maxWidth` + centering pattern Settings
  already used.
  - **Important nuance found while double-checking this fix (worth knowing before touching this
    threshold again):** both Settings' existing `isTablet = screenWidth > 768` and the new Timer
    one use the same cutoff, and it does **not** trigger on iPad mini specifically — an iPad mini
    (A17 Pro) in portrait is 744×1133pt, just *under* 768. Confirmed by measuring the rendered card
    width in screenshots pixel-for-pixel before/after the fix: identical (1392px both times) on
    that device. So iPad mini currently gets the same un-capped phone-style layout on **both**
    Timer and Settings — this isn't a Timer-specific gap, it's how the existing `768` threshold
    already behaves, and changing it also changes Settings' long-shipped behavior, so left as-is
    rather than changed unilaterally here. Re-verified the threshold *does* fire correctly on a
    genuinely large tablet (iPad Pro 11", 834×1194pt portrait, comfortably over 768) — 834 > 768 is
    unambiguous, so the tablet branch reliably activates there; iPad mini is the one edge case
    sitting just under the line. If iPad mini should also get the tablet treatment, that's a
    one-line threshold change in both files, but it's a deliberate call, not a bug fix.
- ✅ **Fixed: Android tablets were letterboxed into a narrow portrait strip (black bars either
  side), so `isTablet` never fired on Android regardless of screen size.** Found on a `pixel_tablet`
  AVD (API 35, 2560×1600 landscape-native, a real 11" Android tablet) with the release build:
  `AndroidManifest.xml`'s `<activity>` had `android:screenOrientation="portrait"` hardcoded (added
  by the earlier "lock iPhone to portrait, matching Android phones" fix), and since Android tablets
  default to **landscape**, the OS letterboxed the whole app into a narrow portrait-width strip
  (confirmed visually: black bars either side, system's "Double-tap to move this app" split-screen
  hint overlaid on them). The activity's own window — and therefore `useWindowDimensions()` — only
  ever saw that narrow letterboxed width, never the tablet's real screen, so `isTablet` evaluated
  false and both Timer and Settings rendered phone-style even on a genuinely large tablet.
  - **Root cause of the root cause:** an earlier commit (`1db000f`) removed this same manifest
    lock specifically because "Android 16 ignores resizability/orientation restrictions on
    large-screen devices outright" — then a later one (`9b6ab49`) restored it for phones,
    reasoning that the ignore-on-large-screens behavior would still protect tablets. That
    assumption was backwards: Android 12L+'s actual large-screen policy for a *declared* fixed
    orientation is to **letterbox** the activity, not ignore the restriction — which is exactly the
    symptom reproduced here (and the AVD was API 35 either way, one version behind the "Android 16"
    the commit named, though the letterboxing turned out to be unrelated to that gap).
  - **Fix:** removed `android:screenOrientation` from the manifest entirely (so large screens are
    never letterboxed at the static/declared level) and moved the portrait lock into
    `MainActivity.onCreate` instead — `requestedOrientation = SCREEN_ORIENTATION_PORTRAIT` when
    `resources.configuration.smallestScreenWidthDp < 600`, `SCREEN_ORIENTATION_UNSPECIFIED`
    otherwise. Phones still lock to portrait with no exceptions (unchanged product decision);
    tablets get sensor/current orientation and the OS stops letterboxing them.
  - **Verified visually** on the same tablet AVD (release build, rebuilt after the fix): Timer's
    card is now centered with the app's own green gradient filling the rest of the screen (no
    black bars), and Settings correctly renders its side-by-side tablet layout — both previously
    dead code paths on Android now actually reachable. Confirmed the small-phone AVD is still
    portrait-only, unaffected.
  - First attempt tried gating `android:screenOrientation` per-screen-size via a `@string`
    resource + `values-sw600dp` override — `aapt` rejected this at install (`For input string:
    "portrait"`): unlike most manifest attributes, `screenOrientation` is compiled to an enum
    constant, not resolved as a plain string reference, so resource-qualified overrides don't work
    for it. The runtime `requestedOrientation` approach above is the one that actually works.
- ✅ **Android emulator dev-client crash-loop — root cause found and worked around, unblocking all
  the above.** The only local AVD (`Pixel_10`) targets `android-37.0`/16KB-page-size — a preview
  image far ahead of any stable Android release. The debug APK crash-looped on it within ~1s of
  every launch (`NullPointerException` in `ReactActivityDelegate.onUserLeaveHint`, `mReactDelegate`
  null). Installed a stable API 35 system image locally (`sdkmanager --sdk_root=~/Library/Android/
  sdk --install "system-images;android-35;google_apis;arm64-v8a"` — the Homebrew-installed
  `sdkmanager` defaults to a *different* SDK root than `~/Library/Android/sdk`, which is what
  `avdmanager`/the emulator actually reads from, so the `--sdk_root` flag matters) and created
  fresh `small_phone` and `pixel_tablet` AVDs on it — **same crash reproduced there too**, ruling
  out the preview-API-level theory: it's a genuine `expo-dev-launcher`/RN 0.85 dev-client
  compatibility bug, not an emulator/API-level issue, and it'll hit a physical device on this
  dependency version just the same. Production builds don't bundle `expo-dev-launcher` though, so
  as a workaround, built a local **release** APK instead (`./gradlew :app:assembleRelease`, debug
  keystore, no code changes needed) — hit the monorepo's already-documented broken-shim gotcha
  (CLAUDE.md) along the way (`Project with path ':expo-dev-launcher' could not be found`), fixed
  with the documented shim-clean + `npm install` + build-cache-clear steps, then a `lintVital*`
  OutOfMemory failure (worked around with `-x lintVitalAnalyzeRelease -x lintVitalReportRelease -x
  lintVitalRelease`, not a real bug — just constrained lint worker memory on this machine). The
  resulting release APK installs and runs cleanly on both stable-API AVDs above with no crash.
- 🔍 **Physical-device spot-check (small phone + tablet, both platforms) still outstanding** —
  needs an actual device in hand, not attempted this session.
- 🔍 **iOS Simulator touch-automation note (tooling limitation, not a product finding):**
  synthetic taps (`cliclick`/`CGEvent`) reliably hit native UIKit chrome (Safari's "Open in App?"
  handoff, the Expo dev-menu's own close button) but were unreliable against RN-rendered app
  content and the iOS notification-permission alert — worked sometimes, not others, no pattern
  found. Android's `adb shell input tap` had no such issue (real HID-level injection) — reliable
  every time. A real device or Xcode's own UI-testing driver would sidestep this for iOS.

## Android notification-permission double prompt
- ✅ **Investigated on-device — not reproducible, no bug present.** The previous write-up's theory
  (two independent request paths firing on mount) doesn't hold up once the full call graph is
  traced:
  - `useTimerNotification.ts` early-returns a stub (`{ scheduleNotification, cancelNotification }`)
    for `Platform.OS === "android"` **before** the `useEffect` that calls
    `registerForPushNotificationsAsync` (and therefore `Notifications.getPermissionsAsync()` /
    `requestPermissionsAsync()`) is even declared. That effect is iOS-only in practice — easy to
    miss reading top-to-bottom since the guard clause sits above the hooks it's skipping. This
    early return isn't new; it's been there since the initial Android notification work (`98479f2`
    and earlier), well before this item was investigated.
  - `useNotificationPermission`'s own mount effect (`checkPermission`) calls
    `liveActivityService.requestNotificationPermission()`, which on Android resolves to
    `ForegroundServiceModule.hasNotificationPermission()` — despite the "request" name on both
    functions, that native method only does `ContextCompat.checkSelfPermission(...)`. It reads
    status, it never shows a dialog.
  - The **only** call in the app that actually triggers the Android system dialog is
    `TimerContext.tsx`'s `checkBackgroundSupport` mount effect, which calls `requestPermission`
    (destructured as `requestNotificationPermission`) from `useNotificationPermission` →
    `PermissionsAndroid.request(POST_NOTIFICATIONS)`. One path, one dialog.
  - **Verified on two API 35 emulators** (`Android_small`, `Android_tablet`): `pm revoke
    POST_NOTIFICATIONS` + `pm clear` to reset to a first-install state, then fresh launch.
    Screenshots confirm exactly one system permission dialog appears; tapping **Allow** dismisses
    it and the app proceeds straight to the Timer screen with no second prompt (foreground-service
    notification icon appears in the status bar once the timer starts). Repeated the same reset
    tapping **Don't allow** instead — also no second prompt, no crash, no immediate re-prompt loop.
  - **Minor readability nit, not a functional bug:** `LiveActivityService.requestNotificationPermission`
    and `ForegroundServiceModule.hasNotificationPermission` are named inconsistently with what they
    do (one's a "request" that only checks; the other's correctly named "has"). Worth a rename for
    clarity if touching this code again, but doesn't affect behavior.

## Live Activity / foreground service controls
- ✅ **Pause/Resume + Stop actions added** to both the Android foreground-service notification and
  the iOS Live Activity/Dynamic Island. Both platforms update their own visible UI immediately on
  a button tap (no dependency on a live JS/bridge instance) and persist the action
  (`SharedPreferences` on Android, App Group `UserDefaults` on iOS) so `TimerContext` reconciles it
  on next app foreground/launch via a new `consumePendingAction()` — covering both "app
  backgrounded, JS still alive" (fast path, live `DeviceEventEmitter`/`NativeEventEmitter` event)
  and "app killed" (persisted-flag fallback). Along the way, fixed a pre-existing bug where
  `ForegroundServiceModule.isServiceRunning` was a stale JS-side flag never updated by the service
  itself — harmless before (nothing but JS ever stopped the service), but would have caused a
  resurrected notification once the service could stop itself from a tap.
  - **Verified end-to-end on Android** (API 35 emulator): started a timer, backgrounded the app,
    tapped Resume/Pause/Stop from the notification, and confirmed both the notification and the
    reopened app's UI reflected the change each time (including a full reset to `10:00`/`Start`
    after Stop).
  - **iOS: verified the build only, not interactively.** A clean Xcode build succeeds for both the
    main app and widget-extension targets (App Intents metadata extraction runs against the three
    new `LiveActivityIntent`s, entitlements/App-Group synthesis for the simulator is correct on
    inspection), but this environment has no way to simulate taps on the iOS Simulator (no `idb`,
    no GUI window session for AppleScript/`cliclick`), so the Live Activity/Dynamic Island buttons
    themselves haven't been interactively exercised. **Needs a real interactive pass** (simulator
    or device) before shipping — start a timer, background the app, tap Pause/Resume/Stop on the
    Lock Screen and Dynamic Island, confirm the app's state matches on reopen, and repeat after
    force-quitting to exercise the cold-launch `consumePendingAction()` path.
  - Also worth confirming before shipping: a real device build (not just simulator) actually gets
    the App Group capability provisioned — local Xcode automatic signing appears to have synced it
    without any manual Apple Developer Portal step for the simulator build tested here, and EAS's
    remote-managed credentials should do the same for device/TestFlight builds, but neither was
    confirmed on a real device.

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
