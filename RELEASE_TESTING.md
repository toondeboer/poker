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

~193 rows, each wanting both platforms. Almost none of it is hard; the cost is **setup churn** —
flipping entitlements, switching backends, finding a second phone. Grouped so each setup is paid
for once.

Two switches decide what a build can see, and they are the axis everything below is sorted on:

- **`FORCE_PRO_IN_DEV`** in `PremiumContext.tsx` — forces Pro **and** Club together, from one
  literal. It is the only way to exercise either without a real purchase.
- **`backendConfig`** in `backendConfig.ts` — `DEV_BACKEND` for the pass, per §0.

**Session A — one device, both switches off.** Nothing here is entitlement-gated, so it is the
block to start with while the build is as checked out.

| § | Rows |
| --- | --- |
| 2. Blind editor | 15 |
| 5. Keyboard | 13 |
| 3. Generator | 7 |
| 4. Round duration | 5 |
| 8. Small phones | 4 |

Do §5 first. Its failure mode — a field under the keypad, a header behind the status bar — recurs
in §12 and elsewhere, and you will recognise it faster having just looked for it.

**Session B — a real device, both switches still off.** A simulator cannot answer these: iOS has no
auto-lock in the Simulator, and notifications do not work there.

| § | Rows |
| --- | --- |
| 6. Notifications & Live Activity | 15 |
| 10. Screen stays awake | 4 |
| 9. Cold launch | 3 |

**Session C — one device, `FORCE_PRO_IN_DEV = true`.** The biggest block in the pass, and the
newest code in the release.

| § | Rows |
| --- | --- |
| 13. Play a hand | 38 |
| 12. Leaderboard | 25 |
| 11. Payouts | 15 |

**Session D — one device, `FORCE_PRO_IN_DEV = true`, `backendConfig = DEV_BACKEND`.**

| § | Rows | Note |
| --- | --- | --- |
| 14. Accounts | 13 | **Never once run from the app.** Read the `email_verified` note first |
| 17. Kill switch | 4 | Run against **prod**, not dev — see §0 |

**Session E — two devices, same switches as D.** The most expensive setup, so do it in one sitting.
A third device is wanted for the "boards follow the account" row.

| § | Rows |
| --- | --- |
| 15. Shared boards | 16 |
| 16. Club, Pro, and what each unlocks | 7 |

**Session F — blocked until the build is on a store track.** Play Billing cannot be exercised from
a local build at all, so this cannot be brought forward. It is why submission goes to the testing
track first.

| § | Rows |
| --- | --- |
| 1. Billing | 13 (16 cells marked 🚫) |

**Session G — a tablet.** §7, 7 rows.

### The switch trap

**Some rows test the *locked* state, and those need the switch back off.** §16 in particular asks
what a non-subscriber sees, and the whole point of the share button being hidden without Club is
that it is invisible — which `FORCE_PRO_IN_DEV = true` destroys. `FORCE_FREE_IN_DEV` exists for the
opposite case, when the store account signed into the device already owns `pro_lifetime` and you
want the ad-supported UI anyway. **Only one of the two may be true at a time.** Plan on running §16
twice, once each way, rather than discovering halfway through that every locked-state row passed
because everything was unlocked.

### Where the risk actually is

- **§11–§13 are 78 of the ~193 rows** and cover what this release invented. If time runs short,
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

| Fix | Where it shows up |
| --- | --- |
| A deleted board came back on the next pull | §12 deleting a group · §15 a board rejoined by link |
| Bounty knockouts dropped on every relaunch | §13 a bounty game, then **relaunch and re-read the standings** |
| A refused game closed the sheet and lost the entry | §12 recording a game |
| Renaming to a duplicate or empty name | §12 — the rename rows already exist |
| A refusal notice shown on the wrong board | §15 two boards, one refusal |
| Identical chip stacks split unevenly | §11 a chop with two equal stacks |
| Chop sheet blank with every stack cleared | §11 clear all stacks to 0 |
| A half-written token signed you out silently | §14 force-quit mid-sign-up |

---

