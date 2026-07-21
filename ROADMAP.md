# Roadmap

Monetization + growth tracker for Poker Blinds Buzzer.

**Where things stand:** iOS is **live on the App Store at v1.1.2** (in-app review prompt + Pro
tournament presets + new ASO listing); **Android is live on Google Play** (approved 2026-07 — Pro
purchase verified end-to-end, closed test completed, production review passed). Both platforms run
an AdMob banner + a Pro / Remove-Ads IAP (RevenueCat). **v1.1.3 is in progress, targeting a
simultaneous iOS + Android release** — adds the Sound Pack Pro feature (a picker with 3 bundled
alternative alarm sounds) and rolls up whatever Android-only fixes land alongside it. The web app
has a live Ko-fi tip jar; web AdSense is built and awaiting Google approval. The web landing page's
`PLAY_STORE_LINK` points at the real Play listing. Checklist is ordered by priority (by ROI/effort
— resequence as you like). See [ARCHITECTURE.md](./ARCHITECTURE.md) + [CLAUDE.md](./CLAUDE.md).

**Legend:** ✅ done · 🚧 in progress · ⏳ waiting on an external process · ⬜ not started.

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

## P0 — Quick closeouts (config done — go-live gated on external review)
**Status:** all hands-on P0 config/deploy is complete (verified 2026-06-28). **P0 cannot be fully
closed now** — the AdSense go-live is gated on Google's site review, which is out of our hands and
tracked as a separate waiting item below.
- ✅ **Web AdSense env (Vercel, web app `poker-timer.toondeboer.com`)** — all three set + deployed, confirmed:
  - `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-9738048037268359` — live (`/ads.txt` serves the seller line; `google-adsense-account` meta tag in `<head>`)
  - `NEXT_PUBLIC_ADSENSE_SLOT_LANDING=3591846942` — set in Vercel Production
  - `NEXT_PUBLIC_ADSENSE_SLOT_TIMER=1002332300` — set in Vercel Production
- ✅ Apex `toondeboer.com` (a **separate** S3/CodeBuild static site, not the Vercel app) — serves the verification meta tag + `/ads.txt` (the seller line) with the correct pub id, deployed to the S3 bucket (confirmed live)
- ✅ **App Store `pro_lifetime` IAP description** matches the trimmed paywall (remove-ads + support-the-dev only; no presets/sound-pack promises) — verified

## ⏳ Waiting on external — AdSense site review (blocks P0 go-live)
- ⏳ **Web AdSense site approval** — site submitted and **in review** ("Getting ready" as of 2026-06-28).
  All our config is done (Vercel env + apex verification, see P0); ads serve on the subdomain only
  after Google approves **and** the visitor consents. Nothing to do but wait — re-check AdSense
  console → Sites; flip to ✅ when it reads "Ready", then confirm a banner renders post-consent.

## P1 — ASO (highest-leverage growth; free; drives installs for the already-live apps)
- ✅ iOS listing: optimized **title + subtitle + 100-char keyword field** — drafted in [STORE_LISTING.md](./STORE_LISTING.md), **live in App Store Connect since v1.1.2**
- ✅ Android screenshots — uploaded to the Play listing
- ⬜ **Android feature graphic** — currently just the app icon enlarged; needs a proper 1024×500 graphic showing the app in use, not just the logo
- ⬜ **iOS screenshots** leading with Live Activities / Dynamic Island, the big timer, custom blind structures
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
- ✅ Update `PLAY_STORE_LINK` in `apps/web/src/app/components/LandingPage.tsx` → real listing (`com.toondeboer.pokerkit`). **TODO:** redeploy web so the link goes live

## P3 — More growth
- ⬜ **Brandable apex domain** for the web app (off `poker-timer.toondeboer.com`) — better word-of-mouth, ASO, ads.txt-at-root, trust
- ⬜ **SEO**: rank the free web `/timer` ("poker timer", "blinds timer"…) and funnel visitors to the app
- ⬜ **Table-side virality**: subtle on-screen brand + URL + a share affordance

## P4 — Premium features (then re-add to the Pro paywall)
- ✅ Saved tournament presets / multiple blind structures — **Pro-gated**, ships in **v1.1.2** (`@poker/core` presets + `usePresets` + "Tournament Presets" card)
- ✅ Extra blind levels — already free in the blinds editor (add/remove/edit); **kept free** (gating it would remove a capability existing users have)
- ✅ Sound packs — **ships in v1.1.3**: Pro-gated picker (Classic Alarm + 3 bundled alternatives)
  wired through JS playback, Android foreground service, and iOS notification sound; smoke-tested
  end-to-end on both platforms. Bundled audio is a synthesized placeholder tone — swap for produced
  audio in a follow-up if desired.
- ⬜ Custom/uploaded alarm sound (Pro) — let a user pick their own audio file instead of choosing
  from the bundled packs. Deferred out of the v1.1.3 sound-pack work (bigger scope): needs
  `expo-document-picker` + persisting the picked file across app restarts, and different native
  wiring per platform — Android can pass the picked `content://` URI straight into
  `MediaPlayer.setDataSource`, but iOS notification sounds require copying the file into the app's
  `Library/Sounds` directory (`UNNotificationSound` only resolves bundle/Library-Sounds filenames,
  not arbitrary paths), under Apple's 30-second sound-file limit.
- ✅ Re-add shipped features to `PRO_FEATURES` in `apps/mobile/src/components/paywall/Paywall.tsx` — presets added. Updated `pro_lifetime` IAP description **copy drafted in [STORE_LISTING.md](./STORE_LISTING.md)** (remove ads + presets + support-the-dev). **TODO:** paste it into the three consoles (App Store Connect / Play Console / RevenueCat)

## 🔁 Ongoing — Monitor
- ⬜ AdMob fill/revenue, RevenueCat conversions, AdSense (post-approval), `app-ads.txt`/`ads.txt` verification, ratings & reviews

## ⚠️ Build & release gotchas (read before building)
- **iOS builds from source — do NOT re-enable precompiled frameworks.** Keep `ios.buildReactNativeFromSource: true` (app.json) + eas.json env `EXPO_USE_PRECOMPILED_MODULES=0` & `RCT_USE_PREBUILT_RNCORE=0`. Verify: `grep -c React-Core-prebuilt apps/mobile/ios/Podfile.lock` → `0`.
- **Keep `ios.supportsTablet: true`** — dropping iPad → App Store error 90101 on updates.
- Monorepo: `npm install` from the repo root only; don't disturb the React `19.2.3` overrides; run `expo-doctor` after adding native deps.
- Where the knobs live: AdMob app ids → `app.json` plugin · banner unit ids → `apps/mobile/src/services/ads.ts` · RevenueCat keys → `app.json` `extra` · web AdSense → Vercel `NEXT_PUBLIC_ADSENSE_*` + `apps/web/src/lib/monetization.ts` · product/entitlement ids (`pro` / `pro_lifetime`) → `packages/core/src/monetization/products.ts`.
