# CLAUDE.md

Guidance for working in this repo. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

## What this is

A monorepo for the Poker Blinds Buzzer product:

- `apps/web` (`@poker/web`) — Next.js 15 site: marketing landing (`/`) + web timer (`/timer`).
- `apps/mobile` (`@poker/mobile`) — Expo (bare) React Native iOS/Android app.
- `packages/core` (`@poker/core`) — shared, framework-agnostic TypeScript logic.

## Package manager & commands

- **npm workspaces + Turborepo.** Always run `npm install` from the **repo root** (one
  lockfile). Don't introduce yarn/pnpm.
- Common commands (from root):
  - `npm run web` · `npm run ios` · `npm run android` · `npm run mobile`
  - `npm run typecheck` · `npm run lint` · `npm run build` (each fans out via `turbo`)
  - Single workspace: `npm run <script> -w @poker/<core|web|mobile>`

## Conventions & guardrails

- **Shared logic goes in `@poker/core`** and must stay framework-agnostic — no `react`,
  `react-native`, or DOM imports (its tsconfig uses `lib: ["esnext"]`, `types: []`, so even
  `console` is unavailable there). Put types, blind math, timer math, and serialization here.
- **Platform code stays in the app.** Audio, notifications, haptics, storage backend, and
  native modules are app-specific. Wire them into core through an interface — e.g. the
  `StorageAdapter` (AsyncStorage on mobile, localStorage on web). Add a web fallback/no-op
  for anything mobile-only (Live Activities, foreground service, push) rather than importing
  native modules on the web.
- **The web app has its own UI** (Next.js + Tailwind). Don't try to render the React Native
  components on the web; share logic, not components.
- **Imports:** cross-package → `@poker/core`; within mobile → `@/src/...`; within web →
  `@/...` (maps to `apps/web/src`).
- **Don't commit build artifacts** — `.next/`, `.expo/`, native `build/`, `node_modules/`,
  `next-env.d.ts` are git-ignored.

## Things that bite in this monorepo

- **`@types/react` must stay a single version** — pinned via root `package.json` `overrides`.
  If you change React typings, keep web and mobile on the same `19.0.x`, then do a clean
  install (`rm -rf node_modules package-lock.json && npm install`) so the override applies.
- **`@types/node` leaks to mobile via hoisting**, so use `ReturnType<typeof setInterval>` for
  interval refs instead of `number`.
- **Metro monorepo config** lives in `apps/mobile/metro.config.js`; if Metro can't resolve a
  hoisted dependency or `@poker/core`, check `watchFolders`/`nodeModulesPaths` there.
- **Mobile is a bare Expo workflow** — `apps/mobile/ios` and `apps/mobile/android` are
  committed. Native changes may need `expo prebuild` and a pod install.

## Deploy

- Web → Vercel (Root Directory = `apps/web`).
- Mobile → EAS from `apps/mobile` (`eas build` / `eas submit`); project id in `app.json`.
