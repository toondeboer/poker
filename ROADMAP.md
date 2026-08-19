# Roadmap

Checklist for v1.1.4 and beyond. Where an item was already investigated while drafting this
list, the root cause / current state is noted inline so it doesn't need re-discovering — see
[CLAUDE.md](./CLAUDE.md) for the release process and [ARCHITECTURE.md](./ARCHITECTURE.md) for the
full design.

> **v1.1.4 is cut** (2026-08-19): versions bumped on both platforms, `CHANGELOG.md` rolled into a
> dated heading. What's left before it ships is store-side, not code — build, upload to **internal
> testing / TestFlight**, run the four rows in
> [RELEASE_TESTING.md](./RELEASE_TESTING.md) that can only be exercised there (Android
> purchase/restore/cancel, iOS cancel, deep-link cold launch), then promote, merge the standing
> `release/1.1.4` → `main` PR, and tag the built commit.

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
  - **Update: this crash is now actually fixed, not just worked around** — see CLAUDE.md's
    "Android dev-client builds" entry for the full root-cause writeup and fix
    (`MainActivity.kt` now guards the affected `ReactActivityDelegate` lifecycle calls). Reported
    live by the user via a real-device "Poker Timer keeps stopping" crash dialog; reproduced
    reliably on an emulator (rapid `adb` force-stop/start cycles hit it 100% of the time, not just
    as an occasional race), confirmed present on `release/1.1.4` **before** this fix (so unrelated
    to the same-day splash-hold change under review in parallel), and confirmed gone (10/10 clean)
    after it. Only verified against a **debug** dev-client build this session (matching how the
    live-device report came in) — the underlying `ReactActivityDelegate`/`ReactActivityDelegateWrapper`
    code path isn't dev-launcher-specific, so release builds are likely equally exposed to the same
    narrow timing window, but that wasn't independently re-verified against a release build here;
    the earlier release-APK testing above may simply not have hit the window in that session.
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

## 1.1.4 device passes (all 2026-08-19)

Five passes over the release checklist on real hardware, twelve defects (D1–D12), indexed in
[RELEASE_TESTING.md](./RELEASE_TESTING.md#open-defects). Eleven fixed and confirmed; D11 accepted
for this release. Below, in the order they were found.

### Pass 1 — first run on real hardware (2026-08-19)

iPhone 13 Pro, `npm run ios:device`. Four defects, D1–D4.

- ✅ **D1 — the Pro sheet showed "Unlock Pro · one-time" with no price.** `PremiumContext` fetched
  `getProPriceString()` exactly once on mount and `revenueCatProvider` swallowed every failure as
  `null`, with nothing logged — so one lost race with SDK configuration or a cold network meant no
  price for the rest of the session, even though the same offering lookup succeeds when Unlock is
  tapped (which is why purchasing worked throughout). Now re-attempted on every sheet open, guarded
  against overlapping requests, never overwriting a good price with a null, and the failure is
  logged. The price-less fallback reads plain "Unlock Pro" — "one-time" alone parsed as a price.
- ✅ **D2 — the generator sheet was unusable with the keyboard up.** `KeyboardAvoidingView`
  (`behavior="padding"`) moved the sheet without telling the scroll region inside it that there was
  less room, so the region kept a `maxHeight` derived from the full window, never believed it was
  overflowing, refused to scroll, and pushed the sheet's own top off-screen. Both platforms now
  track the keyboard directly — the approach Android already needed, because KAV is a no-op inside
  a Modal's separate window — and the scroll cap is the space actually left above the keyboard
  minus chrome *measured* from a layout pass, not estimated from the styles (it varies with the
  title, the footer and the bottom inset, and an estimate that runs small puts the top back
  off-screen). `NumberField` gained an iOS `InputAccessoryView` Done bar, since `number-pad` has no
  Return key; rendered only while focused, so the 30-row editor doesn't mount 60 inert accessories.
- ✅ **D3 — backgrounded expiry only ever advanced one level**, and reopening after two or more
  showed a fresh full round at the old level. **Resolved by making the rule explicit rather than by
  catching up.** Nothing counts rounds while the app isn't running: iOS suspends its JS the moment
  it's backgrounded, and neither the Live Activity nor the foreground-service notification knows
  what a blind level is. So exactly one level advances on the way back in, however long the app was
  away — the alternative was never "advance correctly", it was "advance by a number we invent".
  What changed:
  - `hydrateTimerState` now reports `missedRounds` alongside `expired` — the further whole rounds
    that would have run out since the first expiry. It is *not* a count to advance by; it's what
    the player is owed an explanation for, and the expiry alert says so when it's non-zero rather
    than presenting a 40-minute absence as an ordinary round change. Four new core tests.
  - A foregrounded expiry now always shows the alert. `isAlarmLoaded` used to gate the alert
    itself, so an expiry noticed before the alarm sound finished loading — likely on the reopen
    path specifically, since that check runs right after a storage read — took the silent
    background branch: the level moved with no alert and no sound. That's indistinguishable from
    the app losing your place, and is the best candidate for the "doesn't advance in-app" half of
    the report. Only the sound is conditional now.
  - Both native surfaces carry a standing caption saying the app is what starts the next level.
- ✅ **D4 — Live Activity buttons corrupted the timer.** Descoped; see the box below.
- ✅ **Found while fixing D3: there was no keep-awake anywhere in the app.** The OS locks the screen
  after ~30–60s of no touches, which backgrounds the app and hands the round to the single-round
  background path — during the *first* level of every tournament, on a phone sitting on the table,
  which is the app's whole use case. `expo-keep-awake` now holds the screen while a round is
  counting down and releases on pause/stop. It was already in the tree as an `expo` dependency;
  declared in `apps/mobile` because that's the workspace importing it, and the lockfile moved by
  one line. Tagged (`poker-timer-round`) so releasing ours can't clobber another holder's lock.
### Pass 2 — re-testing the fixes (2026-08-19)

D3 and D4 confirmed done on device. Three new items, D5–D7:

- ✅ **D1 was fixed but untestable as configured.** The re-test came back "can't see a price in local
  development at all" — because `FORCE_FREE_IN_DEV` was on, and both it and `FORCE_PRO_IN_DEV`
  skipped the price fetch along with the entitlement check. That's backwards: forcing the free
  experience exists precisely to *look at* the paywall on a device whose account already owns Pro,
  and a paywall with no price isn't it. The price is a read-only store lookup that grants nothing,
  so it now runs regardless of either flag — only the entitlement is forced. Worth remembering
  before reaching for TestFlight to explain a missing price.
- ✅ **D5 — the Done bar only appeared on the *second* keypad open.** Ordered, not flaky: the
  `InputAccessoryView` was rendered only while the field was focused, and UIKit attaches an
  accessory when the keyboard is *presented*, so on first focus it didn't exist yet. It's now
  unconditional. Restyled to UIKit's toolbar proportions (44pt, hairline separator, one
  right-aligned 17pt action) with `keyboardAppearance="dark"` on the input, which is most of what
  read as "ugly" — a dark bar was sitting under a light keypad. Kept per-field rather than one
  shared bar at the root: a few extra offscreen views buys the certainty that the accessory shares
  a React tree, and on iOS a `UIWindow`, with its input even inside a `Modal`.
  - **For the record, since it will come up again:** there is no native dismiss for iOS's
    `number-pad`. It has no Return key, and `inputAccessoryView` is UIKit's own answer — the same
    toolbar Apple's apps put above numeric fields. The only alternative is a different keyboard
    (`numbers-and-punctuation` has a Return key but trades the big keypad for cramped keys).
