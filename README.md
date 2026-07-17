# Poker Blinds Buzzer

A poker tournament timer for the table — manage blind levels, time each round, and get
audible/visual alerts when the blinds go up.

This monorepo holds the whole product:

- **Website** — a marketing landing page plus a full-screen **web timer**, live at
  [poker-timer.toondeboer.com](https://poker-timer.toondeboer.com).
- **Mobile app** — the iOS & Android app (Poker Blinds Buzzer), with background timing,
  iOS Live Activities, and an Android foreground service.

Both are driven by the same shared logic in `@poker/core`, so the blind schedules and timer
behaviour stay identical across platforms. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the
design and [CLAUDE.md](./CLAUDE.md) for conventions when working in this repo.

## Repository structure

```
apps/
  web/      @poker/web      Next.js site + web timer  (Vercel)
  mobile/   @poker/mobile   Expo iOS/Android app      (EAS)
packages/
  core/     @poker/core     shared, framework-agnostic timer logic
```

## Prerequisites

- **Node ≥ 20** and npm (this repo uses npm workspaces).
- For mobile: **Xcode** + **CocoaPods** (iOS), **Android Studio / SDK** (Android), and the
  Expo/EAS CLI (`npm i -g eas-cli`, or use `npx`).

## Install

```bash
npm install    # from the repo root — installs all workspaces against one lockfile
npm run pods   # installs the iOS CocoaPods (apps/mobile/ios)
```

Mobile is a **bare Expo workflow** (`apps/mobile/ios` and `apps/mobile/android` are committed
native projects), so `npm install` alone doesn't set up iOS — CocoaPods isn't part of the npm
lifecycle. Run `npm run pods` once up front, and again any time `apps/mobile/ios/Podfile.lock`
changes (e.g. after pulling, or adding a native dependency); skipping it surfaces as an
`xcodebuild` error: "The sandbox is not in sync with the Podfile.lock."

### Android SDK

Gradle needs to know where the Android SDK lives. Either export `ANDROID_HOME`, or create
`apps/mobile/android/local.properties` (gitignored) with:

```properties
sdk.dir=/Users/<you>/Library/Android/sdk
```

## Run

```bash
# Website (http://localhost:3000 — landing at /, timer at /timer)
npm run web

# Mobile app
npm run ios        # build & run on an iOS simulator/device
npm run android    # build & run on an Android emulator/device
npm run mobile     # start the Expo dev server (choose a target)
```

## Testing Pro features (mobile)

Real purchases don't work in the iOS Simulator without extra one-time setup (StoreKit Testing
config + a certificate uploaded to the RevenueCat dashboard). To unlock Pro locally without any
of that, flip `FORCE_PRO_IN_DEV` to `true` in
`apps/mobile/src/contexts/PremiumContext.tsx` — it's `__DEV__`-gated, so it's always `false` in
a release build regardless of the literal. Fast Refresh picks up the change immediately; flip
it back to `false` to test the free/paywall experience again.

## Checks

```bash
npm run typecheck  # tsc across all workspaces (via Turborepo)
npm run lint       # eslint across all workspaces
npm run test       # unit tests (@poker/core, via Vitest)
npm run build      # production build of every buildable workspace
```

## Regenerating native projects (mobile)

After adding or upgrading a native dependency, or bumping the Expo SDK, regenerate `ios/` and
`android/` so they match the installed packages:

```bash
npm run prebuild -w @poker/mobile            # add `-- --clean` to regenerate from scratch
npm run pods
```

Then rebuild with `npm run ios` / `npm run android`. `--clean` wipes any hand-edited native code
that isn't expressed as a config plugin, so review the diff afterwards and re-apply anything
important.

## Deploy

- **Website → Vercel.** The Vercel project's **Root Directory is `apps/web`**; pushes to the
  default branch deploy automatically.
- **Mobile → EAS**, from `apps/mobile`:
  ```bash
  eas build --platform ios --profile production
  eas submit -p ios --latest
  ```
  (config in `eas.json`, project id in `app.json`).
