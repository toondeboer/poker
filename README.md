# Poker Blinds Buzzer

A poker tournament timer for the table — manage blind levels, time each round, and get
audible/visual alerts when the blinds go up. Plus the rest of what a home game argues about:
what each place pays, how to end it early, and who is actually winning.

This monorepo holds the whole product:

- **Website** — a marketing landing page plus a full-screen **web timer**, live at
  [poker-timer.toondeboer.com](https://poker-timer.toondeboer.com).
- **Mobile app** — the iOS & Android app (Poker Blinds Buzzer), with background timing,
  iOS Live Activities, and an Android foreground service. Pro adds buy-in and payout maths
  (bounties, rebuys, add-ons), a chop calculator, a leaderboard with a separate board per
  group of friends, and a dealer for when nobody brought cards.
- **Backend** — an AWS CDK stack for accounts and shared leaderboards. **Deployed**, and the app
  talks to it: sign-in, boards, invites and reporting all go through it.

All of it is driven by the same shared logic in `@poker/core`, so blind schedules, payout maths and
the board's rules stay identical wherever they run — on the phone, on the web, and in a Lambda. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the
design and [CLAUDE.md](./CLAUDE.md) for conventions when working in this repo.

## Repository structure

```
apps/
  web/      @poker/web      Next.js site + web timer  (Vercel)
  mobile/   @poker/mobile   Expo iOS/Android app      (EAS)
  infra/    @poker/infra    AWS CDK backend           (deployed)
packages/
  core/     @poker/core     shared, framework-agnostic poker logic
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
npm run ios            # build & run on an iOS simulator
npm run ios:device     # build & run on a connected physical iPhone
npm run android        # build & run on an Android emulator
npm run android:device # build & run on a connected physical Android device
npm run mobile         # start the Expo dev server (choose a target)
```

All of these are safe to run from the repo root (they proxy into `apps/mobile` via npm workspaces).
Running the underlying `npx expo` commands directly instead, from the repo root rather than
`apps/mobile`, makes the Expo CLI treat the monorepo root itself as the app — it'll generate a
bogus `app.json`/`ios/`/`android/` at the root and add stray dependencies to the root
`package.json`. If that happens: `git checkout -- package.json package-lock.json` and `rm -rf ios
android app.json` at the repo root to undo it (safe — none of it is real project state).

Physical-device builds (`ios:device` / `android:device`) need the device on the **same Wi-Fi
network** as your Mac — the app talks to the Metro dev server over the network, not the USB cable.
For iOS specifically, always launch via `ios:device` (or `npm run ios -- --device`) rather than
Xcode's own Run button: the CLI launches the app with a deep link that tells `expo-dev-client`
which Metro server to use; a plain Xcode ⌘R skips that and the app fails with `No script URL
provided ... unsanitizedScriptURLString = (null)`. Once a device has connected via the CLI once,
subsequent Xcode ⌘R runs on it keep working since the URL is cached.

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
npm run test       # unit tests (@poker/core and @poker/infra, via Vitest)
npm run build      # production build of every buildable workspace
```

## Backend

`apps/infra` holds the CDK stack: Cognito for accounts, one DynamoDB table for shared boards, and
the Lambdas behind them. It is **environment-agnostic on purpose** — no account or region lookups —
so it synthesises and tests with no AWS credentials at all:

```bash
npm run test -w @poker/infra   # synthesises the stack and asserts on the template
npm run synth -w @poker/infra  # writes CloudFormation to apps/infra/cdk.out
```

**Deploys go through the `Infra` workflow, not from a laptop.** GitHub mints a short-lived OIDC
token and AWS exchanges it, so there is no key to leak; prod additionally waits on the
`backend-production` environment's approval. `npm run deploy -w @poker/infra` works with real
credentials, but the workflow is the path that is actually used.

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
- **Mobile → EAS**, from the repo root. `eas build` compiles a native binary in EAS's cloud (an
  `.ipa` for iOS / `.aab` for Android); `eas submit` uploads the most recently finished build to
  App Store Connect / Google Play Console. Build first, then submit once it finishes:

  ```bash
  npm run eas:build
  npm run eas:build:ios
  npm run eas:build:android
  ```

  ```bash
  npm run eas:submit
  npm run eas:submit:ios
  npm run eas:submit:android
  ```

  **Those three go to a testing track, not to production**, and that is deliberate: they pass
  `--profile internal`, which puts Android on Play's `internal` track. (iOS is the same upload
  either way — every build reaching App Store Connect lands in TestFlight, and submitting for
  review is a separate, deliberate act there.) The `eas:submit:*:production` variants name
  production in full so it cannot be reached by accident.

  **They do not promote, though.** `eas submit` only uploads, so running a `:production` variant
  after the internal submission re-sends a versionCode Play already has and Play rejects it.
  Promoting the build you have just tested is Play Console → Internal testing → **Promote release →
  Production**; the `:production` scripts are for a build that has never been on a track.

  **Never run a bare `eas submit`.** With no `--profile` the CLI silently uses the profile _named_
  `production`, which is how 1.1.4 reached Play's production track with its billing rows never once
  run.

  (config in `eas.json`, project id in `app.json`). See [CLAUDE.md](./CLAUDE.md) for the release
  checklist (version bump, changelog, tag).
