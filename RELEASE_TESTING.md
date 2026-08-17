# Manual test checklist — 1.1.4

What still needs a human. Everything here is either impossible to automate (real purchases), or was
attempted and blocked (see notes). Automated coverage — 141 `@poker/core` tests, typecheck, lint,
web build — runs in CI and is not repeated here.

Tick the platform column you actually ran. **iOS and Android are not interchangeable** for anything
touching notifications, billing, or the keyboard — those are the paths that differ most.

**Legend:** ✅ verified by hand · ☑ verified by an automated Maestro flow · ❌ verified **broken**,
see [Open defects](#open-defects) · ☐ not run yet · n/a doesn't apply on this platform.

**Passes run so far:** Android phone + tablet + small phone (emulators, throughout development);
iPad Pro 11-inch and iPhone SE (simulators, layout only); **iOS on a real device — iPhone 13 Pro,
`npm run ios:device`** — which is where every ❌ below was found.

---

## 0. Before you start

- [✅] **Rebuild the dev client on both platforms.** 1.1.4 moves `react-native-purchases`
      10.4.0 → 10.4.4, which moves the native SDK (`PurchasesHybridCommon` 18.22.2,
      `RevenueCat` 5.81.1). An existing dev client red-screens at launch with
      `RNPurchases.setupPurchases called with too many arguments, expected up to 14, got 15` —
      the new JS against the old native module. `npm run pods -w @poker/mobile`, then
      `npm run ios` / `npm run android`.
- [✅] If the app behaves strangely in ways that don't match the code, check
      `pgrep -fl GradleDaemon` — VS Code's Java extension replants the broken expo shims.
      `node apps/mobile/scripts/clean-expo-shims.js` fixes it; lint/typecheck now self-heal.

---

## 1. Billing — the highest risk in this release · **blocks submission**

Nothing in development can exercise this: the Android emulator has no Play Billing
(`BILLING_UNAVAILABLE`) and the Simulator has no StoreKit configured. Needs a real device with a
sandbox/test account.

| | iOS | Android |
|---|---|---|
| Paywall opens from all three entry points (Pro card, Presets, Sound Pack) | ✅ | ☐ |
| Price string renders (not blank, not `one-time` alone) | ❌ **[D1](#d1)** | ☐ |
| **Purchase completes** and Pro unlocks (ads gone, Presets + Sound Pack usable) | ✅ | ☐ |
| **Restore purchases** works on a fresh install of the same account | ✅ | ☐ |
| Cancelling a purchase leaves the app in a sane state, no error toast | ☐ not reachable locally — a sandbox purchase can't be cancelled once the sheet is confirmed | ☐ |

> Set `FORCE_PRO_IN_DEV`/`FORCE_FREE_IN_DEV` in `PremiumContext.tsx` to exercise the *gated UI*
> without buying — but that does **not** test billing itself.

---

## 2. Blind structure editor — the main feature

Verified on Android phone (720×1280) during development, and end-to-end on an iPhone 13 Pro. Tablet
layout is covered separately in §7.

| | iOS | Android |
|---|---|---|
| Settings scrolls as one page — no scroll island | ✅ | ☑ |
| Blind structure row shows correct count + range, opens the editor | ✅ | ☑ |
| 30 rows scroll smoothly; inputs editable | ✅ | ☑ |
| Clearing a blind field shows **empty**, not `0`; blur restores the old value | ✅ | ☑ automated (Maestro: `editor-clear-blur.yaml`) |
| `+` → Insert below / Duplicate, at top, middle and end | ✅ | ☑ automated (Maestro: `editor-insert-duplicate.yaml` for top+middle, `editor-delete-discard.yaml` for end on a short list — see notes in those files for why the full 30-row list's last rows weren't used) |
| Delete down to 2 levels → trash buttons disable | ✅ | ☑ automated (Maestro: `editor-delete-discard.yaml`) |
| Sticky footer appears only when dirty | ✅ | ☑ |
| **Discard** restores the active values | ✅ | ☑ automated (Maestro: `editor-delete-discard.yaml`) |
| **Apply mid-tournament keeps your level** (start Level 12, edit, apply → still 12) | ✅ | ☑ |
| Apply a schedule **shorter** than the current level → warning shown, lands on last level, **timer does not crash** | ✅ | ☑ automated (Maestro: `editor-apply-shorter-schedule.yaml`) |
| Tap-to-jump: confirm → timer *and* notification/Live Activity both follow | ✅ | ☑ |
| Jump chip is **inert** while the draft is dirty | ✅ | ☑ |
| Back with unapplied edits → Apply / Discard / Keep editing | ✅ | ☑ |
| …via **hardware back** (Android) and **swipe-back** (iOS) | ✅ | ☑ |
| Kill the app with a dirty draft → relaunch → draft and footer still there | ✅ | ☑ automated (Maestro: `editor-kill-dirty-draft.yaml`) |

---

## 3. Generator

| | iOS | Android |
|---|---|---|
| Slow / Standard / Turbo produce **visibly different** schedules | ✅ | ☑ |
| Smallest chip 5, start 5 → `5/10 10/20 15/30 20/40…`, **never 6/12** | ✅ | ☑ |
| Chip 25, start 25 → matches a real casino sheet (`25/50 50/100 75/150 100/200…`) | ☑ automated (Maestro: `generator-chip25-casino-sheet-ios.yaml`) | ☑ automated (Maestro: `generator-chip25-casino-sheet.yaml`) |
| Chip seeds itself from the structure you're editing | ✅ | ☑ |
| Sheet reaches the bottom edge — **no see-through strip** below it | ✅ | ☑ |
| "Replace structure" fits on **one line** with its icon | ✅ | ☑ |
| Replace writes the draft only; active schedule unchanged until Apply | ☑ automated (Maestro: `generator-replace-draft-only-ios.yaml`, including the "Unapplied changes" badge — see NavRow VoiceOver fix in ROADMAP.md) | ☑ automated (Maestro: `generator-replace-draft-only.yaml`) |

---

## 4. Round duration

| | iOS | Android |
|---|---|---|
| mm:ss commits on blur — no Save button needed | ☑ automated (Maestro: `round-duration-ios.yaml`) | ☑ automated (Maestro: `round-duration.yaml`) |
| Type `12`/`30`, back out → next round is 12:30 | ☑ automated (Maestro: `round-duration-ios.yaml`) | ☑ automated (Maestro: `round-duration.yaml`) |
| Changing it **mid-round leaves the running round's remaining time alone** | ☑ automated (Maestro: `round-duration-mid-round-ios.yaml`) | ☑ automated (Maestro: `round-duration-mid-round.yaml`) |
| Seconds field caps at 59 | ☑ automated (Maestro: `round-duration-ios.yaml` — confirms the NumberField fix holds cross-platform, same shared JS) | ☑ automated (Maestro: `round-duration.yaml` — found and fixed a real display bug along the way, see CHANGELOG) |

---

## 5. Keyboard behaviour

The Presets nudge is fixed and confirmed on both platforms. The sheet path is fixed on Android and
still broken on iOS — see [D2](#d2).

| | iOS | Android |
|---|---|---|
| Focus the preset-name field → **Save Preset is fully visible** above the keyboard | ✅ | ✅ fixed (see ROADMAP.md) — verified by screenshot, full clean breathing room now. Maestro: `keyboard-preset-nudge.yaml` (screenshot-based; `assertVisible` alone can't prove full IME clearance) |
| No dead space / over-scroll after the nudge | ✅ | ✅ verified by the same screenshot — clearance matches `BREATHING_ROOM = 24`, no excess |
| Same on a **small** phone (iPhone SE class / 720×1280) | ☐ still to do in the iPhone SE simulator | ☐ |
| Generator sheet fields usable with the keyboard up | ❌ **[D2](#d2)** | ✅ fixed (Maestro: `generator-keyboard.yaml`) — was hidden behind the keyboard, see ROADMAP.md "Settings page UX — blind levels" |

---

## 6. Notifications & Live Activity

| | iOS | Android |
|---|---|---|
| Round expiry fires the alert + alarm with the app **foregrounded** | ☑ automated (Maestro: `notification-foreground-expiry-ios.yaml`) | ☑ automated (Maestro: `notification-foreground-expiry.yaml`) |
| Expiry while **backgrounded** advances the level | ❌ **[D3](#d3)** | tried to automate, blocked by dev-client-only noise, not a real bug — see note below |
| Pause / Resume / Stop from the notification / Live Activity | ❌ **[D4](#d4)** | ☐ |
| **After a level jump, the pending "time's up" notification names the _new_ next blind** — the fix in this release, never verified on-device | ✅ | n/a |
| Notification survives swipe-away from Recents | n/a | ☐ |

> **Backgrounded-expiry automation attempt:** `adb shell input keyevent KEYCODE_HOME` reliably
> brings Expo's own `DevLauncherActivity` back on top of the task stack on this dev-client build
> (confirmed via `logcat` — a `DevLauncherActivity` window becomes visible right after Home is
> pressed), so resuming afterward shows the dev-launcher picker rather than the real app state.
> That's dev-client tooling noise, not present in a release build, so not a real app bug — but it
> means this specific row can't be reliably automated against this build type. Needs either a
> release-configuration build or a real device/manual pass.

---

## 7. Tablets

`isTablet` is `width > 768`. **iPad mini (744pt) deliberately gets the phone layout** — that's
expected, not a bug.

Android tablet (2560×1600) verified against a freshly built APK. iPad now verified too (iPad Pro
11-inch M5 simulator, screenshots).

| | iPad | Android tablet |
|---|---|---|
| Settings: Tournament + Presets **side by side**, capped and centred | ✅ | ☑ |
| Blind editor list + sticky footer capped at 900 and centred | ✅ fixed (was full-bleed, see ROADMAP.md) — dropping the redundant `width: "100%"` from `centred` fixed it; verified via screenshot on iPad Pro 11-inch, list and sticky footer both cap/centre correctly | ☑ re-verified on Android_tablet after the fix, no regression |
| Timer card centred, not full-bleed | ✅ | ☑ |
| Generator sheet sensible at tablet width | ⚠️ also full-bleed on iPad — `Sheet.tsx` has no tablet-cap logic at all (unlike Settings/BlindStructureScreen), so this may just be pre-existing/never-implemented rather than a regression. Not confirmed whether Android's "sensible" ☑ was judged at the same full-bleed width or genuinely capped. | ☑ |
| iPad **mini** still gets the phone layout | not verified (no iPad mini simulator checked this pass) | n/a |

---

## 8. Small phones

| | iOS | Android |
|---|---|---|
| Timer fits with no scrolling, nothing clipped | ✅ (iPhone SE simulator, screenshot) | ✅ (Android_small emulator, screenshot) |
| Settings cards readable, no overlap | ✅ (iPhone SE simulator, screenshot) | ✅ (Android_small emulator, screenshot) |
| Blind rows: level chip, LIVE badge and both buttons all fit | ✅ (iPhone SE simulator, screenshot) | ✅ (Android_small emulator, screenshot) |

---

## 9. Cold launch

| | iOS | Android |
|---|---|---|
| Launch → no visible resize before the timer appears | ✅ | ☐ |
| Deep link straight to `pokerkit://settings` and `pokerkit://blinds` → splash lifts **immediately**, not after 4s | ☐ same dev-client blocker as Android — the launcher owns the URL scheme, so this needs a release build (`xcrun simctl openurl booted pokerkit://blinds` on a release-config install) | not automatable on this dev-client build — see note below |

> **Cold-launch deep-link automation attempt:** confirmed the same root cause as §6's
> backgrounded-expiry blocker, this time via `adb shell am start -W -a android.intent.action.VIEW
> -d "pokerkit://blinds" com.toondeboer.pokerkit` on a fully force-stopped process — `adb`'s own
> `LaunchState: COLD` / `Activity: ...DevLauncherActivity` output confirms the deep link resolves
> to Expo's dev-launcher picker, not `MainActivity`, on a cold process. `DevLauncherActivity`
> doesn't exist in a release build, so this row is untestable against dev-client tooling by
> construction, not a product bug — it needs a release-configuration build (or a real device) to
> verify for real.

---

## Open defects

Found on the iPhone 13 Pro device pass. Each one **blocks the iOS submission** until fixed or
deliberately descoped; none of them reproduce on Android, where the equivalent rows pass.

<a id="d1"></a>
### D1 · Paywall shows "one-time" with no price · §1

The Unlock button reads `Unlock Pro · one-time` — the localized price is missing entirely. The
purchase itself works, so the RevenueCat offering does resolve when the button is tapped; only the
price shown *before* that is absent. `PremiumContext` fetches `getProPriceString()` exactly once on
mount and `revenueCatProvider.getProPriceString()` swallows every failure as `null`, with no retry
and nothing logged — so a fetch that loses the race with SDK configuration or a cold network leaves
the paywall permanently priceless for that launch. The fallback string is also wrong on its own
terms: "one-time" alone isn't a price.

<a id="d2"></a>
### D2 · Generator sheet is unusable with the keyboard up · §5

Focusing a number field pushes the sheet up but nothing re-measures: the content is taller than
what's left above the keyboard, the sheet's `ScrollView` doesn't scroll (its `maxHeight` is still
computed from the *full* window height, so it doesn't believe it's overflowing), and the numeric
keypad has no Return key — so the only way to dismiss it is to tap some other part of the screen.
Android was fixed for this release by tracking the keyboard height directly (`Sheet.tsx`
`androidKeyboardHeight`); iOS was left on `KeyboardAvoidingView behavior="padding"`, which moves the
sheet without shrinking the scroll region.

<a id="d3"></a>
### D3 · Backgrounded expiry only ever advances one level · §6

Background one round and reopen: correct. Background *through two or more* rounds and reopen: the
timer shows a fresh full round (15:00) and the blind level hasn't moved.

This is by construction, not a race. iOS suspends JS while backgrounded, so nothing counts rounds
down; `hydrateTimerState` sees a single elapsed `endTime`, returns a reset round with
`expired: true`, and the app advances at most one level. Nothing anywhere computes *how many* rounds
fit in the elapsed time. The scheduled notifications don't help: `useTimerNotification` schedules
~38 copies of one "time's up" alert for the current round only (every 8s for 5 minutes) and never
schedules anything for the round after it — which also burns most of iOS's 64-pending-notification
budget, so a per-level chain can't just be added on top.

<a id="d4"></a>
### D4 · Live Activity buttons corrupt the timer · §6

- **Pause** → the timer reads 0:00.
- **Resume** → jumps to a full 15:00 round *and* fires the "time's up" notification immediately.
- **Stop** → dismisses the Live Activity (this part is correct).

Resume's behaviour follows from Pause's: `TogglePauseTimerIntent` stores `timeLeft = 0`, so the
resume branch takes its `timeLeft > 0 ? timeLeft : timerDuration` fallback (full round) and reports
`wasExpired: true`, which makes the app advance a blind level and reschedule the alert with a
non-positive delay — hence the immediate notification. So the whole chain hangs off Pause writing
zero, and the pipeline it hangs off (widget process → App Group `UserDefaults` → Darwin
notification → `consumePendingAction()` reconciled against AsyncStorage after `loadTimerState()`)
is the most intricate code in the app. Console.app, filtered on subsystem `com.toondeboer.pokerkit`
category `LiveActivity`, shows both processes' logs and is how to confirm which side writes the 0.

---

## Known-and-accepted — do not file these

- **iPad mini uses the phone layout** — 744pt is under the 768 threshold, deliberate.
- **`uuid` advisory (moderate)** — `xcode@3.0.1` hard-requires `^7.0.3`; no in-range fix exists.
  Build tooling only, unreachable from app code.
- **Live Activity buttons die after a force-quit on iOS** — Apple platform restriction.
- **Android notification's blind level can lag** across multiple expire/resume cycles while the app
  is fully killed — documented architectural limit, has its own in-app caption.
- **Simulator Live Activity flakiness** — `Failed to start Live Activity` in the Simulator is
  environmental, not app code.
