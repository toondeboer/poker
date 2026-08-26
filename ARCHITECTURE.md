# Architecture

A single monorepo for the **Poker Blinds Buzzer** product: a marketing site with a
full-featured web timer, an iOS/Android app, and the shared logic both build on.

## Overview

| Workspace | Name | Stack | Purpose |
|---|---|---|---|
| `apps/web` | `@poker/web` | Next.js 16 (App Router), React 19, Tailwind CSS 4 | Marketing landing page (`/`) + the full-screen web timer (`/timer`) + privacy policy |
| `apps/mobile` | `@poker/mobile` | Expo SDK 56 (bare), React Native 0.85, expo-router | The iOS/Android app (App Store / Play Store) |
| `packages/core` | `@poker/core` | Plain TypeScript | Framework-agnostic poker logic shared by the apps **and by the backend** |
| `apps/infra` | `@poker/infra` | AWS CDK | The backend for accounts, groups and online play. Defined, not deployed |

The web and mobile UIs are **deliberately separate** — desktop and phone have different
needs (the phone manages sleep, background timers, Live Activities and push notifications;
the desktop does not). What they share is **logic, not components**: blind schedules, timer
math, payout and standings maths, serialization, and types all live in `@poker/core`.
Running the React Native UI on the web (`react-native-web`) was evaluated and rejected as
high-effort/fragile for no real desktop benefit.

**`@poker/core` is shared with the server too, and that is the point.** The poker rules run
unchanged in the app and in a Lambda, so a client predicting its own action optimistically is
running literally the same function as the authority that decides it. The two cannot drift, and
there is no second implementation of the rules to keep in step.

## Repository layout

```
apps/
  web/      @poker/web      Next.js site + web timer
  mobile/   @poker/mobile   Expo iOS/Android app (bare workflow: ios/, android/ committed)
  infra/    @poker/infra    AWS CDK stack for accounts and online play (not deployed)
packages/
  core/     @poker/core     shared, framework-agnostic poker logic
```

Inside `packages/core/src`:

```
blinds/       schedule generation, mutation, diffing, formatting
time/         durations, formatting, timer maths
timer/        the timer state machine
storage/      StorageAdapter and one store per feature
payouts/      buy-in and payout structure, and the chop calculator
leaderboard/  players, results, standings, groups and account claiming
poker/        the game engine: cards, hand evaluation, betting, side pots,
              a whole hand, and a whole game
realtime/     the channel names the app and the backend both build from
presets/  reviews/  sounds/  monetization/  share/
```

**The poker engine is a stack of pure reducers.** `cards` deals from an injected random source;
`handValue`/`evaluate` score a hand; `bettingRound` runs one street; `pots` builds and pays side
pots; `table` plays a whole hand; `session` plays hand after hand until somebody has all the chips
and hands the result to the leaderboard. Nothing in it touches a clock, a network or a screen,
which is why it can run on a phone and in a Lambda without changing.

Inside `apps/mobile/src`:

```
app/            expo-router routes: index (timer), settings, blinds, payouts, leaderboard
components/
  ui/           shared primitives (Card, Button, TextField, Sheet, …)
  settings/     the Settings screen, one file per card
  blinds/       the blind-structure editor
  payouts/      the buy-in / payout calculator (Pro)
  leaderboard/  standings, roster, the record-a-game sheet and the group picker (Pro)
  PokerTimer    the timer screen (self-measuring, deliberately bespoke)
theme/          colour / spacing / typography tokens, tablet breakpoint
contexts/       Blinds, Timer, Premium, SoundPack, Payout, Leaderboard, AppState,
                AppReadyGate
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

`@poker/core` defines a small async key/value `StorageAdapter` interface and builds every
store on top of it — `createTimerStorage`, `createBlindsStorage`, and the preset, review,
sound-pack, payout and leaderboard stores. Each app supplies its own backend:

| | Adapter | Backend |
|---|---|---|
| `apps/mobile` | `src/services/storageAdapter.ts` | `@react-native-async-storage/async-storage` |
| `apps/web` | `src/lib/storageAdapter.ts` | `window.localStorage` (SSR-safe no-ops on the server) |

This is what gives the web timer persistence (custom blinds, round length, current level
survive a reload) using the exact same serialization the app uses.

The Pro stores are **mobile-only in practice** — nothing on the web reads payouts or the
leaderboard yet — but they are built on the same seam and gated in the app rather than in
`@poker/core`, so the web timer could adopt them without the maths moving.

## The backend, and what it is not

`apps/infra` is an AWS CDK stack: Cognito for identity, one DynamoDB table, AppSync Events for
realtime, and a single Lambda that is the only thing allowed to change a table. **It is defined
and tested, and it has never been deployed** — nothing in the app talks to it.

Two decisions in it are structural rather than incidental:

- **Hole cards are private because of where they are published**, not because the app declines to
  draw them. Each player subscribes to `/table/{tableId}` and to
  `/player/{their own id}/table/{tableId}`, and a subscribe handler rejects a private channel whose
  player segment is not the caller's own. Both sides build those paths from `playerChannel` in
  `@poker/core`, because the app and the backend disagreeing about a path is a *silent* security
  bug — and was one, until a review caught the guard sitting on a namespace those channels never
  touched.
- **Only the server publishes.** Clients connect and subscribe with their token; publishing is
  IAM-only, so every change to a table goes through the rules once.

`ROADMAP.md` carries what must be closed before anything connects to it — the shared channel is
authenticated but not yet authorized, and the action handler has no storage or publishing wired up.

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
