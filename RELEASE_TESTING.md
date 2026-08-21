# Manual test checklist — 1.1.4

> **Status: submitted to the store test tracks (2026-08-21).** Everything testable from a local
> build is ✅ 🤖 ➖ or 🟡. The three 🚫 rows below are the whole remaining list and are now
> runnable — they're the last gate before promoting to production.

What still needs a human. Everything here is either impossible to automate (real purchases), or was
attempted and blocked (see notes). Automated coverage — 146 `@poker/core` tests, typecheck, lint,
web build — runs in CI and is not repeated here.

Mark the platform column you actually ran. **iOS and Android are not interchangeable** for anything
touching notifications, billing, or the keyboard — those are the paths that differ most.

**Legend** — every state is an icon, so scanning a column tells you where things stand.

**Done, nothing to do**

| | |
|---|---|
| ✅ | passed, checked by hand on a real device |
| 🤖 | passed, covered by an automated Maestro flow |
| ➖ | doesn't apply on this platform |

**Decided — shipping as-is**

| | |
|---|---|
| 🟡 | known gap, **accepted for this release** and deliberately not held for |

**Needs attention**

| | |
|---|---|
| ❌ | **broken** — has a write-up under [Open defects](#open-defects) |
| 🔧 | broken, **fixed in code**, waiting on a re-test to become ✅ |
| ⬜ | not run yet |
| 🚫 | **blocked** — can't be exercised from a local build, needs TestFlight or Play internal testing |

A fix landing never upgrades a row on its own: ❌ becomes 🔧, and only a re-test on hardware makes it
✅. Anything left as ❌ 🔧 ⬜ 🚫 still wants a human; 🟡 has already been ruled on.

**Passes run so far**

1. Android phone + tablet + small phone (emulators, throughout development), iPad Pro 11-inch and
   iPhone SE (simulators, layout only).
2. **iPhone 13 Pro, `npm run ios:device`** — found D1–D4.
3. **iPhone 13 Pro again**, re-testing those fixes — D3 and D4 confirmed; found D5–D7.
4. **iPhone 13 Pro *and* a real Android device** — confirmed D1, D5's mechanism, D7 and keep-awake's
   acquire side; found D8–D12. This is the first pass where Android was checked by hand rather than
   by emulator or Maestro.
5. **Both devices again** — D8, D9, D10 and D12 confirmed on both, plus Android's swipe-away-from-
   Recents. [D11](#d11) still failing, since accepted.
6. **Both, during the release build** — found D13 (iOS): the Done control floats in the gap between
   a sheet and the keypad; and D14 (Android): the keypad covers the generator sheet's footer
   buttons. Both fixed and confirmed on a rebuilt client.
7. **Store builds** — `eas build` and `eas submit` succeeded for both platforms (2026-08-21). The
   three 🚫 rows below are now runnable for the first time.

**What's left before submission** — the whole rest of the file is ✅ 🤖 ➖ 🟡.

| | What | Where |
|---|---|---|
| 🚫 | Android **purchase / restore / cancel** — needs the build on a Play internal-testing track | §1 |
| 🚫 | iOS **cancel a purchase** — needs TestFlight; a sandbox purchase can't be cancelled once confirmed | §1 |
| 🚫 | **Deep-link cold launch**, both platforms — the dev launcher owns the URL scheme, needs a release build | §9 |

None of these is blocked on code. They're the reason the first store build goes to **internal
testing / TestFlight rather than straight to production** — `eas submit --profile internal`, see the
release steps in [CLAUDE.md](./CLAUDE.md#release-process).

**Also worth re-running on that build, even though they already passed on a dev client:** §10's
keep-awake rows (this is the first release-config build, and [D11](#d11)'s fix has never been seen
working) and §9's cold-launch row (the dev launcher distorts both).

**Accepted for 1.1.4, not held for** (decided 2026-08-19): [D11](#d11) — a paused round leaves the
screen lit while the app is in the foreground. Its fix is in the branch but never confirmed on
hardware. Plus the two tablet cosmetics in §7, both pre-existing rather than 1.1.4 regressions.

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
| Paywall opens from all three entry points (Pro card, Presets, Sound Pack) | ✅ | ✅ |
| Price string renders (not blank, not `one-time` alone) | ✅ **[D1](#d1)** fixed and confirmed | ✅ |
| **Purchase completes** and Pro unlocks (ads gone, Presets + Sound Pack usable) | ✅ | 🚫 **[see below](#android-billing)** |
| **Restore purchases** works on a fresh install of the same account | ✅ | 🚫 **[see below](#android-billing)** |
| Cancelling a purchase leaves the app in a sane state, no error toast | 🚫 a sandbox purchase can't be cancelled once the sheet is confirmed | 🚫 **[see below](#android-billing)** |

> Set `FORCE_PRO_IN_DEV`/`FORCE_FREE_IN_DEV` in `PremiumContext.tsx` to exercise the *gated UI*
> without buying — but that does **not** test billing itself. Both flags leave the **price** fetch
> alone as of the D1 fix, so the paywall still shows a real price under either.

<a id="android-billing"></a>
> **Why Android's purchase rows can't be done locally.** Play Billing only talks to an app the Play
> Store itself recognises: the package must be uploaded to a Play Console track (internal testing is
> enough), signed with the same key, and the tester's account added to the licence-testing list. A
> locally-built debug APK fails all three, which is why it returns `BILLING_UNAVAILABLE` rather than
> a purchase sheet. **These three rows therefore move to the internal-testing pass, after the build
> is uploaded** — they are not blocked on any code change here. iOS is the mirror image: StoreKit
> sandbox works against a local device build, which is why its column is already done.

---

## 2. Blind structure editor — the main feature

Verified on Android (emulator during development, plus a real device on pass 3) and end-to-end on an
iPhone 13 Pro. Tablet layout is covered separately in §7.

| | iOS | Android |
|---|---|---|
| Settings scrolls as one page — no scroll island | ✅ | 🤖 |
| Blind structure row shows correct count + range, opens the editor | ✅ | 🤖 |
| 30 rows scroll smoothly; inputs editable | ✅ | 🤖 |
| Clearing a blind field shows **empty**, not `0`; blur restores the old value | ✅ | 🤖 automated (Maestro: `editor-clear-blur.yaml`) |
| `+` → Insert below / Duplicate, at top, middle and end | ✅ | 🤖 automated (Maestro: `editor-insert-duplicate.yaml` for top+middle, `editor-delete-discard.yaml` for end on a short list — see notes in those files for why the full 30-row list's last rows weren't used) |
| Delete down to 2 levels → trash buttons disable | ✅ | 🤖 automated (Maestro: `editor-delete-discard.yaml`) |
| Sticky footer appears only when dirty | ✅ | 🤖 |
| **Discard** restores the active values | ✅ | 🤖 automated (Maestro: `editor-delete-discard.yaml`) |
| **Apply mid-tournament keeps your level** (start Level 12, edit, apply → still 12) | ✅ | 🤖 |
| Apply a schedule **shorter** than the current level → warning shown, lands on last level, **timer does not crash** | ✅ | 🤖 automated (Maestro: `editor-apply-shorter-schedule.yaml`) |
| Tap-to-jump: confirm → timer *and* notification/Live Activity both follow | ✅ | 🤖 |
| Jump chip is **inert** while the draft is dirty | ✅ | 🤖 |
| Back with unapplied edits → Apply / Discard / Keep editing | ✅ | 🤖 |
| …via **hardware back** (Android) and **swipe-back** (iOS) | ✅ | 🤖 |
| Kill the app with a dirty draft → relaunch → draft and footer still there | ✅ | 🤖 automated (Maestro: `editor-kill-dirty-draft.yaml`) |

---

## 3. Generator

| | iOS | Android |
|---|---|---|
| Slow / Standard / Turbo produce **visibly different** schedules | ✅ | 🤖 |
| Smallest chip 5, start 5 → `5/10 10/20 15/30 20/40…`, **never 6/12** | ✅ | 🤖 |
| Chip 25, start 25 → matches a real casino sheet (`25/50 50/100 75/150 100/200…`) | 🤖 automated (Maestro: `generator-chip25-casino-sheet-ios.yaml`) | 🤖 automated (Maestro: `generator-chip25-casino-sheet.yaml`) |
| Chip seeds itself from the structure you're editing | ✅ | 🤖 |
| Sheet reaches the bottom edge — **no see-through strip** below it | ✅ | 🤖 |
| "Replace structure" fits on **one line** with its icon | ✅ | 🤖 |
| Replace writes the draft only; active schedule unchanged until Apply | 🤖 automated (Maestro: `generator-replace-draft-only-ios.yaml`, including the "Unapplied changes" badge — see NavRow VoiceOver fix in ROADMAP.md) | 🤖 automated (Maestro: `generator-replace-draft-only.yaml`) |

---

## 4. Round duration

| | iOS | Android |
|---|---|---|
| mm:ss commits on blur — no Save button needed | 🤖 automated (Maestro: `round-duration-ios.yaml`) | 🤖 automated (Maestro: `round-duration.yaml`) |
| Type `12`/`30`, back out → next round is 12:30 | 🤖 automated (Maestro: `round-duration-ios.yaml`) | 🤖 automated (Maestro: `round-duration.yaml`) |
| Changing it **mid-round leaves the running round's remaining time alone** | 🤖 automated (Maestro: `round-duration-mid-round-ios.yaml`) | 🤖 automated (Maestro: `round-duration-mid-round.yaml`) |
| A round shorter than 10s is **kept**, not silently rewritten (type `5`, leave, come back → still 5) | ✅ **[D12](#d12)** fixed and confirmed | ✅ **[D12](#d12)** fixed and confirmed |
| Seconds field caps at 59 | 🤖 automated (Maestro: `round-duration-ios.yaml` — confirms the NumberField fix holds cross-platform, same shared JS) | 🤖 automated (Maestro: `round-duration.yaml` — found and fixed a real display bug along the way, see CHANGELOG) |

---

## 5. Keyboard behaviour

Fully confirmed on both platforms as of pass 5 — the Presets nudge, the sheet's sizing and scrolling
([D2](#d2)), the Done bar's timing and looks ([D5](#d5), [D9](#d9)), Android's focus scrolling
([D8](#d8)), and the editor keeping the keypad while you scroll ([D10](#d10)). Nothing open here.

| | iOS | Android |
|---|---|---|
| Focus the preset-name field → **Save Preset is fully visible** above the keyboard | ✅ | ✅ fixed (see ROADMAP.md) — verified by screenshot, full clean breathing room now. Maestro: `keyboard-preset-nudge.yaml` (screenshot-based; `assertVisible` alone can't prove full IME clearance) |
| No dead space / over-scroll after the nudge | ✅ | ✅ verified by the same screenshot — clearance matches `BREATHING_ROOM = 24`, no excess |
| Same on a **small** phone (iPhone SE class / 720×1280) | ✅ | ✅ |
| **Any** focused field stays visible when the keypad opens — Settings, blind editor, sheet | ✅ | ✅ **[D8](#d8)** fixed and confirmed |
| Number fields show a **Done** bar above the keypad (iOS), on the **first** open | ✅ appears on the first open now | ➖ |
| …and it doesn't look bolted on next to the keyboard's rounded edge | ✅ **[D9](#d9)** fixed and confirmed | ➖ |
| In a **sheet**, the Done control belongs to the sheet — nothing floating in the gap above the keypad | ✅ **[D13](#d13)** fixed and confirmed | ✅ |
| A sheet's **footer buttons stay tappable** with the keypad up (generator: Cancel + Replace structure) | ✅ | ✅ **[D14](#d14)** fixed and confirmed |
| Scrolling **keeps the keypad up** — generator sheet | ✅ | ✅ |
| Scrolling **keeps the keypad up** — blind structure editor | ✅ **[D10](#d10)** fixed and confirmed | ✅ **[D10](#d10)** fixed and confirmed |
| Generator sheet fields usable with the keyboard up | ✅ fixed — sheet resizes and scrolls correctly; the remaining complaints were [D5](#d5) and [D6](#d6) | ✅ fixed (Maestro: `generator-keyboard.yaml`) — was hidden behind the keyboard, see ROADMAP.md "Settings page UX — blind levels" |

---

## 6. Notifications & Live Activity

| | iOS | Android |
|---|---|---|
| Round expiry fires the alert + alarm with the app **foregrounded** | 🤖 automated (Maestro: `notification-foreground-expiry-ios.yaml`) | 🤖 automated (Maestro: `notification-foreground-expiry.yaml`) |
| Expiry while **backgrounded** advances **exactly one** level, and says so if more time passed | ✅ **[D3](#d3)** fixed and confirmed on device | ✅ confirmed by hand (the automation attempt below is still blocked, but the behaviour is verified) |
| ~~Pause / Resume / Stop from the notification / Live Activity~~ | ➖ **[descoped](#d4)** | ➖ **[descoped](#d4)** |
| Live Activity / notification show the right level + time, and the "open the app" caption | ✅ confirmed on device | ✅ |
| Blinds are the most prominent thing on it, after the countdown | ✅ **[D7](#d7)** fixed and confirmed | ✅ **[D7](#d7)** fixed and confirmed |
| **After a level jump, the pending "time's up" notification names the _new_ next blind** — the fix in this release, never verified on-device | ✅ | ➖ |
| Notification survives swipe-away from Recents — start a round, swipe the app out of the app switcher, and the timer notification keeps counting down instead of vanishing with it | ➖ | ✅ |

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
| Settings: Tournament + Presets **side by side**, capped and centred | ✅ | 🤖 |
| Blind editor list + sticky footer capped at 900 and centred | ✅ fixed (was full-bleed, see ROADMAP.md) — dropping the redundant `width: "100%"` from `centred` fixed it; verified via screenshot on iPad Pro 11-inch, list and sticky footer both cap/centre correctly | 🤖 re-verified on Android_tablet after the fix, no regression |
| Timer card centred, not full-bleed | ✅ | 🤖 |
| Generator sheet sensible at tablet width | 🟡 accepted for 1.1.4 — also full-bleed on iPad — `Sheet.tsx` has no tablet-cap logic at all (unlike Settings/BlindStructureScreen), so this may just be pre-existing/never-implemented rather than a regression. Not confirmed whether Android's pass was judged at the same full-bleed width or genuinely capped. | 🤖 |
| iPad **mini** still gets the phone layout | 🟡 accepted for 1.1.4 — no iPad mini simulator checked on any pass | ➖ |

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
| Launch → no visible resize before the timer appears | ✅ | ✅ |
| Deep link straight to `pokerkit://settings` and `pokerkit://blinds` → splash lifts **immediately**, not after 4s | 🚫 the dev launcher owns the URL scheme, so this needs a release build (`xcrun simctl openurl booted pokerkit://blinds` on a release-config install) | 🚫 same blocker — see the note below |

> **Cold-launch deep-link automation attempt:** confirmed the same root cause as §6's
> backgrounded-expiry blocker, this time via `adb shell am start -W -a android.intent.action.VIEW
> -d "pokerkit://blinds" com.toondeboer.pokerkit` on a fully force-stopped process — `adb`'s own
> `LaunchState: COLD` / `Activity: ...DevLauncherActivity` output confirms the deep link resolves
> to Expo's dev-launcher picker, not `MainActivity`, on a cold process. `DevLauncherActivity`
> doesn't exist in a release build, so this row is untestable against dev-client tooling by
> construction, not a product bug — it needs a release-configuration build (or a real device) to
> verify for real.

---

## 10. Screen stays awake

New in this release: the screen is held on while a round counts down, and released on pause/stop.
The holding half is confirmed on both platforms. **The releasing half is the last thing open in this
release** — see [D11](#d11), including why a phone's own auto-lock setting can look identical to the
bug.

**Before re-testing, check the device isn't the reason.** Set a short auto-lock — iOS
*Settings → Display & Brightness → Auto-Lock → 30 Seconds* (it must not be *Never*), Android
*Settings → Display → Screen timeout → 30 seconds*. A phone set to never sleep will fail every row
here no matter what the app does.

| | iOS | Android |
|---|---|---|
| Screen doesn't sleep while a round is running, left untouched past the OS timeout | ✅ | ✅ |
| Pausing releases it — the screen sleeps normally again | 🟡 **[D11](#d11)** accepted for 1.1.4 | 🟡 **[D11](#d11)** accepted for 1.1.4 |
| Stopping/resetting releases it too | 🟡 **[D11](#d11)** accepted for 1.1.4 | 🟡 **[D11](#d11)** accepted for 1.1.4 |
| With a round **running**, leave the timer screen for Settings — the screen should still stay awake (the round is still going), and start sleeping again once you pause from there | ✅ | ✅ |

---

## Open defects

One entry per defect, numbered in the order they were found, kept after they're fixed so the
reasoning survives.

| | Found in | State |
|---|---|---|
| [D1](#d1) Paywall price missing | iOS pass 1 | ✅ fixed, confirmed |
| [D2](#d2) Sheet unusable with keyboard up | iOS pass 1 | ✅ fixed, confirmed |
| [D3](#d3) Backgrounded expiry advanced one level only | iOS pass 1 | ✅ fixed, confirmed both platforms |
| [D4](#d4) Live Activity buttons corrupted the timer | iOS pass 1 | ✅ descoped, confirmed |
| [D5](#d5) Done bar only on the second keypad open | iOS pass 2 | ✅ fixed, confirmed |
| [D6](#d6) Scrolling the sheet dismissed the keypad | iOS pass 2 | ✅ fixed for the sheet; the editor is [D10](#d10) |
| [D7](#d7) Blinds too small on the Live Activity | iOS pass 2 | ✅ fixed, confirmed both platforms |
| [D8](#d8) Android never scrolls a focused field clear of the keypad | pass 3 (Android) | ✅ fixed, confirmed |
| [D9](#d9) Done bar looks bolted onto the keyboard | pass 3 (iOS) | ✅ fixed, confirmed |
| [D10](#d10) Blind editor drops the keypad on scroll | pass 3 (both) | ✅ fixed, confirmed both platforms |
| [D11](#d11) Keep-awake never released on pause/stop | pass 3 (both) | 🔧 **still open** — first fix didn't take, re-worked |
| [D12](#d12) Rounds under 10s silently rewritten | pass 3 (Android) | ✅ fixed, confirmed both platforms |
| [D13](#d13) Done button floats in the gap above a sheet's keypad | pass 6 (iOS) | ✅ fixed, confirmed |
| [D14](#d14) Keypad covers a sheet's footer buttons on Android | pass 6 (Android) | ✅ fixed, confirmed |

<a id="d1"></a>
### D1 · Paywall shows "one-time" with no price · §1

The Unlock button reads `Unlock Pro · one-time` — the localized price is missing entirely. The
purchase itself works, so the RevenueCat offering does resolve when the button is tapped; only the
price shown *before* that is absent. `PremiumContext` fetches `getProPriceString()` exactly once on
mount and `revenueCatProvider.getProPriceString()` swallows every failure as `null`, with no retry
and nothing logged — so a fetch that loses the race with SDK configuration or a cold network leaves
the paywall permanently priceless for that launch. The fallback string is also wrong on its own
terms: "one-time" alone isn't a price.

**Fixed, then found to be untestable as configured.** The code fix stands: refetched on every sheet
open, failures logged rather than swallowed, price-less fallback now plain "Unlock Pro". But the
re-test came back "can't see a price in local development at all" — because `FORCE_FREE_IN_DEV` was
on, and both it and `FORCE_PRO_IN_DEV` skipped the price fetch along with the entitlement check.
That's backwards: forcing the free experience exists precisely to *look at* the paywall on a device
whose account already owns Pro, and a paywall with no price is not the paywall. The price is a
read-only store lookup that grants nothing, so it now runs regardless of either flag; only the
entitlement is forced. **Confirmed on both platforms** — a real price renders locally, no TestFlight
needed, which is worth remembering the next time a missing price looks like a store problem.

<a id="d2"></a>
### D2 · Generator sheet is unusable with the keyboard up · §5

Focusing a number field pushes the sheet up but nothing re-measures: the content is taller than
what's left above the keyboard, the sheet's `ScrollView` doesn't scroll (its `maxHeight` is still
computed from the *full* window height, so it doesn't believe it's overflowing), and the numeric
keypad has no Return key — so the only way to dismiss it is to tap some other part of the screen.
Android was fixed for this release by tracking the keyboard height directly (`Sheet.tsx`
`androidKeyboardHeight`); iOS was left on `KeyboardAvoidingView behavior="padding"`, which moves the
sheet without shrinking the scroll region.

**Fixed** — one keyboard path for both platforms, and the scroll cap is now the space left above
the keyboard minus measured chrome. The sheet itself resizes and scrolls correctly on device. The
two things the re-test caught are about the keypad rather than the sheet, and are written up as
[D5](#d5) and [D6](#d6).

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

**Resolved by fixing the rule, not by catching up** — nothing counts rounds while the app isn't
running, so exactly one level advances however long you were away, and the alert now says when
more time passed than that. A foregrounded expiry also always shows the alert now (the alarm
sound loading was gating the alert itself, which produced a silent advance). Separately, the app
had no keep-awake at all, so the phone locked itself into this path during the first level of
every tournament — the screen is now held on while a round runs.

**Re-test:** one round backgrounded, then two-plus rounds backgrounded, then the same with the app
force-quit. Also confirm the screen no longer sleeps mid-round, and that it *does* sleep once
paused.

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
is the most intricate code in the app.

**Descoped** — the buttons are removed on both platforms and both surfaces stay display-only, which
is what each shipped as before this release, so nothing regresses for users. The likeliest
mechanism (unproven) is that WidgetKit never re-renders the Lock Screen view as the countdown runs,
so `paused || isExpired` — which decides what the button does — was evaluated while the round was
still running; after expiry the button still read "Pause", and pausing a negative remaining stores
`max(0, remaining)` = 0. See ROADMAP.md for the full rationale and what to check first if the
buttons are ever revisited.

**Re-test:** confirm no buttons appear on either surface, that both show the right level and time,
and that the "open the app" caption is there and not clipped.

<a id="d5"></a>
### D5 · The Done bar only appears the second time you open the keypad · §5

"Really flaky and ugly, only appears after opening the number pad for the second time."

Not flaky — ordered, which is worse to debug. The `InputAccessoryView` was rendered only while the
field was `focused`, and UIKit attaches an accessory when the keyboard is **presented**. On the
first focus the view doesn't exist yet, so the keypad comes up bare; the render that adds it happens
immediately after, and by the second focus it's still mounted, so it works from then on.

**Is there a native way to hide the keypad instead?** No — `number-pad` has no Return key, and iOS
offers no built-in dismiss for it. `inputAccessoryView` *is* UIKit's own answer, and the toolbar
Apple's own apps put above numeric fields is exactly this. The remaining choice is a different
keyboard: `numbers-and-punctuation` has a Return key, but trades the big keypad for cramped keys to
enter a number with. The bar is the right mechanism; it was just built wrong.

**Fixed** — the accessory renders unconditionally, so it exists before the keypad is ever presented.
It's also restyled to UIKit's own toolbar proportions (44pt, hairline separator, single right-aligned
action at 17pt) and the keypad is now `keyboardAppearance="dark"`, so a dark bar sits under a dark
keyboard instead of a dark bar under a light one — which is most of what read as "ugly".

Kept per-field rather than one shared bar at the root: it costs a few offscreen views on a
field-heavy screen, and it guarantees the accessory is in the same React tree, and on iOS the same
`UIWindow`, as its input — including inside a `Modal`, where a root-mounted one would have to
resolve across windows.

<a id="d6"></a>
### D6 · Scrolling the sheet dismissed the keypad · §5

"When I try to scroll, immediately the num pad disappears. This is not good UX."

Self-inflicted, by `keyboardDismissMode="on-drag"` added with the D2 fix.

**What good apps do here:** the mode is right for scrolling *content* — Messages, Mail's message
list — where the keyboard is incidental to what you're reading, so getting rid of it by flicking is
what you want. A **form** behaves the opposite way: the fields above and below the one you're in are
the reason you're scrolling, so iOS form sheets keep the keyboard up and offer an explicit Done
(which is what [D5](#d5)'s bar is). `on-drag` meant the content jumped, the field being edited moved
under your finger, and reaching the next field cost two gestures instead of one.

**Fixed** — `keyboardDismissMode="none"`. Dismissal comes from the Done bar, tapping outside, and
dragging the grabber (which already calls `Keyboard.dismiss()`). **Confirmed for the sheet on both
platforms.** The blind editor carried the same prop separately and was missed — that's [D10](#d10).

<a id="d7"></a>
### D7 · Blinds are too small on the Live Activity · §6

"Maybe the blind levels show a bit small. It's one of the most important features of this app, so it
can be shown a bit bigger. Also because there is space left in the live activity."

Agreed, and the space is there because the descoped buttons vacated a row. The blinds are what a
player actually reads off a lock screen — the countdown only says when to look again — and at
`.subheadline` against a `.title2` timer they were losing that contest.

**Fixed** — current blinds go to `.title2` bold monospaced, matching the timer's weight, with the
next level a clear step below at `.caption`. Both get `lineLimit(1)` + a minimum scale factor so a
late-structure `5000/10000` shrinks itself rather than wrapping or squeezing the timer. Android's
expanded notification got the same treatment (15sp → 22sp, 12sp → 13sp) to keep the two surfaces
matched. **Confirmed on both platforms.**

<a id="d8"></a>
### D8 · Android never scrolls a focused field clear of the keypad · §5

"When the input field is at the bottom of the screen and the numpad appears, the numpad is over the
input field so the input field is not visible anymore. In all locations."

Android used to get this for free: `android:windowSoftInputMode="adjustResize"` shrank the window,
the native ScrollView shrank with it, and Android's own focus handling scrolled the field back into
view. **Edge-to-edge ended that.** Android 15 (API 35) makes edge-to-edge mandatory and `adjustResize`
a no-op alongside it — the window keeps its full height and the keyboard arrives as an inset the app
is expected to consume. Nothing consumed it, so the field ended up under the keypad with no way to
reach it: no room below to scroll into, and nothing asking the list to scroll either. Same root cause
`Sheet.tsx` already worked around inside its own modal window; the app's two main scrollers never
got the same treatment.

**Fixed** — a shared `useKeyboardFocusScroll` hook does both halves the platform stopped doing: it
returns the keyboard inset to pad the scroller with (so the bottom-most field has somewhere to scroll
to) and scrolls the currently-focused input up by however much the keypad covers it, plus 24pt. Wired
into Settings and the blind editor. Android-only — iOS's `automaticallyAdjustKeyboardInsets` already
does both, and its column passes. The visible-bottom maths is lifted from `useKeyboardNudge`,
including its two hard-won corrections (Android's keyboard height excludes the navigation bar; its
`measureInWindow` frame excludes the status bar while `Dimensions.height` includes it).

**Re-test on Android:** round duration in Settings on a short screen, the last row of a 30-level
blind schedule, and the generator sheet — the field should end up above the keypad every time.

<a id="d9"></a>
### D9 · The Done bar looks bolted onto the keyboard · §5

"Really ugly UI, because the numpad has border radius and the done bar is a vertical block, so there
is some spacing in between."

The keyboard is a rounded, inset panel on current iOS. A full-width opaque strip pinned above it
can't line its square corners up with that, so the two read as unrelated slabs with a gap between
them — and no radius guessed here would track a shape the OS is free to change.

**Fixed** by not competing with it: the bar is transparent (it's only positioning now) and the action
is a rounded pill floating above the keypad, right-aligned. Nothing has an edge that can disagree
with the keyboard's, and it matches how iOS's own floating keyboard accessories look.

<a id="d10"></a>
### D10 · The blind editor drops the keypad on scroll · §5, both platforms

"Only doesn't work on the blind structure page when changing a small or big blind. In that case the
numpad disappears completely."

[D6](#d6) fixed the sheet by moving it off `keyboardDismissMode="on-drag"`. The blind editor's
`FlatList` had the same prop, set separately and long before, so it kept the old behaviour — and it's
the worst place for it, since checking the level above or below the one you're editing is the whole
reason to scroll a schedule.

**Fixed** — `"none"` there too, for the reason [D6](#d6) sets out. Both platforms.

<a id="d11"></a>
### D11 · Keep-awake never released on pause or stop · §10, both platforms

"Doesn't go to sleep, or maybe my iPhone settings are wrong." Then, after the first fix: "nope, stays
awake. Can it be because of Expo?"

**It isn't Expo.** `expo-keep-awake` is the only thing in the entire dependency tree that touches
`isIdleTimerDisabled` (iOS) or `FLAG_KEEP_SCREEN_ON` (Android) — grepped across `node_modules`, and
neither `expo-dev-client` nor the dev launcher holds a lock of its own. Both native implementations
are symmetric and correct: a tag set, with the flag cleared as soon as it empties.

**First fix (didn't take).** Acquire is async and release was fired independently in the effect
cleanup, so a quick pause could release a lock that hadn't finished being taken; the acquire then
landed after it and pinned the screen on with nothing left to turn it off. Chaining each release onto
its own acquire fixed *that* ordering — and the symptom survived it.

**Second fix.** The chaining only ordered each release against its own acquire, not against
*everything else in flight*. The native side is a tag set, not a counter, so whichever call lands
last wins outright, and pause/resume/pause can still interleave two chains. All transitions now go
through one module-level queue that reconciles to the latest desired state, with at most one call in
flight — the class of bug is gone by construction rather than by being one step ahead of it. Both
calls also log now, so the next pass can say definitively whether the release ran.

**Accepted for 1.1.4 (2026-08-19)** — not held for. The blast radius is small: this only applies
while the app is in the *foreground* and paused. `expo-keep-awake` releases the lock natively when
the app is backgrounded, so a phone that's pocketed or locked still sleeps normally; what's left is a
paused timer sitting face-up on a table keeping the screen lit. The re-worked fix ships in this
release either way — untested, so treat §10's two rows as unknown rather than fixed, and re-check
them on the first TestFlight/internal build.

**When re-testing, rule out the phone.** Releasing the lock doesn't wake anything up: it re-arms
the OS idle timer *from that moment*. So the screen sleeps one full auto-lock interval after you
pause — on a 5-minute setting that's five minutes of looking at a lit screen, and on *Never* it
never sleeps no matter what the app does. Set iOS *Settings → Display & Brightness → Auto-Lock →
30 Seconds* or Android *Settings → Display → Screen timeout → 30 seconds* first, then pause and wait
past the interval. If it still doesn't sleep, the Metro log will show whether
`keep-awake: releasing screen lock` was reached, which splits app-bug from OS-behaviour in one line.

<a id="d12"></a>
### D12 · Rounds shorter than 10 seconds were silently rewritten · §4

"It's not possible to set a timer less than 10 seconds. I am able to fill in 5 and when I get back it
shows 10."

`MIN_ROUND_DURATION_SECONDS` was 10 and `clampRoundDuration` applied it without saying anything, so
the field accepted 5 and the stored value came back 10. A rule the UI never states, applied silently
after the fact, reads as a broken field.

**Fixed** — the floor is 1 second. Zero stays excluded: a zero-length round has no meaningful expiry
and divides by zero in the missed-round maths. Two core tests pin the new behaviour (a 5-second round
survives; 0 still clamps up).

<a id="d13"></a>
### D13 · Done floats in the gap between a sheet and the keypad · §5

"When generating a new structure and opening the num pad, the done button floats between the num pad
and the modal. This is really ugly."

Caused by [D9](#d9)'s own fix, and only visible in a sheet. The accessory view is attached to the
*keyboard*, and a sheet is lifted to sit on top of the keyboard — so the accessory occupies the band
between the two. On a full screen that's fine: the app's own background is behind it and the stack
reads as one surface. Over a sheet's dimmed backdrop it isn't — D9 made the bar transparent
specifically so it couldn't clash with the keyboard's rounded corners, and transparency is exactly
what turns that band into a visible gap with a control floating in it, belonging to neither surface.

Making the bar opaque again just reinstates D9.

**Fixed by moving the control instead of restyling it.** A new `InsideSheetContext` lets
`NumberField` tell whether it's inside a `Sheet`; if it is, it renders no accessory at all, and the
sheet puts **Done** in its own title row while the keypad is up. There's then nothing in the gap
because there's no gap — with no accessory, the sheet sits directly on the keypad. Full-screen
fields (blind editor, Settings) keep the accessory, which is the right affordance there.

The context lives in its own module rather than in `Sheet.tsx`, so a leaf primitive can ask the
question without importing a component that carries a Modal, a PanResponder and an animation.

**Re-test:** the generator sheet on both platforms — Done sits in the sheet's header next to
"Generate structure", the sheet's bottom edge meets the keypad with no band between them, and
tapping Done dismisses the keypad without closing the sheet. Then a full-screen number field (blind
editor) to confirm the accessory is still there and still appears on the first open.

<a id="d14"></a>
### D14 · The keypad covers a sheet's footer buttons on Android · §5

"The numpad when opening from generate structure now blocks the cancel and replace structure
buttons."

The sheet lifts itself clear of the keyboard by the height the platform reports — and **Android
reports the IME height excluding the navigation bar**. So the sheet was lifted a navigation bar
short, and the footer, being the part closest to the bottom edge, is the part that went under.
Compounding it, the bottom safe-area inset was dropped from the sheet's padding while the keyboard
was up, which is right on iOS (the keyboard covers the home indicator) and wrong on Android, where
it had been the only thing masking the shortfall.

This is a *measured* quantity in this codebase, not a guess: `useKeyboardNudge` recorded a 640dp
window with a 275dp keyboard where content was actually cut off at 342.5dp — the missing 22.5dp
being the nav bar. The sheet simply never used that correction.

**Fixed** — one `coveredByKeyboard` value, `keyboard + bottom inset` on Android and the raw height on
iOS (where it already spans the home indicator), feeding both the sheet's offset and the scroll cap.
The same formula `useKeyboardNudge` derives, rather than a second one to drift from it.

**Re-test on Android specifically**, and on a device with **3-button navigation** if you have one —
its nav bar is roughly twice a gesture bar's, so it's where a shortfall shows up worst. Open the
generator, focus a number field, and confirm both footer buttons are fully tappable, then that the
sheet's top hasn't been pushed off-screen in the process.

---

## Known-and-accepted — do not file these

- **iPad mini uses the phone layout** — 744pt is under the 768 threshold, deliberate.
- **`uuid` advisory (moderate)** — `xcode@3.0.1` hard-requires `^7.0.3`; no in-range fix exists.
  Build tooling only, unreachable from app code.
- **Neither the Live Activity nor the Android notification can advance the blind level on its own**
  — they have no notion of blind levels, and on iOS nothing of the app's runs while backgrounded.
  Exactly one level advances when the app is reopened, however long it was away. Deliberate as of
  1.1.4; both surfaces carry a caption saying so.
- **Simulator Live Activity flakiness** — `Failed to start Live Activity` in the Simulator is
  environmental, not app code.
- **A paused round can leave the screen lit while the app is foregrounded** ([D11](#d11)) — accepted
  for 1.1.4. Backgrounding still releases the lock natively, so this doesn't drain a pocketed phone.
- **The generator sheet is full-bleed at tablet width on both platforms** — `Sheet.tsx` never had
  tablet-cap logic, so this predates 1.1.4 rather than regressing in it. Accepted for this release.
