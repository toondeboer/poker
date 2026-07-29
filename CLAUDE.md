# CLAUDE.md

Guidance for working in this repo. See [README.md](./README.md) for setup, commands, and deploy,
and [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

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

## Release process

Mobile releases are batched on a short-lived branch per version, not shipped straight from
`main` — avoids cutting a new App Store/Play submission for every small merged PR while a review
(which can take days) is pending.

- **`main` always matches what's actually live** in the App Store / Play Store. Never
  version-bump, tag, or submit from `main` directly — it's the thing you fall back to for an
  emergency fix, so it can't be "ahead" of production.
- **`release/<version>` is the integration branch for the next release** (e.g. `release/1.1.4`),
  cut from `main` when you start batching work toward it:
  `git checkout main && git pull && git checkout -b release/<version>`. Name it
  `release/<version>`, not `v<version>` — a branch and the eventual `v<version>` tag can't share a
  name without ambiguous-ref problems (`git checkout v1.1.3` becomes unpredictable).
- **Never commit directly to `release/<version>`, even for a docs-only change** (e.g. a
  `ROADMAP.md` update) — the whole point of the release branch is that nothing lands there
  without going through a PR. Branch off it (`git checkout -b feature/<name>`), commit there, and
  PR into the release branch. The only exception is the release-prep commit(s) made as part of
  *cutting* the release itself (step-by-step below) — those go directly on the release branch.
- **PRs for anything going into that release target the release branch, not `main`** —
  `gh pr create --base release/<version>`. Every change still gets a `CHANGELOG.md` entry under
  `[Unreleased]` in the same commit/PR that lands it (Keep a Changelog format) — no exceptions,
  don't defer this to release time, or the changelog stops being a reliable diff of what changed.
  Entries keep accumulating there across however many PRs land before the release ships; don't
  roll them into a dated heading until the release is actually being cut (last step below).
- **Open the `release/<version>` → `main` PR immediately after cutting the branch, and leave it
  open** (`gh pr create --base main --head release/<version>`) — don't merge it until the release
  actually ships. It's the running release-candidate diff, not a normal feature PR. Every time
  something merges into `release/<version>`, update this PR's description so it still reflects
  what's in the release — easiest way is to mirror the current `[Unreleased]` section of
  `CHANGELOG.md` into it (`gh pr edit <number> --body "..."`).
- **Cutting the release**, once everything intended for it is merged into `release/<version>`:
  1. Bump native version files for whichever platform(s) are shipping. The marketing version
     lives in **`apps/mobile/ios/PokerTimer/Info.plist`** (`CFBundleShortVersionString`,
     hardcoded — not `$(MARKETING_VERSION)`) and **`apps/mobile/android/app/build.gradle`**
     (`versionName`); `app.json`'s `version` is cosmetic (prebuild isn't run, so it never syncs)
     but keep it in sync anyway. iOS and Android version numbers are independent counters, **not
     tied to each other** — they can diverge (e.g. iOS at 1.1.2, Android still at 1.1.1) when only
     one platform ships, or share the same number when both ship together. Either way, bump the
     native file only for the platform(s) shipping *in this release*, or the binary ships the old
     version and App Store Connect rejects it (ITMS-90186 "train … is closed" / ITMS-90062).
     Build numbers are fine to leave — `eas.json` `appVersionSource: remote` + `autoIncrement`
     manages `CFBundleVersion` / `versionCode` on EAS's servers.
  2. Roll the accumulated `[Unreleased]` entries into a dated heading (e.g.
     `## [1.1.3] - 2026-07-20 — Android`, or `— iOS & Android` when both platforms ship together
     in one heading), add the compare link at the bottom.
  3. Update `ROADMAP.md` if it references the release.
  4. Commit those release-prep changes on the release branch.
  5. `eas build` + `eas submit` **from the release branch** — EAS builds whatever's checked out
     locally, so make sure `release/<version>` is checked out when you run it.
  6. Once submission succeeds: merge the standing `release/<version>` → `main` PR (update its
     description one last time first), then tag the resulting `main` commit — not just wherever
     the version string changed, since one version number can span several commits before the one
     that actually ships:
     `git tag -a v<version> <built-commit-sha> -m "v<version> (<platform>, build <n>)"` then
     `git push origin v<version>`. Find the built commit via `eas build:view <id>` or the EAS
     build page.
  7. Delete `release/<version>`. Cut the next `release/<version>` from the new `main` tip when you
     start batching the next round of work.
