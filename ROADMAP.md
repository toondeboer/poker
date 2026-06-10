# ROADMAP

Tracks proposed and completed improvements for the Poker Blinds Buzzer monorepo. Most items
originate from the architecture/due-diligence review of the codebase.

**Maintenance convention (read this):** Claude (and contributors) must **read this file at the
start of a work session** and **keep the Status column current** — when an item is implemented,
partially landed, deferred, or abandoned, update its row in the *same* change. Add newly
proposed improvements as new rows. See [CLAUDE.md](./CLAUDE.md).

**Status legend:** ✅ Done · 🚧 In progress · ⬜ Not started · ⏸️ Deferred

_Last reviewed: 2026-06-10._

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
| R12 | ~~Fix iOS background-expiry blind advancement~~ (invalid premise) | High | High | **Won't do.** Premise was wrong: the intended product behavior is to advance **exactly one** blind level per expiry and then **stop and wait for explicit player acknowledgement** — blinds must never silently fast-forward through multiple levels or run to the end. That single-advance-then-acknowledge behavior already exists. (iOS can't sound an alarm in the background, so the repeating notifications are the deliberate "blinds went up" nudge until the app is reopened — see R16.) Investigating this surfaced two real, unrelated bugs, fixed here: (1) `resetTimer` persisted a stale `timeLeft` from its closure, and (2) the foreground reloaded timer state from storage every second (`loadTimerState` is an unstable effect dep) — together these made "reset while paused" appear to do nothing. Fixed by persisting explicit reset state and gating the reload behind a real background→foreground transition (`wasActiveRef`). | ⏸️ Deferred (won't-do; 2 robustness fixes landed) |
| R13 | Android permission diet | Med | Med | Dropped 4 unused permissions from the release manifest. `RECORD_AUDIO` (no library declared it; app only plays audio with `allowsRecordingIOS: false`) and `SYSTEM_ALERT_WINDOW` (only RN's *debug* manifest re-adds it for the redbox; app uses `USE_FULL_SCREEN_INTENT`, not overlays) were plain deletes. `READ/WRITE_EXTERNAL_STORAGE` are merged in by `expo-file-system` (transitive, unused) and `expo-image` (unused) so they're stripped with `tools:node="remove"`. Also added `android.blockedPermissions` to `app.json` so a future `expo prebuild` won't reintroduce them. Verified against the merged release manifest (`processReleaseManifest`): all four are absent. | ✅ Done |
| R14 | Prune unused mobile deps | Med | Med | e.g. `react-native-webview`, `expo-blur/image/symbols/web-browser/system-ui/haptics/constants`, `@react-navigation/*`, `react-native-web`. Bare workflow → needs `expo prebuild` + pod/gradle re-sync + build verification. | ⬜ Not started |
| R15 | Replace `PLAY_STORE_LINK` placeholder | Med | Low | `LandingPage` ships `"https://google.com" // TODO`; confirm Android launch or hide the CTA. | ⬜ Not started |
| R16 | Multi-level background notifications | Med | High | The repeating iOS notifications all show one fixed next-blind **by design**: since blinds advance only one level per expiry and then wait for player acknowledgement (see R12), there is exactly one "next blind" to announce until the app is reopened. The repeating notification is the deliberate workaround for iOS not allowing a background alarm — it nags "blinds went up" until acknowledged, then stops on open. A per-level timeline would only make sense if we wanted background auto-advance through multiple levels, which contradicts the acknowledgement model. Revisit only if that product decision changes. | ⏸️ Deferred (by design) |
| R17 | Gate `console.*` (mobile) | Low | Low | ~75 `console.*` calls in mobile production paths; gate behind `__DEV__` or a small logger. | ⬜ Not started |
| R18 | Remove dead `scheduledNotificationIds` plumbing | Low | Low | State is never populated; `cancelNotification` already relies on the global cancel. | ⬜ Not started |
| R19 | Consolidate `PokerSettings` `formatTime` | Low | Low | Use core `formatTime` (cosmetic: pads minutes, `9:00`→`09:00`). | ⬜ Not started |
| R20 | Migrate `expo-av` → `expo-audio` | Med | Med | `expo-av` is deprecated as of Expo SDK 53. | ⬜ Not started |
| R21 | Hoist a shared timer state machine into `@poker/core` | High | High | Have web `useWebTimer` and mobile `useTimerEngine` adapt one core state machine; kills the duplicated-engine drift class of bugs. | ⬜ Not started |
| R22 | Decompose `TimerContext` / `useTimerEngine` (SRP) | Med | High | Split engine vs. side-effects vs. native sync; reduces the god-object fragility. | ⬜ Not started |
| R23 | Extract `<StoreButton>` in `LandingPage` | Low | Low | Apple/Google store SVG + button markup is duplicated 3×. | ⬜ Not started |
| R24 | Dependency / Expo SDK version bumps | Med | Med | Stack (Expo 53 / RN 0.79) is ~1+ SDK generation behind. Next.js bumped to 16.2.7 (was 15.3.5); Expo/RN still pending. | 🚧 In progress |
