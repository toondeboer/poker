# Manual test checklist

What a human runs before a release ships. **This is the app's only end-to-end coverage** — the
Maestro suite was removed deliberately (see below), so nothing in this file is covered by a machine.

**Where the line sits.** Everything that is *logic* lives in `@poker/core` and is unit-tested there
at ~99% coverage, enforced by a threshold in CI: blind maths, the generator's chip ladder, schedule
diffing, timer state, persistence and its corrupt/unavailable-storage fallbacks. If a rule about
*what the numbers should be* is broken, a unit test should catch it and this checklist shouldn't
need to. What's left for a human is what unit tests structurally cannot see:

- **Does it render where it should** — safe areas, keyboard overlap, tablet width. A test can assert
  an element exists while it sits off-screen; that exact false pass happened with a native form
  sheet, whose content was in the view hierarchy and outside the sheet frame.
- **Real platform behaviour** — notifications, Live Activities, the foreground service, deep links,
  screen-wake, cold launch.
- **Real purchases.** Play Billing can't be exercised from a local build at all.

**Why there is no automated e2e.** A Maestro suite existed and was deleted in 1.1.5. It cost a
~20-minute Android CI job (a cold Gradle build dominated it, not the flows), and it had rotted while
unwired — a hardcoded LAN address and stale selectors. The judgement was that a fast CI plus an
honest manual pass beats a slow CI plus flows nobody trusts. **If you reintroduce it, cache Gradle
and gate it behind a label** — the flows themselves were never the expensive part.

