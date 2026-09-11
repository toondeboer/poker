# Manual test checklist

What a human runs before a release ships. **This is the app's only end-to-end coverage** — the
Maestro suite was removed deliberately (see below), so nothing in this file is covered by a machine.

**Where the line sits.** Everything that is _logic_ lives in `@poker/core` and is unit-tested there
at ~99% coverage, enforced by a threshold in CI: blind maths, the generator's chip ladder, schedule
diffing, timer state, persistence and its corrupt/unavailable-storage fallbacks. If a rule about
_what the numbers should be_ is broken, a unit test should catch it and this checklist shouldn't
need to. What's left for a human is what unit tests structurally cannot see:

- **Does it render where it should** — safe areas, keyboard overlap, tablet width. A test can assert
  an element exists while it sits off-screen; that exact false pass happened with a native form
  sheet, whose content was in the view hierarchy and outside the sheet frame.
- **Real platform behaviour** — notifications, Live Activities, the foreground service, deep links,
  screen-wake, cold launch.
- **Real purchases.** Play Billing can't be exercised from a local build at all.

**Why there is no automated e2e.** A Maestro suite existed and was deleted in 1.2.0. It had rotted
while unwired — a hardcoded LAN address and stale selectors, no npm script and no CI job — and
wiring it up would have cost a ~20-minute Android job per PR, dominated by a cold Gradle build
rather than the flows. The judgement was that a fast CI plus an
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

|     |                                          |
| --- | ---------------------------------------- |
| ✅  | passed, checked by hand on a real device |
| ➖  | doesn't apply on this platform           |

**Decided — shipping as-is**

|     |                                                                        |
| --- | ---------------------------------------------------------------------- |
| 🟡  | known gap, **accepted for this release** and deliberately not held for |

**Needs attention**

