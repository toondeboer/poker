# Architecture

A single monorepo for the **Poker Blinds Buzzer** product: a marketing site with a
full-featured web timer, an iOS/Android app, and the shared logic both build on.

## Overview

| Workspace | Name | Stack | Purpose |
|---|---|---|---|
| `apps/web` | `@poker/web` | Next.js 15 (App Router), React 19, Tailwind CSS 4 | Marketing landing page (`/`) + the full-screen web timer (`/timer`) + privacy policy |
| `apps/mobile` | `@poker/mobile` | Expo SDK 53 (bare), React Native 0.79, expo-router | The iOS/Android app (App Store / Play Store) |
| `packages/core` | `@poker/core` | Plain TypeScript | Framework-agnostic poker-timer logic shared by both apps |

The web and mobile UIs are **deliberately separate** — desktop and phone have different
needs (the phone manages sleep, background timers, Live Activities and push notifications;
the desktop does not). What they share is **logic, not components**: blind schedules, timer
math, serialization, and types all live in `@poker/core`.

## Repository layout

```
poker-monorepo/
├── package.json            # workspaces (apps/*, packages/*), turbo scripts, @types/react override
├── turbo.json              # build / lint / typecheck / dev pipeline
├── tsconfig.base.json      # shared compiler options + @poker/* path aliases
├── apps/
│   ├── web/                # @poker/web — Next.js
│   │   ├── next.config.ts          # transpilePackages: ["@poker/core"]
│   │   └── src/
│   │       ├── app/                # routes: / (landing), /timer, /privacy-policy
│   │       │   └── components/LandingPage.tsx
│   │       ├── components/timer/    # PokerTimer + TimerDisplay/CurrentBlinds/TimerControls/BlindsSchedule/SettingsPanel
│   │       ├── hooks/               # useWebTimer, useWebBlinds, useWebAudio, useWebNotifications
│   │       └── lib/storageAdapter.ts   # localStorage StorageAdapter
│   └── mobile/             # @poker/mobile — Expo (bare workflow)
│       ├── ios/ · android/         # committed native projects (iOS widget + Live Activity, Android foreground service)
│       ├── app.json · eas.json · metro.config.js
│       └── src/
│           ├── app/                # expo-router screens
│           ├── components/ · contexts/ · hooks/
│           ├── services/           # TimerStorage/BlindsStorage (wrap core), LiveActivityService, storageAdapter
│           └── modules/            # native module bindings (LiveActivityModule)
└── packages/
    └── core/              # @poker/core
        └── src/
            ├── types/      # BlindLevel, PokerTimerState
            ├── blinds/     # generateBlinds, mutateBlinds
            ├── time/       # format (MM:SS), timerMath (calculateTimeLeft/computeEndTime/progress)
            ├── storage/    # StorageAdapter interface + createTimerStorage/createBlindsStorage
            ├── constants.ts
            └── index.ts    # barrel export
```

## Tooling

- **npm workspaces** link the packages. We use npm (not pnpm/yarn) because both original
  repos used npm and because React Native's Metro bundler + Expo autolinking resolve most
  reliably against npm's hoisted `node_modules`. Install **always from the repo root**.
- **Turborepo** runs and caches tasks across workspaces (`turbo run build|lint|typecheck`).
- **TypeScript**: every package extends `tsconfig.base.json`; cross-package imports use the
  `@poker/core` alias. `@poker/core` ships **uncompiled TypeScript** (its `main`/`types`
  point at `src/index.ts`); Next compiles it via `transpilePackages`, Metro via its
  monorepo config — so there is no separate build step for the shared package.

## Dependency rules

- `@poker/core` is **framework-agnostic**: no `react`, `react-native`, or DOM imports. Its
  `tsconfig` enforces this (`"lib": ["esnext"]`, `"types": []`).
- Apps depend on packages; **packages never depend on apps**.
- Anything that touches a platform API (audio, notifications, storage backend, native
  modules) stays in the app and is wired into core through an interface.