**This file is a template, not a record.** Rows are reset to ⬜ when a release is cut; what actually
shipped is in [CHANGELOG.md](./CHANGELOG.md) and past results are in git history. Fill the results in
as you run each pass, and log the passes under [Passes run](#passes-run) so the next reader knows what
hardware the ✅s came from.

Mark the platform column you actually ran. **iOS and Android are not interchangeable** for anything
touching notifications, billing, or the keyboard — those are the paths that differ most.

**Legend** — every state is an icon, so scanning a column tells you where things stand.

**Done, nothing to do**

| | |
|---|---|
| ✅ | passed, checked by hand on a real device |
| ➖ | doesn't apply on this platform |

**Decided — shipping as-is**

| | |
|---|---|
| 🟡 | known gap, **accepted for this release** and deliberately not held for |

**Needs attention**

| | |
|---|---|
| ❌ | **broken** — write it up under [Open defects](#open-defects) |
| 🔧 | broken, **fixed in code**, waiting on a re-test to become ✅ |
| ⬜ | not run yet |
| 🚫 | **blocked** — can't be exercised from a local build, needs TestFlight or Play internal testing |

A fix landing never upgrades a row on its own: ❌ becomes 🔧, and only a re-test on hardware makes it
✅. Anything left as ❌ 🔧 ⬜ 🚫 still wants a human; 🟡 has already been ruled on.

<a id="passes-run"></a>
**Passes run**

1. **Android** — `Android_small` emulator, API 35, 30s screen timeout. §10 keep-awake: holding,
   pause-releases and reset-releases all verified against the window flag and `mWakefulness`.
   iOS not covered: the Simulator has no auto-lock, so §10 needs a real device there.

---

## 0. Before you start

- [⬜] **Rebuild the dev client on both platforms if any native dependency moved.** A dev client
      ships compiled native modules and Metro only replaces the JS, so a bumped native package
      red-screens at runtime with nothing at build time to warn you (1.1.4's
      `react-native-purchases` 10.4.0 → 10.4.4 did exactly this). `npm run pods -w @poker/mobile`,
      then `npm run ios` / `npm run android`.
- [⬜] If the app behaves strangely in ways that don't match the code, check
      `pgrep -fl GradleDaemon` — VS Code's Java extension replants the broken expo shims.
      `node apps/mobile/scripts/clean-expo-shims.js` fixes it; lint/typecheck now self-heal.

---

## 1. Billing — the highest risk in any release · **blocks submission**

Nothing in development can exercise this fully: the Android emulator has no Play Billing
(`BILLING_UNAVAILABLE`) and the Simulator has no StoreKit configured. Needs a real device with a
sandbox/test account, and for Android, a build uploaded to a Play track.

| | iOS | Android |
|---|---|---|
| Paywall opens from all three entry points (Pro card, Presets, Sound Pack) | ⬜ | ⬜ |
| Price string renders (not blank, not `one-time` alone) | ⬜ | ⬜ |
| **Purchase completes** and Pro unlocks (ads gone, Presets + Sound Pack usable) | ⬜ | 🚫 [see below](#android-billing) |
| **Restore purchases** works on a fresh install of the same account | ⬜ | 🚫 [see below](#android-billing) |
| Cancelling a purchase leaves the app in a sane state, no error toast | ⬜ | 🚫 [see below](#android-billing) |

> Set `FORCE_PRO_IN_DEV`/`FORCE_FREE_IN_DEV` in `PremiumContext.tsx` to exercise the *gated UI*
> without buying — but that does **not** test billing itself. Both flags leave the **price** fetch
> alone, so the paywall still shows a real price under either. Worth remembering the next time a
> missing price looks like a store problem: it's a read-only lookup that grants nothing, and it
> works locally.

<a id="android-billing"></a>
> **Why Android's purchase rows can't be done locally.** Play Billing only talks to an app the Play
> Store itself recognises: the package must be uploaded to a Play Console track (internal testing is
> enough), signed with the same key, and the tester's account added to the licence-testing list. A
> locally-built debug APK fails all three, which is why it returns `BILLING_UNAVAILABLE` rather than
> a purchase sheet. **These three rows therefore move to the internal-testing pass, after the build
> is uploaded** — they are not blocked on any code change. iOS is the mirror image: StoreKit sandbox
> works against a local device build, which is why its column can be cleared earlier.

---

## 2. Blind structure editor

Tablet layout is covered separately in §7.

| | iOS | Android |
|---|---|---|
| Settings scrolls as one page — no scroll island | ⬜ | ⬜ |
| Blind structure row shows correct count + range, opens the editor | ⬜ | ⬜ |
| 30 rows scroll smoothly; inputs editable | ⬜ | ⬜ |
| Clearing a blind field shows **empty**, not `0`; blur restores the old value | ⬜ | ⬜ |
| `+` → Insert below / Duplicate, at top, middle and end | ⬜ | ⬜ |
| Delete down to 2 levels → trash buttons disable | ⬜ | ⬜ |
| Sticky footer appears only when dirty | ⬜ | ⬜ |
| **Discard** restores the active values | ⬜ | ⬜ |
| **Apply mid-tournament keeps your level** (start Level 12, edit, apply → still 12) | ⬜ | ⬜ |
| Apply a schedule **shorter** than the current level → warning shown, lands on last level, **timer does not crash** | ⬜ | ⬜ |
| Tap-to-jump: confirm → timer *and* notification/Live Activity both follow | ⬜ | ⬜ |
| Jump chip is **inert** while the draft is dirty | ⬜ | ⬜ |
| Back with unapplied edits → Apply / Discard / Keep editing | ⬜ | ⬜ |
| …via **hardware back** (Android) and **swipe-back** (iOS) | ⬜ | ⬜ |
| Kill the app with a dirty draft → relaunch → draft and footer still there | ⬜ | ⬜ |

---

## 3. Generator

| | iOS | Android |
|---|---|---|
| Slow / Standard / Turbo produce **visibly different** schedules | ⬜ | ⬜ |
| Smallest chip 5, start 5 → `5/10 10/20 15/30 20/40…`, **never 6/12** | ⬜ | ⬜ |
| Chip 25, start 25 → matches a real casino sheet (`25/50 50/100 75/150 100/200…`) | ⬜ | ⬜ |
| Chip seeds itself from the structure you're editing | ⬜ | ⬜ |
| Sheet reaches the bottom edge — **no see-through strip** below it | ⬜ | ⬜ |
| "Replace structure" fits on **one line** with its icon | ⬜ | ⬜ |
| Replace writes the draft only; active schedule unchanged until Apply | ⬜ | ⬜ |

---

## 4. Round duration

| | iOS | Android |
|---|---|---|
| mm:ss commits on blur — no Save button needed | ⬜ | ⬜ |
| Type `12`/`30`, back out → next round is 12:30 | ⬜ | ⬜ |
| Changing it **mid-round leaves the running round's remaining time alone** | ⬜ | ⬜ |
| A round shorter than 10s is **kept**, not silently rewritten (type `5`, leave, come back → still 5) | ⬜ | ⬜ |
| Seconds field caps at 59, and the field shows the clamped value after blur | ⬜ | ⬜ |

---

## 5. Keyboard behaviour

The most-regressed area in this app: Android's edge-to-edge requirement means nothing here comes for
free, and a `Modal`'s own window measures differently again. Re-check it whenever a sheet, a scroller
or a number field is touched.

| | iOS | Android |
|---|---|---|
| Focus the preset-name field → **Save Preset is fully visible** above the keyboard | ⬜ | ⬜ |
| No dead space / over-scroll after the nudge — clearance matches `BREATHING_ROOM = 24` | ⬜ | ⬜ |
| Same on a **small** phone (iPhone SE class / 720×1280) | ⬜ | ⬜ |
| **Any** focused field stays visible when the keypad opens — Settings, blind editor, sheet | ⬜ | ⬜ |
| Number fields show a **Done** bar above the keypad (iOS), on the **first** open | ⬜ | ➖ |
| …and it doesn't look bolted on next to the keyboard's rounded edge | ⬜ | ➖ |
| In a **sheet**, the Done control belongs to the sheet — nothing floating in the gap above the keypad | ⬜ | ⬜ |
| A sheet's **footer buttons stay tappable** with the keypad up (generator: Cancel + Replace structure) | ⬜ | ⬜ — check on **3-button navigation** if you have it; its nav bar is roughly twice a gesture bar's, and Android reports the IME height *excluding* it, so a shortfall shows up worst there |
| Scrolling **keeps the keypad up** — generator sheet | ⬜ | ⬜ |
| Scrolling **keeps the keypad up** — blind structure editor | ⬜ | ⬜ |
| Generator sheet fields usable with the keyboard up — sheet resizes *and* scrolls, top not pushed off-screen | ⬜ | ⬜ |

---

## 6. Notifications & Live Activity

| | iOS | Android |
|---|---|---|
| Round expiry fires the alert + alarm with the app **foregrounded** | ⬜ | ⬜ |
| Expiry while **backgrounded** advances **exactly one** level, and says so if more time passed | ⬜ | ⬜ (automation blocked, see below — needs a hand pass) |
| Live Activity / notification show the right level + time, and the "open the app" caption | ⬜ | ⬜ |
| Blinds are the most prominent thing on it, after the countdown | ⬜ | ⬜ |
| After a level jump, the pending "time's up" notification names the **new** next blind | ⬜ | ➖ |
| Notification survives swipe-away from Recents — start a round, swipe the app out of the app switcher, and the timer notification keeps counting down instead of vanishing with it | ➖ | ⬜ |

> **Backgrounded-expiry automation blocker:** `adb shell input keyevent KEYCODE_HOME` reliably
> brings Expo's own `DevLauncherActivity` back on top of the task stack on a dev-client build
> (confirmed via `logcat` — a `DevLauncherActivity` window becomes visible right after Home is
> pressed), so resuming afterward shows the dev-launcher picker rather than the real app state.
> That's dev-client tooling noise, not present in a release build, so not a real app bug — but it
> means this specific row can't be reliably automated against this build type. Needs either a
> release-configuration build or a real device/manual pass.

---

## 7. Tablets

`isTablet` is `width > 768`. **iPad mini (744pt) deliberately gets the phone layout** — that's
expected, not a bug.

| | iPad | Android tablet |
|---|---|---|
| Settings: Tournament + Presets **side by side**, capped and centred | ⬜ | ⬜ |
| Blind editor list + sticky footer capped at 900 and centred | ⬜ | ⬜ |
| Timer card centred, not full-bleed | ⬜ | ⬜ |
| Generator sheet sensible at tablet width | 🟡 accepted — `Sheet.tsx` has no tablet-cap logic at all, so it's full-bleed on both platforms (see ROADMAP.md) | 🟡 |
| iPad **mini** still gets the phone layout | ⬜ | ➖ |

---

## 8. Small phones

| | iOS | Android |
|---|---|---|
| Timer fits with no scrolling, nothing clipped | ⬜ | ⬜ |
| Settings cards readable, no overlap | ⬜ | ⬜ |
| Blind rows: level chip, LIVE badge and both buttons all fit | ⬜ | ⬜ |

---

## 9. Cold launch

| | iOS | Android |
|---|---|---|
| Launch → no visible resize before the timer appears | ⬜ | ⬜ |
| Deep link straight to `pokerkit://settings` and `pokerkit://blinds` → splash lifts **immediately**, not after 4s | 🚫 | 🚫 |

> **Why the deep-link row is 🚫:** same root cause as §6's blocker. `adb shell am start -W -a
> android.intent.action.VIEW -d "pokerkit://blinds" com.toondeboer.pokerkit` on a fully force-stopped
> process reports `LaunchState: COLD` / `Activity: ...DevLauncherActivity` — the deep link resolves
> to Expo's dev-launcher picker, not `MainActivity`, because the dev launcher owns the URL scheme.
> `DevLauncherActivity` doesn't exist in a release build, so this row is untestable against
> dev-client tooling by construction. Needs the TestFlight / Play internal build.

---

## 10. Screen stays awake

The screen is held on while a round counts down, and released on pause/stop. **The releasing half
has never been verified on hardware** — see the keep-awake carry-over at the top of
[ROADMAP.md](./ROADMAP.md#carried-over-from-114--needs-verification) for what shipped untested and
why it was accepted.

**Before testing, check the device isn't the reason.** Set a short auto-lock — iOS
*Settings → Display & Brightness → Auto-Lock → 30 Seconds* (it must not be *Never*), Android
*Settings → Display → Screen timeout → 30 seconds*. A phone set to never sleep will fail every row
here no matter what the app does. If a row still fails, the Metro log shows whether
`keep-awake: releasing screen lock` was reached, which splits an app bug from OS behaviour in one
line.

**Check the window flag, not just your eyes.** `adb shell dumpsys window | grep -c 'fl=KEEP_SCREEN_ON'`
is 1 while the lock is held and 0 once it's released, which answers the question in one line and
doesn't need you to sit and watch a screen for a whole auto-lock interval. Confirm the sleep itself
with `adb shell dumpsys power | grep mWakefulness` (`Awake` / `Asleep`). **Read it from a known
baseline** — force-stop, relaunch, and check the flag is 0 *before* starting a round. A relaunch can
restore a running tournament and re-acquire the lock on its own, which makes the next Start/Pause tap
land the opposite way round and reads exactly like a broken release.

| | iOS | Android |
|---|---|---|
| Screen doesn't sleep while a round is running, left untouched past the OS timeout | ⬜ | ✅ |
| Pausing releases it — the screen sleeps normally again | ⬜ **never verified** | ✅ |
| Stopping/resetting releases it too | ⬜ **never verified** | ✅ |
| With a round **running**, leave the timer screen for Settings — the screen should still stay awake (the round is still going), and start sleeping again once you pause from there | ⬜ | ⬜ |

---

## Open defects

One entry per defect found this cycle, numbered in the order they were found (D1, D2, …), with an
anchor so the rows above can link to it. Keep an entry after it's fixed so the reasoning survives the
release; the whole section is cleared when the release ships, since by then the fix is in the
changelog and the reasoning is in the commit.

| | Found in | State |
|---|---|---|
| _(none open)_ | | |

---

## Known-and-accepted — do not file these

- **iPad mini uses the phone layout** — 744pt is under the 768 threshold, deliberate.
- **The generator sheet is full-bleed at tablet width on both platforms** — `Sheet.tsx` never had
  tablet-cap logic, so it predates 1.1.4 rather than regressing in it.
- **`uuid` advisory (moderate)** — `xcode@3.0.1` hard-requires `^7.0.3`; no in-range fix exists.
  Build tooling only, unreachable from app code.
- **Neither the Live Activity nor the Android notification can advance the blind level on its own**
  — they have no notion of blind levels, and on iOS nothing of the app's runs while backgrounded.
  Exactly one level advances when the app is reopened, however long it was away. Deliberate; both
  surfaces carry a caption saying so.
- **The Live Activity and the notification carry no Pause/Resume/Stop buttons** — built, then
  descoped before ever shipping. Both surfaces are display-only by design (see ROADMAP.md).
- **Simulator Live Activity flakiness** — `Failed to start Live Activity` in the Simulator is
  environmental, not app code.
- **A Pro user whose entitlement resolves late sees the reserved ad band collapse once at launch.**
  The banner slot reserves its height from the first layout pass, keyed on `isPremium` (which starts
  `false`) rather than the full `shouldShowAds` policy — gating it on the async `consentResolved`
  would reintroduce a 0 → full-height jump for every free user, which is the far more common case.
- **The floating gear icon in the corner of a dev-client build** is Expo's own dev-menu trigger, not
  app UI. It never ships in a release build.