- **Hotfixing the live version while a release branch is mid-cycle**: branch `hotfix/<version>`
  from `main` (not from the active release branch — `main` is what's actually live), fix it, ship
  through the same version/changelog/tag steps above, merge back to `main`. Then merge (or
  cherry-pick) that same fix into the in-progress `release/<version>` too, or it'll be silently
  reverted when that release eventually merges over it.

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
- **The floating gear-icon-in-a-circle in the top corner of every screen on a dev-client build is
  Expo's own dev-menu trigger** (`expo-dev-client`/`expo-dev-menu`), not app UI — it doesn't exist
  in the app's source and never ships in a release build. Ignore it when reviewing screenshots or
  debugging layout; it's not a bug to fix and not a system accessibility overlay either.
- **`expo run:android` plants broken package shims that also break iOS.** `npm run
  android`/`android:device`/`ios`/`ios:device` (the ones in root `package.json`, proxying into
  `apps/mobile`) now self-heal this automatically — each runs `preandroid`/`preandroid:device`/
  `preios`/`preios:device` first, which calls `apps/mobile/scripts/clean-expo-shims.js` to detect
  (checked via a missing `package.json`, not just presence) and remove the broken shims plus the
  stale Gradle autolinking cache before the real build starts. That covers shims left over from a
  *previous* run; if it still recurs mid-build (a concurrent IDE Gradle sync replanting them
  *during* the same invocation — see the note at the bottom of this entry — or you built via some
  other entrypoint like a bare `npx expo run:android` that skips the npm script), the manual fix
  below still applies; `node apps/mobile/scripts/clean-expo-shims.js` on its own is equivalent to
  the `rm -rf`+cache-clear steps and safe to re-run any time. Root cause, for when the automatic
  fix isn't enough: Expo's autolinking creates partial proxy directories — missing `package.json`
  and the platform folder, just a stray `android/` — at
  `node_modules/expo-dev-client/node_modules/expo-dev-launcher` and directly under
  `apps/mobile/node_modules/{expo,expo-constants,expo-modules-autolinking}`. These shadow the
  real, correctly-hoisted copies at root `node_modules/` for *any* Node-based resolution,
  including CocoaPods' iOS autolinking. Symptoms: Android — `Project with path
  ':expo-dev-launcher' could not be found in project ':expo-dev-client'` (surfaces once the Gradle
  daemon/cache goes cold; harmless while warm). iOS — `expo-modules-autolinking resolve -p ios`
  silently omits the `expo` package (every other `expo-*` package resolves fine), so `pod install`
  never links the `Expo` pod and `AppDelegate.swift`'s `public import Expo` fails (`no such module
  'Expo'`); patching around *that* (e.g. adding `pod 'Expo'` to the Podfile by hand) only gets you
  to a runtime crash instead (`Cannot find native module 'ExpoFetchModule'`), since the Swift
  module-registration codegen is driven by the same broken resolve output. Don't do that — fix the
  actual shims: `rm -rf node_modules/expo-dev-client/node_modules
  apps/mobile/node_modules/{expo,expo-constants,expo-modules-autolinking}`, confirm with `cd
  apps/mobile && npx expo-modules-autolinking resolve -p ios --json | grep -c
  '"packageName":"expo"'` → should be `1`, then `npm install` (Android) or `npm run pods -w
  @poker/mobile` (iOS) and rebuild. **Also clear
  `apps/mobile/android/build/generated/autolinking/`** (or just `rm -rf
  apps/mobile/android/build apps/mobile/android/app/build`) after fixing the shims — Gradle caches
  the resolved autolinking list there and only re-runs the resolution command when a lockfile hash
  changes (`ReactSettingsExtension.checkAndUpdateCache`), so if the cache was written while the
  shims were broken it keeps serving that same truncated dependency list (symptom: `resource
  style/Theme.EdgeToEdge`/`Theme.SplashScreen ... not found` during `processDebugResources`, from
  `react-native-edge-to-edge`/`expo-splash-screen` silently missing from the linked modules) even
  after the shims themselves are cleaned up. This surfaced here from **background Gradle syncs
  alone** (Android Studio + the VS Code Gradle extension both open against the project, each
  running their own daemon) re-triggering the shim bug with no `expo run:android` or other
  explicit command involved — if a local Android build seems to spontaneously re-break after
  being fixed, check for a concurrent IDE Gradle sync before assuming the fix didn't take.
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
- **Android dev-client builds can crash on launch with `java.lang.NullPointerException` at
  `ReactActivityDelegate.onUserLeaveHint` / `DevLauncherErrorActivity`** — a race in `expo`'s own
  `ReactActivityDelegateWrapper.kt` (`node_modules/expo/android/src/main/java/expo/modules/`), not
  app code. `onCreate()` signals `loadAppReady.complete(Unit)` *before* it reflectively sets the
  underlying `ReactActivityDelegate`'s private `mReactDelegate` field; `onUserLeaveHint()` awaits
  `loadAppReady` and then calls straight into `delegate.onUserLeaveHint()` with no null-check.
  `onPause()`, right above it in the same file, already has a defensive `try/catch` for exactly
  this scenario (its own comment: "we stop before the ReactActivityDelegate gets a chance to set
  up... we should catch the exceptions") — `onUserLeaveHint()` is missing the same guard. Narrow
  timing window: only bites when something pauses `MainActivity` (another activity opening on top,
  a permission dialog, backgrounding) before the JS bundle finishes its very first load, so it
  doesn't reproduce every launch. Not patchable in-repo without hand-editing vendored
  `node_modules` (wiped on next `npm install`) — workaround is to wait for the Timer screen to
  actually render before triggering anything that could pause the activity right after a fresh
  launch; otherwise a real fix means bumping the installed `expo`/`expo-dev-client` version (both
  `56.0.20` as of this note) once upstream addresses it.
