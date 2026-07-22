# Roadmap

Monetization + growth tracker for Poker Blinds Buzzer.

**Where things stand:** **v1.1.3 has shipped — simultaneous iOS + Android** (Sound Pack Pro, the
table-side share row, and the SEO/table-side-share web work from PR #56). `release/1.1.3` was
built and submitted on both platforms, PR #55 merged into `main`, `v1.1.3` tagged on commit
`90ea90e` (2026-07-22), and the release branch deleted. Android submitted to the Play Console
production track and iOS uploaded to App Store Connect as of the submission — **confirm final
store-review approval directly in App Store Connect / Play Console**, since that isn't visible
from the repo. Both platforms run an AdMob banner + a Pro / Remove-Ads IAP (RevenueCat). An
earlier Android upload for this release surfaced **4 Play Console recommendations (2026-07-21)**
— edge-to-edge, large-screen orientation, R8 — all fixed and verified live on a physical device
(see the Android technical quality section below). The web app has a live Ko-fi tip jar; web
AdSense is built; Google **rejected** the first site review 2026-07-21 ("Low value content"), the
content fix from PR #56 + the new `/guide` page went live in production, and the site was
**resubmitted for AdSense review on 2026-07-22** — now **waiting on Google's decision** (see the
waiting-on-external section). The `pro_lifetime` IAP description (all three consoles) and the iOS
App Store Connect listing description have both been **updated to the v1.1.3-aligned copy
drafted in [STORE_LISTING.md](./STORE_LISTING.md)**. The web landing page's `PLAY_STORE_LINK`
points at the real Play listing and is deployed. Checklist is ordered by priority (by ROI/effort —
resequence as you like). See [ARCHITECTURE.md](./ARCHITECTURE.md) + [CLAUDE.md](./CLAUDE.md).

**Legend:** ✅ done · 🚧 in progress · ⏳ waiting on an external process · ⬜ not started · ❌ chosen not to do for now.

