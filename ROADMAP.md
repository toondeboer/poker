# Roadmap

Monetization + growth tracker for Poker Blinds Buzzer.

**Where things stand:** iOS is **live** (App Store v1.1.1) with an AdMob banner + a Pro /
Remove-Ads IAP (RevenueCat). The web app has a live Ko-fi tip jar; web AdSense is built and
awaiting Google approval. **Android is not launched yet.** Checklist is ordered by priority
(by ROI/effort — resequence as you like). See [ARCHITECTURE.md](./ARCHITECTURE.md) + [CLAUDE.md](./CLAUDE.md).

## ✅ Done
- [x] Shared `shouldShowAds` + entitlement seam in `@poker/core`
- [x] iOS: AdMob banner + RevenueCat Pro/Remove-Ads IAP — **live (v1.1.1)**
- [x] iOS build-from-source fix (SDK-56 precompiled XCFrameworks break this monorepo)
- [x] iOS universal device family (`supportsTablet`) — fixes App Store error 90101
- [x] Honest Pro paywall copy (only "remove ads" + "support the dev" for now)
- [x] Web: Ko-fi tip jar (live) + "Ad-free with Pro" landing copy
- [x] Web AdSense components (consent-gated) + AdSense `ads.txt`/meta on apex + AdMob `app-ads.txt`
- [x] RevenueCat Android `goog_` SDK key wired in `app.json`

## P0 — Quick closeouts (trivial, finish now)
- [ ] **Web AdSense go-live:** set Vercel env on the web app + redeploy:
  - `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-9738048037268359`
  - `NEXT_PUBLIC_ADSENSE_SLOT_LANDING=3591846942`
  - `NEXT_PUBLIC_ADSENSE_SLOT_TIMER=1002332300`
- [ ] Confirm `toondeboer.com` (apex) is deployed with the verification meta tag + `/ads.txt`, complete AdSense site verification → **await approval** (ads serve on the subdomain after approval + visitor consent)
- [ ] Verify the **App Store `pro_lifetime` IAP description** matches the trimmed paywall (no presets/sound-pack promises)

## P1 — ASO (highest-leverage growth; free; drives installs for the already-live iOS app)
- [ ] iOS listing: optimized **title + subtitle + 100-char keyword field** ("poker timer", "blinds timer", "tournament clock", "poker clock"…)
- [ ] **Screenshots** leading with Live Activities / Dynamic Island, the big timer, custom blind structures
- [ ] In-app **review prompt** after a completed game
- [ ] Reuse the same listing copy for Android at launch

## P2 — Android launch (ads + Pro parity)
**Prereq — app health (hasn't been run/tested in a while):**
- [ ] Run the Android app locally; fix bugs
- [ ] Update dependencies; resolve breakages (keep the React `19.2.3` overrides; run `expo-doctor` after native changes)
- [ ] Smoke-test: timer, blinds editor, notifications, Android foreground service, AdMob banner, Pro paywall/purchase

**Then deploy:**
- [ ] RevenueCat: get the Play **service-account credentials green** (grant Play permissions + enable the Google Play Android Developer API; ~24–48h propagation)
- [ ] `eas build -p android --profile production` → upload AAB to Play **Internal testing** (first upload may need to be manual)
- [ ] Create Play **`pro_lifetime`** managed product (one-time) → attach in RevenueCat to the `pro` entitlement + offering
- [ ] Play **store listing** + **content rating** + **Data safety** (declare AdMob ads, advertising ID, purchases)
- [ ] Test internal → promote to production → review → live
- [ ] Update `PLAY_STORE_LINK` in `apps/web/src/app/components/LandingPage.tsx` (currently placeholder `https://google.com`)

## P3 — More growth
- [ ] **Brandable apex domain** for the web app (off `poker-timer.toondeboer.com`) — better word-of-mouth, ASO, ads.txt-at-root, trust
- [ ] **SEO**: rank the free web `/timer` ("poker timer", "blinds timer"…) and funnel visitors to the app
- [ ] **Table-side virality**: subtle on-screen brand + URL + a share affordance

## P4 — Premium features (then re-add to the Pro paywall)
- [ ] Saved tournament presets / multiple blind structures
- [ ] Extra blind levels
- [ ] Sound packs
- [ ] Re-add the above to `PRO_FEATURES` in `apps/mobile/src/components/paywall/Paywall.tsx` once shipped

## 🔁 Ongoing — Monitor
- [ ] AdMob fill/revenue, RevenueCat conversions, AdSense (post-approval), `app-ads.txt`/`ads.txt` verification, ratings & reviews

## ⚠️ Build & release gotchas (read before building)
- **iOS builds from source — do NOT re-enable precompiled frameworks.** Keep `ios.buildReactNativeFromSource: true` (app.json) + eas.json env `EXPO_USE_PRECOMPILED_MODULES=0` & `RCT_USE_PREBUILT_RNCORE=0`. Verify: `grep -c React-Core-prebuilt apps/mobile/ios/Podfile.lock` → `0`.
- **Keep `ios.supportsTablet: true`** — dropping iPad → App Store error 90101 on updates.
- Monorepo: `npm install` from the repo root only; don't disturb the React `19.2.3` overrides; run `expo-doctor` after adding native deps.
- Where the knobs live: AdMob app ids → `app.json` plugin · banner unit ids → `apps/mobile/src/services/ads.ts` · RevenueCat keys → `app.json` `extra` · web AdSense → Vercel `NEXT_PUBLIC_ADSENSE_*` + `apps/web/src/lib/monetization.ts` · product/entitlement ids (`pro` / `pro_lifetime`) → `packages/core/src/monetization/products.ts`.