## 1. Billing — the highest risk in any release · **blocks submission**

Nothing in development can exercise this fully: the Android emulator has no Play Billing
(`BILLING_UNAVAILABLE`) and the Simulator has no StoreKit configured. Needs a real device with a
sandbox/test account, and for Android, a build uploaded to a Play track.

| | iOS | Android |
|---|---|---|
| Paywall opens from all five entry points (Pro card, Presets, Sound Pack, Payouts, Leaderboard) | ⬜ | ⬜ |
| Price string renders (not blank, not `one-time` alone) | ⬜ | ⬜ |
| **Purchase completes** and Pro unlocks (ads gone, Presets, Sound Pack, Payouts + Leaderboard usable) | ⬜ | 🚫 [see below](#android-billing) |
| **Restore purchases** works on a fresh install of the same account | ⬜ | 🚫 [see below](#android-billing) |
| Cancelling a purchase leaves the app in a sane state, no error toast | ⬜ | 🚫 [see below](#android-billing) |

### 1b. The Club subscription · **new in 1.2.0**

A subscription is not a second one-time purchase. **It ends**, and nothing in this app has ever had
to handle something a person bought stopping working — every row below is a first.

| | iOS | Android |
|---|---|---|
| Both SKUs appear and are priced — monthly **and** annual. One store having only one of them is a half-shipped product | ⬜ | 🚫 [see below](#android-billing) |
| **Subscribing grants Pro as well.** A subscriber who never bought Pro can open the leaderboard — otherwise they are hosting a board they cannot see | ⬜ | 🚫 |
| **Restore brings back both**, on a fresh install of the same account — Pro and Club, not one of them | ⬜ | 🚫 |
| Cancelling in the store leaves the app sane, and access continues to the end of the paid period | ⬜ | 🚫 |
| **After it expires: sharing stops, and Pro does not.** Once a subscription has granted Pro it keeps it, so the boards stay visible and only hosting goes. Getting this wrong takes the sight of every board they own | ⬜ | 🚫 |
| An expired subscriber's **existing shared boards keep working for the other members** — they are still on the server, and stranding them is worse than the cost it saves | ⬜ | 🚫 |
| Resubscribing restores hosting without anything being lost | ⬜ | 🚫 |
| A Pro-only buyer is **never** told to buy Pro again by any Club message | ⬜ | 🚫 |

> **Expiry is the row most likely to be skipped and most likely to hurt.** Sandbox subscriptions
> renew and expire on a compressed clock — minutes rather than months on both stores — so it is
> genuinely testable in an afternoon. `entitlementsFrom` reads `entitlements.all` rather than
> `active` precisely so a lapsed subscriber keeps Pro through a reinstall; this is what proves it.

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
| Payouts: focus the **Bounty** field — now the lowest of six, so it's the one Android's edge-to-edge would leave under the keypad | ⬜ | ⬜ |
| Leaderboard: focus **Add a player** with the roster long enough to scroll — field stays visible | ⬜ | ⬜ |

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
| First launch after install asks for notification permission **exactly once** | ➖ | ⬜ |
| **After denying once**, force-stop and relaunch → still **exactly one** dialog, and it's the system sheet ("Allow Poker Timer to send you notifications?"), not an app-drawn alert in front of it | ➖ | ⬜ |
| Denying **twice** blocks the permission permanently (Android's own behaviour) — confirm the background timer degrades rather than crashes, and that Metro logs the "permanently denied" warning | ➖ | 🟡 |
| **With notifications denied, Settings shows the "Notifications are off" card** at the top, above Pro. It is the only route back and has never run on a device | ➖ | ⬜ |
| Its **"Turn on notifications"** button shows the *system* dialog when Android will still ask, and falls through to the "Open Settings" alert when it will not — the permanently-blocked case | ➖ | ⬜ |
| Granting the permission in system settings and **returning to the app makes the card disappear** without a relaunch | ➖ | ⬜ |
| The card is **absent** whenever notifications are allowed, and absent on iOS entirely | ⬜ | ⬜ |
| **Force-quit mid-round, relaunch → exactly one Live Activity**, not two. Repeat three times: still one, and it's the live round rather than a stale one | ⬜ | ➖ |
| Stopping/resetting the timer leaves **no** Live Activity behind, including any stray from an earlier session | ⬜ | ➖ |
| Swipe a Live Activity away by hand mid-round, then change level → a fresh card appears and there is still only one | ⬜ | ➖ |

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
| Generator and Pro sheets capped at 640 and centred, **not** full-bleed (the 1.2.0 fix — was 🟡 accepted in 1.1.4) | ⬜ | ⬜ |
| Payouts: cards capped and centred, payout rows readable | ⬜ | ⬜ |
| Leaderboard: standings and the record sheet capped and centred | ⬜ | ⬜ |
| iPad **mini** still gets the phone layout | ⬜ | ➖ |

---

## 8. Small phones

| | iOS | Android |
|---|---|---|
| Timer fits with no scrolling, nothing clipped | ⬜ | ⬜ |
| Settings cards readable, no overlap | ⬜ | ⬜ |
| Blind rows: level chip, LIVE badge and both buttons all fit | ⬜ | ⬜ |
| Payouts: "Paid places" segments wrap rather than breaking a label mid-word — check at **25+ players**, which offers the most segments | ⬜ | ⬜ |

---

## 9. Cold launch

| | iOS | Android |
|---|---|---|
| Launch → no visible resize before the timer appears | ⬜ | ⬜ |
| Leaderboard survives a force-stop: players, games and standings all still there | ⬜ | ⬜ |
| Payout settings survive a force-stop (buy-in, bounty, denomination, pinned places) | ⬜ | ⬜ |
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

## 11. Payouts (Pro)

Almost all of the *arithmetic* here is unit-tested in `@poker/core` — the table summing to exactly
the prize pool is asserted across the whole realistic input range, so a row that just re-adds the
numbers is wasted effort. **What's left for a human is the screen**: that the controls fit, the
keypad doesn't cover them, and the figures land where you can read them.

Set `FORCE_PRO_IN_DEV` in `PremiumContext.tsx` to see the unlocked screen without buying.

| | iOS | Android |
|---|---|---|
| Locked state: Settings row shows the Pro pill, the screen still opens and offers the unlock | ✅ | ⬜ |
| Buy-in / Players / Rebuys / Add-ons / Bounty accept typing and a **cleared field doesn't show a literal `0`** | ⬜ | ⬜ |
| **Add-on price** appears only once Add-ons is above 0, and disappears again at 0 | ⬜ | ⬜ |
| Rebuys grow the pool and the Entries row reads "8 players + 4 rebuys". Places follow the **player** count, not entries — but a bigger pool *can* fund one more place, so don't treat the count as fixed | ⬜ | ⬜ |
| Payout rows and "Where it comes from" reconcile on screen: prize pool + bounties = collected | ⬜ | ⬜ |
| A bounty **equal to or above** the buy-in explains itself instead of showing an empty table | ⬜ | ⬜ |
| Pinning a place count overrides Auto; switching back to Auto follows the field again | ⬜ | ⬜ |
| Settings' Payouts summary row updates after editing and going **back** (not just on relaunch) | ⬜ | ⬜ |
| **Share payouts** opens the share sheet, and the pasted text matches the table on screen | ⬜ | ⬜ |
| **Chop sheet**: shares add up to the money still on the table, and nobody is below the guarantee | ⬜ | ⬜ |
| Chop sheet: the chip fields are usable with the keypad up, and the sheet header clears the status bar | ⬜ | ⬜ |
| Chop button is hidden when only **one** place is paid — there is nothing to split | ⬜ | ⬜ |
| **Bounty type** appears only once a bounty is set, and disappears again at 0 | ⬜ | ⬜ |
| Choosing **Progressive** renames the field to "Starting bounty" and the summary row to "Starting at N a head, growing" — the screen must not say "per knockout" anywhere while it is on | ⬜ | ⬜ |
| **Share payouts** on a progressive tournament sends the progressive line, not the flat one | ⬜ | ⬜ |

---

## 12. Leaderboard (Pro)

The aggregation, ranking and tie-breaks are unit-tested. The human rows are the roster editing, the
record-a-game interaction, and persistence — see also the cold-launch row in §9, which is the one
that matters most here because **this is the only data in the app a user can't recreate by retyping
it**.

| | iOS | Android |
|---|---|---|
| Locked state: Pro pill on the Settings row, screen opens and offers the unlock | ✅ | ⬜ |
| Adding a player: duplicate and empty names keep the button disabled | ⬜ | ⬜ |
| Name field isn't covered by the keypad, and dismisses on return | ⬜ | ⬜ |
| Record a game: tapping who played, then tapping them in finishing order, gives 1st/2nd/3rd | ⬜ | ⬜ |
| Winnings shown per place match the Payouts screen **for the field that turned up**, not the saved player count | ⬜ | ⬜ |
| Un-picking a player who was already ranked also clears their place | ⬜ | ⬜ |
| Saving updates the standings, and Settings' summary row, immediately | ⬜ | ⬜ |
| Removing a player keeps past games — everyone else's totals unchanged | ⬜ | ⬜ |
| **End-of-game prompt:** advance past level 1, then reset → "Record this game?" appears; "Record" opens the sheet with the roster in it | ⬜ | ⬜ |
| Resetting on **level 1** does *not* prompt (it's a mis-tap, not a finished game) | ⬜ | ⬜ |
| No prompt with an **empty roster**, or when Pro is locked — the sheet would have nothing to offer | ⬜ | ⬜ |
| Back from a prompt-opened leaderboard returns to the **timer**, and the header says "Back" | ⬜ | ⬜ |
| Record sheet: header clears the status bar and the footer clears the keypad (the §5 failure mode) | ⬜ | ⬜ |
| Group row shows the current board and opens the sheet; switching groups swaps the standings **and** the roster | ⬜ | ⬜ |
| Creating a group makes it active and empty; the previous group's players and games are untouched when you switch back | ⬜ | ⬜ |
| Renaming a group in place commits on return **and** when you tap away — a row, another group's buttons, the backdrop, Done — rather than being discarded | ⬜ | ⬜ |
| An empty or duplicate rename shows the reason under the field **while typing**, and leaves the group's name as it was | ⬜ | ⬜ |
| Reopening the sheet after a rename doesn't come back mid-edit with the keyboard up | ⬜ | ⬜ |
| Deleting a group warns how many games go with it, and the board falls back to another group rather than showing nothing | ⬜ | ⬜ |
| Groups sheet: the rename field isn't covered by the keypad, and the sheet header clears the status bar (the §5 failure mode) | ⬜ | ⬜ |
| **Upgrading keeps an existing leaderboard.** Record a game on the *previous* build, update, reopen → the same players, games and standings, unchanged | ⬜ | ⬜ |
| **Share standings** is disabled with nothing to report, and enabled once a game is recorded — including after **removing every player**, which keeps the games but leaves nothing to say | ⬜ | ⬜ |
| Shared standings text lists only players who have played, ranked, with no markdown characters | ⬜ | ⬜ |
| **Signed out, no "that's me" affordance appears** on any player row — this is the state every user is in until accounts ship | ⬜ | ⬜ |
| A player left linked to an account that no longer exists can still be **unlinked**, so they aren't stuck | ⬜ | ⬜ |

---

## 13. Play a hand (Pro)

The rules are unit-tested to death in `@poker/core` — whole games are played out by the thousand,
chips conserved, every card dealt once. **What is left for a human is the passing-the-phone part**,
which no test can see: whether the next player's cards are ever visible to the last one, and whether
the table can follow what is happening from across it.

| | iOS | Android |
|---|---|---|
| Locked state: Pro pill on the Settings row, the screen still opens and offers the unlock | ⬜ | ⬜ |
| Seating: tapping a player seats them, tapping again unseats; Deal stays disabled below two | ⬜ | ⬜ |
| Deal is refused when the big blind isn't above the small one, or a stack isn't above the big blind | ⬜ | ⬜ |
| Blinds post to the correct seats, the pot reads their sum, and the seat **after** the big blind acts first | ⬜ | ⬜ |
| **Cards stay hidden until tapped, and re-hide the moment the turn passes** — pass the phone round a full orbit and confirm nobody sees the next player's hand | ⬜ | ⬜ |
| Heads-up: the button posts the small blind and acts first pre-flop, then **last** on every street after | ⬜ | ⬜ |
| Fold / check / call each do what they say, and the stacks move by the right amounts | ⬜ | ⬜ |
| Raise: typing an amount below the minimum or above the stack leaves the confirm button disabled | ⬜ | ⬜ |
| Min / Pot / All in **fill the amount in without acting**; raising always needs the confirm tap | ⬜ | ⬜ |
| The Pot button is absent when a pot-sized raise would be the minimum or all-in anyway | ⬜ | ⬜ |
| The amount resets to the minimum when the turn passes, so nobody inherits the last player's number | ⬜ | ⬜ |
| Raise: the amount field isn't covered by the keypad — it is the lowest control on a long screen (the §5 failure mode) | ⬜ | ⬜ |
| A short stack all-in for less builds a side pot, and the big stack can't win chips nobody matched | ⬜ | ⬜ |
| Showdown reveals only the players still in, names the hand, and the awards add up to the pot | ⬜ | ⬜ |
| Everyone folding to one player ends the hand with **no cards shown** | ⬜ | ⬜ |
| A knocked-out player is left out of the next deal, and the button skips them | ⬜ | ⬜ |
| Last player standing ends the game and shows the finishing order | ⬜ | ⬜ |
| **A game survives a force-stop.** Deal a hand, kill the app from the switcher, reopen → same table, same stacks, same cards, same player to act | ⬜ | ⬜ |
| A game survives between hands too, and a finished-but-unsaved game still offers Save after a relaunch | ⬜ | ⬜ |
| Ending a game clears it — reopening the screen offers the setup form, not the last table | ⬜ | ⬜ |
| **"New game" on a finished, unsaved game asks first**, and does not cover the showdown while it does — the hand that decided it stays readable behind the alert | ⬜ | ⬜ |
| On that alert, **Save is the top button and Discard is below it** (iOS moves Cancel to the bottom, which once put Discard in the easiest slot) | ⬜ | ➖ |
| **Save from the alert that cannot save keeps the game.** Finish a game, switch board on the Leaderboard screen, come back, New game → Save → the refusal is shown and the table is still there | ⬜ | ⬜ |
| **"End the game" between hands asks too** — an evening in progress cannot be put on the leaderboard or recovered, and the button sits under "Next hand". It only appears between hands, never mid-hand | ⬜ | ⬜ |
| Ending a game where **nothing has been dealt** does not ask — there is nothing to lose, and a confirmation there is one people learn to tap through | ⬜ | ⬜ |
| Ending an **already-saved** game does not ask, because there is nothing left to lose | ⬜ | ⬜ |
| **Save to the leaderboard** records the finishing order the game produced, with winnings from the Payouts screen priced for the field that sat down | ⬜ | ⬜ |
| The saved game appears in the standings immediately, and the winner's count goes up | ⬜ | ⬜ |
| Saving with **no buy-in set** still records the finishing order, everyone winning nothing — a friendly game still has a winner | ⬜ | ⬜ |
| The Save button doesn't offer itself twice — **save, go back, reopen the screen**, and it still says saved rather than offering to record the same night again | ⬜ | ⬜ |
| Switching leaderboard group mid-game and then saving is **refused**, with a message saying which board to switch back to | ⬜ | ⬜ |
| Rebuys or add-ons left set on the Payouts screen don't inflate what a dealt game records — this game has no way to buy back in | ⬜ | ⬜ |
| **Knockouts reach the board.** Play a game out with a bounty set, save it, and the standings show a KO count and the bounty money in the total | ⬜ | ⬜ |
| A knockout on a **split pot** credits both players one KO each, and the bounty between them — not one each | ⬜ | ⬜ |
| **Progressive**: the winner's bounty money is visibly more than the flat amount would have been, because they collect their own grown head at the end | ⬜ | ⬜ |
| A hand where everyone folds and the busted player's pot goes unclaimed shows the "went unclaimed" line on the game-over card rather than silently losing the money | ⬜ | ⬜ |
| Readable across a table — card faces, stacks and whose turn it is, at arm's length | ⬜ | ⬜ |
| Tablet: the table is capped and centred rather than running the full width | ⬜ | ⬜ |

---

## 14. Accounts · **new in 1.2.0, and never once run from the app**

### 14b. Signing in with Apple and Google · **new, and never run**

**Needs `backendConfig = DEV_BACKEND` and a rebuilt dev client** — `expo-web-browser` and
`expo-crypto` are native, so a reloaded JS bundle talks to a binary that does not have them.

| Row | iOS | Android |
| --- | --- | --- |
| **Continue with Apple** on a fresh install creates an account and signs in | ⬜ | ⬜ |
| **Continue with Google** on a fresh install creates an account and signs in | ⬜ | ⬜ |
| Signing out and back in with the same provider returns to the **same** account, not a new one | ⬜ | ⬜ |
| **The linking case.** Sign up with email+password, sign out, then sign in with a provider on the *same address* — the boards and season are still there. This is the one that fails silently and looks exactly like data loss | ⬜ | ⬜ |
| **Hide My Email** (Apple → "Hide My Email") signs in and gets its own account. Expected: it does *not* link to an existing one, because the relay address matches nothing | ⬜ | ⬜ |
| Closing the provider sheet halfway leaves the screen usable, with **no red error** — cancelling is not a failure | ⬜ | ⬜ |
| Declining at the provider does the same | ⬜ | ⬜ |
| **Use email instead** reveals the email form, and email sign-in still works | ⬜ | ⬜ |
| With the phone in aeroplane mode, tapping a provider says the network is unavailable rather than "that didn't work" | ⬜ | ⬜ |


Every screen here was written, wired to Cognito and exercised from a script. **None of it has been
used from inside the app**, which is a different thing — the script never mistyped a code, never
backgrounded the phone mid-flow, and never had to find the entry point.

**Read this before starting.** The account screens are reachable from Settings, and `backendConfig`
must point at a real backend or they cannot work at all. If sign-up says the build cannot do it,
that is the switch, not a bug.

| | iOS | Android |
|---|---|---|
| Settings shows the account row, and it opens the account screen | ⬜ | ⬜ |
| **Sign up with a real address → the code arrives.** This is the row the whole feature rests on: Cognito's own sender was capped and landed in spam, which is why it now goes through SES | ⬜ | ⬜ |
| The code arrives **in the inbox, not spam**, and is from `Poker Blinds Timer` | ⬜ | ⬜ |
| Confirming with the emailed code signs you in | ⬜ | ⬜ |
| **After confirming, the account can reset its password.** A user confirmed without the emailed code ends up `email_verified: false` and Cognito refuses to send to them at all — it reads as a mail failure and is not one. [See D-note](#accounts-email-verified) | ⬜ | ⬜ |
| A **wrong code** says so and lets you try again, rather than dead-ending | ⬜ | ⬜ |
| An **already-taken email** says so in words, not an error code | ⬜ | ⬜ |
| A **wrong password** on sign-in says so and does not clear the email field | ⬜ | ⬜ |
| Sign out, then sign back in — the boards are still there | ⬜ | ⬜ |
| **Force-quit mid-sign-up, relaunch** → not signed in and not stuck; signing up again with the same address behaves sanely | ⬜ | ⬜ |
| **Airplane mode during sign-in** says there is no connection, and does **not** sign you out of an existing session | ⬜ | ⬜ |
| **Delete account removes the data, not just the login.** Delete, then sign up again with the same address: no old boards, no old claims. App Store 5.1.1(v) asks for the data as well | ⬜ | ⬜ |
| After deleting, the app still works — local boards intact, timer fine, no crash on next launch | ⬜ | ⬜ |

<a id="accounts-email-verified"></a>
> **Why the password-reset row is there.** Both smoke accounts were `CONFIRMED` with
> `email_verified: false`, because they had been confirmed administratively rather than through the
> emailed code. Cognito then refuses to send to them — *"no registered/verified email"* — which looks
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

| | iOS | Android |
|---|---|---|
| **The host shares a board** — the code arrives in the share sheet with a message naming the app | ⬜ | ⬜ |
| **A second device joins by pasting the code**, and the board arrives with its whole roster and season, not empty | ⬜ | ⬜ |
| Pasting **the entire shared message** works, not just the bare code | ⬜ | ⬜ |
| A **wrong or expired code** says so and leaves the app usable | ⬜ | ⬜ |
| **A guest pays nothing.** A device with neither Pro nor Club joins, and can read the board it was sent — if it hits a paywall, the feature is dead | ⬜ | ⬜ |
| That guest **cannot** create a board of their own (Pro) or share one (Club) — the create and share controls are absent, not broken | ⬜ | ⬜ |
| **A player added on one device appears on the other** after foregrounding it | ⬜ | ⬜ |
| **A game recorded on one appears on the other**, with the same standings | ⬜ | ⬜ |
| **Record with no signal, then reconnect.** Airplane mode, add a player and record a game, come back — both arrive, and nothing was lost or doubled | ⬜ | ⬜ |
| **A deletion propagates.** Remove a player on the host; the guest stops showing them | ⬜ | ⬜ |
| **A local delete stays deleted.** Delete a game on the guest, foreground twice — it does not come back | ⬜ | ⬜ |
| **A board deleted locally stays deleted**, and is not re-added by the next sync | ⬜ | ⬜ |
| The **share button is absent on a board you joined** — only an admin can invite, so offering it would only ever explain itself | ⬜ | ⬜ |
| **Sign in on a third device → the boards are there**, without anybody sharing anything | ⬜ | ⬜ |
| A write the server refuses shows the "Not saved for others" card, and dismissing it works | ⬜ | ⬜ |
| Renaming a board on one device does **not** revert on the next sync | ⬜ | ⬜ |

---

## 16. Club, Pro, and what each unlocks

The rules are unit-tested in `clubPolicy`. **What a human has to check is that nobody is told to buy
something they already own**, which is the failure that reaches a store review.

| | iOS | Android |
|---|---|---|
| A **Pro-only** account (no Club) can use every local feature and **cannot** share a board — and the message names Club, not Pro | ⬜ | ⬜ |
| A **Club** subscriber gets Pro with it — the leaderboard works without buying Pro separately | ⬜ | ⬜ |
| A Club subscriber sees **"Pro is included with Club"**, not "Pro unlocked" — the second implies a permanence they have not got | ⬜ | ⬜ |
| **Restore purchases is offered even when the app thinks you are unlocked.** The person who needs it most is the one whose purchase this device has not recognised | ⬜ | ⬜ |
| Buying **Pro** while subscribed does not double-charge or confuse the paywall | ⬜ | ⬜ |
| Nobody is ever told to buy something they hold — check the messages for a Pro-only, a Club-only, and a signed-out account | ⬜ | ⬜ |
| A **signed-out** person tapping "Join a board" is offered a sign-in, not a paywall and not an empty sheet | ⬜ | ⬜ |

---

## 17. The kill switch

**An untested switch is worse than none**, because it gets reached for in an emergency. Verified
from a laptop against dev in both directions; these rows are the app half.

| | iOS | Android |
|---|---|---|
| With `featureSharing=off` deployed, a **cold launch** shows no share button and no join field, and nothing syncs | ⬜ | ⬜ |
| Turning it back on and relaunching restores both — within the 60-second cache | ⬜ | ⬜ |
| With `featureAccounts=off` deployed, a **cold launch** shows no Account row in Settings; `pokerkit://account` still opens the screen, because a confirmation email has to land somewhere | ⬜ | ⬜ |
| **With the backend unreachable entirely** (airplane mode at launch), the app treats the features as off rather than queueing writes at a server that is not there | ⬜ | ⬜ |

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
