# Roadmap

Monetization + growth tracker for Poker Blinds Buzzer.

**Where things stand:** iOS is **live on the App Store at v1.1.2** (in-app review prompt + Pro
tournament presets + new ASO listing); **Android is live on Google Play** (approved 2026-07 — Pro
purchase verified end-to-end, closed test completed, production review passed). Both platforms run
an AdMob banner + a Pro / Remove-Ads IAP (RevenueCat). **v1.1.3 is in progress, targeting a
simultaneous iOS + Android release** — adds the Sound Pack Pro feature (a picker with 3 bundled
alternative alarm sounds), the SEO/table-side-share work (PR #56, merged into `release/1.1.3`), and
rolls up whatever Android-only fixes land alongside it. The web app has a live Ko-fi tip jar; web
AdSense is built, but Google **rejected** the site review 2026-07-21 ("Low value content") — the
first content fix merged in PR #56 (see P3 SEO), but **isn't live yet**: Vercel only deploys `main`
automatically, and `release/1.1.3` → `main` doesn't merge until the mobile v1.1.3 submission ships
(see CLAUDE.md's release process) — so the web content fix is hostage to the mobile release
timeline unless that's deliberately decoupled. The web landing page's `PLAY_STORE_LINK` points at
the real Play listing and is deployed. Checklist is ordered by priority (by ROI/effort — resequence
as you like). See [ARCHITECTURE.md](./ARCHITECTURE.md) + [CLAUDE.md](./CLAUDE.md).

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

## P0 — Quick closeouts (config done — AdSense go-live rejected, see below)
**Status:** all hands-on P0 config/deploy is complete (verified 2026-06-28). **P0 cannot be closed**
— Google rejected the AdSense site review (see waiting item below), so ads don't actually serve yet
despite config being done.
- ✅ **Web AdSense env (Vercel, web app `poker-timer.toondeboer.com`)** — all three set + deployed, confirmed:
  - `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-9738048037268359` — live (`/ads.txt` serves the seller line; `google-adsense-account` meta tag in `<head>`)
  - `NEXT_PUBLIC_ADSENSE_SLOT_LANDING=3591846942` — set in Vercel Production
  - `NEXT_PUBLIC_ADSENSE_SLOT_TIMER=1002332300` — set in Vercel Production
- ✅ Apex `toondeboer.com` (a **separate** S3/CodeBuild static site, not the Vercel app) — serves the verification meta tag + `/ads.txt` (the seller line) with the correct pub id, deployed to the S3 bucket (confirmed live)
- ✅ **App Store `pro_lifetime` IAP description** matches the trimmed paywall (remove-ads + support-the-dev only; no presets/sound-pack promises) — verified

## ⏳ Waiting on external — AdSense rejected: "Low value content" (blocks P0 go-live)
- ⏳ **Web AdSense site review — rejected 2026-07-21** with "Low value content": the site doesn't
  yet meet Google's minimum content / unique-content bar for the publisher network. Config (Vercel
  env + apex verification, see P0) is unaffected and stays ready — nothing to flip there. The first
  content fix (see P3 SEO) merged into `release/1.1.3` but **isn't deployed yet** — it won't reach
  production until that branch merges to `main`. Resubmitting to AdSense before then would just
  re-review the old thin content.

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
  `WebApplication` / `SoftwareApplication` JSON-LD) instead of the bare widget — PR #56, merged
  into `release/1.1.3` (**not deployed to production yet**, see the AdSense item above). This is a
  necessary baseline, not a ranking guarantee — it alone won't surface the app for searches like
  "poker timer." Still open, in rough priority order:
  - ⬜ Verify the `poker-timer.toondeboer.com` property in Google Search Console and submit
    `sitemap.xml` — confirms indexing and gives real impression/click data
  - ⬜ Add genuinely useful content-page depth (e.g. a "how to run a home poker tournament" guide,
    a blind-structure explainer) — the `/timer` FAQ alone is still thin by competitive standards
  - ⬜ **Backlinks** — the dominant ranking factor for a term like "poker timer," and untouched so
    far: Product Hunt launch, r/poker, poker forums, app-directory listings
  - ⏳ Resubmit for AdSense review once the content fix is live and the above gives Google enough
    to judge the site as more than "low value content"
- ✅ **Table-side virality**: subtle on-screen brand + URL + a share affordance on both the web and
  mobile timer screens — PR #56, merged into `release/1.1.3` (web side not deployed yet, same
  caveat; mobile side ships with the v1.1.3 build)

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
- ✅ Re-add shipped features to `PRO_FEATURES` in `apps/mobile/src/components/paywall/Paywall.tsx` — presets added. Updated `pro_lifetime` IAP description (remove ads + presets + support-the-dev, copy in [STORE_LISTING.md](./STORE_LISTING.md)) pasted into App Store Connect / Play Console / RevenueCat

## 🔁 Ongoing — Monitor
- ⬜ AdMob fill/revenue, RevenueCat conversions, AdSense (post-approval), `app-ads.txt`/`ads.txt` verification, ratings & reviews

## ⚠️ Build & release gotchas (read before building)
- **iOS builds from source — do NOT re-enable precompiled frameworks.** Keep `ios.buildReactNativeFromSource: true` (app.json) + eas.json env `EXPO_USE_PRECOMPILED_MODULES=0` & `RCT_USE_PREBUILT_RNCORE=0`. Verify: `grep -c React-Core-prebuilt apps/mobile/ios/Podfile.lock` → `0`.
- **Keep `ios.supportsTablet: true`** — dropping iPad → App Store error 90101 on updates.
- Monorepo: `npm install` from the repo root only; don't disturb the React `19.2.3` overrides; run `expo-doctor` after adding native deps.
- Where the knobs live: AdMob app ids → `app.json` plugin · banner unit ids → `apps/mobile/src/services/ads.ts` · RevenueCat keys → `app.json` `extra` · web AdSense → Vercel `NEXT_PUBLIC_ADSENSE_*` + `apps/web/src/lib/monetization.ts` · product/entitlement ids (`pro` / `pro_lifetime`) → `packages/core/src/monetization/products.ts`.
