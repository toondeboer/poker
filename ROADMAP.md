# Roadmap

Monetization + growth tracker for Poker Blinds Buzzer.

**Where things stand:** iOS is **live** (App Store v1.1.1) with an AdMob banner + a Pro /
Remove-Ads IAP (RevenueCat). The web app has a live Ko-fi tip jar; web AdSense is built and
awaiting Google approval. **Android launch is essentially done** — Pro purchase verified end-to-end
(shows in RevenueCat), the closed test completed, and the app is **submitted for production and in
Google review**. The only remaining steps are gated on that review: go live, then swap the web Play
Store link. Checklist is ordered by
priority (by ROI/effort — resequence as you like). See [ARCHITECTURE.md](./ARCHITECTURE.md) +
[CLAUDE.md](./CLAUDE.md).

**Legend:** ✅ done · 🚧 in progress · ⏳ waiting on an external process · ⬜ not started.

## ✅ Done
- ✅ Shared `shouldShowAds` + entitlement seam in `@poker/core`
- ✅ iOS: AdMob banner + RevenueCat Pro/Remove-Ads IAP — **live (v1.1.1)**
- ✅ iOS build-from-source fix (SDK-56 precompiled XCFrameworks break this monorepo)
- ✅ iOS universal device family (`supportsTablet`) — fixes App Store error 90101
- ✅ Honest Pro paywall copy (only "remove ads" + "support the dev" for now)
- ✅ Web: Ko-fi tip jar (live) + "Ad-free with Pro" landing copy
- ✅ Web AdSense components (consent-gated) + AdSense `ads.txt`/meta on apex + AdMob `app-ads.txt`
- ✅ RevenueCat Android `goog_` SDK key wired in `app.json`
- ✅ Android app revived for launch: RN 0.85 / Expo SDK 56 native build fixes + notification-permission
  + foreground-alarm bugs — emulator smoke test green (PR #44)

## P0 — Quick closeouts (trivial, finish now)
- ⬜ **Web AdSense go-live:** set Vercel env on the web app + redeploy:
  - `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-9738048037268359`
  - `NEXT_PUBLIC_ADSENSE_SLOT_LANDING=3591846942`
  - `NEXT_PUBLIC_ADSENSE_SLOT_TIMER=1002332300`
- ⬜ Confirm `toondeboer.com` (apex) is deployed with the verification meta tag + `/ads.txt`, complete AdSense site verification → **await approval** (ads serve on the subdomain after approval + visitor consent)
- ⬜ Verify the **App Store `pro_lifetime` IAP description** matches the trimmed paywall (no presets/sound-pack promises)

## P1 — ASO (highest-leverage growth; free; drives installs for the already-live iOS app)
- ⬜ iOS listing: optimized **title + subtitle + 100-char keyword field** ("poker timer", "blinds timer", "tournament clock", "poker clock"…)
- ⬜ **Screenshots** leading with Live Activities / Dynamic Island, the big timer, custom blind structures
- ⬜ In-app **review prompt** after a completed game
- ⬜ Reuse the same listing copy for Android at launch

## P2 — Android launch (ads + Pro parity)
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
- ⏳ Production release → **in Google review** (blocked here — nothing to do but wait)
- ⬜ Once live: update `PLAY_STORE_LINK` in `apps/web/src/app/components/LandingPage.tsx` (placeholder `https://google.com`) → redeploy web

## P3 — More growth
- ⬜ **Brandable apex domain** for the web app (off `poker-timer.toondeboer.com`) — better word-of-mouth, ASO, ads.txt-at-root, trust
- ⬜ **SEO**: rank the free web `/timer` ("poker timer", "blinds timer"…) and funnel visitors to the app
- ⬜ **Table-side virality**: subtle on-screen brand + URL + a share affordance

## P4 — Premium features (then re-add to the Pro paywall)
- ⬜ Saved tournament presets / multiple blind structures
- ⬜ Extra blind levels
- ⬜ Sound packs
- ⬜ Re-add the above to `PRO_FEATURES` in `apps/mobile/src/components/paywall/Paywall.tsx` once shipped

## 🔁 Ongoing — Monitor
- ⬜ AdMob fill/revenue, RevenueCat conversions, AdSense (post-approval), `app-ads.txt`/`ads.txt` verification, ratings & reviews

## ⚠️ Build & release gotchas (read before building)
- **iOS builds from source — do NOT re-enable precompiled frameworks.** Keep `ios.buildReactNativeFromSource: true` (app.json) + eas.json env `EXPO_USE_PRECOMPILED_MODULES=0` & `RCT_USE_PREBUILT_RNCORE=0`. Verify: `grep -c React-Core-prebuilt apps/mobile/ios/Podfile.lock` → `0`.
- **Keep `ios.supportsTablet: true`** — dropping iPad → App Store error 90101 on updates.
- Monorepo: `npm install` from the repo root only; don't disturb the React `19.2.3` overrides; run `expo-doctor` after adding native deps.
- Where the knobs live: AdMob app ids → `app.json` plugin · banner unit ids → `apps/mobile/src/services/ads.ts` · RevenueCat keys → `app.json` `extra` · web AdSense → Vercel `NEXT_PUBLIC_ADSENSE_*` + `apps/web/src/lib/monetization.ts` · product/entitlement ids (`pro` / `pro_lifetime`) → `packages/core/src/monetization/products.ts`.
