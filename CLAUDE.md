# CLAUDE.md

Guidance for working in this repo. See [README.md](./README.md) for setup, commands, and deploy,
[ARCHITECTURE.md](./ARCHITECTURE.md) for the full design, and [ROADMAP.md](./ROADMAP.md) for
current monetization/growth status.

## Conventions & guardrails

- **npm workspaces + Turborepo.** Always `npm install` from the **repo root** (one lockfile);
  don't introduce yarn/pnpm. Target one workspace with `npm run <script> -w @poker/<core|web|mobile>`.
- **Shared logic goes in `@poker/core`** and must stay framework-agnostic — no `react`,
  `react-native`, or DOM imports (its tsconfig uses `lib: ["esnext"]`, `types: []`, so even
  `console` is unavailable). Put types, blind/timer math, serialization, and the ad-gating
  policy (`shouldShowAds`) here. Apps depend on packages, never the reverse.
- **Platform code stays in the app.** Audio, notifications, haptics, storage, billing, ads, and
  native modules are app-specific — wire them into core through an interface (e.g. `StorageAdapter`,
  and `EntitlementProvider` for Pro). Add a web no-op for mobile-only features (Live Activities,
  foreground service, push) instead of importing native modules on web.
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
  App-config/native changes need `expo prebuild` (+ `npm run pods`); EAS builds the committed projects.
- **iOS must build from source.** SDK-56 precompiled XCFrameworks break this hoisted monorepo
  (archive fails on `Build ExpoModulesJSI xcframework` / safe-area-context "Directory not found",
  even with `--clear-cache`). `apps/mobile/ios/Podfile` bakes
  `ENV['EXPO_USE_PRECOMPILED_MODULES'] = '0'` and `ENV['RCT_USE_PREBUILT_RNCORE'] = '0'` at the
  top, so a plain `pod install` / `npm run pods` is safe — no env prefix needed. `app.json`'s
  `ios.buildReactNativeFromSource: true` documents the intent but has no effect on its own —
  nothing bridges it to the env var, so the Podfile lines are what actually enforce this. The
  matching `eas.json` build-profile env vars are a redundant guard specifically for EAS Build,
  which sets `EXPO_USE_PRECOMPILED_MODULES=1` ambiently in its cloud environment. Verify:
  `grep -c React-Core-prebuilt apps/mobile/ios/Podfile.lock` → `0`; if it's non-zero, someone
  removed the Podfile `ENV` lines — restore them rather than just reverting the lock file.
- **Keep `ios.supportsTablet: true`.** The app shipped universal (iPhone + iPad); an update that
  drops iPad is rejected at upload with App Store error 90101.
- **Version bumps must touch the native projects, not just `app.json`.** This is a bare workflow, so
  EAS builds the committed native projects and `app.json` `version` is cosmetic (prebuild isn't run,
  so it never syncs). The marketing version lives in **`apps/mobile/ios/PokerTimer/Info.plist`**
  (`CFBundleShortVersionString`, hardcoded — not `$(MARKETING_VERSION)`) and
  **`apps/mobile/android/app/build.gradle`** (`versionName`). Bump all three together or the binary
  ships the old version and App Store Connect rejects it (ITMS-90186 "train … is closed" / ITMS-90062).
  Build numbers are fine to leave — `eas.json` `appVersionSource: remote` + `autoIncrement` manages
  `CFBundleVersion` / `versionCode` on EAS's servers.