|     |                                                                                                |
| --- | ---------------------------------------------------------------------------------------------- |
| ❌  | **broken** — write it up under [Open defects](#open-defects)                                   |
| 🔧  | broken, **fixed in code**, waiting on a re-test to become ✅                                   |
| ⬜  | not run yet                                                                                    |
| 🚫  | **blocked** — can't be exercised from a local build, needs TestFlight or Play internal testing |

A fix landing never upgrades a row on its own: ❌ becomes 🔧, and only a re-test on hardware makes it
✅. Anything left as ❌ 🔧 ⬜ 🚫 still wants a human; 🟡 has already been ruled on.

<a id="passes-run"></a>
**Passes run**

1. **iOS Simulator** — iPhone 17 Pro, iOS 26.5, dev client. Covers the **locked/non-Pro states
   only**: both Pro pills in Settings, the Payouts and Leaderboard screens rendering their locked
   cards and unlock buttons, the paywall listing all six Pro features, and the banner ad appearing
   (so `shouldShowAds` is live). Also confirmed the end-of-game prompt produces **nothing** with Pro
   locked, driven from a temporary mount trigger rather than the reset button. A Simulator can't
   speak to billing, notifications or screen-wake, so nothing else here is claimed from it.
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
- [⬜] **Point the build at `DEV_BACKEND`, locally and uncommitted, before running any of this.**
  `backendConfig` in `apps/mobile/src/services/backendConfig.ts` now ships as **`PROD_BACKEND`**
  — it was `null` for most of 1.2.0 and this note used to say so. The consequence is the other
  way round from what it used to be: nothing is silently absent any more, and a pass run as
  checked out writes **real accounts, boards and games into the production user pool**, which
  today holds none. Test accounts are deletable from inside the app, so this is recoverable
  rather than fatal — but it is much easier not to do it.

      ```diff
      -export const backendConfig: BackendConfig | null = PROD_BACKEND;
      +export const backendConfig: BackendConfig | null = DEV_BACKEND;
      ```

      **Put both testing toggles back before the build is cut.** There are two, and checking only
      the first is how one of them ships:

      | File | Testing value | Must ship as |
      | --- | --- | --- |
      | `src/services/backendConfig.ts` | `DEV_BACKEND` | **`PROD_BACKEND`** |
      | `src/contexts/PremiumContext.tsx` | `__DEV__ && true` | `__DEV__ && false` |

      ```bash
      git status --short apps/mobile/src   # must be empty before `eas build`
      ```

      **A clean `git diff` is not proof.** These reached `release/1.2.0` once already, staged by a
      `git add -A` run while they were flipped — at which point the very check this step describes
      comes back clean because the change is committed rather than pending. `git status` on the
      working tree only catches the uncommitted case; the committed case needs the table above read
      against the branch.

- [⬜] **Run §17, the kill switch, against prod rather than dev**, since that is the one section
  whose whole point is the production stack answering. `curl https://poker-api.toondeboer.com/config`
  should say `{"accounts":true,"sharing":true}` — it did on 2026-09-04.
- [⬜] **And §15–§16 need the Club entitlement**, which nothing grants until the subscription exists
  in both stores. Until then set `FORCE_PRO_IN_DEV` in `PremiumContext.tsx`, which forces Pro
  **and** Club. Without it the share button and join field are simply not there, which reads
  exactly like sync being broken.
- [⬜] **§15 needs two devices**, and a third for the "boards follow the account" row. One phone
  cannot see any of the failures worth finding.

---

## Running the pass: what needs what

~170 rows, each wanting both platforms. Almost none of it is hard; the cost is **setup churn** —
flipping entitlements, switching backends, finding a second phone. Grouped so each setup is paid
for once.

Two switches decide what a build can see, and they are the axis everything below is sorted on:

- **`FORCE_PRO_IN_DEV`** in `PremiumContext.tsx` — forces Pro **and** Club together, from one
  literal. It is the only way to exercise either without a real purchase.
- **`backendConfig`** in `backendConfig.ts` — `DEV_BACKEND` for the pass, per §0.

**Session A — one device, both switches off.** Nothing here is entitlement-gated, so it is the
block to start with while the build is as checked out.

| §                 | Rows |
| ----------------- | ---- |
| 2. Blind editor   | 15   |
| 5. Keyboard       | 13   |
| 3. Generator      | 7    |
| 4. Round duration | 5    |
| 8. Small phones   | 4    |

Do §5 first. Its failure mode — a field under the keypad, a header behind the status bar — recurs
in §12 and elsewhere, and you will recognise it faster having just looked for it.

**Session B — a real device, both switches still off.** A simulator cannot answer these: iOS has no
auto-lock in the Simulator, and notifications do not work there.

| §                                | Rows |
| -------------------------------- | ---- |
| 6. Notifications & Live Activity | 15   |
| 10. Screen stays awake           | 4    |
| 9. Cold launch                   | 3    |

**Session C — one device, `FORCE_PRO_IN_DEV = true`.** The biggest block in the pass, and the
newest code in the release.

| §               | Rows |
| --------------- | ---- |
| 13. Deal a hand | 17   |
| 12. Leaderboard | 25   |
| 11. Payouts     | 12   |

**Session D — one device, `FORCE_PRO_IN_DEV = true`, `backendConfig = DEV_BACKEND`.**

| §               | Rows | Note                                                                  |
| --------------- | ---- | --------------------------------------------------------------------- |
| 14. Accounts    | 13   | **Never once run from the app.** Read the `email_verified` note first |
| 17. Kill switch | 4    | Run against **prod**, not dev — see §0                                |

**Session E — two devices, same switches as D.** The most expensive setup, so do it in one sitting.
A third device is wanted for the "boards follow the account" row.

| §                                    | Rows |
| ------------------------------------ | ---- |
| 15. Shared boards                    | 16   |
| 16. Club, Pro, and what each unlocks | 7    |

**Session F — blocked until the build is on a store track.** Play Billing cannot be exercised from
a local build at all, so this cannot be brought forward. It is why submission goes to the testing
track first.

| §          | Rows                    |
| ---------- | ----------------------- |
| 1. Billing | 13 (16 cells marked 🚫) |

**Session G — a tablet.** §7, 7 rows.

### The switch trap

**Some rows test the _locked_ state, and those need the switch back off.** §16 in particular asks
what a non-subscriber sees, and the whole point of the share button being hidden without Club is
that it is invisible — which `FORCE_PRO_IN_DEV = true` destroys. `FORCE_FREE_IN_DEV` exists for the
opposite case, when the store account signed into the device already owns `pro_lifetime` and you
want the ad-supported UI anyway. **Only one of the two may be true at a time.** Plan on running §16
twice, once each way, rather than discovering halfway through that every locked-state row passed
because everything was unlocked.

### Where the risk actually is

- **§11–§13 are 54 of the ~170 rows** and cover what this release invented. If time runs short,
  short-change something else.
- **§14 and §15 have never been run at all**, from any build, on any platform.
- **Android has seen almost none of this.** Several features were checked on an iOS Simulator only,
  and synthetic taps do not exist here — assume the first real Android tap finds something.
- **§1 blocks submission** and cannot start until the build is uploaded. It is the long pole, not
  the big one.

### Rows that cover a fix made on 2026-09-04

Thirteen defects were fixed on the release branch the day before this pass, **found by review
rather than by testing** — so these are rows this checklist previously let through. Worth running
deliberately rather than waiting for them to come up in sequence.

| Fix                                                | Where it shows up                                   |
| -------------------------------------------------- | --------------------------------------------------- |
| A deleted board came back on the next pull         | §12 deleting a group · §15 a board rejoined by link |
| A refused game closed the sheet and lost the entry | §12 recording a game                                |
| Renaming to a duplicate or empty name              | §12 — the rename rows already exist                 |
| A refusal notice shown on the wrong board          | §15 two boards, one refusal                         |
| Identical chip stacks split unevenly               | §11 a chop with two equal stacks                    |
| Chop sheet blank with every stack cleared          | §11 clear all stacks to 0                           |
| A half-written token signed you out silently       | §14 force-quit mid-sign-up                          |

---

## 1. Billing — the highest risk in any release · **blocks submission**

Nothing in development can exercise this fully: the Android emulator has no Play Billing
(`BILLING_UNAVAILABLE`) and the Simulator has no StoreKit configured. Needs a real device with a
sandbox/test account, and for Android, a build uploaded to a Play track.

|                                                                                                      | iOS | Android                          |
| ---------------------------------------------------------------------------------------------------- | --- | -------------------------------- |
| Paywall opens from all five entry points (Pro card, Presets, Sound Pack, Payouts, Leaderboard)       | ⬜  | ⬜                               |
| Price string renders (not blank, not `one-time` alone)                                               | ⬜  | ⬜                               |
| **Purchase completes** and Pro unlocks (ads gone, Presets, Sound Pack, Payouts + Leaderboard usable) | ⬜  | 🚫 [see below](#android-billing) |
| **Restore purchases** works on a fresh install of the same account                                   | ⬜  | 🚫 [see below](#android-billing) |
| Cancelling a purchase leaves the app in a sane state, no error toast                                 | ⬜  | 🚫 [see below](#android-billing) |

### 1b. The Club subscription · **new in 1.2.0**

A subscription is not a second one-time purchase. **It ends**, and nothing in this app has ever had
to handle something a person bought stopping working — every row below is a first.

|                                                                                                                                                                                                                      | iOS | Android                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------- |
| Both SKUs appear and are priced — monthly **and** annual. One store having only one of them is a half-shipped product                                                                                                | ⬜  | 🚫 [see below](#android-billing) |
| **Subscribing grants Pro as well.** A subscriber who never bought Pro can open the leaderboard — otherwise they are hosting a board they cannot see                                                                  | ⬜  | 🚫                               |
| **Restore brings back both**, on a fresh install of the same account — Pro and Club, not one of them                                                                                                                 | ⬜  | 🚫                               |
| Cancelling in the store leaves the app sane, and access continues to the end of the paid period                                                                                                                      | ⬜  | 🚫                               |
| **After it expires: sharing stops, and Pro does not.** Once a subscription has granted Pro it keeps it, so the boards stay visible and only hosting goes. Getting this wrong takes the sight of every board they own | ⬜  | 🚫                               |
| An expired subscriber's **existing shared boards keep working for the other members** — they are still on the server, and stranding them is worse than the cost it saves                                             | ⬜  | 🚫                               |
| Resubscribing restores hosting without anything being lost                                                                                                                                                           | ⬜  | 🚫                               |
| A Pro-only buyer is **never** told to buy Pro again by any Club message                                                                                                                                              | ⬜  | 🚫                               |

> **Expiry is the row most likely to be skipped and most likely to hurt.** Sandbox subscriptions
> renew and expire on a compressed clock — minutes rather than months on both stores — so it is
> genuinely testable in an afternoon. `entitlementsFrom` reads `entitlements.all` rather than
> `active` precisely so a lapsed subscriber keeps Pro through a reinstall; this is what proves it.

> Set `FORCE_PRO_IN_DEV`/`FORCE_FREE_IN_DEV` in `PremiumContext.tsx` to exercise the _gated UI_
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

|                                                                                                                    | iOS | Android |
| ------------------------------------------------------------------------------------------------------------------ | --- | ------- |
| Settings scrolls as one page — no scroll island                                                                    | ⬜  | ⬜      |
| Blind structure row shows correct count + range, opens the editor                                                  | ⬜  | ⬜      |
| 30 rows scroll smoothly; inputs editable                                                                           | ⬜  | ⬜      |
| Clearing a blind field shows **empty**, not `0`; blur restores the old value                                       | ⬜  | ⬜      |
| `+` → Insert below / Duplicate, at top, middle and end                                                             | ⬜  | ⬜      |
| Delete down to 2 levels → trash buttons disable                                                                    | ⬜  | ⬜      |
| Sticky footer appears only when dirty                                                                              | ⬜  | ⬜      |
| **Discard** restores the active values                                                                             | ⬜  | ⬜      |
| **Apply mid-tournament keeps your level** (start Level 12, edit, apply → still 12)                                 | ⬜  | ⬜      |
| Apply a schedule **shorter** than the current level → warning shown, lands on last level, **timer does not crash** | ⬜  | ⬜      |
| Tap-to-jump: confirm → timer _and_ notification/Live Activity both follow                                          | ⬜  | ⬜      |
| Jump chip is **inert** while the draft is dirty                                                                    | ⬜  | ⬜      |
| Back with unapplied edits → Apply / Discard / Keep editing                                                         | ⬜  | ⬜      |
| …via **hardware back** (Android) and **swipe-back** (iOS)                                                          | ⬜  | ⬜      |
| Kill the app with a dirty draft → relaunch → draft and footer still there                                          | ⬜  | ⬜      |

---

## 3. Generator

|                                                                                  | iOS | Android |
| -------------------------------------------------------------------------------- | --- | ------- |
| Slow / Standard / Turbo produce **visibly different** schedules                  | ⬜  | ⬜      |
| Smallest chip 5, start 5 → `5/10 10/20 15/30 20/40…`, **never 6/12**             | ⬜  | ⬜      |
| Chip 25, start 25 → matches a real casino sheet (`25/50 50/100 75/150 100/200…`) | ⬜  | ⬜      |
| Chip seeds itself from the structure you're editing                              | ⬜  | ⬜      |
| Sheet reaches the bottom edge — **no see-through strip** below it                | ⬜  | ⬜      |
| "Replace structure" fits on **one line** with its icon                           | ⬜  | ⬜      |
| Replace writes the draft only; active schedule unchanged until Apply             | ⬜  | ⬜      |

---

## 4. Round duration

|                                                                                                     | iOS | Android |
| --------------------------------------------------------------------------------------------------- | --- | ------- |
| mm:ss commits on blur — no Save button needed                                                       | ⬜  | ⬜      |
| Type `12`/`30`, back out → next round is 12:30                                                      | ⬜  | ⬜      |
| Changing it **mid-round leaves the running round's remaining time alone**                           | ⬜  | ⬜      |
| A round shorter than 10s is **kept**, not silently rewritten (type `5`, leave, come back → still 5) | ⬜  | ⬜      |
| Seconds field caps at 59, and the field shows the clamped value after blur                          | ⬜  | ⬜      |

---

## 5. Keyboard behaviour

The most-regressed area in this app: Android's edge-to-edge requirement means nothing here comes for
free, and a `Modal`'s own window measures differently again. Re-check it whenever a sheet, a scroller
or a number field is touched.

|                                                                                                                                  | iOS | Android                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focus the preset-name field → **Save Preset is fully visible** above the keyboard                                                | ⬜  | ⬜                                                                                                                                                                                         |
| No dead space / over-scroll after the nudge — clearance matches `BREATHING_ROOM = 24`                                            | ⬜  | ⬜                                                                                                                                                                                         |
| Same on a **small** phone (iPhone SE class / 720×1280)                                                                           | ⬜  | ⬜                                                                                                                                                                                         |
| **Any** focused field stays visible when the keypad opens — Settings, blind editor, sheet                                        | ⬜  | ⬜                                                                                                                                                                                         |
| Number fields show a **Done** bar above the keypad (iOS), on the **first** open                                                  | ⬜  | ➖                                                                                                                                                                                         |
| …and it doesn't look bolted on next to the keyboard's rounded edge                                                               | ⬜  | ➖                                                                                                                                                                                         |
| In a **sheet**, the Done control belongs to the sheet — nothing floating in the gap above the keypad                             | ⬜  | ⬜                                                                                                                                                                                         |
| A sheet's **footer buttons stay tappable** with the keypad up (generator: Cancel + Replace structure)                            | ⬜  | ⬜ — check on **3-button navigation** if you have it; its nav bar is roughly twice a gesture bar's, and Android reports the IME height _excluding_ it, so a shortfall shows up worst there |
| Scrolling **keeps the keypad up** — generator sheet                                                                              | ⬜  | ⬜                                                                                                                                                                                         |
| Scrolling **keeps the keypad up** — blind structure editor                                                                       | ⬜  | ⬜                                                                                                                                                                                         |
| Generator sheet fields usable with the keyboard up — sheet resizes _and_ scrolls, top not pushed off-screen                      | ⬜  | ⬜                                                                                                                                                                                         |
| Payouts: focus the **Bounty** field — now the lowest of six, so it's the one Android's edge-to-edge would leave under the keypad | ⬜  | ⬜                                                                                                                                                                                         |
| Leaderboard: focus **Add a player** with the roster long enough to scroll — field stays visible                                  | ⬜  | ⬜                                                                                                                                                                                         |

---

## 6. Notifications & Live Activity

|                                                                                                                                                                                                   | iOS | Android                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------ |
| Round expiry fires the alert + alarm with the app **foregrounded**                                                                                                                                | ⬜  | ⬜                                                     |
| Expiry while **backgrounded** advances **exactly one** level, and says so if more time passed                                                                                                     | ⬜  | ⬜ (automation blocked, see below — needs a hand pass) |
| Live Activity / notification show the right level + time, and the "open the app" caption                                                                                                          | ⬜  | ⬜                                                     |
| Blinds are the most prominent thing on it, after the countdown                                                                                                                                    | ⬜  | ⬜                                                     |
| After a level jump, the pending "time's up" notification names the **new** next blind                                                                                                             | ⬜  | ➖                                                     |
| Notification survives swipe-away from Recents — start a round, swipe the app out of the app switcher, and the timer notification keeps counting down instead of vanishing with it                 | ➖  | ⬜                                                     |
| First launch after install asks for notification permission **exactly once**                                                                                                                      | ➖  | ⬜                                                     |
| **After denying once**, force-stop and relaunch → still **exactly one** dialog, and it's the system sheet ("Allow Poker Timer to send you notifications?"), not an app-drawn alert in front of it | ➖  | ⬜                                                     |
| Denying **twice** blocks the permission permanently (Android's own behaviour) — confirm the background timer degrades rather than crashes, and that Metro logs the "permanently denied" warning   | ➖  | 🟡                                                     |
| **With notifications denied, Settings shows the "Notifications are off" card** at the top, above Pro. It is the only route back and has never run on a device                                     | ➖  | ⬜                                                     |
| Its **"Turn on notifications"** button shows the _system_ dialog when Android will still ask, and falls through to the "Open Settings" alert when it will not — the permanently-blocked case      | ➖  | ⬜                                                     |
| Granting the permission in system settings and **returning to the app makes the card disappear** without a relaunch                                                                               | ➖  | ⬜                                                     |
| The card is **absent** whenever notifications are allowed, and absent on iOS entirely                                                                                                             | ⬜  | ⬜                                                     |
| **Force-quit mid-round, relaunch → exactly one Live Activity**, not two. Repeat three times: still one, and it's the live round rather than a stale one                                           | ⬜  | ➖                                                     |
| Stopping/resetting the timer leaves **no** Live Activity behind, including any stray from an earlier session                                                                                      | ⬜  | ➖                                                     |
| Swipe a Live Activity away by hand mid-round, then change level → a fresh card appears and there is still only one                                                                                | ⬜  | ➖                                                     |

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

|                                                                                                                   | iPad | Android tablet |
| ----------------------------------------------------------------------------------------------------------------- | ---- | -------------- |
| Settings: Tournament + Presets **side by side**, capped and centred                                               | ⬜   | ⬜             |
| Blind editor list + sticky footer capped at 900 and centred                                                       | ⬜   | ⬜             |
| Timer card centred, not full-bleed                                                                                | ⬜   | ⬜             |
| Generator and Pro sheets capped at 640 and centred, **not** full-bleed (the 1.2.0 fix — was 🟡 accepted in 1.1.4) | ⬜   | ⬜             |
| Payouts: cards capped and centred, payout rows readable                                                           | ⬜   | ⬜             |
| Leaderboard: standings and the record sheet capped and centred                                                    | ⬜   | ⬜             |
| iPad **mini** still gets the phone layout                                                                         | ⬜   | ➖             |

---

## 8. Small phones

|                                                                                                                                       | iOS | Android |
| ------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| Timer fits with no scrolling, nothing clipped                                                                                         | ⬜  | ⬜      |
| Settings cards readable, no overlap                                                                                                   | ⬜  | ⬜      |
| Blind rows: level chip, LIVE badge and both buttons all fit                                                                           | ⬜  | ⬜      |
| Payouts: "Paid places" segments wrap rather than breaking a label mid-word — check at **25+ players**, which offers the most segments | ⬜  | ⬜      |

---

## 9. Cold launch

|                                                                                                                  | iOS | Android |
| ---------------------------------------------------------------------------------------------------------------- | --- | ------- |
| Launch → no visible resize before the timer appears                                                              | ⬜  | ⬜      |
| Leaderboard survives a force-stop: players, games and standings all still there                                  | ⬜  | ⬜      |
| Payout settings survive a force-stop (buy-in, bounty, denomination, pinned places)                               | ⬜  | ⬜      |
| Deep link straight to `pokerkit://settings` and `pokerkit://blinds` → splash lifts **immediately**, not after 4s | 🚫  | 🚫      |

> **Why the deep-link row is 🚫:** same root cause as §6's blocker. `adb shell am start -W -a
android.intent.action.VIEW -d "pokerkit://blinds" com.toondeboer.pokerkit` on a fully force-stopped
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
_Settings → Display & Brightness → Auto-Lock → 30 Seconds_ (it must not be _Never_), Android
_Settings → Display → Screen timeout → 30 seconds_. A phone set to never sleep will fail every row
here no matter what the app does. If a row still fails, the Metro log shows whether
`keep-awake: releasing screen lock` was reached, which splits an app bug from OS behaviour in one
line.

**Check the window flag, not just your eyes.** `adb shell dumpsys window | grep -c 'fl=KEEP_SCREEN_ON'`
is 1 while the lock is held and 0 once it's released, which answers the question in one line and
doesn't need you to sit and watch a screen for a whole auto-lock interval. Confirm the sleep itself
with `adb shell dumpsys power | grep mWakefulness` (`Awake` / `Asleep`). **Read it from a known
baseline** — force-stop, relaunch, and check the flag is 0 _before_ starting a round. A relaunch can
restore a running tournament and re-acquire the lock on its own, which makes the next Start/Pause tap
land the opposite way round and reads exactly like a broken release.

|                                                                                                                                                                                   | iOS                   | Android |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------- |
| Screen doesn't sleep while a round is running, left untouched past the OS timeout                                                                                                 | ⬜                    | ✅      |
| Pausing releases it — the screen sleeps normally again                                                                                                                            | ⬜ **never verified** | ✅      |
| Stopping/resetting releases it too                                                                                                                                                | ⬜ **never verified** | ✅      |
| With a round **running**, leave the timer screen for Settings — the screen should still stay awake (the round is still going), and start sleeping again once you pause from there | ⬜                    | ⬜      |

---

## 11. Payouts (Pro)

Almost all of the _arithmetic_ here is unit-tested in `@poker/core` — the table summing to exactly
the prize pool is asserted across the whole realistic input range, so a row that just re-adds the
numbers is wasted effort. **What's left for a human is the screen**: that the controls fit, the
keypad doesn't cover them, and the figures land where you can read them.

Set `FORCE_PRO_IN_DEV` in `PremiumContext.tsx` to see the unlocked screen without buying.

|                                                                                                                                                                                                         | iOS | Android |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| Locked state: Settings row shows the Pro pill, the screen still opens and offers the unlock                                                                                                             | ✅  | ⬜      |
| Buy-in / Players / Rebuys / Add-ons / Bounty accept typing and a **cleared field doesn't show a literal `0`**                                                                                           | ⬜  | ⬜      |
| **Add-on price** appears only once Add-ons is above 0, and disappears again at 0                                                                                                                        | ⬜  | ⬜      |
| Rebuys grow the pool and the Entries row reads "8 players + 4 rebuys". Places follow the **player** count, not entries — but a bigger pool _can_ fund one more place, so don't treat the count as fixed | ⬜  | ⬜      |
| Payout rows and "Where it comes from" reconcile on screen: prize pool + bounties = collected                                                                                                            | ⬜  | ⬜      |
| A bounty **equal to or above** the buy-in explains itself instead of showing an empty table                                                                                                             | ⬜  | ⬜      |
| Pinning a place count overrides Auto; switching back to Auto follows the field again                                                                                                                    | ⬜  | ⬜      |
| Settings' Payouts summary row updates after editing and going **back** (not just on relaunch)                                                                                                           | ⬜  | ⬜      |
| **Share payouts** opens the share sheet, and the pasted text matches the table on screen                                                                                                                | ⬜  | ⬜      |
| **Chop sheet**: shares add up to the money still on the table, and nobody is below the guarantee                                                                                                        | ⬜  | ⬜      |
| Chop sheet: the chip fields are usable with the keypad up, and the sheet header clears the status bar                                                                                                   | ⬜  | ⬜      |
| Chop button is hidden when only **one** place is paid — there is nothing to split                                                                                                                       | ⬜  | ⬜      |

---

## 12. Leaderboard (Pro)

The aggregation, ranking and tie-breaks are unit-tested. The human rows are the roster editing, the
record-a-game interaction, and persistence — see also the cold-launch row in §9, which is the one
that matters most here because **this is the only data in the app a user can't recreate by retyping
it**.

|                                                                                                                                                                                          | iOS | Android |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| Locked state: Pro pill on the Settings row, screen opens and offers the unlock                                                                                                           | ✅  | ⬜      |
| Adding a player: duplicate and empty names keep the button disabled                                                                                                                      | ⬜  | ⬜      |
| Name field isn't covered by the keypad, and dismisses on return                                                                                                                          | ⬜  | ⬜      |
| Record a game: tapping who played, then tapping them in finishing order, gives 1st/2nd/3rd                                                                                               | ⬜  | ⬜      |
| Winnings shown per place match the Payouts screen **for the field that turned up**, not the saved player count                                                                           | ⬜  | ⬜      |
| Un-picking a player who was already ranked also clears their place                                                                                                                       | ⬜  | ⬜      |
| Saving updates the standings, and Settings' summary row, immediately                                                                                                                     | ⬜  | ⬜      |
| Removing a player keeps past games — everyone else's totals unchanged                                                                                                                    | ⬜  | ⬜      |
| **End-of-game prompt:** advance past level 1, then reset → "Record this game?" appears; "Record" opens the sheet with the roster in it                                                   | ⬜  | ⬜      |
| Resetting on **level 1** does _not_ prompt (it's a mis-tap, not a finished game)                                                                                                         | ⬜  | ⬜      |
| No prompt with an **empty roster**, or when Pro is locked — the sheet would have nothing to offer                                                                                        | ⬜  | ⬜      |
| Back from a prompt-opened leaderboard returns to the **timer**, and the header says "Back"                                                                                               | ⬜  | ⬜      |
| Record sheet: header clears the status bar and the footer clears the keypad (the §5 failure mode)                                                                                        | ⬜  | ⬜      |
| Group row shows the current board and opens the sheet; switching groups swaps the standings **and** the roster                                                                           | ⬜  | ⬜      |
| Creating a group makes it active and empty; the previous group's players and games are untouched when you switch back                                                                    | ⬜  | ⬜      |
| Renaming a group in place commits on return **and** when you tap away — a row, another group's buttons, the backdrop, Done — rather than being discarded                                 | ⬜  | ⬜      |
| An empty or duplicate rename shows the reason under the field **while typing**, and leaves the group's name as it was                                                                    | ⬜  | ⬜      |
| Reopening the sheet after a rename doesn't come back mid-edit with the keyboard up                                                                                                       | ⬜  | ⬜      |
| Deleting a group warns how many games go with it, and the board falls back to another group rather than showing nothing                                                                  | ⬜  | ⬜      |
| Groups sheet: the rename field isn't covered by the keypad, and the sheet header clears the status bar (the §5 failure mode)                                                             | ⬜  | ⬜      |
| **Upgrading keeps an existing leaderboard.** Record a game on the _previous_ build, update, reopen → the same players, games and standings, unchanged                                    | ⬜  | ⬜      |
| **Share standings** is disabled with nothing to report, and enabled once a game is recorded — including after **removing every player**, which keeps the games but leaves nothing to say | ⬜  | ⬜      |
| Shared standings text lists only players who have played, ranked, with no markdown characters                                                                                            | ⬜  | ⬜      |
| **Signed out, no "that's me" affordance appears** on any player row — this is the state every user is in until accounts ship                                                             | ⬜  | ⬜      |
| A player left linked to an account that no longer exists can still be **unlinked**, so they aren't stuck                                                                                 | ⬜  | ⬜      |

---

## 13. Deal a hand (Pro)

**The whole betting half of this section is gone**, along with the engine it tested — see the
Gambling classification section in [ROADMAP.md](./ROADMAP.md#gambling-classification--blocking-120).
Roughly thirty rows went with it: blinds posting, fold/check/call, raise validation, Min/Pot/All-in,
side pots, awards, finishing order, every save-to-leaderboard row, knockouts and progressive
bounties. None of that exists any more, and rows testing it would be worse than no rows.

The dealing and hand evaluation are unit-tested in `@poker/core` — every card dealt exactly once,
every showdown ranked. **What is left for a human is the passing-the-phone part**, which no test can
see: whether one player's cards are ever visible to the next, and whether the table can follow what
is happening from across it.

**The peek rows are the important ones.** They are the only thing standing between a phone changing
hands and somebody seeing a hand they should not. They were also the rows a synthetic tap could not
verify on the iOS simulator, so they have never been exercised by anything but a human.

**Run on Android, 2026-09-08** (`Pixel_stable`, API 35, dev client rebuilt for #211's native
modules), driven through `adb` against real element bounds and checked in screenshots rather than by
assertion. **One row failed and is fixed in #234**: with everybody else mucked, the table printed
"Everyone else mucked — no hand had to be shown" and displayed the remaining player's hole cards
directly above it. `showdownFor` was right; `TableView` keyed the reveal on reaching the showdown
rather than on anybody having to show. Exactly the defect class this section exists for — invisible
to a unit test, obvious in a screenshot.

|                                                                                                                                                    | iOS | Android |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| Locked state: Pro pill on the Settings row, the screen still opens and offers the unlock                                                           | ⬜  | 🚫      |
| Seating: tapping a player seats them, tapping again unseats; Deal stays disabled below two                                                         | ⬜  | ✅      |
| **Tapping a seat shows only that seat's two cards**, and tapping it again hides them                                                               | ⬜  | ✅      |
| **Tapping a second seat hides the first.** Never two hands visible at once — this is the one that matters when the phone is going round            | ⬜  | ✅      |
| **Turning a street hides whatever was showing.** Deal the flop with a hand revealed and it must close, or the next player inherits it              | ⬜  | ✅      |
| Muck takes a seat out: the row dims, they are left out of the showdown, and the "in" count drops                                                   | ⬜  | ✅      |
| Mucking down to one player leaves **no cards shown** at the showdown — an uncontested hand is not revealed                                         | ⬜  | ✅      |
| The showdown reveals every hand still in, ranked best first, with the winner starred and each hand named                                           | ⬜  | ✅      |
| **No chips, no pot, no bet and no amount appear anywhere on the screen.** Check by eye, in a screenshot — this is the property the rating rests on | ⬜  | ✅      |
| The action to take a seat out reads **Muck**, never Fold                                                                                           | ⬜  | ✅      |
| **A hand survives a force-stop.** Deal, kill the app from the switcher, reopen → the same board and the same hole cards come back                  | ⬜  | ✅      |
| A finished hand survives too: the showdown is still on screen after a relaunch                                                                     | ⬜  | ✅      |
| "Next hand" deals again and the button moves on                                                                                                    | ⬜  | 🟡      |
| Ending a game where **nothing has been dealt** does not ask — there is nothing to lose                                                             | ⬜  | ✅      |
| Ending a game mid-evening asks first, and cancelling keeps the cards                                                                               | ⬜  | ✅      |
| Readable across a table — card faces and whose cards are showing, at arm's length                                                                  | ⬜  | 🚫      |
| Tablet: the table is capped and centred rather than running the full width                                                                         | ⬜  | ⬜      |

**Why three rows are not ✅ on Android:**

- **Locked state — 🚫 on a dev build.** `FORCE_PRO_IN_DEV` has to be `true` to reach this screen at
  all locally, which is the same switch that hides the locked state. Needs the TestFlight / Play
  internal build, like the billing rows.
- **"Next hand" — 🟡 dealing again is verified; the button moving is not.** The button index is not
  drawn anywhere on the table, so there is nothing on screen to check it against. The rotation is
  unit-tested in `dealerSession.test.ts`.
- **Readable across a table — 🚫 by nature.** An emulator on a laptop cannot answer "legible at
  arm's length across a kitchen table". Needs a real device and a real table.

**A seat sitting out is not reachable from the app.** `GameContext` exposes `toggleSittingOut` and
`@poker/core` implements and tests `sitOut`, but **no component calls it** — there is no control
anywhere in the dealer UI. The row that used to test it has been dropped rather than left permanently
unrunnable. Either wire it up or delete the dead path; until then, a player who leaves is handled by
unseating them and starting a new game.

---

## 14. Accounts · **new in 1.2.0, and never once run from the app**

### 14b. Signing in with Apple and Google · **new, and never run**

**Needs `backendConfig = DEV_BACKEND` and a rebuilt dev client** — `expo-web-browser` and
`expo-crypto` are native, so a reloaded JS bundle talks to a binary that does not have them.

**And this is not scoped to sign-in — it takes the whole app down at launch.** `socialSignIn.ts`
imports `expo-crypto` at module scope, and it is pulled in by `cognitoAuthProvider` →
`AuthContext` → `_layout`, so a dev client built before #211 red-screens with
`Cannot find native module 'ExpoCrypto'` before anything renders. **No section of this checklist
can be run on such a build**, not just this one. Rebuild first — see §0.

| Row                                                                                                                                                                                                                           | iOS | Android |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| **Continue with Apple** on a fresh install creates an account and signs in                                                                                                                                                    | ✅  | ⬜      |
| **Continue with Google** on a fresh install creates an account and signs in                                                                                                                                                   | ✅  | ⬜      |
| Signing out and back in with the same provider returns to the **same** account, not a new one                                                                                                                                 | ✅  | ⬜      |
| **The linking case.** Sign up with email+password, sign out, then sign in with a provider on the _same address_ — the boards and season are still there. This is the one that fails silently and looks exactly like data loss | ✅  | ⬜      |
| 🚫 **Hide My Email** — needs a **second Apple ID**, and cannot be run with one. See below                                                                                                                                     | ⬜  | ⬜      |
| Closing the provider sheet halfway leaves the screen usable, with **no red error** — cancelling is not a failure                                                                                                              | ✅  | ✅      |
| Declining at the provider does the same                                                                                                                                                                                       | ✅  | ⬜      |
| **Use email instead** reveals the email form, and email sign-in still works                                                                                                                                                   | ✅  | ⬜      |
| With no network, tapping a provider opens the sheet and **Safari** reports being offline; dismissing it leaves no app error                                                                                                   | ✅  | ✅      |

**Declining failed first time round**, on 2026-09-07: Apple sends `user_cancelled_authorize` and only
`access_denied` was handled, so the screen said _"That didn't work. Try again in a moment."_ about
something somebody had chosen to do. Fixed in #219 and re-run on the device before being marked ✅ —
which is the only thing that makes the mark mean anything.

**Everything ✅ on the iOS column was run on the iOS Simulator on 2026-09-07**, against
`DEV_BACKEND`.

**Android was opened on 2026-09-11** on a `Pixel_stable` API 35 emulator, against `DEV_BACKEND`, and
two rows are ✅ from it. What that run actually established is worth writing down, because it is more
than two ticks and less than a pass:

- **Both providers reach their real sign-in page.** Google's shows _"to continue to
  pokerkit-dev.auth.us-east-1.amazoncognito.com"_, and Apple's shows **the app's own icon and the
  name "Poker Timer"** — which comes from the Services ID record in the developer portal, so the
  Services ID, Team ID, Key ID and the `.p8` that signs the client secret are all right. A
  `redirect_mismatch`, a missing identity provider or a bad client id all fail _before_ that page,
  so none of them is present on dev.
- **The launch path is `BrowserProxyActivity` → Chrome Custom Tab**, confirmed in logcat. Chrome's
  own first-run screen sits in front of it on a fresh emulator, which looks exactly like a broken
  sign-in and is not one.
- **The four rows that need real credentials cannot be driven from here** and stay ⬜. So does
  _Declining at the provider_, which needs somebody to get as far as the provider's own decline
  button — closing the tab is a different code path, and it is the one already covered.
- **_Use email instead_ reveals the form correctly** and the provider card keeps no error while it
  is open, which is the #219 fix holding. The row stays ⬜ because its second half needs an account.

**The prod pool was then checked too, on 2026-09-11, and both providers are configured correctly
there.** This is the part that dev passing says nothing about: the prod pool has its own Apple
Services ID (`com.toondeboer.pokerkit.signin`, against the `.dev` one) and its own Google client id,
each needing its own redirect URI registered, and prod is what ships.

Run by pointing `backendConfig` at `PROD_BACKEND`, reloading, and tapping each button. Verified by
logcat that the browser opened `pokerkit.auth.us-east-1.amazoncognito.com` — **the prod domain, no
`-dev`** — rather than trusting the file. Apple's page rendered with the app's icon and name;
Google's said _"to continue to pokerkit.auth.us-east-1.amazoncognito.com"_. So the prod Services ID,
its redirect URI, the prod Google client and the `.p8` all check out.

**What is still not proven is a completed sign-in**, on either pool or either platform's prod
config: that needs real provider credentials, which cannot be driven from here. The four rows above
stay ⬜ and want a human with an Apple ID and a Google account. They are the highest-value rows left
in this file — those two buttons are the first thing on the sign-in card, so a failure there is a
Guideline 2.1 rejection rather than a missing feature.

_On Android the offline row's browser is Chrome rather than Safari; the behaviour asked for is the
same — the browser reports being offline and dismissing it leaves no app error._

**Hide My Email needs a second Apple ID, and the obvious way to test it does not work.**
Apple offers the Share/Hide choice only on _first_ authorization and remembers the answer
afterwards. Revoking at Settings → Apple ID → Sign in with Apple gets the prompt back — but it does
**not** give a clean test, because Cognito identifies a federated user by the provider's _subject_,
not by the address. That sub is stable for one Apple ID and team, so re-authorizing with a relay
address matches the same Cognito user and signs you into the account you already have; only the
email attribute changes.

That is the correct behaviour and worth knowing: identity keys on the sub, so somebody toggling
their relay settings does not fracture their account. What it means for testing is that
"a relay address gets its own account" is only reachable on a **first** sign-in from an Apple ID
that has never used the app.

The code path is in any case the same one the Google row already covers — an address matching
nothing in the pool, `no-account-to-link`, a new user. What Hide My Email adds beyond that is the
**revocation** gap: if somebody later turns the relay off, mail to them stops and password reset
fails silently. Apple's server-to-server notification endpoint is what would tell us, and it is
deliberately not built — see `ROADMAP.md`.

Every screen here was written, wired to Cognito and exercised from a script. **None of it has been
used from inside the app**, which is a different thing — the script never mistyped a code, never
backgrounded the phone mid-flow, and never had to find the entry point.

**Read this before starting.** The account screens are reachable from Settings, and `backendConfig`
must point at a real backend or they cannot work at all. If sign-up says the build cannot do it,
that is the switch, not a bug.

**Partly run on Android, 2026-09-08.** What a laptop can drive was driven; **every row that needs a
confirmation code is 🚫, because running it needs somebody with an inbox.** Those are the rows the
feature rests on and they are still outstanding — see the note under the table.

Two defects came out of the part that could be run. One is fixed; one is dev-only and deliberately
left:

- **Fixed: the same error was printed twice.** `AccountScreen` keeps one `error` state and rendered
  it in four places. The "Sign in" card and the "Email and password" card are on screen together
  once _Use email instead_ is tapped, so a failed email sign-in also printed a red line under the
  Apple and Google buttons — about a provider nobody had touched.
- **Dev-only, not fixed: an offline sign-in red-screens a dev build.** The app handles it correctly
  in the UI ("Couldn't reach the server. Check your connection.") and then calls `console.error`,
  which LogBox turns into a full-screen Console Error over the top. Nothing is wrong and release
  builds have no LogBox — but it looks alarming, and it is the same shape as the bug #219 fixed:
  treating an ordinary condition as an error. Worth demoting to `warn` at some point.

|                                                                                                                                                                                                                                                                    | iOS | Android |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------- |
| Settings shows the account row, and it opens the account screen                                                                                                                                                                                                    | ⬜  | ✅      |
| **Sign up with a real address → the code arrives.** This is the row the whole feature rests on: Cognito's own sender was capped and landed in spam, which is why it now goes through SES                                                                           | ⬜  | 🚫      |
| The code arrives **in the inbox, not spam**, and is from `Poker Blinds Timer`                                                                                                                                                                                      | ⬜  | 🚫      |
| Confirming with the emailed code signs you in                                                                                                                                                                                                                      | ⬜  | 🚫      |
| **After confirming, the account can reset its password.** A user confirmed without the emailed code ends up `email_verified: false` and Cognito refuses to send to them at all — it reads as a mail failure and is not one. [See D-note](#accounts-email-verified) | ⬜  | 🚫      |
| A **wrong code** says so and lets you try again, rather than dead-ending                                                                                                                                                                                           | ⬜  | 🚫      |
| An **already-taken email** says so in words, not an error code                                                                                                                                                                                                     | ⬜  | 🚫      |
| A **wrong password** on sign-in says so and does not clear the email field                                                                                                                                                                                         | ⬜  | 🟡      |
| Sign out, then sign back in — the boards are still there                                                                                                                                                                                                           | ⬜  | 🚫      |
| **Force-quit mid-sign-up, relaunch** → not signed in and not stuck; signing up again with the same address behaves sanely                                                                                                                                          | ⬜  | 🚫      |
| **Airplane mode during sign-in** says there is no connection, and does **not** sign you out of an existing session                                                                                                                                                 | ⬜  | 🟡      |
| **Delete account removes the data, not just the login.** Delete, then sign up again with the same address: no old boards, no old claims. App Store 5.1.1(v) asks for the data as well                                                                              | ⬜  | 🚫      |
| After deleting, the app still works — local boards intact, timer fine, no crash on next launch                                                                                                                                                                     | ⬜  | 🚫      |

**These 🚫 are a different blocker from the billing rows.** They are not blocked on a store build —
`DEV_BACKEND` reaches a real Cognito pool and SES has production access, so the flow works. They are
blocked on **somebody with an inbox**: every one of them turns on receiving a confirmation code, and
that is the one step no script can do honestly. Run them by hand against `DEV_BACKEND` with a real
address. They remain the largest untested surface in 1.2.0.

**What the two 🟡 mean:**

- **Wrong password.** The half that could be checked was checked: a failed sign-in **keeps the email
  field**, which is what the row is really guarding against. The wording of the wrong-password
  message itself needs an account that exists.
- **Airplane mode.** Says there is no connection, in words, and keeps what was typed — verified. The
  second half of the row, that it does **not** sign you out of an existing session, needs a session,
  so it needs the sign-up rows above first.

<a id="accounts-email-verified"></a>

> **Why the password-reset row is there.** Both smoke accounts were `CONFIRMED` with
> `email_verified: false`, because they had been confirmed administratively rather than through the
> emailed code. Cognito then refuses to send to them — _"no registered/verified email"_ — which looks
> exactly like SES being broken. Real sign-up should set it; this row is what proves it does.

---

## 15. Shared boards (Club) · **new in 1.2.0, needs two devices**

**One device cannot test this.** The whole feature is a board on one phone appearing on another, and
every interesting failure — a stale board, a write that never arrives, a member seeing an empty
board — only shows with two.

**Nothing grants `club` until the subscription exists in both stores.** Until then set
`FORCE_PRO_IN_DEV` in `PremiumContext.tsx`, which forces both entitlements. Without it the share
button and join field are simply absent, silently and correctly, which reads exactly like sync being
broken.

**It needs two accounts as well as two devices, and that is the harder half.** Checked on Android
on 2026-09-09: the share control is gated on `accountsAreReal && account && mayShare &&
group.canInvite` (`GroupsSheet.tsx`), and joining is gated on being signed in. So **every row here
is blocked behind §14's sign-up rows**, which are themselves blocked on somebody with an inbox —
budget for that before setting two phones up, because `FORCE_PRO_IN_DEV` does not help with it.

Two things were confirmed without an account, and neither needs repeating: with nobody signed in the
sheet **explains itself rather than failing** — _"Sign in to join a board. Joining is free — the
person who shares a board is the one who pays for it."_ — and the share control is **absent rather
than broken**, which is the shape the guest rows below are about.

|                                                                                                                                                    | iOS | Android |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| **The host shares a board** — the code arrives in the share sheet with a message naming the app                                                    | ⬜  | ⬜      |
| **A second device joins by pasting the code**, and the board arrives with its whole roster and season, not empty                                   | ⬜  | ⬜      |
| Pasting **the entire shared message** works, not just the bare code                                                                                | ⬜  | ⬜      |
| A **wrong or expired code** says so and leaves the app usable                                                                                      | ⬜  | ⬜      |
| **A guest pays nothing.** A device with neither Pro nor Club joins, and can read the board it was sent — if it hits a paywall, the feature is dead | ⬜  | ⬜      |
| That guest **cannot** create a board of their own (Pro) or share one (Club) — the create and share controls are absent, not broken                 | ⬜  | ⬜      |
| **A player added on one device appears on the other** after foregrounding it                                                                       | ⬜  | ⬜      |
| **A game recorded on one appears on the other**, with the same standings                                                                           | ⬜  | ⬜      |
| **Record with no signal, then reconnect.** Airplane mode, add a player and record a game, come back — both arrive, and nothing was lost or doubled | ⬜  | ⬜      |
| **A deletion propagates.** Remove a player on the host; the guest stops showing them                                                               | ⬜  | ⬜      |
| **A local delete stays deleted.** Delete a game on the guest, foreground twice — it does not come back                                             | ⬜  | ⬜      |
| **A board deleted locally stays deleted**, and is not re-added by the next sync                                                                    | ⬜  | ⬜      |
| The **share button is absent on a board you joined** — only an admin can invite, so offering it would only ever explain itself                     | ⬜  | ⬜      |
| **Sign in on a third device → the boards are there**, without anybody sharing anything                                                             | ⬜  | ⬜      |
| A write the server refuses shows the "Not saved for others" card, and dismissing it works                                                          | ⬜  | ⬜      |
| Renaming a board on one device does **not** revert on the next sync                                                                                | ⬜  | ⬜      |

---

## 16. Club, Pro, and what each unlocks

The rules are unit-tested in `clubPolicy`. **What a human has to check is that nobody is told to buy
something they already own**, which is the failure that reaches a store review.

|                                                                                                                                                                   | iOS | Android |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| A **Pro-only** account (no Club) can use every local feature and **cannot** share a board — and the message names Club, not Pro                                   | ⬜  | ⬜      |
| A **Club** subscriber gets Pro with it — the leaderboard works without buying Pro separately                                                                      | ⬜  | ⬜      |
| A Club subscriber sees **"Pro is included with Club"**, not "Pro unlocked" — the second implies a permanence they have not got                                    | ⬜  | ⬜      |
| **Restore purchases is offered even when the app thinks you are unlocked.** The person who needs it most is the one whose purchase this device has not recognised | ⬜  | ⬜      |
| Buying **Pro** while subscribed does not double-charge or confuse the paywall                                                                                     | ⬜  | ⬜      |
| Nobody is ever told to buy something they hold — check the messages for a Pro-only, a Club-only, and a signed-out account                                         | ⬜  | ⬜      |
| A **signed-out** person tapping "Join a board" is offered a sign-in, not a paywall and not an empty sheet                                                         | ⬜  | ⬜      |

### 16b. Buying Club · **the rows a subscription is rejected over**

**Guideline 3.1.2 is the reason for most of these.** An app selling an auto-renewable subscription
has to show its title, the length of its period and its price **in the app**, and carry working
links to the Terms of Use and the Privacy Policy. A missing link is a rejection, and it is the kind
that costs a whole review cycle.

🚫 **None of it can be run until the subscriptions are approved in both stores** — RevenueCat
returns no plans before that, and the section is deliberately absent rather than empty, because
advertising something nobody can buy is worse than saying nothing.

|                                                                                                                                         | iOS | Android |
| --------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| **The Club section appears at all** once the products are live — and is absent before, rather than showing an empty box                 | ⬜  | ⬜      |
| **Both plans show a price**, taken from the store rather than written into the app — so it is right in every currency                   | ⬜  | ⬜      |
| **Each says its billing period** — "Monthly" and "Annual". Price without period is the 3.1.2 rejection                                  | ⬜  | ⬜      |
| It says **renews until cancelled**, and where to cancel — App Store on iOS, Play Store on Android                                       | ⬜  | ⬜      |
| **"Joining a board is always free" is on screen.** The misunderstanding most likely to kill the feature                                 | ⬜  | ⬜      |
| **Terms of Use opens `/terms`** in a browser, and the page loads                                                                        | ⬜  | ⬜      |
| **Privacy Policy opens `/privacy-policy`**, and the page loads                                                                          | ⬜  | ⬜      |
| Buying **monthly** grants `club` **and** `pro` — the board opens straight away, with no second purchase                                 | ⬜  | ⬜      |
| Buying **annual** does the same                                                                                                         | ⬜  | ⬜      |
| **Cancelling at the store** removes hosting but **leaves Pro** — the boards stay visible. This is the promise `clubEver` exists to keep | ⬜  | ⬜      |
| **The Club section disappears once subscribed** — nobody is sold what they hold                                                         | ⬜  | ⬜      |
| Cancelling a purchase halfway leaves the sheet usable, with no error — cancelling is not a failure                                      | ⬜  | ⬜      |
| **Restore brings back both entitlements** on a fresh install                                                                            | ⬜  | ⬜      |

---

## 17. The kill switch

**An untested switch is worse than none**, because it gets reached for in an emergency. Verified
from a laptop against dev in both directions; these rows are the app half.

|                                                                                                                                                                                          | iOS | Android |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| With `featureSharing=off` deployed, a **cold launch** shows no share button and no join field, and nothing syncs                                                                         | ⬜  | ⬜      |
| Turning it back on and relaunching restores both — within the 60-second cache                                                                                                            | ⬜  | ⬜      |
| With `featureAccounts=off` deployed, a **cold launch** shows no Account row in Settings; `pokerkit://account` still opens the screen, because a confirmation email has to land somewhere | ⬜  | ⬜      |
| **With the backend unreachable entirely** (airplane mode at launch), the app treats the features as off rather than queueing writes at a server that is not there                        | ⬜  | ⬜      |

---

## 18. Shared clock (Club) · **new in 1.2.0, needs two devices**

**Needs the backend deployed with the `/sessions` routes**, and `FORCE_PRO_IN_DEV` until Club can be
bought — hosting is gated on `hasClub` and joining on being signed in, so without either the Start
button is disabled with a sentence saying why. That sentence is the feature working, not a failure.

**One device answers less here than in §15.** A session is peer-to-peer: any participant can pause,
skip a level or resume, and every interesting failure is about two clocks disagreeing. What one
device can show is the gate, the codes and the refusals.

**The transport is HTTP polling at 4s against a 5s heartbeat**, so "immediately" is the wrong
expectation throughout: a press reaches the other phone within about four seconds and the section
reads `stale` only after fifteen without contact. A pause that shows up three seconds later is a
pass.

|                                                                                                                                              | iOS | Android |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| **Without Club**, Start is disabled and says sharing is part of Club — and that **joining is free**                                          | ⬜  | ⬜      |
| **Signed out**, both Start and Join are disabled and each says to sign in — not "subscribe"                                                  | ⬜  | ⬜      |
| While entitlements are still loading, it says so rather than refusing — a subscriber must never be told they have not paid                   | ⬜  | ⬜      |
| **Hosting produces a six-character code** from the alphabet that drops what gets misheard — no I, O, S, Z                                    | ⬜  | ⬜      |
| **A second device joins by typing it**, and sees the same round, level and countdown within ~4s                                              | ⬜  | ⬜      |
| Lower case and spaces work — the code is normalised on the way in                                                                            | ⬜  | ⬜      |
| **A wrong code says no clock is running under it**, and leaves the screen usable                                                             | ⬜  | ⬜      |
| **Pausing on either device pauses both.** This is the row the feature exists for — and either device, not just the host                      | ⬜  | ⬜      |
| **Two people pause at the same moment** and both phones settle on the same answer rather than splitting                                      | ⬜  | ⬜      |
| A level jump travels too — `blindIndex` is in the message                                                                                    | ⬜  | ⬜      |
| **Killing the host app leaves the joiner counting down**, and it reads `stale` after ~15s rather than freezing or lying                      | ⬜  | ⬜      |
| Reopening the host **rejoins and the two agree again** within a poll                                                                         | ⬜  | ⬜      |
| **Airplane mode on the joiner** for 30s, then back: it catches up rather than needing a rejoin                                               | ⬜  | ⬜      |
| Leaving stops the polling — the clock keeps running locally and nothing further is sent                                                      | ⬜  | ⬜      |
| 🚫 **A session expires six hours after its last message.** Cannot be run in a sitting; the TTL is asserted in the store's unit tests instead | ⬜  | ⬜      |

**Where to look if it does not work.** `sessionTransport` is `null` on any build with no
`backendConfig`, and then the whole screen is absent rather than broken — check that first. A 401 on
every poll means the token, not the code.

---

## 19. Push notifications · **new in 1.2.0, needs two accounts and a real build**

🚫 **None of this runs on a simulator.** Push tokens need a real device and real credentials — an
APNs key for iOS and an FCM v1 service account for Android, both held by EAS. A development build
against `DEV_BACKEND` is enough; the Simulator is not.

**It also needs two accounts**, because the sender never notifies whoever recorded the game.

|                                                                                                                                        | iOS | Android |
| -------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| **A member records a game; the other member's phone shows a notification** within a few seconds                                        | ⬜  | ⬜      |
| **The person who recorded it is not notified** — they are holding the phone                                                            | ⬜  | ⬜      |
| **It names the board, not the player.** No player name appears on the lock screen                                                      | ⬜  | ⬜      |
| Tapping it opens the app — and does not crash from a cold start                                                                        | ⬜  | ⬜      |
| **Declining the notification permission means no push, and no error.** Somebody who said no should not be asked again by this feature  | ⬜  | ⬜      |
| **Signed in on two devices, both are notified** — a token is a row per device, and the second sign-in must not unregister the first    | ⬜  | ⬜      |
| **Recording while the other phone is offline**: it arrives when that phone comes back, or not at all — never as a duplicate            | ⬜  | ⬜      |
| **The outbox replaying a queued game sends no second notification.** Only a write that actually landed notifies                        | ⬜  | ⬜      |
| **A failed push never fails the write.** Break it deliberately (sign out on the receiver, delete the app) and recording still succeeds | ⬜  | ⬜      |
| Uninstalling the receiving app and recording again does not error on the sender — the token is forgotten on `DeviceNotRegistered`      | ⬜  | ⬜      |

**The quiet failure to watch for**: registration rides on the notification permission the timer
already asked for and never prompts on its own. So a device that never allowed notifications simply
never registers, silently and correctly. If nothing arrives, check the permission before suspecting
the token.

---

## Open defects

One entry per defect found this cycle, numbered in the order they were found (D1, D2, …), with an
anchor so the rows above can link to it. Keep an entry after it's fixed so the reasoning survives the
release; the whole section is cleared when the release ships, since by then the fix is in the
changelog and the reasoning is in the commit.

|               | Found in | State |
| ------------- | -------- | ----- |
| _(none open)_ |          |       |

---

## Known-and-accepted — do not file these

- **iPad mini uses the phone layout** — 744pt is under the 768 threshold, deliberate.
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
