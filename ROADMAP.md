# ROADMAP

Tracks proposed and completed improvements for the Poker Blinds Buzzer monorepo. Most items
originate from the architecture/due-diligence review of the codebase.

**Maintenance convention (read this):** Claude (and contributors) must **read this file at the
start of a work session** and **keep the Status column current** — when an item is implemented,
partially landed, deferred, or abandoned, update its row in the *same* change. Add newly
proposed improvements as new rows. See [CLAUDE.md](./CLAUDE.md).

**Status legend:** ✅ Done · 🚧 In progress · ⬜ Not started · ⏸️ Deferred

_Last reviewed: 2026-06-07._

## Completed (branch `refactor/post-review-cleanups`)

| ID | Change | Impact | Risk | Description | Status |
|----|--------|--------|------|-------------|--------|
| R1 | Remove duplicate mobile lockfile | Med | Low | Deleted the tracked `apps/mobile/package-lock.json`; npm workspaces use the single root lockfile. Added a `.gitignore` guard for nested lockfiles. | ✅ Done |
| R2 | Remove dead code | Low | Low | Dropped `defaultBlindLevels` (core, 0 consumers) and the unused `BlowAnimationView` (mobile `TimerExpirationAlert`). | ✅ Done |
| R3 | De-duplicate `formatTime` (mobile) | Low | Low | `PokerTimer` imports core `formatTime` instead of a byte-identical local copy. | ✅ Done |
| R4 | Correct docs | Med | Low | ARCHITECTURE haptics row → RN `Vibration` (not `expo-haptics`); mobile README → RN `StyleSheet` (not Tailwind). | ✅ Done |
| R5 | `@poker/core` test suite | High | Low | Vitest + 28 unit tests (blinds, time math, storage factories). New turbo `test` task + root `test` script. | ✅ Done |
| R6 | Lint `@poker/core` | Med | Low | ESLint flat config + `lint` script; closes the unlinted blind spot. | ✅ Done |
| R7 | Fix web RSC boundary | Low | Low | Moved `"use client"` onto `LandingPage`; `/` is now a server component rendering it. | ✅ Done |
| R8 | Stabilize timer interval | Med | Low | `callbacksRef` in `useTimerEngine` stops per-render teardown/rebuild of the 1s interval. | ✅ Done (wants device smoke test) |
| R9 | Throttle AsyncStorage writes | Med | Med | Stopped per-second `timeLeft` writes; persist on meaningful transitions only, derive `timeLeft` from `endTime` on load. | ✅ Done (wants device verification) |

## Proposed (not started) — roughly by priority

| ID | Change | Impact | Risk | Description | Status |
|----|--------|--------|------|-------------|--------|
| R10 | Resolve privacy-policy vs Google Analytics contradiction | High | Med | Web loaded GA (`G-13MH57QZWG`) on every page while the policy claimed "no analytics"; EU publisher, no consent banner. Added `AnalyticsConsent` (cookie-consent banner that gates GA loading on opt-in, persisted to `localStorage`) and rewrote the privacy-policy sections to accurately disclose the website's optional, consent-based Google Analytics use vs. the app's true no-analytics behavior. | ✅ Done |
| R11 | Add CI (typecheck + lint + test) | High | Low | Added `.github/workflows/ci.yml`: GitHub Actions running `npm run typecheck/lint/test` (turbo tasks across all workspaces) on PRs and pushes to `main`. | ✅ Done |
| R12 | Fix iOS background-expiry blind advancement | High | High | On reopen, advance the blind level (fast-forward by fully-elapsed rounds) instead of resetting to the same level paused. JS is suspended in the background, so blinds never advance there today. Needs simulator-in-the-loop. | ⬜ Not started |
| R13 | Android permission diet | Med | Med | Drop `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE` if unused — Play-review friction + privacy optics. | ⬜ Not started |
| R14 | Prune unused mobile deps | Med | Med | e.g. `react-native-webview`, `expo-blur/image/symbols/web-browser/system-ui/haptics/constants`, `@react-navigation/*`, `react-native-web`. Bare workflow → needs `expo prebuild` + pod/gradle re-sync + build verification. | ⬜ Not started |
| R15 | Replace `PLAY_STORE_LINK` placeholder | Med | Low | `LandingPage` ships `"https://google.com" // TODO`; confirm Android launch or hide the CTA. | ⬜ Not started |
| R16 | Multi-level background notifications | Med | High | Repeating iOS notifications all show one fixed next-blind. Pre-schedule a per-level timeline or use push-updated Live Activities. | ⬜ Not started |
| R17 | Gate `console.*` (mobile) | Low | Low | ~75 `console.*` calls in mobile production paths; gate behind `__DEV__` or a small logger. | ⬜ Not started |
| R18 | Remove dead `scheduledNotificationIds` plumbing | Low | Low | State is never populated; `cancelNotification` already relies on the global cancel. | ⬜ Not started |
| R19 | Consolidate `PokerSettings` `formatTime` | Low | Low | Use core `formatTime` (cosmetic: pads minutes, `9:00`→`09:00`). | ⬜ Not started |
| R20 | Migrate `expo-av` → `expo-audio` | Med | Med | `expo-av` is deprecated as of Expo SDK 53. | ⬜ Not started |
| R21 | Hoist a shared timer state machine into `@poker/core` | High | High | Have web `useWebTimer` and mobile `useTimerEngine` adapt one core state machine; kills the duplicated-engine drift class of bugs. | ⬜ Not started |
| R22 | Decompose `TimerContext` / `useTimerEngine` (SRP) | Med | High | Split engine vs. side-effects vs. native sync; reduces the god-object fragility. | ⬜ Not started |
| R23 | Extract `<StoreButton>` in `LandingPage` | Low | Low | Apple/Google store SVG + button markup is duplicated 3×. | ⬜ Not started |
| R24 | Dependency / Expo SDK version bumps | Med | Med | Stack (Expo 53 / RN 0.79) is ~1+ SDK generation behind. Next.js bumped to 16.2.7 (was 15.3.5); Expo/RN still pending. | 🚧 In progress |