## The shared seam: `StorageAdapter`

`@poker/core` defines a small async key/value `StorageAdapter` interface and builds the
timer/blinds stores on top of it (`createTimerStorage`, `createBlindsStorage`). Each app
supplies its own backend:

| | Adapter | Backend |
|---|---|---|
| `apps/mobile` | `src/services/storageAdapter.ts` | `@react-native-async-storage/async-storage` |
| `apps/web` | `src/lib/storageAdapter.ts` | `window.localStorage` (SSR-safe no-ops on the server) |

This is what gives the web timer persistence (custom blinds, round length, current level
survive a reload) using the exact same serialization the app uses.

## Platform-coupling map

| Concern | `apps/mobile` | `apps/web` |
|---|---|---|
| Sound | `expo-av` (`useSounds`) | Web Audio API (`useWebAudio`) |
| Notifications | `expo-notifications` (`useTimerNotification`) | `Notification` API + speech synthesis (`useWebNotifications`) |
| Background timer | iOS Live Activities + Android foreground service (`LiveActivityService`, native `ios/`/`android/`) | none — the tab stays open; no background needed |
| Haptics | React Native `Vibration` API (`TimerExpirationAlert`) + native Android `Vibrator` | none |
| Storage | AsyncStorage adapter | localStorage adapter |
| UI | React Native `StyleSheet` components | Next.js + Tailwind components |

The web app intentionally does **not** reuse the React Native UI — running the RN component
tree on the web (react-native-web) was evaluated and rejected as high-effort/fragile for no
real desktop benefit.

## App internals

- **Web timer** (`apps/web/src`): `useWebTimer` derives the countdown from an absolute
  `endTime` (robust to tab throttling), auto-advances to the next round on expiry, and
  persists through the localStorage adapter. `useWebBlinds` owns the schedule. The view is
  decomposed into presentational components under `components/timer/`.
- **Mobile** (`apps/mobile/src`): `useTimerEngine` + `TimerContext`/`BlindsContext`
  orchestrate the countdown, sounds, notifications and Live Activity. `TimerStorage` and
  `BlindsStorage` are thin wrappers that inject the AsyncStorage adapter into core.

## Build & deploy

- **Web → Vercel.** Project **Root Directory = `apps/web`**; "include files outside the root
  directory" must be enabled so `packages/*` are available at build time. Install runs from
  the root lockfile. Domain `poker-timer.toondeboer.com` is unchanged.
- **Mobile → EAS.** Build/submit from `apps/mobile` (`eas build`, `eas submit`). The EAS
  project link lives in `app.json` (`extra.eas.projectId`) and is unaffected by the move.
- The native `ios/` and `android/` projects are **committed** (bare workflow): an iOS app +
  Live Activity widget and an Android foreground service. Native changes may require
  `expo prebuild` / pod install.

## Monorepo gotchas

- **Single `@types/react`.** The root `overrides` pin `@types/react`/`@types/react-dom` to
  one `19.0.x` so web and mobile don't each resolve a different copy (two copies produce a
  spurious "X cannot be used as a JSX component" type error). Keep them aligned.
- **Node global type leakage.** With hoisting, `@types/node` (a web dependency) is visible to
  the mobile `tsc`, so `setInterval` types as `NodeJS.Timeout`. Timer code uses
  `ReturnType<typeof setInterval>` to stay portable.
- **Metro monorepo config.** `apps/mobile/metro.config.js` adds the repo root to
  `watchFolders` and both `node_modules` dirs to `nodeModulesPaths` so Metro resolves hoisted
  deps and `@poker/core` source. If native builds can't find modules, check this first.

## History

This repo was created by merging two repositories with full history preserved:
`poker-timer` (the website) under `apps/web`, and `poker-kit` (the app) under `apps/mobile`.
`git log --follow -- apps/<web|mobile>/...` traces a file across the merge.