- ✅ **D6 — scrolling the sheet dismissed the keypad.** Self-inflicted, via the
  `keyboardDismissMode="on-drag"` added with the D2 fix. That mode suits scrolling *content*
  (Messages, Mail's list) where the keyboard is incidental to what you're reading; a **form** is the
  opposite — the fields above and below the one you're in are the reason you're scrolling, so iOS
  form sheets keep the keyboard up and offer an explicit Done. Now `"none"`; dismissal comes from
  the Done bar, tapping outside, and the grabber. Changes Android too, so `generator-keyboard.yaml`
  wants a re-run.
- ✅ **D7 — blinds too small on the Live Activity.** The descoped buttons vacated a row and the
  blinds took it: `.subheadline` → `.title2` bold monospaced for the current level, matching the
  timer's weight, with the next level a step below at `.caption`. Both get `lineLimit(1)` and a
  minimum scale factor so a late-structure `5000/10000` shrinks rather than wrapping or squeezing
  the timer. Android's expanded notification matched (15sp → 22sp, 12sp → 13sp).
### Pass 3 — first hand pass on a real Android device (2026-08-19)

D1, D2, D5's timing, D6 for the sheet, D7 and D3 on Android all confirmed. Five new items:

- ✅ **D8 — Android never scrolls a focused field clear of the keypad**, in Settings or the blind
  editor. Worth understanding, because it will bite anything else that scrolls: Android used to do
  this for free via `windowSoftInputMode="adjustResize"` (window shrinks → native ScrollView shrinks
  → Android's focus handling scrolls the field back into view), and **edge-to-edge ended that**.
  API 35 makes edge-to-edge mandatory and `adjustResize` a no-op with it; the keyboard arrives as an
  inset the app must consume. Nothing did. Same root cause `Sheet.tsx` already handled for its own
  modal window — the app's two main scrollers never got the equivalent. New
  `useKeyboardFocusScroll` hook returns the inset to pad with *and* scrolls the focused input clear;
  Android-only, since iOS's `automaticallyAdjustKeyboardInsets` does both and its column passes.
  Measurement logic lifted from `useKeyboardNudge`, including its nav-bar and status-bar corrections.
- ✅ **D9 — the Done bar looked bolted onto the keyboard.** Current iOS draws the keypad as a
  rounded, inset panel, so a full-width opaque strip above it left mismatched corners and a visible
  seam. Now a transparent bar with a floating rounded pill: nothing with an edge to disagree with a
  shape the OS can change under us.
- ✅ **D10 — the blind editor still dropped the keypad on scroll.** Its `FlatList` carried its own
  `keyboardDismissMode="on-drag"`, set long before and separately from the sheet's, so the D6 fix
  missed it. Same value, same reasoning; both platforms.
- ✅ **D11 — keep-awake never released on pause or stop.** A real race, not the reporter's phone
  settings, and reproducing identically on both platforms was the tell. Acquire is async and release
  was fired independently in the effect cleanup, so a quick pause released a lock that hadn't been
  taken yet; the acquire then landed after it and pinned the screen on for the rest of the session.
  Release is now chained onto the acquire's promise.
- ✅ **D12 — rounds shorter than 10 seconds were silently rewritten.** `MIN_ROUND_DURATION_SECONDS`
  was 10 and `clampRoundDuration` applied it with no feedback, so typing 5 gave back 10 — a rule the
  UI never states, applied after the fact, reads as a broken field. Floor is now 1 second; zero stays
  out (no meaningful expiry, and it divides by zero in the missed-round maths).
### Passes 4 and 5 — D11 only (2026-08-19)

D8, D9, D10, D12 and Android's swipe-away-from-Recents all confirmed on both devices. **D11 is the
only defect left open in 1.1.4**, and it is accepted rather than fixed (below).

- 🚧 **D11 survived its first fix.** Reported back as "nope, stays awake — can it be because of
  Expo?". It is not Expo: `expo-keep-awake` is the only thing in the whole dependency tree that
  touches `isIdleTimerDisabled` or `FLAG_KEEP_SCREEN_ON` (grepped across `node_modules`; neither
  `expo-dev-client` nor the dev launcher holds a lock), and both native implementations are
  symmetric — a tag set, flag cleared once it empties.
  - The first fix chained each release onto its own acquire, which only ordered *that* pair. The
    native side is a tag set rather than a counter, so whichever call lands last wins outright, and
    a pause/resume/pause sequence can still interleave two independent chains. All transitions now
    go through **one module-level queue** that reconciles to the latest desired state with at most
    one call in flight, so the class of bug is gone by construction rather than by staying a step
    ahead of it. Both calls log, so the next pass can say whether the release actually ran.
  - **Rule the phone out before believing the app.** Releasing doesn't wake anything: it re-arms the
    OS idle timer from that moment, so the screen sleeps one full auto-lock interval *after* the
    pause — five minutes on a 5-minute setting, never on *Never*. This is indistinguishable from the
    bug without either a 30-second auto-lock or the new log lines.
- 🟡 **Accepted for 1.1.4 (2026-08-19), not held for.** The re-worked fix ships untested. Small blast
  radius: it only applies with the app *foregrounded* and paused, since `expo-keep-awake` releases
  the lock natively when the app is backgrounded — a pocketed phone still sleeps. Re-check §10's two
  rows on the first TestFlight/internal build; if they still fail, the new log lines say in one line
  whether the release call ran, which is what separates an app bug from the OS re-arming its idle
  timer from the moment of release.
- ☐ **Still unverified on device:** D11 and the two §10 rows it gates. Android's three purchase rows
  are blocked on a Play Console upload rather than on any code here — Play Billing only serves an app
  the store recognises (uploaded to a track, matching signing key, tester on the licence-testing
  list), which a local debug APK is not.

## Live Activity / foreground service controls

> **⛔️ Descoped from 1.1.4 (2026-08-19): the Pause/Resume/Stop buttons are removed from both
> platforms, before ever shipping.** Everything below this box is the history of building them and
> is kept for whoever picks the idea back up — it is not a description of the current app. Both
> surfaces remain, display-only.
>
> **What forced it.** The 1.1.4 device pass (iPhone 13 Pro, see [RELEASE_TESTING.md](./RELEASE_TESTING.md)'s
> D4) found Pause setting the timer to 0:00, and Resume then jumping to a full round *and* firing
> the "time's up" notification immediately. Resume's behaviour is downstream of Pause's: a stored
> `timeLeft` of 0 takes the `timeLeft > 0 ? timeLeft : timerDuration` fallback and reports
> `wasExpired`, which advances a blind level and reschedules the alert with a non-positive delay.
>
> **Best hypothesis for the zero, untested.** `TimerActionButtons(paused: paused || isExpired)`
> was evaluated at *render* time, and WidgetKit does not re-render the Lock Screen view as the
> countdown runs — `Text(timerInterval:)` animates without one. So after expiry the button still
> read "Pause", and `state.timeLeft = max(0, state.timeRemaining)` on a negative remaining stores
> 0. Note this is the same class of failure as the 2026-07-29 investigation below, which was
> written off as Simulator flakiness — it reproduced on real hardware.
>
> **Why removal rather than a fix.** The buttons exist to let something *other than the app* write
> timer state, and everything expensive here follows from that: an intent running in the widget
> extension's own process, an App Group write, a Darwin notification, a live JS event, a persisted
> snapshot reconciled against AsyncStorage in a specific order on next foreground, and a
> `wasExpired` flag so the widget can ask the app to do the level maths it can't. Four rounds of
> device debugging (below) went into making that pipeline work and it still shipped broken. With
> the buttons gone the app is the sole writer of timer state, which is also the premise the
> backgrounded-expiry rule now rests on.
>
> **Kept on purpose:** the App Group entitlement (`group.com.toondeboer.pokerkit`) in `app.json`
> and both `.entitlements` files. Nothing reads it now. It stayed because removing an entitlement
> changes code signing on a release that's mid-submission-cycle, for no user-visible gain, and
> it's exactly what the buttons would need on the way back.
>
> **If revisiting:** confirm the stale-render hypothesis first, with Console.app on a device
> filtered to subsystem `com.toondeboer.pokerkit` — the diagnostic `os.Logger` calls were in the
> deleted `TimerActionIntents.swift` and are worth restoring before anything else. A fix that
> doesn't depend on render-time freshness (deriving the action from the Activity's own state
> inside `perform()`, accepting that it may disagree with what was tapped) is the shape to try.

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
  - **iOS: real device build required a one-time manual step** — local Xcode automatic signing
    didn't auto-register the new App Groups capability from the entitlements files alone (that
    only happens via Xcode's own Signing & Capabilities UI); the device build failed with
    "Provisioning Profile ... does not support the App Groups capability" until the capability was
    added there for both targets. EAS's remote-managed credentials are expected to handle this
    automatically for device/TestFlight builds, but that hasn't been confirmed.
  - **Verified on a real device (iPhone 13 Pro), round 1: Pause and Stop worked correctly, Resume
    did not** — tapping it had no effect. First (partial) diagnosis: `TimerActionButtons` swapped
    between two *different* `LiveActivityIntent` types (`PauseTimerIntent` vs `ResumeTimerIntent`)
    depending on `paused` — WidgetKit's interactive buttons can lose their binding when a button
    swaps between different intent types across re-renders, and the branch that only appears
    after the first state change (Resume, since the activity always starts unpaused) was the one
    that stopped responding. Merged both into a single `TogglePauseTimerIntent`.
  - **Verified on device, round 2: now Pause didn't work either, and Resume still didn't work
    after the timer expired** — the single-intent merge alone didn't fix it, meaning the round-1
    diagnosis was incomplete. Root-caused properly this time: `TimerContext` had two independent,
    unsequenced async reconciliations firing on the same foreground transition —
    `useNativeTimerActionSync`'s `consumePendingAction()` (reads the App Group flag a native tap
    writes) racing against `TimerContext`'s own `loadTimerState()` (reads AsyncStorage — a
    completely separate, stale source a native tap never touches). AsyncStorage I/O is
    consistently slower than the native UserDefaults/SharedPreferences read behind
    `consumePendingAction()`, so `loadTimerState()` reliably resolved *last* and silently
    overwrote the reconciled action — not a flaky race, a losing one every time. Fixed by moving
    the persisted-flag reconciliation out of `useNativeTimerActionSync` (now just the live-event
    fast path) and into `TimerContext`, explicitly sequenced *after* `loadTimerState()` resolves.
    Also hardened `TogglePauseTimerIntent` defensively: it now takes `shouldPause` as an
    `@Parameter` tied to the same `paused` value that decided the button's label, rather than
    re-reading `Activity` state fresh inside `perform()` (Lock Screen content can render slightly
    behind the true state, so a stale read could disagree with what the user saw and tapped).
  - **Confirmed fixed on a real device (iPhone 13 Pro)**: Pause, Resume, and Stop all work as
    expected from the Lock Screen/Dynamic Island, matching the in-app UI afterward. Diagnostic
    `os.Logger`/`NSLog` calls added while chasing round 2 (widget intent `perform()`, the App
    Group read/write path, the Darwin-notification observer, and the RN bridge's emit) were left
    in place — they're per-tap, not per-tick, so they're cheap, and they're valuable if this area
    regresses later.
  - **Confirmed: iOS Live Activity buttons go dead after the user force-quits the app — this is
    an Apple platform restriction, not fixable in app code.** `LiveActivityIntent` is built on the
    App Intents framework, and Apple explicitly refuses to run *any* of an app's App Intents
    (Live Activity buttons, interactive widgets, Shortcuts alike) once the user has force-quit
    that app from the app switcher, until they manually reopen it at least once — the Live
    Activity itself stays visible and tappable (it's a system surface, not tied to the app's
    process), but the tap silently goes nowhere. Verified this matches the reported symptom
    exactly (buttons visible and tappable, no effect) and there's no API to override it.
    - The "timer expired" notification still arriving during this window is correct, not a bug:
      it's scheduled ahead of time through iOS's own notification system
      (`scheduleNotificationAsync` in `useTimerNotification.ts`) specifically so it's delivered
      regardless of the app's process state — that's the point, so the user isn't left unaware
      the timer ended just because they force-quit the app.
    - Reopening the app after a force-quit already cleans up correctly with no further changes
      needed: `useTimerNotification.ts`'s foreground effect calls `clearAllNotifications()` as
      soon as the app becomes active, and `loadTimerState()`/`hydrateTimerState()` resync the UI
      from whatever the timer's actual last real (non-force-quit) state was.
    - Resuming an *already-expired* timer via the button (the `state.timerDuration` fallback path
      in `TogglePauseTimerIntent`/`ForegroundServiceModule`) has not been separately re-verified,
      but isn't affected by the above — worth a quick pass next time this area is touched.
      - 🔍 **Partially investigated (2026-07-29), reported via iOS Simulator**: resuming with
        ~1 minute left showed the Live Activity immediately jump to "expired" and start counting
        down from 15 minutes instead of the actual remaining time. Read through the full path
        (`TogglePauseTimerIntent`'s resume branch, `applyNativeAction`/
        `handleNotificationScheduling` in `TimerContext.tsx`) and found no logic bug — the resume
        branch correctly computes `remaining = timeLeft > 0 ? timeLeft : timerDuration` and sets
        `endTime = now + remaining`; pause cancels the scheduled "time's up" local notification,
        resume reschedules it `timeLeft` seconds out. Suspected cause is **Simulator-specific
        ActivityKit flakiness, not app code**: Apple's Live Activities have documented reliability
        gaps in Simulator (no push-token path at all; local `Activity.update()` propagation
        between the main app process and the widget extension process can lag/desync in ways real
        hardware doesn't show), and this exact scenario was never verified end-to-end on a real
        device in the original Pause/Resume/Stop work above (only the ordinary, non-expired case
        was confirmed on an iPhone 13 Pro). Not re-investigated further in the Simulator — the
        diagnostic `os.Logger` calls already in `TogglePauseTimerIntent` (see above) are the next
        step, watched live via Console.app on a **real device** reproducing the same steps
        (pause with time left, wait, resume from Lock Screen); if it reproduces there too, treat
        as a genuine bug and dig into the logged `state.timeLeft`/`timerDuration` values at the
        moment of the tap. If it's Simulator-only, no app-code fix is needed.
  - **Found via adb automation, not manual testing: Android had its own version of this bug, and
    it was worse — self-inflicted, not a platform limit, and happening on the ordinary
    swipe-away-from-Recents gesture, not just a deliberate "force stop."** `TimerContext` had a
    leftover "cleanup on unmount" effect calling `liveActivityService.endActivity()`. On Android,
    swiping the task away destroys the Activity, which tears down the whole React Native host and
    unmounts every component — including this one — so that cleanup fired and explicitly stopped
    the very foreground service that's supposed to survive exactly that gesture. Confirmed via
    logcat: `"Foreground Service updated successfully"` → `ReactHost.onHostDestroy` →
    `"Foreground Service stopped"`, all inside the same task-removal event. This predates the
    pause/resume/stop work (it's been in `TimerContext.tsx` since the original read-only Live
    Activity feature) but went unnoticed until this feature made surviving backgrounding actually
    matter. Very likely also the explanation for a separately-reported "app sometimes quits
    unexpectedly" — no crash appears in any captured log, but the foreground presence and the
    background service both vanishing together on every swipe-away would read as exactly that.
    Fixed by removing the unmount cleanup entirely; ending the activity is solely `resetTimer()`'s
    job now. Verified end-to-end via `adb`: start timer, swipe away from Recents, confirm the
    notification survives, Pause/Resume/Stop still work, reopening the app shows synced state.
  - **Found via the same `adb` testing: pausing/resuming natively while the app was backgrounded
    froze the timer at the wrong instant** — reported as "the timer keeps running past when I
    paused it, and shows paused at whatever time it happened to be at when I reopen the app."
    Root cause: the native side only ever persisted the bare action name ("pause"/"resume") for
    JS to reconcile, not the actual frozen `timeLeft`/`endTime` it computed at that instant. On
    reopen, `loadTimerState()` re-derives `timeLeft` by continuing to count down from the
    *original pre-pause* `endTime` all the way to "now" — entirely unaware a native pause/resume
    happened in between — and only *then* applied `pauseTimer()`/`startTimer()` on top of that
    already-wrong value. This affected both platforms identically (a shared `TimerContext` bug,
    not Android-specific), just surfaced first here. Fixed by threading the native side's own
    authoritative snapshot through end-to-end (SharedPreferences/App Group `UserDefaults` +
    the emitted event, not just the action name) and giving `useTimerEngine`'s `pause()`/
    `resume()` an optional exact override, applied directly instead of re-derived from JS's own
    stale state. Verified via `adb`: paused via notification at a recorded value, waited 20s,
    reopened — showed the exact paused value, not a decayed one; resumed, waited 15s, reopened —
    correctly showed the timer had legitimately expired from continuing the *correct* countdown.
  - **Two more bugs found testing the timing-precision fix above, both specific to resuming a
    round that had already expired natively (button tapped after "TIME'S UP"):**
    1. The Android notification (and iOS Live Activity) kept showing a "Pause" button/label after
       the round expired — nonsensical, since nothing was running to pause. Root cause on
       Android: `timerExpired` was flipped *after* the notification's last rebuild (the tick that
       hits `timeLeft == 0` is also the last one this service ever reschedules), so the stale
       "Pause" button froze forever. Fixed the ordering, and both platforms now show "Resume"
       once expired (`isEffectivelyPaused`/`isExpired` computed alongside `paused`).
    2. Resuming from that expired state (via the notification, or the equivalent in-app "Resume"
       button after a native-originated pause) restarted the round but instantly reset it to
       expired again. Root cause: `@poker/core`'s `startTimer` computed a fresh `endTime` (falling
       back to a full `timerDuration`) but left `timeLeft` at its stale `0`, and every completion
       effect (`timeLeft === 0 && !paused && endTime`) reads that combination as "just expired."
       Fixed at the source (`startTimer` now sets `timeLeft` in the same update) plus the two
       other places with the identical pattern: `useTimerEngine`'s native-resume override and both
       native sides' own `ACTION_RESUME`/`TogglePauseTimerIntent` resume branches.
    - **Found via a third round of testing: resuming an expired round didn't advance the blind
      level** — it restarted the *same* round instead of moving to the next level, unlike every
      other expiry path in the app (background auto-advance, the in-app "Next Blinds" button).
      Root cause: neither native side tracks blind levels at all (that's app-only business logic
      by design — see `CLAUDE.md`'s "shared logic" boundary), so native's own resume fallback
      could only ever restart the same round it already knew about. Fixed by adding a `wasExpired`
      flag to the pending-action payload (Android: `KEY_PENDING_WAS_EXPIRED`; iOS: captured from
      `ContentState.isExpired` before the intent mutates state) — set only when a "resume" follows
      an expired round, not an ordinary mid-round pause/resume. `TimerContext.applyNativeAction`
      branches on it: when true, calls `increaseBlinds()` and starts a fresh full-duration round
      computed in JS, disregarding native's same-level `endTime`/`timeLeft` entirely. Verified via
      `adb`: expired a 6s test round, tapped Resume from the notification, confirmed both the
      notification and the reopened app advanced from Level 1 to Level 2 (not a restarted Level
      1). iOS has the equivalent fix in place but hasn't been separately verified on-device yet.
  - **A fourth bug, unrelated to the native side: the in-app "Time's Up" alert (overlay + alarm
    sound) could silently fail to show when a round expired while the app was genuinely in the
    foreground** — instead it auto-advanced the blind level with no alert and no sound, as if the
    app had been backgrounded, even though it was on-screen the whole time. Two separate causes in
    `TimerContext.tsx`, both tracing back to the same root issue — cached `AppState` flags that
    only update on a "change" event and can end up stuck if one is ever missed or arrives out of
    order (a transient system dialog/notification/overlay momentarily stealing focus):
    1. `handleTimerComplete` decided whether to show the alert using the cached `isActive` from
       `AppStateContext` instead of checking live. Fixed by reading `AppState.currentState`
       directly at the decision point — a live getter can't go stale the way an event-driven cache
       can.
    2. A separate effect that auto-dismisses the alert when backgrounded
       (`if ((isBackground || isInactive) && showTimerAlert)`) was level-triggered, not
       edge-triggered — it re-runs the instant `showTimerAlert` flips true (it's in the effect's
       own deps), so if `isBackground`/`isInactive` merely *happened* to already read true on that
       render, it would immediately dismiss+advance the alert the moment it appeared. Fixed to
       only fire on the actual active→background/inactive transition (`!isActive &&
       wasActiveRef.current`), mirroring the `cameToForeground` edge-detection already used just
       above it in the same effect.
    Verified via a temporary on-screen debug readout (`AppState.currentState`, `isAlarmLoaded`,
    `showTimerAlert` at the moment `handleTimerComplete` fires) across two consecutive foreground
    expiries — both correctly showed the "Time's Up!" overlay. Not separately stress-tested for a
    round expiring within the first few seconds of a cold app launch (before `AppState`/audio
    loading has settled) — inherently lower-risk in real usage since rounds run minutes, not
    seconds, but flagged here in case this area gets revisited.
  - **A fifth bug, reported after force-quitting (swiping away from Recents) and reopening: the
    timer reset to the default 10-minute duration and blind Level 2, regardless of what was
    actually configured/persisted before the kill.** Root cause: a genuine stale-closure race, not
    a platform limitation. `TimerContext`'s mount effect (`useEffect(() => {
    loadTimerState().then(reconcileNativeAction); }, [])`) runs exactly once, at the very first
    render — before `BlindsContext`'s own persisted `currentBlindIndex` has loaded (defaults to
    `0`) and before `timerDuration` has loaded (defaults to `DEFAULT_TIMER_DURATION`, 10 minutes).
    Since this effect never re-runs, `reconcileNativeAction`/`applyNativeAction` stay permanently
    bound to those pre-load default values — a `wasExpired` resume reconciled through it computed
    a fresh endTime from the *default* duration and called the *default*-index `increaseBlinds()`,
    landing on "10:00, Level 2" no matter what was actually persisted. Fixed two ways: (1)
    `applyNativeAction` is now dereferenced through a ref updated every render
    (`applyNativeActionRef`, same pattern as `useTimerEngine`'s `callbacksRef`), so it's never
    bound to a stale render; (2) the mount effect now waits for `BlindsContext`'s own `isLoading`
    to clear (guarded by a ref so it still only fires once) before reconciling at all, since
    `BlindsContext` loads independently of `TimerContext` and a "fresh" closure alone doesn't
    help if the data it reads hasn't actually loaded yet. Verified via `adb`: force-quit
    mid-round (Level 3, 6s test duration), let it expire and resumed from the notification twice
    while still fully killed (confirming — see below — that native's own display can't advance on
    its own), then reopened the app cold: correctly showed Level 4 (advanced once, matching the
    single pending action) at the correct 6-second duration, not reset to Level 2/10 minutes.
    - **Reported at the same time, but a separate, narrower architectural limitation, not a bug:
      while the app stays fully killed (task swiped away from Recents), the notification's own
      displayed blind level/blinds text can't advance across *multiple* expire-and-resume
      cycles.** Neither native side tracks blind levels at all (by design — see the `wasExpired`
      fix above), and the pending-action mechanism is a single-slot "last action" cache, not a
      queue — so if a round expires, gets resumed from the notification, runs out again, and gets
      resumed *again*, all without the app ever being reopened, only the most recent action is
      remembered. On next reopen, JS correctly advances by the one pending action, but the
      notification's own text stays frozen at whatever blind level JS last pushed to it
      throughout that whole dead stretch, and doesn't reflect intermediate advances the user
      couldn't see anyway. Confirmed via `adb`: after two consecutive native-only resumes, the
      notification still read "Level 3" both times, but reopening correctly caught up to
      "Level 4." **Only triggered by an actual task removal, not ordinary backgrounding** —
      pressing Home leaves the RN host alive, so the live-event listener still catches each
      native action immediately and pushes the update back to the notification in real time;
      the lag specifically needs the Activity destroyed (confirmed via logcat:
      `ReactHost.onHostDestroy` fires on task removal, not on a plain Home-button background).
      Fixing this fully would mean duplicating blind-level math into Java/Swift, against this
      repo's "shared logic lives in `@poker/core`, platform code stays in the app" boundary
      (`CLAUDE.md`) — considered not worth it for a scenario that requires the user to swipe the
      app away *and* never check their phone across multiple full rounds.
    - ✅ **Communicated via a small permanent caption**, matching the existing iOS force-quit
      notice's style — name the action to avoid, not just the symptom — but worded for Android's
      actual (narrower) limitation: buttons keep working regardless, only the displayed blind
      level can lag, and only after an actual force-quit (not plain backgrounding): "Don't force
      quit the app, or the blind level shown here may fall behind." Added unconditionally to the
      end of `PokerTimerService.formatBigText()`, so it shows in the notification's expanded view
      regardless of state. Verified via `adb`: renders as its own paragraph below "Next Level",
      above the Resume/Stop buttons, no clipping or crowding.

## Live Activity / foreground service UI/UX polish
- ✅ **Force-quit limitation communicated** — considered detecting a force-quit and prompting
  about it, but there's no API to know a button tap was even attempted (App Intents that never
  ran leave no trace to check for), so no conditional/one-time message is possible. Added a
  small, permanent caption to the iOS Lock Screen Live Activity card instead: "Don't force quit
  the app, or these buttons may stop responding." Not added to the Dynamic Island's expanded
  region (already tight on space — leading/trailing blinds, timer, level, and the buttons
  themselves) or to Android (force-stopping there kills the notification along with the service,
  so there's no dead-button state to warn about — see the force-quit item above).
- ✅ Now that Pause/Resume/Stop are functional (see above), pass over the visual design of both
  surfaces — they were originally built as read-only displays, and the current button styling
  (`.buttonStyle(.bordered)`, small system icons) was chosen for speed, not polish.
  - ✅ **Color consistency, both platforms** — the Live Activity's Pause/Resume button had no
    `.tint()` at all (rendered in the system default blue, clashing with the app's own palette),
    and neither surface's state colors lined up with each other or with the app's own in-JS
    gradient (`PokerTimer.tsx`'s `getGradientColors`/`getProgressBarColor`) or Android's own
    `getStatusColor`. Both now derive from the same brand hex values (`#10B981` green /
    `#F59E0B` amber / `#DC2626` red, plus `#6B7280` gray for paused): iOS via a new
    `TimerVisualState` enum (`PokerTimerWidget.swift`) shared across the Lock Screen view and all
    three Dynamic Island presentations (previously each had its own `paused ? .orange : .green`
    ternary), Android via `PokerTimerService#getStatusColor`. This also added two visual states
    that didn't exist before: an expired round now shows red + an alarm icon (previously
    indistinguishable from "active" in color/icon, only the button label changed), and a
    low-time warning (`isLowTime`, ≤60s remaining) matching Android's existing threshold — iOS
    computes this reactively off `endTime` the same way `isExpired` already did, so it updates
    live without the widget extension needing to run code every second.
  - ✅ **Android Stop icon fixed** — `createNotification()`'s "Stop" action was reusing
    `ic_notification_clear` (an X/dismiss glyph, correctly used elsewhere for the alert
    notification's "Dismiss" action), which reads as "cancel/close" rather than "stop". Added a
    dedicated `ic_notification_stop.xml` (filled square) used only for this action.
  - Screenshotted on real devices (iPhone 17 simulator + an Android emulator): iOS matched the
    intended design (green icon, gray Pause, red Stop). Android didn't — `NotificationCompat`'s
    stock action buttons render as plain platform-accent text links with no per-button color API,
    so the color/icon fixes above never reached the buttons themselves, leaving them looking like
    generic Android chrome next to iOS's colored pills.
  - ✅ **Custom Android `RemoteViews` layout** — resolved the open design question below in favor
    of matching iOS: replaced the stock two-action layout with `notification_timer_collapsed.xml`
    (text + two small circular icon buttons) and `notification_timer_expanded.xml` (full layout
    mirroring the iOS Lock Screen's header/timer+blinds/buttons/caption rows), wired up via
    `NotificationCompat.DecoratedCustomViewStyle` + `setCustomContentView`/
    `setCustomBigContentView` in `PokerTimerService#createNotification`. Buttons are real
    `LinearLayout`s with a solid-color pill/circle background (`bg_pill_green/gray/red.xml`,
    swapped per state via `RemoteViews#setInt(..., "setBackgroundResource", ...)`) and a
    `setOnClickPendingIntent` reusing the same Pause/Resume/Stop `PendingIntent`s as before.
    - Hit and fixed two real bugs along the way, both only surfacing at runtime (not compile
      time), so the passing Gradle build below didn't catch either:
      1. `android.widget.Space` (used for spacers in both layouts) isn't on RemoteViews'
         allow-list of inflatable view classes — crashed with `InflateException: Class not
         allowed to be inflated android.widget.Space`. First fix attempt swapped it for plain
         `<View>` — **also not on the allow-list**, confirmed via a second crash
         (`BadForegroundServiceNotificationException`) once the notification was actually posted
         for the first time (the dev-client crash below had been blocking that until now). Fixed
         for good by dropping spacers entirely in favor of margins on the following element; the
         one flexible push-apart gap uses an empty `LinearLayout`, which is unambiguously
         RemoteViews-safe.
      2. `.addAction()` calls were initially kept alongside the custom views "for Wear OS/Android
         Auto surfaces that can't render a custom view" — wrong reasoning: `DecoratedCustomViewStyle`
         renders the system's own action row *in addition to* the custom content, not instead of
         it, so every button was duplicated as a second, plain-text row directly below the
         colored pills (confirmed on-device via screenshot). This app has no Wear OS/Android Auto
         surface today to justify that cost, so removed the calls entirely rather than keep
         speculative future-proofing with a real, visible downside right now.
    - ✅ **Confirmed working on-device (Pixel emulator)**: both the collapsed and expanded
      RemoteViews layouts render correctly (green active-state color, gray Pause/red Stop pills,
      level/blinds, force-quit caption), no crash, no duplicate action row.
  - ✅ **Gray → amber, both platforms** — spotted on a real device: gray read as dull/washed-out
    against the iOS Live Activity's dark-mode black background, next to the vivid green timer
    text and red Stop button. Amber was already in the palette (the low-time warning color) and
    reads as a caution color between green (resume/go) and red (stop) — closer to a
    traffic-light convention, and more legible on both platforms. First applied to just the Pause
    button (Android's `bg_pill_gray.xml` renamed to `bg_pill_amber.xml`), then extended to the
    paused round's own accent too (iOS `TimerVisualState.color`'s `.paused` case, Android
    `getStatusColor`'s `paused` branch — the icon/timer text color, separate from the button's
    own tint) once the gray icon/text still looked inconsistent next to the now-amber button.
    Palette simplifies to 3 colors: green (active), amber (caution — paused or low-time), red
    (stop/expired). `pokerGray`/`pokerTimerGray` removed, now fully unused on both platforms.
  - Verified via `swiftc -typecheck` (widget target's Swift files) and full
    `:app:compileDebugJavaWithJavac` + `:app:mergeDebugResources` Gradle builds (Android) — all
    clean.
  - ✅ **Layout/spacing pass, Lock Screen view** — a prior fix already resolved outright clipping
    (see the compact-layout commit above) but used flat, uniform 6pt spacing between all four
    rows regardless of relationship. Regrouped into two visual blocks with a tighter 4pt rhythm
    within each and deliberate extra separation between them: header + timer/blinds read as one
    "info" block, buttons + force-quit caption read as one "controls" block (the caption
    specifically describes the buttons above it, so keeping them close reads as a unit rather
    than four independent, equally-spaced rows). Also dimmed the caption slightly beyond standard
    `.secondary` (`opacity(0.85)`) so it reads as fine print rather than a peer of the buttons.
    Didn't touch `TimerActionButtons`' own internal sizing (shared with the Dynamic Island's
    already-tight expanded region — bumping it there risks the overflow this area was fixed for).

## Mobile app launch — visible resize before layout settles
- ✅ **Fixed — the screen now stays hidden until its layout has actually converged**, rather than
  trying to out-race the convergence with a timer. `SplashScreen.preventAutoHideAsync()` is called
  at module scope in `_layout.tsx` (before first render — a `useEffect` fires too late, after the
  first paint), and `AppReadyGate` (`apps/mobile/src/components/AppReadyGate.tsx`) provides a
  `revealed` flag + `reportContentSettled()` callback via context to everything inside the `Stack`.
  `PokerTimer` renders its measured column at `opacity: 0` until `revealed`, and calls
  `reportContentSettled()` once its fit has converged *and* `TimerContext.isLoading` is false;
  `AppReadyGate` then flips `revealed` and calls `hideAsync()` in the same commit, so the splash
  lifts and the settled card appears in one frame. A 4s ceiling still bounds the worst case.
  - **Why the first attempt wasn't enough (and what the instrumentation showed).** The original fix
    hid the splash on "contexts loaded + a 300ms settle buffer", which was a *guess* at how long
    convergence takes. Timestamped logging of every `onLayout`/`setScale` on a 360×640dp Android
    emulator showed the real behaviour: **four passes, `1.000 → 0.778 → 0.917 → 0.808`, taking
    ~470–600ms** — and, importantly, **non-monotonic**: it overshoots down, corrects back up, then
    settles. That wobble is exactly the reported "resizes a few times". The 300ms guess did happen
    to win the race in the runs measured (settled +465ms, splash hid +854ms) — but only by ~390ms,
    with nothing guaranteeing it, which is why it still showed up in real use.
  - **Root cause of the oscillation** (left in place, now just invisible): `handleColumnLayout`
    estimates `naturalHeight = measuredHeight / scale`, which assumes height is *linear* in `scale`
    — but spacing uses `g() = scale ** 3`. So each pass' estimate is wrong in a direction that
    overshoots, and it converges by damped oscillation instead of directly. Fixing the estimate
    itself would mean re-tuning the whole fit (and its carefully tuned `MIN_SCALE` /
    `MIN_SPACING_SCALE` visual result), so the reveal gate makes it moot instead — any number of
    passes, however long they take, are now unobservable.
  - **Both completion orders are handled.** Convergence and data-loading can finish in either
    order, and a converged layout fires no further `onLayout` — so if data lands *second* there'd be
    no measurement pass left to report from. A `useEffect` on `isLoading` covers that. Both paths
    were exercised in testing: cold launch #1 settled with `isLoading` already false (reported from
    the layout handler, +517ms); cold launch #2 settled while still loading and reported from the
    effect 52ms later (+654ms) — neither fell through to the ceiling.
  - `settings.tsx` also calls `reportContentSettled()` on mount. It has no measure-and-rescale pass
    to wait for, but without it a launch that opens straight to Settings (deep link / restored
    route) would have nothing to report and would sit on the splash until the 4s ceiling.
  - Also seeds `scale` from a module-level `lastConvergedScale` so a remount starts at the right
    size and settles in one pass — direction (a) from the original write-up, in its cheap form.
    In practice expo-router keeps the timer screen mounted across Settings navigation (verified: a
    Settings round-trip produced *zero* layout passes), so this is a safety net rather than the
    main mechanism.
  - **The ad banner IS a contributor after all — fixed in a follow-up.** An initial Android run
    made it look harmless (`onSizeChange` reported `360×56` at +353ms, *before* the fit settled),
    but that was luck: the user then reported the resize still happening on iOS, and instrumenting
    an iPhone showed `onAdLoaded` arriving at **+591ms *after* the reveal**, taking the slot from
    0 → 63pt under an already-visible layout and kicking off **9 visible oscillating passes**.
    A later Android run had the ad land at **+2799ms**, so the platform difference was really just
    timing — both were exposed. `BannerAdSlot` now reserves the banner's height up front so the
    slot is its final size on the very first layout pass and the ad arriving changes nothing.
    - The SDK exposes no synchronous way to ask for an anchored adaptive banner's height, so it's
      estimated as `min(90, max(50, round(width * 0.156)))` — Google clamps these to 50..90dp, and
      the ratio matches both measurements exactly (402pt→63 on iOS, 360dp→56 on Android). It does
      not need to be exact: the fit ignores scale deltas under `0.01`, which on a full-height
      column absorbs roughly ±8pt, so a few points of error still produces no reflow. A real
      banner's reported height is cached in-process to self-correct later mounts.
    - **The reservation had to be gated on `isPremium` alone, not the full `shouldShowAds` policy.**
      That policy is `!isPremium && consentResolved`, and `consentResolved` flips asynchronously
      *after* the first layout pass — so keying the slot's existence on it just reintroduced the
      same 0 → full-height jump one step earlier. Gating on `isPremium` (which starts `false`) gives
      free users stable space from the first pass; only the `BannerAd` itself waits for consent.
      A Pro user whose entitlement resolves late still sees the band collapse once, but that was
      already true before — and worse, since the slot used to mount and load a real ad first.
  - **Also fixed the convergence itself**, which the reveal gate had been hiding rather than
    solving. The `measuredHeight / scale` estimate assumes height is linear in `scale` while
    spacing uses `scale ** 3`, so every step overshot: the raw iteration ping-ponged around the
    answer (measured 11 passes on iOS: `0.951 ↔ 0.991 ↔ 0.961 ↔ 0.982 …`) and terminated only by
    scraping under the tolerance (`0.009` vs `0.01`) — on a scale that still overflowed the screen
    by 8pt. Since the reveal now *waits* for settle, a device where that ping-pong didn't dip under
    the threshold would have sat on the splash until the 4s ceiling, so this was a real risk the
    gate introduced. Halving each step fixes it: the map's slope near the fit is ≈ -1, so a 0.5
    damping factor drives the effective slope to ≈ 0. Convergence went **11 passes → 3 on iOS** and
    **4 monotonic passes on Android** (no oscillation at all), and it now settles on a size that
    actually fits (`measured 776.7 < avail 778`) rather than one 8pt over. The termination test
    still uses the true undamped error, so the fixed point — and therefore the final visual result
    and the tuned `MIN_SCALE`/`MIN_SPACING_SCALE` behaviour — is unchanged; only the path to it is.
  - **Verified on both platforms** via timestamped `onLayout`/reveal/ad-load instrumentation
    (dev-client + Metro), on a 360×640dp Android emulator (`Android_small`, API 35) and an
    iPhone 17 simulator. Final runs: every intermediate scale lands before the reveal, and the ad
    load (+677ms iOS, +2799ms Android) produces **zero** subsequent layout passes on either.
    Confirmed visually on both, and a Settings round-trip still produces no layout passes.
    `typecheck` and `prettier --check` clean. Lint still fails repo-wide on the pre-existing
    `expo/tsconfig.base` resolver error, unrelated to this.
  - Residual, not worth chasing unless it shows up: a Pro user whose RevenueCat entitlement
    resolves *after* the reveal will see the reserved ad band collapse once. Gating the reveal on
    entitlement resolution too would fix it, but would put every user's launch behind a network
    call, so it wasn't done.

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
- ✅ **Fixed — blind editing moved to its own screen.** Of the two options originally listed
  (inline the list in the outer scroll vs. a dedicated screen), the **dedicated screen** was taken:
  inlining 30 level rows would have pushed Presets and Sound Pack far below the fold on the
  Settings page. `PokerSettings.tsx` (956 lines, one file) is deleted; Settings is now
  `components/settings/*` and blind editing is a new `/blinds` route
  (`components/blinds/BlindStructureScreen.tsx`) whose only scroller is a single `FlatList`.
  `nestedScrollEnabled` no longer appears anywhere in `apps/mobile/src` — verify with
  `grep -rn "nestedScrollEnabled" apps/mobile/src`.
  - **Apply now clamps instead of resetting.** `applyCustomBlindLevels()` used to set
    `currentBlindIndex = 0`, so editing blinds mid-tournament silently restarted you at Level 1.
    It now clamps the index into the new schedule (core's `clampBlindIndex`), and the Apply footer
    warns first when the level you're on would be dropped. **That reset was load-bearing** —
    `PokerTimer.tsx` indexes `blindLevels[currentBlindIndex]` directly and zeroing was the only
    reason a shortened schedule couldn't crash it. Replaced by three things: the clamp on apply, a
    matching clamp when the persisted state loads in `BlindsContext`, and a `?? blindLevels[0]`
    fallback at the read site.
  - **`loadBlindLevels` and `resetToDefaultBlinds` deliberately still reset to Level 1** — they
    swap in a whole different setup (a saved preset, the factory default), where "Level 12" of the
    structure you *were* playing is meaningless. Only editing the structure you're currently
    playing preserves your place.
  - New editor capabilities alongside the restructure: insert/duplicate a level at any position
    (`insertBlindLevel`/`duplicateBlindLevel` in `@poker/core`), tap-to-jump the running tournament
    to any level (`selectBlind`, mirroring web's `useWebBlinds`), and a structure generator
    (`generateBlindStructure` — starting small blind × level count × speed).
  - **The generator's growth model is a mantissa ladder, not a percentage — don't "simplify" it
    back.** The first implementation used a flat multiplier (`1.25`/`1.4`/`1.75`) plus a rounding
    pass onto chip denominations, with a monotonicity repair for when rounding collapsed a step.
    At realistic starting blinds that repair fired on *every* level, so it walked the denomination
    ladder (5→10→20→25→50→100…) regardless of the rate and **all three speeds returned
    byte-identical schedules** — while also exploding to 10⁸ by level 30. The tests missed it
    because they asserted "strictly increasing" and "is a chip denomination", both of which the
    broken ladder-walk satisfied; `generateStructure.test.ts` now asserts the speeds *differ* and
    are *ordered*. Replaced with how real published structures actually work (see the standard
    casino sheet `25/50 → 50/100 → 75/150 → 100/200 → 150/300 → 200/400 → 300/600 → 400/800`,
    whose ratios are 2.0, 1.5, 1.33, 1.5, 1.33, 1.5, 1.33 — round numbers first, not a constant
    percentage): each speed is a ladder of round mantissas walked within a power of ten and wrapped
    into the next. Ladder length is levels-per-10×, so the top end is bounded and predictable —
    slow `[1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8]` (10/decade, ≈+26%/level, matching WSOP-main-event
    pace and the 20–33% band), standard `[1, 1.5, 2, 3, 4, 6]` (6/decade), turbo `[1, 2, 3, 5]`
    (4/decade).
  - Also landed with it: a shared theme module (`apps/mobile/src/theme`) and UI primitives
    (`apps/mobile/src/components/ui`) — the app previously had no design system at all, every
    style being hand-rolled hex. Values were lifted verbatim, so the token extraction itself is
    visually a no-op. Emoji icon stubs replaced with Ionicons; round duration is now mm:ss.
  - **Not verified on a device/emulator yet** — `typecheck`, `test` (117 core tests) and
    `prettier --check` are clean, and `lint` fails only on the pre-existing `expo/tsconfig.base`
    resolver error, but nothing here has been run visually. See the manual checklist in the PR.
- ⬜ **Two known divergences deliberately left open by the above:**
  - Web's `applyCustomBlindLevels` (`apps/web/src/hooks/useWebBlinds.ts`) still resets to index 0,
    so mobile and web now behave differently on the same action. Mirror the clamp there when web
    is next touched.
  - iOS's scheduled "time's up" notification is only rebuilt on pause/resume
    (`handleNotificationScheduling` in `TimerContext.tsx`), so after a level jump the pending
    notification still names the *old* next blind. Pre-existing — `increaseBlinds`/`decreaseBlinds`
    have always had it — but a 20-level jump makes it obvious. Fix by rescheduling on a
    `currentBlindIndex`/`blindLevels` change while running.
- ✅ **Fixed: the generator sheet's footer (Replace structure / Cancel) was unreachable behind the
  keyboard on Android** — found while building Maestro coverage for `RELEASE_TESTING.md` §5.
  Focusing "Starting small blind" or "Number of levels" and bringing up the keyboard covered the
  sheet's lower fields and its whole footer with no compensating scroll or resize. Root cause
  confirmed properly this time (an earlier pass here recorded a wrong theory and a fix that did
  nothing): a temporary on-screen listener showed `keyboardDidShow`/`keyboardDidHide` firing
  correctly with the right height, so the event was never the problem — `KeyboardAvoidingView`
  itself was silently producing zero adjustment on Android regardless of `behavior`
  (`undefined` or `"height"` gave pixel-identical screenshots), the same
  `Dimensions.get('window').height`-doesn't-reach-inside-a-Modal root cause `useKeyboardNudge.ts`
  already documents for Presets. Fixed by bypassing `KeyboardAvoidingView`'s Android path
  entirely: `Sheet.tsx` now tracks keyboard height itself via `Keyboard.addListener` and applies
  it directly as `marginBottom` on the sheet. Verified via screenshot: the whole sheet, including
  "Cancel"/"Replace structure", is now visible above the keyboard, and
  `generator-keyboard.yaml` asserts on it for real instead of documenting the gap.
- ✅ **Fixed: `useKeyboardNudge`'s scroll-clear-the-button logic undershot for the Presets card's
  preset-name field** — found in the same Maestro pass as the item above. Focusing "Preset name"
  and bringing up the *full QWERTY* keyboard only scrolled "Save Preset" about 40% clear of it,
  not fully clear as `BREATHING_ROOM = 24` intends. Root cause, confirmed via a temporary
  `console.log` diagnostic rather than guessed: the hook's `windowHeight - covered` branch (the
  one that wins for a keyboard this tall) mixed two coordinate frames that don't share an origin
  on Android — `measureInWindow` (used for both `containerY` and the target's own Y) reports y=0
  at the top of the *content* area, already excluding the status bar, while
  `Dimensions.get("window").height` is the *full* screen height, status bar included. That gap is
  exactly the status bar's height (~54dp measured here) — small enough that the narrower
  number-pad keyboards elsewhere never pushed this branch low enough to matter, but a full
  keyboard did. Fixed by threading a new `topInset` prop (from `useSafeAreaInsets().top`,
  `SettingsScreen.tsx` → `PresetsCard.tsx` → the hook) and subtracting it from `windowHeight`
  before the comparison — gated to Android only, matching how `bottomInset` is already gated,
  since iOS's `measureInWindow` frame wasn't verified to have the same exclusion. Verified via
  screenshot: "Save Preset" now has full, clean breathing room above the keyboard.
- ✅ **Fixed: `NavRow`'s badge (e.g. the "Unapplied changes" pill on the Blind structure row) was
  invisible to VoiceOver on iOS** — found while adapting the generator's Maestro flows for iOS.
  `NavRow.tsx` set an explicit `accessibilityLabel="${title}. ${summary}"` on its
  `TouchableOpacity`, which on iOS collapses the *entire subtree* — including the `badge` child —
  into just that one opaque accessibility string. Confirmed via `maestro hierarchy` immediately
  after a screenshot that clearly showed the badge rendered: it was genuinely absent from the
  accessibility tree, not a timing fluke. Android wasn't affected — title/summary/badge stay
  separate accessible nodes there. Fixed with a new `badgeLabel` prop that folds the badge's text
  into the same `accessibilityLabel` (`"<title>. <summary>. <badgeLabel>"`) — `TournamentCard.tsx`
  now passes it alongside the `<Badge>` node. Verified: `maestro hierarchy` on iOS now reports
  `"Blind structure. 30 levels · 5/10 → 800/1600. Unapplied changes"`, and
  `generator-replace-draft-only-ios.yaml` asserts on it directly instead of only a screenshot.
- 🔍 **The blind-structure editor's list is not capped/centred on iPad at all — genuinely
  full-bleed** — found while finally verifying §7 of `RELEASE_TESTING.md` on a real iPad simulator
  (iPad Pro 11-inch M5) for the first time; that row had never actually been checked before despite
  the code appearing to handle it. `BlindStructureScreen.tsx` has the identical
  `isTablet && styles.centred` pattern (`maxWidth: TABLET_MAX_WIDTH_LIST` (900),
  `alignSelf: "center"`, `width: "100%"` on the `FlatList`'s `contentContainerStyle`) that
  demonstrably works correctly on the *Settings* screen on this exact same device and orientation
  (Tournament + Presets render side by side, capped) — so `isTablet` is evaluating true, the
  problem is specific to how this particular `FlatList`'s `contentContainerStyle` resolves on iOS.
  Confirmed with two separate settled screenshots (not a mid-transition capture) that every row,
  the header buttons, and the sticky Apply/Discard footer all span the full ~834pt width. Not root
  caused beyond that — possibly a Fabric/Yoga difference in how `contentContainerStyle` combines
  `flexGrow: 1` (from the shared `content` style) with `alignSelf`/`width`/`maxWidth` on iOS vs.
  Android, but worth a real investigation rather than another guess given how much of this session
  already went to guess-and-check layout fixes that didn't pan out.
  - Also full-bleed on iPad: the generator sheet (`GenerateStructureSheet`/`Sheet.tsx`), but that
    component has no tablet-cap logic at all on either platform, so this may be pre-existing/never
    implemented rather than a regression — unclear whether Android's existing ☑ for "sensible at
    tablet width" was judged at this same full-bleed width or a genuinely capped one.
  - Timer and Settings *do* correctly cap/centre on this same iPad, confirmed via screenshot — the
    bug is specific to the blind-editor list.

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
