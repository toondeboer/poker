# Architecture

A single monorepo for the **Poker Blinds Buzzer** product: a marketing site with a
full-featured web timer, an iOS/Android app, and the shared logic both build on.

## Overview

| Workspace | Name | Stack | Purpose |
|---|---|---|---|
| `apps/web` | `@poker/web` | Next.js 16 (App Router), React 19, Tailwind CSS 4 | Marketing landing page (`/`) + the full-screen web timer (`/timer`) + privacy policy |
| `apps/mobile` | `@poker/mobile` | Expo SDK 56 (bare), React Native 0.85, expo-router | The iOS/Android app (App Store / Play Store) |
| `packages/core` | `@poker/core` | Plain TypeScript | Framework-agnostic poker-timer logic shared by both apps |

The web and mobile UIs are **deliberately separate** — desktop and phone have different
needs (the phone manages sleep, background timers, Live Activities and push notifications;
the desktop does not). What they share is **logic, not components**: blind schedules, timer
math, serialization, and types all live in `@poker/core`. Running the React Native UI on the
web (`react-native-web`) was evaluated and rejected as high-effort/fragile for no real desktop
benefit.

## Repository layout

```
apps/
  web/      @poker/web      Next.js site + web timer
  mobile/   @poker/mobile   Expo iOS/Android app (bare workflow: ios/, android/ committed)
packages/
  core/     @poker/core     shared, framework-agnostic timer logic
```

Inside `apps/mobile/src`:

```
app/            expo-router routes: index (timer), settings, blinds
components/
  ui/           shared primitives (Card, Button, TextField, Sheet, …)
  settings/     the Settings screen, one file per card
  blinds/       the blind-structure editor
  PokerTimer    the timer screen (self-measuring, deliberately bespoke)
theme/          colour / spacing / typography tokens, tablet breakpoint
contexts/       Blinds, Timer, Premium, SoundPack, AppState, AppReadyGate
```

**Blind levels use a draft/active split.** `BlindsContext` holds `customBlindLevels` (what the
`/blinds` editor mutates) separately from `blindLevels` (what the timer plays); the editor's Apply
button is what promotes one to the other. Applying *clamps* the current level into the new schedule
rather than resetting it, so editing mid-tournament doesn't restart the game — whereas loading a
preset or resetting to defaults does restart, since those swap in a different tournament entirely.

## Tooling

- **npm workspaces** link the packages. We use npm (not pnpm/yarn) because both original
  repos used npm and because React Native's Metro bundler + Expo autolinking resolve most
  reliably against npm's hoisted `node_modules`.
- **Turborepo** runs and caches tasks across workspaces (`turbo run build|lint|typecheck`).
- **TypeScript**: every package extends `tsconfig.base.json`; cross-package imports use the
  `@poker/core` alias. `@poker/core` ships **uncompiled TypeScript** (its `main`/`types`
  point at `src/index.ts`); Next compiles it via `transpilePackages`, Metro via its
  monorepo config — so there is no separate build step for the shared package.

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
| Sound | `expo-audio` (`useSounds`) | Web Audio API (`useWebAudio`) |
| Notifications | `expo-notifications` (`useTimerNotification`) | `Notification` API + speech synthesis (`useWebNotifications`) |
| Background timer | iOS Live Activities + Android foreground service (`LiveActivityService`, native `ios/`/`android/`) | none — the tab stays open; no background needed |
| Haptics | React Native `Vibration` API (`TimerExpirationAlert`) + native Android `Vibrator` | none |
| Storage | AsyncStorage adapter | localStorage adapter |
| UI | React Native `StyleSheet` components | Next.js + Tailwind components |

See [CLAUDE.md](./CLAUDE.md) for monorepo conventions and gotchas, and [README.md](./README.md)
for setup, run, and deploy commands.
