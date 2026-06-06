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
design.

## Repository structure

```
apps/
  web/      @poker/web      Next.js site + web timer  (Vercel)
  mobile/   @poker/mobile   Expo iOS/Android app      (EAS)
packages/
  core/     @poker/core     shared, framework-agnostic timer logic
```

Each app keeps its own docs in `apps/web/README.md` and `apps/mobile/README.md`.

## Prerequisites

- **Node ≥ 20** and npm (this repo uses npm workspaces — always install from the root).
- For mobile: **Xcode** (iOS), **Android Studio / SDK** (Android), and the Expo/EAS CLI
  (`npm i -g eas-cli`, or use `npx`).

## Install

```bash
npm install        # from the repo root — installs all workspaces against one lockfile
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

## Checks

```bash
npm run typecheck  # tsc across all workspaces (via Turborepo)
npm run lint       # eslint across all workspaces
npm run build      # production build of every buildable workspace
```

## Deploy

- **Website → Vercel.** The Vercel project's **Root Directory is `apps/web`**; pushes to the
  default branch deploy automatically.
- **Mobile → EAS.** From `apps/mobile`: `eas build` then `eas submit` (config in `eas.json`,
  project id in `app.json`).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how the pieces fit together and
[CLAUDE.md](./CLAUDE.md) for conventions when working in this repo.