## ✅ Done
- ✅ Shared `shouldShowAds` + entitlement seam in `@poker/core`
- ✅ iOS: AdMob banner + RevenueCat Pro/Remove-Ads IAP — **live (v1.1.1)**
- ✅ iOS: tournament presets (Pro) + in-app review prompt + refreshed ASO listing — **live (v1.1.2)**
- ✅ iOS build-from-source fix (SDK-56 precompiled XCFrameworks break this monorepo)
- ✅ iOS universal device family (`supportsTablet`) — fixes App Store error 90101
- ✅ Honest Pro paywall copy (only "remove ads" + "support the dev" for now)
- ✅ Web: Ko-fi tip jar (live) + "Ad-free with Pro" landing copy
- ✅ Web AdSense components (consent-gated) + AdSense `ads.txt`/meta on apex + AdMob `app-ads.txt`
- ✅ RevenueCat Android `goog_` SDK key wired in `app.json`
- ✅ Android app revived for launch: RN 0.85 / Expo SDK 56 native build fixes + notification-permission
  + foreground-alarm bugs — emulator smoke test green (PR #44)
- ✅ Android: **live on Google Play** (approved 2026-07) — AdMob banner + Pro/Remove-Ads IAP (RevenueCat), production review passed

## ✅ P0 — Quick closeouts (config done, AdSense resubmitted — see waiting section)
**Status:** all hands-on P0 config/deploy is complete, including the IAP/App Store copy sync.
**P0 itself can't fully close until AdSense approves** (see waiting item below) — that's the only
remaining dependency, and it's outside repo control.
- ✅ **Web AdSense env (Vercel, web app `poker-timer.toondeboer.com`)** — all three set + deployed, confirmed:
  - `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-9738048037268359` — live (`/ads.txt` serves the seller line; `google-adsense-account` meta tag in `<head>`)
  - `NEXT_PUBLIC_ADSENSE_SLOT_LANDING=3591846942` — set in Vercel Production
  - `NEXT_PUBLIC_ADSENSE_SLOT_TIMER=1002332300` — set in Vercel Production
- ✅ Apex `toondeboer.com` (a **separate** S3/CodeBuild static site, not the Vercel app) — serves the verification meta tag + `/ads.txt` (the seller line) with the correct pub id, deployed to the S3 bucket (confirmed live)
- ✅ **App Store `pro_lifetime` IAP description** — updated to the four-feature copy (remove ads,
  presets, sound pack, support-the-dev) in App Store Connect, Play Console, and RevenueCat (2026-07-22).
- ✅ **iOS App Store Connect listing description** — replaced the stale, Pro-less text with the
  v1.1.3-aligned rewrite drafted in [STORE_LISTING.md](./STORE_LISTING.md) (2026-07-22).

## ⏳ Waiting on external — AdSense resubmitted, awaiting Google's decision
- ⏳ **Web AdSense site review — resubmitted 2026-07-22** after the first rejection (2026-07-21,
  "Low value content"). The content fix (`/timer` FAQ, PR #56) and the new `/guide` page are both
  live in production, and the site was resubmitted for review — **now waiting on Google**, typically
  a few days to a couple weeks. Nothing left to do here until Google responds; if rejected again,
  check the specific reason before assuming more content depth is needed — could also be traffic
  volume or another policy area.

## ✅ Android technical quality — Play Console recommendations (v1.1.3)
**Status:** surfaced 2026-07-21 against an earlier Android upload for this release. All 4 were
"recommended," not blocking, but edge-to-edge is enforced by default from Android 15 and
large-screen restrictions are ignored outright from Android 16 — cheaper to fix now than let them
become forced/user-visible later. All 4 fixed, verified live on a physical device (Samsung
SM_A325M), and merged into `release/1.1.3` via PR #63. Re-check the recommendations list after the
next Android upload.
- ✅ **True edge-to-edge, not the transparent-bar trick** — root cause of both the "may not
  display for all users" warning and the deprecated-API warning
  (`Window.getStatusBarColor`/`setStatusBarColor`/`setNavigationBarColor`,
  `LAYOUT_IN_DISPLAY_CUTOUT_MODE_*`). Fixed by switching `AppTheme` in
  `apps/mobile/android/app/src/main/res/values/styles.xml` from
  `Theme.AppCompat.DayNight.NoActionBar` (with manual transparent `statusBarColor`/
  `navigationBarColor` overrides) to `react-native-edge-to-edge`'s `Theme.EdgeToEdge`, which
  handles real `WindowCompat`/inset behavior; `PokerTimer.tsx` and `BannerAdSlot.tsx` now use
  `useSafeAreaInsets()` (wrapped in `SafeAreaProvider` at the app root) instead of the hardcoded
  `StatusBar.currentHeight || 44` padding, and `SystemBars` (from `react-native-edge-to-edge`)
  replaces the raw `react-native` `StatusBar` component. `app.json` documents intent via
  `android.edgeToEdgeEnabled`. **Still needed:** an on-device visual check — typecheck/lint are
  clean and `assembleDebug` compiles the theme + the newly-autolinked native module, but that's
  not a substitute for seeing the status/nav bar and inset behavior render. The remaining flagged
  call sites (`StatusBarModule`, Material `BottomSheetDialog`/`SheetDialog`/`EdgeToEdgeUtils`, the
  Google Mobile Ads SDK's ad overlay) live inside React Native core, Material Components, and
  `react-native-google-mobile-ads` respectively, not our call sites — those only clear via
  upstream version bumps, not app code.
- ✅ **Large-screen orientation — kept `android:screenOrientation="portrait"` on phones,
  deliberately** — first pass removed it entirely to satisfy the Play Console recommendation, but
  on-device testing (physical Samsung phone) showed real auto-rotate landscape layouts are worse
  UX for a poker timer, and product direction is **portrait-only on phones, no exceptions**.
  Restored `android:screenOrientation="portrait"` on `MainActivity`. This doesn't actually undo
  large-screen support: Android 16's override that ignores `screenOrientation` only kicks in for
  **large-screen devices** (tablets/foldables) — phones still honor the manifest attribute — so
  Play Console will likely keep flagging this as a recommendation (not a blocker) indefinitely,
  which is an accepted tradeoff for the portrait-only product decision. The two components fixed
  to read `useWindowDimensions()` reactively instead of a stale module-load-time
  `Dimensions.get()` (`TimerExpirationAlert.tsx`, `PokerSettings.tsx`'s `isTablet` check) are kept
  — they still matter for tablets/foldables, which can still get resized/rotated by Android 16
  regardless of the manifest attribute.
- ✅ **iOS: same portrait-only decision applied to iPhone** — `apps/mobile/ios/PokerTimer/Info.plist`'s
  `UISupportedInterfaceOrientations` (iPhone) trimmed to just `UIInterfaceOrientationPortrait`
  (was all four), matching the Android phone decision above. `UISupportedInterfaceOrientations~ipad`
  is untouched — iPad keeps all four orientations, same as Android tablets/foldables.
- ✅ **Timer screen fits one screen without scrolling, responsively** — found during the same
  on-device pass: the timer screen wasn't scrollable and only padded for the top inset, so the ad
  banner could push the share row off-screen with no way to reach it. Rejected making it
  scrollable — the screen's content is minimal enough that scrolling reads as a bug, not a
  feature, for a poker timer glanced at across a table. First pass estimated the ad banner's
  height with a guessed constant, which undershot the real adaptive-banner size (confirmed
  on-device: still didn't fit with the actual test ad). Replaced with a **measured** approach
  instead of a guess: `PokerTimer.tsx` measures the actual rendered height of the card + ad +
  share row via `onLayout` and computes a `scale` factor (`available height ÷ measured natural
  height`, clamped to a 0.6 floor) applied to font sizes and spacing throughout — self-corrects
  once the adaptive banner reports its real size (which it doesn't know until it's loaded), so
  there's no constant to keep re-tuning. Also moved the ad banner to sit **between the card and
  the share row** (was previously pinned below both, separate from the scaled column) per product
  direction. Verified live on-device with the real (larger, 468×60) test ad: fits one screen with
  no scrolling, ad correctly positioned above the share row.
- ✅ **Enable R8** — set `android.enableProguardInReleaseBuilds=true` and
  `android.enableShrinkResourcesInReleaseBuilds=true` in
  `apps/mobile/android/gradle.properties` (previously unset/`false`, so release builds shipped
  unminified). No `proguard-rules.pro` additions were needed — RevenueCat, Google Mobile Ads, and
  the Expo modules all ship their own consumer rules via AAR, exactly as hoped but not previously
  verified. Smoke-tested a real `assembleRelease` build (R8 + resource shrinking) on an emulator:
  app launch, timer countdown, the foreground-service notification (live blinds/time-left text
  survived), an AdMob test ad rendering, and the RevenueCat paywall modal (full feature list +
  buttons; "Restore purchases"/"Maybe later" all present) — RevenueCat correctly reported
  `BILLING_UNAVAILABLE` with a fully-readable error message (expected on an emulator with no Play
  Store account, not an R8 stripping issue). No crashes, no obfuscated/garbled error output
  anywhere. Still worth a real device + license-tester purchase before this ships, since the
  emulator can't exercise an actual completed purchase.

## P1 — ASO (skipped for now)
- ✅ iOS listing: optimized **title + subtitle + 100-char keyword field** — drafted in [STORE_LISTING.md](./STORE_LISTING.md), **live in App Store Connect since v1.1.2**
- ✅ Android screenshots — uploaded to the Play listing
- ❌ **Android feature graphic** (1024×500, showing the app in use rather than the enlarged icon) — chosen not to do for now
- ❌ **iOS screenshots** leading with Live Activities / Dynamic Island, the big timer, custom blind structures — chosen not to do for now
- ✅ In-app **review prompt** — fires after **5 rounds played** (gated: ≥5 rounds + 120-day cooldown in `@poker/core`); **live on iOS since v1.1.2**, lands on Android in **v1.1.3**
- ✅ Reuse the same listing copy for Android at launch — Play Store copy drafted in [STORE_LISTING.md](./STORE_LISTING.md)

## ✅ P2 — Android launch (ads + Pro parity) — LIVE on Google Play (2026-07)
**Prereq — app health:**
- ✅ Run the Android app locally; fix bugs (native build drift, notification permission, foreground alarm — PR #44)
- ✅ Update dependencies; resolve breakages — aligned `@babel/core`→7.29.x + `safe-area-context`→5.7.0 to Expo SDK 56, clean-reinstalled to dedupe, `expo-doctor` version check green (React `19.2.3` overrides untouched) — PR #45
- ✅ Smoke-test: timer, blinds editor, notifications, Android foreground service, AdMob banner, Pro paywall (renders) — emulator green. Pro **purchase** flow deferred to Stage 6 (needs a Play device + license tester)

**Then deploy:**
- ✅ RevenueCat: Play **service-account credentials** working — service account created; **release** permission added so `eas submit` works; products/offering wired
- ✅ `eas build -p android --profile production` (from `apps/mobile`) → AAB built & uploaded to **Internal testing** via `eas submit`, then promoted to **Closed testing**. Gotchas fixed along the way: hermesc path for RN 0.85 (PR #45), the SA **release** permission, and the **AD_ID advertising-ID declaration** (App content)
- ✅ Create Play **`pro_lifetime`** managed product (one-time) → attached in RevenueCat to the `pro` entitlement + **current** offering
- ✅ Test the **Pro purchase** end-to-end on a **physical device** (license tester) → purchase completes, Pro unlocks, transaction shows in RevenueCat
- ✅ Play **store listing** + **content rating** + **Data safety** — all forms filled in
- ✅ **Closed testing (account created 2025 → required): ≥12 testers × 14 continuous days** — completed
- ✅ **Apply for production access** (Play Console → Production) — submitted
- ✅ Production release → **LIVE on Google Play** (approved 2026-07)
- ✅ Update `PLAY_STORE_LINK` in `apps/web/src/app/components/LandingPage.tsx` → real listing (`com.toondeboer.pokerkit`), redeployed — live

## P3 — More growth
- ❌ **Brandable apex domain** for the web app (off `poker-timer.toondeboer.com`) — chosen not to do for now
- ✅ **SEO — technical/on-page baseline**: enriched web metadata (OG/Twitter/canonical/keywords),
  added `robots.ts`/`sitemap.ts`, gave `/timer` real content (how-to + FAQ, with `FAQPage` /
  `WebApplication` / `SoftwareApplication` JSON-LD) instead of the bare widget — PR #56, **live in
  production**. This is a necessary baseline, not a ranking guarantee — it alone won't surface the
  app for searches like "poker timer." Still open, in rough priority order:
  - ⬜ Verify the `poker-timer.toondeboer.com` property in Google Search Console and submit
    `sitemap.xml` — confirms indexing and gives real impression/click data. Needs the site owner's
    Google account — not something to do from the repo.
  - ✅ Add genuinely useful content-page depth — new `/guide` page: "How to Run a Home Poker
    Tournament" (buy-in, blind structure, payouts, timer) + a blind-structure explainer, with
    `HowTo`/`FAQPage` JSON-LD, cross-linked from `/timer`. Live in production.
  - ⬜ **Backlinks** — the dominant ranking factor for a term like "poker timer," and untouched so
    far: Product Hunt launch, r/poker, poker forums, app-directory listings. Public outreach under
    the owner's own accounts — not something to do unprompted from the repo.
  - ⏳ **Resubmit for AdSense review** — done 2026-07-22, awaiting Google's decision (see the
    waiting-on-external section up top).
- ✅ **Table-side virality**: subtle on-screen brand + URL + a share affordance on both the web and
  mobile timer screens — PR #56, live in production (web) and shipped in the v1.1.3 build (mobile)

## P4 — Premium features (then re-add to the Pro paywall)
- ✅ Saved tournament presets / multiple blind structures — **Pro-gated**, ships in **v1.1.2** (`@poker/core` presets + `usePresets` + "Tournament Presets" card)
- ✅ Extra blind levels — already free in the blinds editor (add/remove/edit); **kept free** (gating it would remove a capability existing users have)
- ✅ Sound packs — **ships in v1.1.3**: Pro-gated picker (Classic Alarm + 3 bundled alternatives)
  wired through JS playback, Android foreground service, and iOS notification sound; smoke-tested
  end-to-end on both platforms. Bundled audio is a synthesized placeholder tone — swap for produced
  audio in a follow-up if desired.
- ❌ Custom/uploaded alarm sound (Pro) — let a user pick their own audio file instead of choosing
  from the bundled packs. Chosen not to do for now (bigger scope than the v1.1.3 sound-pack work:
  needs `expo-document-picker` + persisting the picked file across app restarts, and different
  native wiring per platform — Android can pass the picked `content://` URI straight into
  `MediaPlayer.setDataSource`, but iOS notification sounds require copying the file into the app's
  `Library/Sounds` directory (`UNNotificationSound` only resolves bundle/Library-Sounds filenames,
  not arbitrary paths), under Apple's 30-second sound-file limit).
- ✅ Re-add shipped features to `PRO_FEATURES` in `apps/mobile/src/components/paywall/Paywall.tsx` — presets and Sound Packs both added (4 features total: remove ads, presets, sound pack, support-the-dev). Updated `pro_lifetime` IAP copy (drafted in `STORE_LISTING.md`) pasted into App Store Connect / Play Console / RevenueCat (2026-07-22).

## 🔁 Ongoing — Monitor
- ⬜ AdMob fill/revenue, RevenueCat conversions, AdSense (post-approval), `app-ads.txt`/`ads.txt` verification, ratings & reviews

## ⚠️ Build & release gotchas (read before building)
- **iOS builds from source — do NOT re-enable precompiled frameworks.** Keep `ios.buildReactNativeFromSource: true` (app.json) + eas.json env `EXPO_USE_PRECOMPILED_MODULES=0` & `RCT_USE_PREBUILT_RNCORE=0`. Verify: `grep -c React-Core-prebuilt apps/mobile/ios/Podfile.lock` → `0`.
- **Keep `ios.supportsTablet: true`** — dropping iPad → App Store error 90101 on updates.
- Monorepo: `npm install` from the repo root only; don't disturb the React `19.2.3` overrides; run `expo-doctor` after adding native deps.
- Where the knobs live: AdMob app ids → `app.json` plugin · banner unit ids → `apps/mobile/src/services/ads.ts` · RevenueCat keys → `app.json` `extra` · web AdSense → Vercel `NEXT_PUBLIC_ADSENSE_*` + `apps/web/src/lib/monetization.ts` · product/entitlement ids (`pro` / `pro_lifetime`) → `packages/core/src/monetization/products.ts`.
