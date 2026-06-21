# CLAUDE.md

Guidance for working in this repo. See [README.md](./README.md) for setup, commands, and deploy,
and [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

## What this is

A monorepo for the Poker Blinds Buzzer product:

- `apps/web` (`@poker/web`) — Next.js 16 site: marketing landing (`/`) + web timer (`/timer`).
- `apps/mobile` (`@poker/mobile`) — Expo SDK 56 (bare) React Native iOS/Android app.
- `packages/core` (`@poker/core`) — shared, framework-agnostic TypeScript logic.

iOS + web are **live**, with AdMob/AdSense ads and a RevenueCat "Pro / Remove Ads" IAP. Android
isn't launched yet (see [ROADMAP.md](./ROADMAP.md) for outstanding work).

## Conventions & guardrails

- **npm workspaces + Turborepo.** Always `npm install` from the **repo root** (one lockfile);
  don't introduce yarn/pnpm. Target one workspace with `npm run <script> -w @poker/<core|web|mobile>`.
- **Shared logic goes in `@poker/core`** and must stay framework-agnostic — no `react`,
  `react-native`, or DOM imports (its tsconfig uses `lib: ["esnext"]`, `types: []`, so even
  `console` is unavailable). Put types, blind/timer math, serialization, and the ad-gating
  policy (`shouldShowAds`) here.
- **Platform code stays in the app.** Audio, notifications, haptics, storage, billing, ads, and
  native modules are app-specific — wire them into core through an interface (e.g. `StorageAdapter`,
  and `EntitlementProvider` for Pro). Add a web no-op for mobile-only features (Live Activities,
  foreground service, push) instead of importing native modules on web.
- **The web app has its own UI** (Next.js + Tailwind) — share logic, not components.
- **Imports:** cross-package → `@poker/core`; within mobile → `@/src/...`; within web → `@/...`.

## Things that bite in this monorepo

- **React must stay a single version across web + mobile** — root `package.json` `overrides` pin
  `react`/`react-dom` (currently `19.2.3`, the version Expo bundles) and `@types/react`/
  `@types/react-dom` (`~19.2`). Without the runtime overrides, `next`'s peer range floats a second
  React copy and `expo-doctor` flags a duplicate. To change React, bump web + mobile + the overrides
  together, then clean-install (`rm -rf node_modules package-lock.json && npm install`).
- **`next` must be a root `devDependency`** even though only `@poker/web` imports it — otherwise
  `eslint-config-next` can't resolve `next` and web lint dies. Don't remove it.
- **`@types/node` leaks to mobile via hoisting** — use `ReturnType<typeof setInterval>` for interval
  refs, not `number`.
- **Metro monorepo config** is in `apps/mobile/metro.config.js`; if Metro can't resolve a hoisted
  dep or `@poker/core`, check `watchFolders`/`nodeModulesPaths` there.
- **Mobile is a bare Expo workflow** — `apps/mobile/ios` and `apps/mobile/android` are committed.
  App-config/native changes need `expo prebuild` (+ pod install); EAS builds the committed projects.
- **iOS must build from source.** SDK-56 precompiled XCFrameworks break this hoisted monorepo
  (archive fails on `Build ExpoModulesJSI xcframework` / safe-area-context "Directory not found",
  even with `--clear-cache`). Keep `ios.buildReactNativeFromSource: true` (app.json) **and** the
  eas.json build-profile env `EXPO_USE_PRECOMPILED_MODULES=0` + `RCT_USE_PREBUILT_RNCORE=0`. Verify:
  `grep -c React-Core-prebuilt apps/mobile/ios/Podfile.lock` → `0`.
- **Keep `ios.supportsTablet: true`.** The app shipped universal (iPhone + iPad); an update that
  drops iPad is rejected at upload with App Store error 90101.
