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

|     |                                                                           |
| --- | ------------------------------------------------------------------------- |
| ❌  | **broken** — write it up under [Open defects](#open-defects)              |
| 🔧  | broken, **fixed in code**, waiting on a re-test to become ✅              |
| ⬜  | not run yet                                                               |
| 🚫  | **blocked on something other than time** — read the row to find out which |

A fix landing never upgrades a row on its own: ❌ becomes 🔧, and only a re-test on hardware makes it
✅. Anything left as ❌ 🔧 ⬜ 🚫 still wants a human; 🟡 has already been ruled on.

**🚫 means four different things in this file, and conflating them wastes a session.** It used to be
defined as "needs TestFlight or Play internal testing", which is only the first of these:

| Blocked on                         | Where                                                         | What unblocks it                      |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| A build on a store track           | §1 and §1b's billing rows, §13's locked state, §9's deep link | Submitting a candidate                |
| Somebody with an inbox             | §14's sign-up and deletion rows                               | A real address; `DEV_BACKEND` is fine |
| A second Apple ID                  | §14b's Hide My Email row                                      | Another Apple account, or accept it   |
| Time that cannot pass in a sitting | §18's six-hour session expiry                                 | Nothing — it is unit-tested instead   |

Cutting step 6 in [CLAUDE.md](./CLAUDE.md) says to run "whatever rows are marked 🚫" on the store
build. Only the first row of that table is what it means.

<a id="mirroring"></a>

## A ✅ in both columns does not always mean it was run twice

**Adopted 2026-09-20.** Most of this app is one React Native codebase, and for a large class of rows
the two platforms run the _same JavaScript against the same state_. Running those twice buys nothing
and costs the time that the rows which genuinely differ need. So where a row was verified on one
platform and **no platform-specific implementation stands behind it**, the other column is marked
from it rather than re-run.

**Mirrored:** §2, §3, §4, §11, §13, §15, §15b, §16 and §16c — blind-editor drafts, the generator,
round duration, payout arithmetic and conditional fields, the dealer, shared boards, the guideline
1.2 rows, and entitlement gating and copy. All of them are shared JS with no native component in the
path.

**Never mirrored, because this repo has been bitten by every one of them:**

|                               | Why                                                                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1, §1b, §16b billing         | Two different stores, and Play Billing cannot run on an emulator at all                                                                                                 |
| §5 keyboard                   | Android's edge-to-edge means nothing here comes for free; it is the most-regressed area in the app                                                                      |
| §6 notifications, §19 push    | A foreground service and FCM against `UNUserNotificationCenter` and APNs                                                                                                |
| §7, §8 device sizes           | Different devices, not just different platforms — **D5** was a layout defect found on one and invisible on the other                                                    |
| §9 cold launch and deep links | The dev launcher owns the scheme on one and not the other                                                                                                               |
| §10 keep-awake                | A window flag against an idle timer                                                                                                                                     |
| §14, §14b accounts            | Apple and Google are different providers — **D1** succeeded on iOS and failed on Android on the same commit                                                             |
| §18 shared clock              | Its own note already says each column is **the platform that pressed**                                                                                                  |
| Sheets and navigation         | The form-sheet work in [CLAUDE.md](./CLAUDE.md) was an iOS-only failure across two `react-native-screens` versions; hardware back and swipe-back are different gestures |

**The risk this accepts, stated plainly.** D1 — a provider sign-in ending on "Unmatched Route" — was
**Android-only on a commit where iOS passed**, and would have been missed by a mirror. It is in the
never-mirrored list for exactly that reason, but the list is a judgement and judgements are wrong
sometimes. A mirrored ✅ is evidence that the logic is right, not that the platform renders it
right.

<a id="passes-run"></a>
**Passes run** — what hardware the ✅s came from, one line each. Detail that outlives a pass belongs
in the section it was found in, not here; this list is cleared when the release ships.

| #   | Where                                                                                                                           | What it covered                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | iPhone 17 Pro Simulator, iOS 26.5, dev client                                                                                   | **Locked / non-Pro states only** — both Pro pills, the locked Payouts and Leaderboard cards, the paywall's six features, the banner ad, and the end-of-game prompt staying silent without Pro                                  |
| 2   | `Android_small` emulator, API 35, 30s screen timeout                                                                            | §10 keep-awake, read off the window flag and `mWakefulness`. iOS still wants a real device — the Simulator has no auto-lock                                                                                                    |
| 3   | iPhone 17 Pro Simulator **+** `Pixel_stable` API 35, dev clients on `DEV_BACKEND`, `FORCE_PRO_IN_DEV`, two dev-pool accounts    | 2026-09-13/14 — §15 boards, §18 clock, §19 registration, §14's email sign-in. Found the shared-clock and shared-board defects fixed in #268 and before it; nothing in those sections passed until they were                    |
| 4   | iPhone, **TestFlight build 28** (candidate 2, from `8b03ac5`)                                                                   | 2026-09-15 — §20 in full, and §1's Pro rows: price, purchase, restore on a fresh install, cancelled purchase                                                                                                                   |
| 5   | iPhone, TestFlight build 28, ordinary Apple ID                                                                                  | 2026-09-16 — §1b's pricing and purchase rows, and §16b — **which is where #272 was found**                                                                                                                                     |
| 6   | iPhone, TestFlight build 28 **+ a Sandbox Apple Account**                                                                       | 2026-09-16 — the whole subscription life cycle, including §1b's expiry row on a device for the first time: hosting went, Pro stayed. The recipe is under §1b                                                                   |
| 7   | **Android phone, Play internal versionCode 18** (candidate 3, from `96361a2`), factory-reset, one licence-tester Google account | 2026-09-19 — §20's prod check and update row, the whole free-state Guideline 3.1.2 block with no purchase made, then Club monthly bought, cancelled and lapsed, the annual, §3, §5 and §9's deep link. Found **D1** and **D2** |
| 8   | **Android (host, Club) + iPhone (guest), both candidate 3** — build 29 on TestFlight, separate Cognito accounts                 | 2026-09-19 — §15's sharing loop across platforms: share, join, propagation both ways, deletion, and the offline outbox. The iPhone carried Club via the Apple ID, so §15's two _guest pays nothing_ rows could not run         |

**What no pass has touched:** as of 2026-09-19, very little of the above is still true — Android
billing, sharing across two platforms, push delivery and the shared clock have all now been
exercised on candidate 3. What remains unrun is listed per section.

<a id="play-verification"></a>

> 🛑 **Android submission is blocked outside this repo, and it blocks the Android pass with it.**
> `eas submit -p android` fails before uploading:
>
> > _Invalid request — To meet Play Console requirements, your app's package name must be registered
> > to your verified developer identity. Go to the Android developer verification page to complete
> > the registration process for this app._
>
> Google's **developer verification**, not anything about the binary, the signing key or the track.
> **It is new today**: versionCode 18 reached the internal track normally at 07:30 on 2026-09-19 and
> versionCode 19 was refused the same evening, so enforcement arrived or a grace period lapsed in
> between.
>
> **Every remaining Android row that needs a store build is stuck behind it** — §1's purchase rows,
> §13's locked state, §16's Pro-only rows, and re-testing the four 🔧 rows on candidate 4. Identity
> checks can take days, so this is a schedule risk rather than a technical one, and it is worth
> starting before anything else. Tracked on the release PR's gates.

> **TestFlight shows a build only to members of a tester group.** Build 28's upload was fine and
> invisible until the tester was added to one. If a build is "missing" from TestFlight, check the
> group before rebuilding anything.

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

      **The gate before `eas build` is cutting step 5 in [CLAUDE.md](./CLAUDE.md)**, not a
      `git status` on `apps/mobile/src`: eas-cli uploads untracked files anywhere in the tree, and
      a toggle that was _committed_ while flipped (it happened once, via `git add -A`) passes any
      working-tree check. Step 5 reads both values out of `HEAD` for that reason.

- [⬜] **Run §17, the kill switch, against dev** — and read prod with `curl` rather than deploying to
  it. The app half of those rows does not depend on which backend answers, and the prod half is one
  command: `curl https://poker-api.toondeboer.com/config` should say
  `{"accounts":true,"sharing":true}` (it did on 2026-09-04, 2026-09-12 and 2026-09-18). This said
  "against prod" until somebody worked out what that means. The flags are CDK context —
  `featureAccounts` / `featureSharing`, defaulting to `on` and absent from `cdk.json` — so flipping
  one is **a deploy to production**, and the Infra workflow cannot do it at all: its only input is
  the stage. Against dev it is
  `npm run deploy:dev -w @poker/infra -- -c featureSharing=off`, from a laptop with credentials,
  and re-running it without the flag puts it back. Doing that to prod during a review is how a
  reviewer meets a feature that has been switched off.
- [⬜] **And §15–§16 need the Club entitlement.** A dev client cannot buy it, so set
  `FORCE_PRO_IN_DEV` in `PremiumContext.tsx`, which forces Pro **and** Club. Without it the share
  button and join field are simply not there, which reads exactly like sync being broken. On a
  store build, buy it in the sandbox instead.
- [⬜] **§15 needs two devices**, and a third for the "boards follow the account" row. One phone
  cannot see any of the failures worth finding.

---

## Running the pass: what needs what

**Where things stand is `npm run testing:status`** — rows and cells per section, by icon. Do not
write a count into this file; every one it carried went stale within a day. The cost of the pass
is **setup churn** — flipping entitlements, switching backends, signing two accounts in on two
devices — so the sessions below group rows so each setup is paid for once.

**Where a session runs is not "any device".** A dev client and a store build share a bundle id, and
on Android they are signed with different keys — so swapping between them means uninstalling, which
takes the local data you were about to test with it. Keep them apart:

- **This Mac** — the iOS Simulator plus an Android emulator on a **Google Play** system image (FCM
  and the Google sign-in tab both want Play services). Dev clients, `DEV_BACKEND`.
- **The phones** — store builds only, which means `PROD_BACKEND` and the rows in §20.

Three switches decide what a build can see:

- **`FORCE_PRO_IN_DEV`** in `PremiumContext.tsx` — forces Pro **and** Club together, from one
  literal. It is the only way to exercise either without a real purchase.
- **`FORCE_FREE_IN_DEV`** beside it — forces the free/ad experience. **Only one of the two may be
  true at a time.**
- **`backendConfig`** in `backendConfig.ts` — `DEV_BACKEND` for everything on the Mac, per §0.

**Two accounts cost one inbox.** Sign-up wants an address with one `@`, no whitespace and something
either side (`validateCredentials` in `@poker/core`), so `you+a@…` and `you+b@…` are two accounts
that both arrive in one place. Every two-account session below uses the same pair.

| Session | Where                                          | Switches                 | Sections                                                                               |
| ------- | ---------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| **S1**  | Mac + a real inbox                             | both off                 | §14 accounts, including delete · §14b on Android, re-run on iOS                        |
| **S2**  | Mac                                            | PRO=true, then FREE=true | §16, run twice                                                                         |
| **S3**  | Simulator **and** emulator, signed in as A / B | PRO=true on both         | §15 boards · §15b · §18 clock · §19 registration                                       |
| **S4**  | Mac                                            | PRO=true                 | §11 payouts · §12 leaderboard · §13 dealer **on iOS**                                  |
| **S5**  | Mac                                            | both off                 | §5 keyboard first, then §2 · §3 · §4 · §8                                              |
| **S6**  | iPad Simulator                                 | PRO=true                 | §7 tablets                                                                             |
| **S7**  | Mac, against **dev**                           | both off                 | §17 kill switch                                                                        |
| **P**   | The phones, once a candidate is on a track     | none — a release build   | §20 first, then §1 · §1b · §16b · §16c · §19 delivery · §9 · §13 locked · §6 · §10 iOS |

**S1 comes first for what it unblocks**, not for itself: every two-account session is stuck behind
it, and its rows need a person with an inbox rather than a script.

**Do §5 before §11–§13.** Its failure mode — a field under the keypad, a header behind the status
bar — recurs in every sheet those sections open, and you will spot it faster having just looked for
it.

**§19 does not fully run on the Mac, whatever this used to say.** Registration does, and is worth
checking there. Delivery did not, on 2026-09-14: APNs refused the iOS Simulator's token with
`BadDeviceToken` (a dev client's sandbox token against the environment Expo sends to), and FCM
accepted the Android emulator's message without it ever appearing. The rows that end with a
notification on screen want the phones and a store build — §20.

### The switch trap

**Some rows test the _locked_ state, and those need the switch back off.** §16 in particular asks
what a non-subscriber sees, and the whole point of the share button being hidden without Club is
that it is invisible — which `FORCE_PRO_IN_DEV = true` destroys. `FORCE_FREE_IN_DEV` exists for the
opposite case, when the store account signed into the device already owns `pro_lifetime` and you
want the ad-supported UI anyway. **Only one of the two may be true at a time.** Plan on running §16
twice, once each way, rather than discovering halfway through that every locked-state row passed
because everything was unlocked.

### Where the risk actually is

- **§19's delivery rows have never been seen to work**, on any build or platform — registration is
  all that has been run. §15 and §18 were in the same state until 2026-09-13/14, and their first runs
  found the shared clock broken three separate ways and shared boards unable to remove anything.
  That is what a section nobody has opened looks like.
- **Android billing has never been exercised at all** (§1, §1b, §16b), and it is the one area a
  laptop cannot help with: it needs the Play internal track and a licence tester. Budget for it
  rather than discovering it last.
- **§14's sign-up rows need a person with an inbox**, and every two-account row in §15–§19 is
  queued behind them.
- **§11–§13 cover what this release invented.** If time runs short, short-change something else.
- **Android has seen almost none of this.** Several features were checked on an iOS Simulator only,
  and synthetic taps do not exist here — assume the first real Android tap finds something.
- **§1 blocks submission** and cannot start until the build is on a track. It is the long pole, not
  the big one.

### The shortest pass that can ship

Everything in this file is worth running; not all of it is worth holding a release for. **If the
goal is shipping soon, these are the rows a release should not go out without**, because each is a
store rejection, a lost purchase, or a headline feature that does not work — and none of them is
covered by a unit test:

1. **§20** in full, on the phones, before anything else touches them.
2. **§1, §1b and §16b** on the store builds — billing and guideline 3.1.2.
3. **§14's sign-up, confirm, sign-in, delete rows** and **§14b's completed provider sign-in against
   prod** — the sign-in card is the first thing a reviewer taps.
4. **§15's first eight rows and §18's first eleven**, on two devices — share, join, sync, and the
   shared clock the listing advertises.
5. **§16c's first six rows** — that a person can tell a one-time purchase from a subscription.
6. **§3 and §5's sheet rows, and one look at every sheet**, on both platforms — #265 changed how
   every sheet lays out after candidate 1 was built.
7. **§13's peek rows on iOS**, and **§12's upgrade row** — the one piece of data a user cannot
   recreate.
8. **§19's first row on the phones.** The server fix is deployed, so a device can register now; what
   has never been seen is a notification arriving.

Anything else left ⬜ at submission should be a decision, not an accident: mark it 🟡 with the reason.

### Rows that cover a fix found by review

Defects fixed on the release branch that were **found by review rather than by testing** — so these are rows this checklist previously let through. Worth running
deliberately rather than waiting for them to come up in sequence.

| Fix                                                                               | Where it shows up                                        |
| --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| A deleted board came back on the next pull                                        | §12 deleting a group · §15 a board rejoined by link      |
| A refused game closed the sheet and lost the entry                                | §12 recording a game                                     |
| Renaming to a duplicate or empty name                                             | §12 — the rename rows already exist                      |
| A refusal notice shown on the wrong board                                         | §15 two boards, one refusal                              |
| Identical chip stacks split unevenly                                              | §11 a chop with two equal stacks                         |
| Chop sheet blank with every stack cleared                                         | §11 clear all stacks to 0                                |
| A half-written token signed you out silently                                      | §14 force-quit mid-sign-up                               |
| **2026-09-13:** hosting/joining a clock always refused                            | §18 host and join, signed in, with Club                  |
| **2026-09-13:** paywall sold Club under the kill switch                           | §16c and §17 with `featureSharing=off`                   |
| **2026-09-13:** sheet content stopped short of the edge                           | §3 bottom edge · §5 sheet rows · every sheet             |
| **2026-09-13:** no shared-clock press reached another phone                       | §18 pause, resume and level jump, both ways              |
| **2026-09-13:** email sign-in left the sign-in form on screen                     | §14 the email sign-in row                                |
| **2026-09-14:** nothing removed from a shared board reached anyone else           | §15 deletion propagates, offline removal, guest controls |
| **2026-09-16:** a subscriber could not reach the renewal terms or the legal links | §16b — as a **subscriber**, on candidate 3               |

---

## 1. Billing — the highest risk in any release · **blocks submission**

Nothing in development can exercise this fully: the Android emulator has no Play Billing
(`BILLING_UNAVAILABLE`) and the Simulator has no StoreKit configured. Needs a real device with a
sandbox/test account, and for Android, a build uploaded to a Play track.

|                                                                                                                                                                                                                                                                                                                                                                                 | iOS | Android                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------- |
| Paywall opens from **every** entry point. Settings' **Pro**, **Club**, **Presets** and **Sound Pack** cards; **Payouts**; **Leaderboard** (both its locked card _and_ "Share this board"); the **game** screen; the **Groups** sheet; and the **shared-clock** screen. **Was written as "five" and is not** — Club, Groups, the game screen and the shared clock all came later | ⬜  | ✅                               |
| Price string renders (not blank, not `one-time` alone)                                                                                                                                                                                                                                                                                                                          | ✅  | ✅                               |
| **Purchase completes** and Pro unlocks (ads gone, Presets, Sound Pack, Payouts + Leaderboard usable)                                                                                                                                                                                                                                                                            | ✅  | 🚫 [see below](#android-billing) |
| **Restore purchases** works on a fresh install of the same account                                                                                                                                                                                                                                                                                                              | ✅  | 🚫 [see below](#android-billing) |
| Cancelling a purchase leaves the app in a sane state, no error toast                                                                                                                                                                                                                                                                                                            | ✅  | 🚫 [see below](#android-billing) |
| **A refund revokes the entitlement.** Refund with _revoke access_ in the store console → the app loses Pro. **Known gap, accepted — [see D2](#d2-rtdn)**                                                                                                                                                                                                                        | 🟡  | 🟡                               |

### 1b. The Club subscription · **new in 1.2.0**

A subscription is not a second one-time purchase. **It ends**, and nothing in this app has ever had
to handle something a person bought stopping working — every row below is a first.

|                                                                                                                                                                                                                      | iOS | Android                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------- |
| Both SKUs appear and are priced — monthly **and** annual. One store having only one of them is a half-shipped product                                                                                                | ✅  | 🚫 [see below](#android-billing) |
| **Subscribing grants Pro as well.** A subscriber who never bought Pro can open the leaderboard — otherwise they are hosting a board they cannot see                                                                  | ✅  | ✅                               |
| **Restore brings back both**, on a fresh install on the same store account — Pro and Club, not one                                                                                                                   | ⬜  | 🚫                               |
| Cancelling in the store leaves the app sane, and access continues to the end of the paid period                                                                                                                      | ✅  | ✅                               |
| **After it expires: sharing stops, and Pro does not.** Once a subscription has granted Pro it keeps it, so the boards stay visible and only hosting goes. Getting this wrong takes the sight of every board they own | ✅  | ✅                               |
| An expired subscriber's **existing shared boards keep working for the other members** — they are still on the server, and stranding them is worse than the cost it saves                                             | ⬜  | 🚫                               |
| Resubscribing restores hosting without anything being lost                                                                                                                                                           | ⬜  | ✅                               |
| A Pro-only buyer is **never** told to buy Pro again by any Club message                                                                                                                                              | ⬜  | 🚫                               |

> **Expiry is the row most likely to be skipped and most likely to hurt.** `entitlementsFrom` reads
> `entitlements.all` rather than `active` precisely so a lapsed subscriber keeps Pro through a
> reinstall; these rows are what prove it.

#### The iOS life cycle, in half an hour — with a Sandbox Apple Account

**Subscribing, cancelling and lapsing are all reachable in one sitting, but only in this order.**

**What the two accounts do.** TestFlight installs the build and needs a **real** Apple Account. The
**sandbox** account only ever pays for what is bought inside the app, and is signed in at
Settings → Developer → Sandbox Apple Account. A sandbox tester's email **cannot be an existing Apple
Account** — a `+alias` works — and its email and password cannot be edited afterwards.

**Why the order matters.** A purchase made with the real Apple ID grants the entitlement to _this
install's_ RevenueCat customer, and signing a sandbox account in afterwards does not take it away:
the app keeps showing Club until that subscription lapses on its own. Signing out **before the app's
first launch** is what stops the old receipt re-attaching.

1. App Store Connect → Users and Access → **Sandbox**: create a tester, and set its **Subscription
   Renewal Rate** to **every 3 minutes**.
2. Delete the app. Reinstall it from TestFlight, then close TestFlight **without opening the app**.
3. Settings → your name → **Media & Purchases** → **Sign Out**.
4. Settings → **Developer** → **Sandbox Apple Account** → sign in as the tester. No Developer menu
   means Developer Mode is off (Settings → Privacy & Security), and turning it on restarts the phone.
5. Open the app **from the home screen**. Club and Pro must both be locked. If Club is unlocked here,
   the old receipt re-attached and this device cannot run the test.
6. Buy Club. **A sandbox tester has never bought Pro**, so the leaderboard opening is what proves
   Club grants Pro — the row a personal account can never show once it owns Pro.
7. **A sandbox subscription renews, it does not expire.** At 3 minutes it renews every 3 minutes, up
   to **12 times**, so leaving it alone takes about 36 minutes. Cancel instead: Settings → Developer
   → **Sandbox Apple Account → Manage** (older iOS: Settings → App Store → Sandbox Account → Manage),
   then wait out the current period.
8. **Force-quit and reopen** before judging: entitlements are cached for a few minutes, so a
   foreground refresh is what shows the lapse.
9. Afterwards: sign the sandbox account out, sign back in under Media & Purchases, and reinstall from
   TestFlight for a normal build.

**A plain TestFlight purchase is the slow path.** Since late 2024 a TestFlight subscription renews
**every 24 hours, up to 6 times**, lapsing around day 8 — so the expiry row is not reachable that way
in a sitting. Signing out of Media & Purchases costs nothing permanent (iCloud, Find My and backups
are a different account slot), but Apple Music and App Store downloads stop until you sign back in,
and nothing is cancelled or refunded.

#### The Android life cycle — a licence tester on the internal track

**Play accelerates the same clock, and harder.** A licence tester's subscription renews on the
timings below and then **ends after 6 renewals** (free trials and introductory periods don't count),
so a lapse is something you can sit and wait for rather than schedule around:

| Real period      | Test period     |
| ---------------- | --------------- |
| Weekly / monthly | ~5 minutes      |
| 3 months         | ~10 minutes     |
| 6 months         | ~15 minutes     |
| **Yearly**       | ~**30 minutes** |

Others worth knowing while running §1b: free trial 3 minutes, grace period 5 minutes, account hold 10
minutes, purchase acknowledgement 5 minutes — and **an unacknowledged purchase is auto-refunded after
3 minutes**, which looks exactly like a purchase silently reversing itself. Times are approximate.

**Run the expiry row on the monthly plan**, not the annual: 6 × ~5 minutes is about half an hour to a
lapse, against roughly three hours for the annual. Buy the annual once for its own §16b row and let it
be.

**Getting there:** the build must be on a Play track (internal testing is enough), signed with the
same key, and the tester's Google account added to the **licence-testing list** in Play Console
(Setup → License testing) _and_ to the track's tester list. Miss the licence list and purchases are
charged for real; miss the track and the build is not installable.

> Sources: [Testing subscriptions in TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/),
> [Create a Sandbox Apple Account](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-a-sandbox-apple-account/),
> [Manage Sandbox Apple Account settings](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/manage-sandbox-apple-account-settings/),
> [Test Google Play Billing](https://developer.android.com/google/play/billing/test).

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
| Settings scrolls as one page — no scroll island                                                                    | ✅  | ✅      |
| Blind structure row shows correct count + range, opens the editor                                                  | ✅  | ✅      |
| 30 rows scroll smoothly; inputs editable                                                                           | ✅  | ✅      |
| Clearing a blind field shows **empty**, not `0`; blur restores the old value                                       | ✅  | ✅      |
| `+` → Insert below / Duplicate, at top, middle and end                                                             | ⬜  | ⬜      |
| Delete down to 2 levels → trash buttons disable                                                                    | ⬜  | ⬜      |
| Sticky footer appears only when dirty                                                                              | ✅  | ✅      |
| **Discard** restores the active values                                                                             | ✅  | ✅      |
| **Apply mid-tournament keeps your level** (start Level 12, edit, apply → still 12)                                 | ⬜  | ⬜      |
| Apply a schedule **shorter** than the current level → warning shown, lands on last level, **timer does not crash** | ⬜  | ⬜      |
| Tap-to-jump: confirm → timer _and_ notification/Live Activity both follow                                          | ⬜  | ⬜      |
| Jump chip is **inert** while the draft is dirty                                                                    | ✅  | ✅      |
| Back with unapplied edits → Apply / Discard / Keep editing                                                         | ✅  | ✅      |
| …via **hardware back** (Android) and **swipe-back** (iOS)                                                          | ⬜  | ✅      |
| Kill the app with a dirty draft → relaunch → draft and footer still there                                          | ✅  | ✅      |

---

## 3. Generator

|                                                                                  | iOS | Android |
| -------------------------------------------------------------------------------- | --- | ------- |
| Slow / Standard / Turbo produce **visibly different** schedules                  | ✅  | ✅      |
| Smallest chip 5, start 5 → `5/10 10/20 15/30 20/40…`, **never 6/12**             | ✅  | ✅      |
| Chip 25, start 25 → matches a real casino sheet (`25/50 50/100 75/150 100/200…`) | ✅  | ✅      |
| Chip seeds itself from the structure you're editing                              | ✅  | ✅      |
| Sheet reaches the bottom edge — **no see-through strip** below it                | ✅  | ✅      |
| "Replace structure" fits on **one line** with its icon                           | ✅  | ✅      |
| Replace writes the draft only; active schedule unchanged until Apply             | ✅  | ✅      |

---

## 4. Round duration

|                                                                                                     | iOS | Android |
| --------------------------------------------------------------------------------------------------- | --- | ------- |
| mm:ss commits on blur — no Save button needed                                                       | ✅  | ✅      |
| Type `12`/`30`, back out → next round is 12:30                                                      | ✅  | ✅      |
| Changing it **mid-round leaves the running round's remaining time alone**                           | ⬜  | ⬜      |
| A round shorter than 10s is **kept**, not silently rewritten (type `5`, leave, come back → still 5) | ✅  | ✅      |
| Seconds field caps at 59, and the field shows the clamped value after blur                          | ✅  | ✅      |

---

## 5. Keyboard behaviour

The most-regressed area in this app: Android's edge-to-edge requirement means nothing here comes for
free, and a `Modal`'s own window measures differently again. Re-check it whenever a sheet, a scroller
or a number field is touched.

|                                                                                                                                  | iOS | Android                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focus the preset-name field → **Save Preset is fully visible** above the keyboard                                                | ⬜  | ✅                                                                                                                                                                                         |
| No dead space / over-scroll after the nudge — clearance matches `BREATHING_ROOM = 24`                                            | ⬜  | ✅                                                                                                                                                                                         |
| Same on a **small** phone (iPhone SE class / 720×1280)                                                                           | ⬜  | ✅                                                                                                                                                                                         |
| **Any** focused field stays visible when the keypad opens — Settings, blind editor, sheet                                        | ⬜  | ✅                                                                                                                                                                                         |
| Number fields show a **Done** bar above the keypad (iOS), on the **first** open                                                  | ⬜  | ➖                                                                                                                                                                                         |
| …and it doesn't look bolted on next to the keyboard's rounded edge                                                               | ⬜  | ➖                                                                                                                                                                                         |
| In a **sheet**, the Done control belongs to the sheet — nothing floating in the gap above the keypad                             | ⬜  | ✅                                                                                                                                                                                         |
| A sheet's **footer buttons stay tappable** with the keypad up (generator: Cancel + Replace structure)                            | ⬜  | ✅ — check on **3-button navigation** if you have it; its nav bar is roughly twice a gesture bar's, and Android reports the IME height _excluding_ it, so a shortfall shows up worst there |
| Scrolling **keeps the keypad up** — generator sheet                                                                              | ⬜  | ✅                                                                                                                                                                                         |
| Scrolling **keeps the keypad up** — blind structure editor                                                                       | ⬜  | ✅                                                                                                                                                                                         |
| Generator sheet fields usable with the keyboard up — sheet resizes _and_ scrolls, top not pushed off-screen                      | ⬜  | ✅                                                                                                                                                                                         |
| Payouts: focus the **Bounty** field — now the lowest of six, so it's the one Android's edge-to-edge would leave under the keypad | ⬜  | ✅                                                                                                                                                                                         |
| Leaderboard: focus **Add a player** with the roster long enough to scroll — field stays visible                                  | ⬜  | ✅                                                                                                                                                                                         |

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

|                                                                                                                                                                   | iPad | Android tablet |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------- |
| Settings: Tournament + Presets **side by side**, capped and centred                                                                                               | ✅   | ⬜             |
| Blind editor list + sticky footer capped at 900 and centred — fixed and re-verified, [see D5](#d5-ipad-list-width). **The sticky footer half was not triggered**  | ✅   | ⬜             |
| Timer card centred, not full-bleed                                                                                                                                | ✅   | ⬜             |
| Generator and Pro sheets capped at 640 and centred, **not** full-bleed (the 1.2.0 fix — was 🟡 accepted in 1.1.4)                                                 | ⬜   | ⬜             |
| Payouts: cards capped and centred, payout rows readable                                                                                                           | ✅   | ⬜             |
| Leaderboard: standings and the record sheet capped and centred — **standings verified on an iPad Pro simulator; the record sheet needs a tap and was not opened** | ⬜   | ⬜             |
| iPad **mini** still gets the phone layout                                                                                                                         | ✅   | ➖             |

---

## 8. Small phones

|                                                                                                                                       | iOS | Android |
| ------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| Timer fits with no scrolling, nothing clipped                                                                                         | ✅  | ✅      |
| Settings cards readable, no overlap                                                                                                   | ✅  | ✅      |
| Blind rows: level chip, LIVE badge and both buttons all fit                                                                           | ✅  | ✅      |
| Payouts: "Paid places" segments wrap rather than breaking a label mid-word — check at **25+ players**, which offers the most segments | ⬜  | ✅      |

---

## 9. Cold launch

|                                                                                                                  | iOS | Android |
| ---------------------------------------------------------------------------------------------------------------- | --- | ------- |
| Launch → no visible resize before the timer appears                                                              | ⬜  | ⬜      |
| Leaderboard survives a force-stop: players, games and standings all still there                                  | ⬜  | ⬜      |
| Payout settings survive a force-stop (buy-in, bounty, denomination, pinned places)                               | ⬜  | ⬜      |
| Deep link straight to `pokerkit://settings` and `pokerkit://blinds` → splash lifts **immediately**, not after 4s | 🚫  | ✅      |

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
| Locked state: Settings row shows the Pro pill, the screen still opens and offers the unlock                                                                                                             | ✅  | ✅      |
| Buy-in / Players / Rebuys / Add-ons / Bounty accept typing and a **cleared field doesn't show a literal `0`**                                                                                           | ✅  | ✅      |
| **Add-on price** appears only once Add-ons is above 0, and disappears again at 0                                                                                                                        | ✅  | ✅      |
| Rebuys grow the pool and the Entries row reads "8 players + 4 rebuys". Places follow the **player** count, not entries — but a bigger pool _can_ fund one more place, so don't treat the count as fixed | ⬜  | ⬜      |
| Payout rows and "Where it comes from" reconcile on screen: prize pool + bounties = collected                                                                                                            | ✅  | ✅      |
| A bounty **equal to or above** the buy-in explains itself instead of showing an empty table                                                                                                             | ✅  | ✅      |
| Pinning a place count overrides Auto; switching back to Auto follows the field again                                                                                                                    | ✅  | ✅      |
| Settings' Payouts summary row updates after editing and going **back** (not just on relaunch)                                                                                                           | ✅  | ✅      |
| **Share payouts** opens the share sheet, and the pasted text matches the table on screen                                                                                                                | ⬜  | ⬜      |
| **Chop sheet**: shares add up to the money still on the table, and nobody is below the guarantee                                                                                                        | ✅  | ✅      |
| Chop sheet: the chip fields are usable with the keypad up, and the sheet header clears the status bar                                                                                                   | ✅  | ✅      |
| Chop button is hidden when only **one** place is paid — there is nothing to split                                                                                                                       | ✅  | ✅      |

---

## 12. Leaderboard (Pro)

The aggregation, ranking and tie-breaks are unit-tested. The human rows are the roster editing, the
record-a-game interaction, and persistence — see also the cold-launch row in §9, which is the one
that matters most here because **this is the only data in the app a user can't recreate by retyping
it**.

|                                                                                                                                                                                          | iOS | Android |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| Locked state: Pro pill on the Settings row, screen opens and offers the unlock                                                                                                           | ✅  | ✅      |
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
Gambling classification section in [ROADMAP.md](./ROADMAP.md#gambling-classification--the-rating-record).
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
| Locked state: Pro pill on the Settings row, the screen still opens and offers the unlock                                                           | ✅  | 🚫      |
| Seating: tapping a player seats them, tapping again unseats; Deal stays disabled below two                                                         | ✅  | ✅      |
| **Tapping a seat shows only that seat's two cards**, and tapping it again hides them                                                               | ✅  | ✅      |
| **Tapping a second seat hides the first.** Never two hands visible at once — this is the one that matters when the phone is going round            | ✅  | ✅      |
| **Turning a street hides whatever was showing.** Deal the flop with a hand revealed and it must close, or the next player inherits it              | ✅  | ✅      |
| Muck takes a seat out: the row dims, they are left out of the showdown, and the "in" count drops                                                   | ✅  | ✅      |
| Mucking down to one player leaves **no cards shown** at the showdown — an uncontested hand is not revealed                                         | ✅  | ✅      |
| The showdown reveals every hand still in, ranked best first, with the winner starred and each hand named                                           | ✅  | ✅      |
| **No chips, no pot, no bet and no amount appear anywhere on the screen.** Check by eye, in a screenshot — this is the property the rating rests on | ✅  | ✅      |
| The action to take a seat out reads **Muck**, never Fold                                                                                           | ✅  | ✅      |
| **A hand survives a force-stop.** Deal, kill the app from the switcher, reopen → the same board and the same hole cards come back                  | ✅  | ✅      |
| A finished hand survives too: the showdown is still on screen after a relaunch                                                                     | ✅  | ✅      |
| "Next hand" deals again and the button moves on                                                                                                    | ⬜  | 🟡      |
| Ending a game where **nothing has been dealt** does not ask — there is nothing to lose                                                             | ✅  | ✅      |
| Ending a game mid-evening asks first, and cancelling keeps the cards                                                                               | ✅  | ✅      |
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

**A seat sitting out is not reachable from the app** — there is no control for it, so there is no
row. The dead code path is tracked in [ROADMAP.md](./ROADMAP.md#minor-cleanups).

---

## 14. Accounts · **new in 1.2.0**

Every screen here was written, wired to Cognito and exercised from a script. **The email flow has
not been completed from inside the app**, which is a different thing — the script never mistyped a
code, never backgrounded the phone mid-flow, and never had to find the entry point.

**Read this before starting.** The account screens are reachable from Settings, and `backendConfig`
must point at a real backend or they cannot work at all. If sign-up says the build cannot do it,
that is the switch, not a bug.

**Partly run on Android.** What a laptop can drive was driven; **every row that needs a confirmation
code is 🚫, because running it needs somebody with an inbox.** Those are the rows the feature rests
on and they are still outstanding — see the note under the table.

|                                                                                                                                                                                                                                                                    | iOS | Android |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------- |
| After signing in **with email**, only the signed-in card shows — no second Sign in or Create-an-account form beneath it                                                                                                                                            | ⬜  | ✅      |
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

### 14b. Signing in with Apple and Google

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
| **Continue with Google** on a fresh install creates an account and signs in. **Signs in, but ends on an error screen — [see D1](#d1-auth-redirect)**                                                                          | ✅  | 🔧      |
| Signing out and back in with the same provider returns to the **same** account, not a new one                                                                                                                                 | ✅  | ⬜      |
| **The linking case.** Sign up with email+password, sign out, then sign in with a provider on the _same address_ — the boards and season are still there. This is the one that fails silently and looks exactly like data loss | ✅  | ⬜      |
| 🚫 **Hide My Email** — needs a **second Apple ID**, and cannot be run with one. See below                                                                                                                                     | ⬜  | ⬜      |
| Closing the provider sheet halfway leaves the screen usable, with **no red error** — cancelling is not a failure                                                                                                              | ✅  | ✅      |
| Declining at the provider does the same                                                                                                                                                                                       | ✅  | ⬜      |
| **Use email instead** reveals the email form, and email sign-in still works                                                                                                                                                   | ✅  | ⬜      |
| With no network, tapping a provider opens the sheet and **Safari** reports being offline; dismissing it leaves no app error                                                                                                   | ✅  | ✅      |

**Where the ✅s came from.** The iOS column was run on the iOS Simulator on 2026-09-07 against
`DEV_BACKEND`; Android was opened on a `Pixel_stable` API 35 emulator on 2026-09-11, which is why
only two of its rows are ticked.

**Both pools are configured correctly, and that is worth separating from the rows.** On dev and on
**prod**, both providers reach their real sign-in page: Google's names the Cognito domain (prod says
`pokerkit.auth.us-east-1.amazoncognito.com`, with **no `-dev`** — verified in logcat rather than by
reading the file), and Apple's shows the app's own icon and name, which comes from the Services ID
record. A `redirect_mismatch`, a missing identity provider or a bad client id all fail _before_ that
page, so none of them is present on either pool — and prod has its own Services ID, Google client and
redirect URIs, so dev passing says nothing about it.

**What is still not proven is a completed sign-in**, on either pool or either platform. That needs
real provider credentials, which cannot be driven from a laptop. Those rows are the highest-value
ones left in this file: the two provider buttons are the first thing on the sign-in card, so a
failure there is a Guideline 2.1 rejection rather than a missing feature.

**Two things that look like a broken sign-in and are not.** On a fresh emulator Chrome's own
first-run screen sits in front of the Custom Tab (the launch path is `BrowserProxyActivity` → Chrome
Custom Tab, confirmed in logcat). And _Declining at the provider_ is a different code path from
closing the tab — the latter is already covered, the former needs somebody to reach the provider's
own decline button.

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

---

## 15. Shared boards (Club) · **new in 1.2.0, needs two devices**

**One device cannot test this.** The whole feature is a board on one phone appearing on another, and
every interesting failure — a stale board, a write that never arrives, a member seeing an empty
board — only shows with two.

**A dev client cannot buy `club`.** Set `FORCE_PRO_IN_DEV` in `PremiumContext.tsx`, which forces
both entitlements. Without it the share button and join field are simply absent, silently and
correctly, which reads exactly like sync being broken.

**It needs two accounts as well as two devices, and that is the harder half.** Checked on Android
on 2026-09-09: the share control is gated on `accountsAreReal && account && mayShare &&
group.canInvite` (`GroupsSheet.tsx`), and joining is gated on being signed in. So **every row here
is blocked behind §14's sign-up rows**, which are themselves blocked on somebody with an inbox —
budget for that before setting two phones up, because `FORCE_PRO_IN_DEV` does not help with it.

Two things were confirmed without an account and need no repeating: with nobody signed in the sheet
**explains itself rather than failing** — _"Sign in to join a board. Joining is free — the person who
shares a board is the one who pays for it."_ — and the share control is **absent rather than broken**,
which is the shape the guest rows below are about.

**Reading the table: each column is the platform that acted**, not the platform that watched. Run on
2026-09-14 on the §18 pair, Android hosting as one account and the iPhone joining as another. Invite
codes were read from the dev table rather than typed off a screenshot, which is worth doing again — a
mistyped code fails identically to a broken one.

**Why several rows are still ⬜ after a run that looked complete:** the game half of the offline row
was never done (only a player added with no signal, which arrived exactly once on reconnect), and
_Dismiss_ on the "Not saved for others" card is unverified — the tap may not have landed, and
re-joining clears a board's refusals anyway, so it could not be confirmed after the fact.

> **Test data, not a defect: Bob is still on the dev board for the guest.** The host removed him
> before removals reached the server, and the host's phone has hidden him since, so nothing can take
> him off now. Only a board used before that fix can be in this state — don't file it.

|                                                                                                                                                    | iOS | Android |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| **The host shares a board** — the code arrives in the share sheet with a message naming the app                                                    | ✅  | ✅      |
| **A second device joins by pasting the code**, and the board arrives with its whole roster and season, not empty                                   | ✅  | ✅      |
| Pasting **the entire shared message** works, not just the bare code                                                                                | ✅  | ✅      |
| A **wrong or expired code** says so and leaves the app usable                                                                                      | ✅  | ✅      |
| **A guest pays nothing.** A device with neither Pro nor Club joins, and can read the board it was sent — if it hits a paywall, the feature is dead | ✅  | ✅      |
| That guest **cannot** create a board of their own (Pro) or share one (Club) — the create and share controls are absent, not broken                 | ✅  | ✅      |
| **A player added on one device appears on the other** after foregrounding it                                                                       | ✅  | ✅      |
| **A game recorded on one appears on the other**, with the same standings                                                                           | ✅  | ✅      |
| **Record with no signal, then reconnect.** Airplane mode, add a player and record a game, come back — both arrive, and nothing was lost or doubled | ✅  | ✅      |
| **A deletion propagates.** Remove a player on the host; the guest stops showing them                                                               | ✅  | ✅      |
| **Removing with no signal says so and changes nothing** — the player stays, and the alert says removing needs signal                               | ✅  | ✅      |
| **A guest has no remove, delete or rename** on a board somebody else shared — only an admin can, and a guest's used to change their phone alone    | ✅  | ✅      |
| **A game the admin deletes stays gone on the guest** — foreground the guest twice and it does not come back                                        | ✅  | ✅      |
| **A board deleted locally stays deleted**, and is not re-added by the next sync                                                                    | ⬜  | ⬜      |
| The **share button is absent on a board you joined** — only an admin can invite, so offering it would only ever explain itself                     | ✅  | ✅      |
| **Sign in on a third device → the boards are there**, without anybody sharing anything                                                             | ⬜  | ⬜      |
| A write the server refuses shows the "Not saved for others" card, and dismissing it works                                                          | ⬜  | ⬜      |
| Renaming a board on one device does **not** revert on the next sync                                                                                | ✅  | ✅      |
| **An admin sees the members button on their own board**, and a member sees none on a board they joined                                             | ✅  | ✅      |
| **Removing a member stops that phone syncing the board.** They keep the local copy, and their next write comes back refused rather than vanishing  | ✅  | ✅      |
| **The code they were sent stops working afterwards** — rejoining needs a fresh one, and the sheet says the code was replaced                       | ✅  | ✅      |
| Your own row says **"you"** and offers no remove; leaving is still on the boards list                                                              | ✅  | ✅      |
| The **only admin cannot be removed**, and the sheet says why rather than failing                                                                   | ⬜  | ⬜      |

---

### 15b. Reporting, leaving, and the filter · **what guideline 1.2 asks for**

Apple's 1.2 wants four things of an app carrying user-generated content: a filter on what goes in, a
way to report, a way to block, and published contact details. **Three of them had no rows at all**,
and the notes for review claim all four — so these are what make the claim checkable by somebody
other than the person who wrote it. The fourth, removing a member, is new in 1.2.0 and has its rows
in §15.

|                                                                                                                                                                   | iOS | Android |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| **The filter refuses a name as it is typed** — try an obvious slur as a board name and as a player name: the reason appears under the field, and nothing is saved | ✅  | ✅      |
| **Reporting a board you joined** — the flag icon, a reason, optional detail, and a confirmation that says a person will read it                                   | ✅  | ✅      |
| A report that **cannot be sent says so** (airplane mode), rather than thanking somebody for a report that never left the phone                                    | ✅  | ✅      |
| **Leaving takes every name on that board off the phone**, and it does not come back on the next foreground or the next sign-in                                    | ✅  | ✅      |

> **The other half of a report is on the server**, and it is checked once against prod in §20: a
> report raises the `ContentReports` alarm, which emails `alertEmail`. An SNS email subscription
> delivers nothing until somebody has confirmed it, so "reports are monitored and answered" is a
> promise with a confirmation link behind it.

---

## 16. Club, Pro, and what each unlocks

The rules are unit-tested in `clubPolicy`. **What a human has to check is that nobody is told to buy
something they already own**, which is the failure that reaches a store review.

|                                                                                                                                                                                                                                                                                                                                                    | iOS | Android |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| A **Pro-only** account (no Club) can use every local feature and **cannot** share a board — and the message names Club, not Pro                                                                                                                                                                                                                    | ⬜  | ⬜      |
| A **Club** subscriber gets Pro with it — the leaderboard works without buying Pro separately                                                                                                                                                                                                                                                       | ✅  | ✅      |
| A Club subscriber sees **"Pro is included with Club"**, not "Pro unlocked". **The reason given here used to be wrong** — it said the second "implies a permanence they have not got", and `clubEver` means they _do_ keep Pro after a lapse. The distinction is that they did not buy Pro outright (`ownsProOutright`), not that they will lose it | ✅  | ✅      |
| **Restore purchases is offered even when the app thinks you are unlocked.** The person who needs it most is the one whose purchase this device has not recognised                                                                                                                                                                                  | ✅  | ✅      |
| Buying **Pro** while subscribed does not double-charge or confuse the paywall                                                                                                                                                                                                                                                                      | ⬜  | ⬜      |
| Nobody is ever told to buy something they hold — check the messages for a Pro-only, a Club-only, and a signed-out account                                                                                                                                                                                                                          | ⬜  | ⬜      |
| A **signed-out** person tapping "Join a board" is offered a sign-in, not a paywall and not an empty sheet                                                                                                                                                                                                                                          | ✅  | ✅      |

### 16b. Buying Club · **the rows a subscription is rejected over**

**Guideline 3.1.2 is the reason for most of these.** An app selling an auto-renewable subscription
has to show its title, the length of its period and its price **in the app**, and carry working
links to the Terms of Use and the Privacy Policy. A missing link is a rejection, and it is the kind
that costs a whole review cycle.

**What actually blocks these, because "approved" is the wrong word.** Apple approves a first
auto-renewable subscription **with an app version, in the same submission** — so waiting for
approval before testing is waiting for something that cannot come first. What StoreKit wants is the
products at **Ready to Submit**; at _Missing Metadata_ it returns nothing, which is the state that
makes the Club section correctly absent rather than empty. Play approves no products at all: its
base plans start **inactive**, and an inactive one is invisible to RevenueCat.

So get both stores to Ready to Submit / active, and these rows then run on the first candidate that
reaches TestFlight or Play internal testing — before submission, not after it.

|                                                                                                                                                                                                                          | iOS | Android |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------- |
| **The Club section appears at all** once the products are live — and is absent before, rather than showing an empty box                                                                                                  | ✅  | ✅      |
| **Both plans show a price**, taken from the store rather than written into the app — so it is right in every currency                                                                                                    | ✅  | ✅      |
| **Each says its billing period** — "Monthly" and "Annual". Price without period is the 3.1.2 rejection                                                                                                                   | ✅  | ✅      |
| It says **renews until cancelled**, and where to cancel — App Store on iOS, Play Store on Android                                                                                                                        | ✅  | ✅      |
| **"Joining a board is always free" is on screen.** The misunderstanding most likely to kill the feature                                                                                                                  | ⬜  | ✅      |
| **Terms of Use opens `/terms`** in a browser, and the page loads                                                                                                                                                         | ⬜  | ✅      |
| **Privacy Policy opens `/privacy-policy`**, and the page loads                                                                                                                                                           | ⬜  | ✅      |
| Buying **monthly** grants `club` **and** `pro` — the board opens straight away, with no second purchase                                                                                                                  | ✅  | ✅      |
| Buying **annual** does the same                                                                                                                                                                                          | ⬜  | ✅      |
| **Cancelling at the store** removes hosting but **leaves Pro** — the boards stay visible. This is the promise `clubEver` exists to keep                                                                                  | ✅  | ✅      |
| **A subscriber is never offered the plans again** — the two plan buttons are replaced by "Club active"                                                                                                                   | ✅  | ✅      |
| **…but the card itself stays**, carrying the renewal terms and both legal links. Changed in 1.2.0: the whole section used to vanish, which took the cancellation terms with it — away from the one person who needs them | 🔧  | ✅      |
| Cancelling a purchase halfway leaves the sheet usable, with no error — cancelling is not a failure                                                                                                                       | ⬜  | ⬜      |
| **Restore brings back both entitlements** on a fresh install                                                                                                                                                             | ⬜  | ⬜      |

> **Two of these need candidate 3, and one of them was marked against candidate 2 by mistake.**
> Running §16b on build 28 is what found #272: Settings collapsed the active Club card to a line and
> a badge, and every other way into the paywall is a _locked_ feature — so a subscriber could not
> open it at all, and the renewal terms, where to cancel, and both legal links went with it. The
> _…but the card itself stays_ row was ticked anyway and is now 🔧, because on that build it was
> false. _A subscriber is never offered the plans again_ keeps its ✅ — the plan buttons really were
> gone; that was the same collapse seen from the other side.
>
> On candidate 3 the active card carries a **Subscription details** button opening the same sheet
> (`ClubCard.tsx`). Re-run that row **as a subscriber**, and open **Terms of Use** and **Privacy
> Policy** from there — those two rows are still ⬜ and a subscriber had no route to them before.

### 16c. Telling the two purchases apart · **new in 1.2.0**

**The failure these exist for is somebody starting a subscription while meaning to pay once.** Until
this release both were sold in one amber sheet headed "Pro", behind buttons that all said "Unlock
Pro", so nothing on screen distinguished a one-time purchase from a recurring one. Everything below
is about whether a person can tell, before they tap, which of the two they are buying.

|                                                                                                                                                  | iOS | Android |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------- |
| Settings shows **two separate cards**, Pro badged **One-time** and Club badged **Subscription**                                                  | ✅  | ✅      |
| The two are **visibly different colours** — Pro amber, Club violet — on the cards, the pills and the buttons                                     | ✅  | ✅      |
| Opening the sheet from a **locked Pro feature** puts Pro first, filled; Club is below it and outlined                                            | ✅  | ✅      |
| Opening it from **"See Club"** puts Club first, filled; Pro is below it and outlined                                                             | ✅  | ✅      |
| **Both stay buyable either way** — the unfocused card is outlined, never hidden, and its button still works                                      | ✅  | ✅      |
| Each card says its shape in words: Pro _"paid once … nothing to renew"_, Club _"renews automatically until cancelled"_                           | ✅  | ✅      |
| The **shared clock** row in Settings carries a **CLUB** pill, and the Pro rows carry **PRO** pills — a subscriber sees neither on what they hold | ✅  | ✅      |
| **Groups → the Club offer** appears for a signed-in non-subscriber and opens the sheet on Club                                                   | ✅  | ✅      |
| That offer is **absent on a cold launch until the store answers** — never shown while entitlements are still the default                         | ✅  | ✅      |
| **Start a clock → "See Club"** opens the sheet on Club, and the refusal sentence above it still reads the same                                   | ✅  | ✅      |
| Club is **absent everywhere** with `featureSharing=off` — the Settings card, the paywall's Club card, the groups offer and the clock's button    | ⬜  | ⬜      |
| Club is **absent everywhere** in a build whose subscriptions are not live — no empty card, no dead button                                        | ✅  | ✅      |
| **The annual plan comes first and is the filled button**; the monthly sits below it, outlined                                                    | ✅  | ✅      |
| The annual carries **"Save N% vs monthly"**, and N is right for the two prices **actually on screen** — work it out by hand and compare          | ⬜  | ⬜      |
| **The claim is absent rather than wrong** when it cannot be made: only one plan returned by the store, or an annual that is not cheaper          | ⬜  | ⬜      |
| In a **non-euro storefront** the saving is still correct — the whole reason it is computed from numbers instead of the formatted price strings   | ⬜  | ⬜      |
| The leaderboard's free text share now reads **"Send a text summary"** and still produces exactly that — a text blob in the system share sheet    | ⬜  | ⬜      |
| **"Share this board" sits beside it**, violet, for a signed-in non-subscriber, and opens the sheet on Club                                       | ⬜  | ⬜      |
| For a **Club subscriber** the same button is grey and opens Groups — not the paywall, and not a second invite-minting path                       | ✅  | ✅      |
| It is **absent on a board somebody else hosts.** Inviting to one you are only a member of is refused on role, so selling Club for it is a lie    | ⬜  | ⬜      |
| It is **absent** with `featureSharing=off`, in a no-backend build, and while signed out                                                          | ⬜  | ⬜      |
| It is **absent on a cold launch until the store answers** — same rule as the Groups offer                                                        | ⬜  | ⬜      |

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
expectation throughout, and the section reads `stale` only after fifteen seconds without contact.
**Measured on 2026-09-13, a press took 6–16 seconds to reach the other phone, not the four this
used to promise** — every device's heartbeat rewrites the one stored row, so a newer press can be
overwritten before the other phone reads it, and arrives on a later beat. A pause that shows up
fifteen seconds later is a pass; one that never arrives is not. See `ROADMAP.md`.

**Reading the table: where a row involves both devices, each column is the platform that pressed.**
Run on 2026-09-13 and re-run on 2026-09-14 after #268, on an iPhone 17 Pro Simulator (iOS 26.5) and
`Pixel_stable` (API 35), both dev clients against `DEV_BACKEND` with `FORCE_PRO_IN_DEV`, signed in as
two accounts. The first run found three defects — hosting and joining refused for everyone, no press
ever leaving the phone, and heartbeats dropped on arrival — all fixed the same day, and nothing here
passed before they were.

**Two things seen once and never explained — watch for them on real phones.** Shortly after a resume,
the iPhone's countdown stood still for about seven seconds while Android's ran, then caught up. And
in one session the host stopped sending heartbeats altogether, so the joiner read "Out of touch"
while the host read "In step"; a fresh session on the same builds behaved, and the logs say nothing.
If a phone shows that asymmetry, note which one is hosting.

|                                                                                                                                              | iOS | Android |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| **Settings → Tournament shows "Shared clock"**, and it opens this screen. Absent with `featureSharing=off`, and on a build with no backend   | ⬜  | ✅      |
| **Without Club**, Start is disabled and says sharing is part of Club — and that **joining is free**                                          | ⬜  | ⬜      |
| **Signed out**, both Start and Join are disabled and each says to sign in — not "subscribe"                                                  | ✅  | ✅      |
| While entitlements are still loading, it says so rather than refusing — a subscriber must never be told they have not paid                   | ✅  | ✅      |
| **Hosting produces a six-character code** from the alphabet that drops what gets misheard — no I, O, S, Z                                    | ✅  | ✅      |
| **A second device joins by typing it**, and sees the same round, level and countdown within ~4s                                              | ✅  | ✅      |
| Lower case and spaces work — the code is normalised on the way in                                                                            | ✅  | ✅      |
| **A wrong code says no clock is running under it**, and leaves the screen usable                                                             | ✅  | ✅      |
| **Pausing on either device pauses both.** This is the row the feature exists for — and either device, not just the host                      | ✅  | ✅      |
| **Two people pause at the same moment** and both phones settle on the same answer rather than splitting                                      | ✅  | ✅      |
| A level jump travels too — `blindIndex` is in the message                                                                                    | ✅  | ✅      |
| **Killing the host app leaves the joiner counting down**, and it reads `stale` after ~15s rather than freezing or lying                      | ⬜  | ✅      |
| Reopening the host **rejoins and the two agree again** within a poll — **[see D3](#d3-session-not-persisted)**                               | ⬜  | 🔧      |
| **Airplane mode on the joiner** for 30s, then back: it catches up rather than needing a rejoin                                               | ✅  | ⬜      |
| Leaving stops the polling — the clock keeps running locally and nothing further is sent                                                      | ✅  | ⬜      |
| 🚫 **A session expires six hours after its last message.** Cannot be run in a sitting; the TTL is asserted in the store's unit tests instead | ⬜  | ⬜      |

**Where to look if it does not work.** `sessionTransport` is `null` on any build with no
`backendConfig`, and the Settings row is then absent rather than leading somewhere broken — check
that first, and check `GET /config` says `sharing` is on, because the row reads it too. A 401 on
every poll means the token, not the code.

---

## 19. Push notifications · **new in 1.2.0, needs two accounts**

**It needs credentials, and in practice a store build.** An APNs key for iOS and an FCM v1 service
account for Android, both held by EAS. **Registration can be checked anywhere** — a device that
registered has a `PUSH#<token>` row under `ACCOUNT#<its sub>` in the table. **Delivery did not run on
the Mac**, whatever this used to promise: on 2026-09-14 APNs refused the iOS Simulator's token with
`BadDeviceToken`, and FCM accepted the emulator's message without it ever appearing. Production
APNs/FCM are a different set of credentials again, so every row that ends in a notification on screen
wants the phones and a store build — see §20.

**The server bug is fixed and on prod.** `POST /me/push-token` answered 400 "no group" to every
device until #268 — the groups handler's group-id guard ran before the push routes — so no row here
could ever have passed. Prod has carried the fix since the 1.2.0 deploy, and dev additionally carries
extra push-ticket logging. If registration still fails, it is not this.

**Two quiet failures to rule out before suspecting the token:**

- **Registration rides on the notification permission and never asks for it.** A device that never
  allowed notifications simply never registers, silently and correctly. On the emulator:
  `adb shell pm grant com.toondeboer.pokerkit android.permission.POST_NOTIFICATIONS`.
- **A refused send only surfaces in a receipt**, fetched separately and later. The sender logs a
  ticket's error code now (not the token), but nothing fetches receipts at all, so a bad token or a
  revoked key leaves no trace on the server — see `ROADMAP.md`.

**It also needs two accounts**, because the sender never notifies whoever recorded the game.

**🟡 Delivery is proven; every behaviour _around_ delivery is accepted untested.** On 2026-09-19 a
game recorded on the Android raised a notification on the iPhone within seconds, naming the board and
not the player, with the recording device correctly silent — the first time push has been seen to
work at all. The rest of the section was **deliberately not run**: the cold-start tap, the offline
receiver, the outbox replaying without re-notifying, a failed push not failing the write, and an
uninstalled receiver not erroring the sender.

**The accepted risk, stated plainly:** the mitigation is error logging and monitoring, to be added
after 1.2.0, and **it does not exist yet**. Until it does there is no signal at all — nothing fetches
push receipts, so a bad token, a revoked key or a duplicate notification produces no error, no log
and no alert. A regression here is invisible until somebody reports it. Carried in
[ROADMAP.md](./ROADMAP.md).

**The duplicate-notification row is the one to run first when this is revisited.** A replayed outbox
item re-notifying is the failure most likely to reach a person, hardest to notice from the server,
and the only one of the five that annoys every member of the board at once.

|                                                                                                                                                                                                                                    | iOS | Android |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| **A member records a game; the other member's phone shows a notification** within a few seconds                                                                                                                                    | ✅  | ⬜      |
| **The person who recorded it is not notified** — they are holding the phone                                                                                                                                                        | ⬜  | ✅      |
| **It names the board, not the player.** No player name appears on the lock screen                                                                                                                                                  | ✅  | ⬜      |
| Tapping it opens the app — and does not crash from a cold start                                                                                                                                                                    | 🟡  | 🟡      |
| **Declining the notification permission means no push, and no error.** Somebody who said no should not be asked again by this feature                                                                                              | ⬜  | ✅      |
| 🚫 **Signed in on two devices, both are notified** — needs the _receiving_ account on two devices plus a separate sender, so **three devices** — a token is a row per device, and the second sign-in must not unregister the first | 🚫  | 🚫      |
| **Recording while the other phone is offline**: it arrives when that phone comes back, or not at all — never as a duplicate                                                                                                        | 🟡  | 🟡      |
| **The outbox replaying a queued game sends no second notification.** Only a write that actually landed notifies                                                                                                                    | 🟡  | 🟡      |
| **A failed push never fails the write.** Break it deliberately (sign out on the receiver, delete the app) and recording still succeeds                                                                                             | 🟡  | 🟡      |
| Uninstalling the receiving app and recording again does not error on the sender — the token is forgotten on `DeviceNotRegistered`                                                                                                  | 🟡  | 🟡      |

---

## 20. The store build itself · **only answerable once it is on a track**

Three things nothing else in this file covers, each of which can only be asked of a build that came
out of EAS and went to TestFlight or Play internal testing.

|                                                                                                                                                                                                                                                | iOS | Android |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| **It talks to prod.** Account → Continue with Google: the page must name `pokerkit.auth.us-east-1.amazoncognito.com`, with no `-dev`. This is what proves the local testing toggles did not ship                                               | ✅  | ✅      |
| **Updating from the live version keeps everything.** Install 1.1.4 from the store, set a round length, edit a structure, save a preset — then update to the candidate and check all of it survived, Pro included                               | ✅  | ✅      |
| **A report reaches a person.** File one against prod and confirm the alarm email arrives at `alertEmail` — `/support` promises an answer within two business days. **The alarm fired and nobody was subscribed — [see D4](#d4-prod-alerting)** | 🔧  | ⬜      |

**Run the update row before anything else touches that phone.** It needs the live version installed
with data on it, and installing the candidate is the step being tested — there is no way back except
reinstalling 1.1.4 from the store and starting again.

**And do the prod check before signing in anywhere**, because the answer changes what every row
after it means: a candidate pointed at dev writes test accounts into the pool that exists to be
thrown away, and passes everything while proving nothing about what ships.

---

## Open defects

One entry per defect found this cycle, numbered in the order they were found (D1, D2, …), with an
anchor so the rows above can link to it. Keep an entry after it's fixed so the reasoning survives the
release; the whole section is cleared when the release ships, since by then the fix is in the
changelog and the reasoning is in the commit.

|                                                                                            | Found in                   | State                               |
| ------------------------------------------------------------------------------------------ | -------------------------- | ----------------------------------- |
| **[D1](#d1-auth-redirect)** — a provider sign-in ends on "Unmatched Route"                 | §14b, Android, candidate 3 | 🔧 fixed in #277, wants candidate 4 |
| **[D2](#d2-rtdn)** — a refund never revokes the entitlement                                | §1, Android, candidate 3   | 🟡 accepted for 1.2.0               |
| **[D3](#d3-session-not-persisted)** — a restarted host silently leaves its own clock       | §18, Android, candidate 3  | 🔧 fixed in #283, wants candidate 4 |
| **[D5](#d5-ipad-list-width)** — the blind editor's iPad layout never reaches its 900pt cap | §7, iPad simulator         | ✅ fixed and re-verified            |
| **[D4](#d4-prod-alerting)** — prod had no alarm delivery at all                            | §15b/§20, prod, 2026-09-19 | 🔧 re-subscribed, wants confirming  |

<a id="d1-auth-redirect"></a>

### D1 — a provider sign-in ends on "Page could not be found" (Android)

**Found** on candidate 3 (versionCode 18, from `96361a2`) off the Play internal track, while running
§20's prod check.

**What happens.** Settings → Account → Sign in → **Continue with Google** → pick an account → the app
shows expo-router's **"Unmatched Route — Page could not be found"**. Backing out and reopening the
app shows you _are_ signed in. So the sign-in succeeds, and the last thing the user sees is a
full-screen error on the first control of the release's headline feature.

**Cause.** `AUTH_REDIRECT_URI` is `pokerkit://auth` (`src/services/socialSignIn.ts`), and there is no
`auth` route. `src/app/` holds `index`, `settings`, `blinds`, `payouts`, `account`, `join/[token]`,
`session`, `game` and `leaderboard` — nothing else — and `_layout.tsx` declares no `Stack.Screen` for
one either. Cognito redirects to `pokerkit://auth`, the scheme's intent filter opens the app, and
expo-router cannot resolve `/auth`.

**Why it is Android-only, and why the iOS ✅ proved nothing.** On iOS `ASWebAuthenticationSession`
intercepts the callback URL inside the session, so the OS never dispatches a deep link and the router
never sees `/auth`. On Android `openAuthSessionAsync` uses a Custom Tab and the redirect arrives as a
**real deep-link intent** — which both resolves the promise (hence the successful sign-in) _and_ is
handled by the router (hence the error screen). §14b's iOS column was ticked on the Simulator on
2026-09-07 and could not have caught this.

**Not the Metro staleness trap.** [CLAUDE.md](./CLAUDE.md) describes a route file added while Metro is
running reading as "Unmatched Route" until Metro restarts. That is a dev-client condition. This is a
Play Store build with the route table compiled in, and the route genuinely does not exist.

**Fixed in #277**, which adds `src/app/auth.tsx` redirecting to `/account` — where every provider
sign-in starts from — and declares it with `headerShown: false` so nothing flashes on the way
through. 🔧 until it is re-run on candidate 4 against a real provider; a fix landing never ticks a
row on its own.

<a id="d2-rtdn"></a>

### D2 — a refund never revokes the entitlement (Play → RevenueCat)

**Found** while trying to return a licence-tester account to a free state for §1's purchase rows.

**What happens.** Play Console → Order management → refund the Pro order **with _revoke access_
ticked**. Play records the refund and the revocation. Several minutes later RevenueCat still shows
the entitlement as active, the app still has Pro, and **Restore purchases** re-affirms it.

**Cause.** Play Console → **Monetization setup → Real-time developer notifications** had **no
Pub/Sub topic configured**. RevenueCat learns about a revoked one-time product from Google's
`ONE_TIME_PRODUCT_CANCELED` notification on that topic. With the field empty the notification is
never sent, so RevenueCat is never told and holds the entitlement indefinitely.

**Why this is not only a testing problem.** The same channel carries every refund and revocation in
**production**. As shipped, a customer who is refunded for Pro — by Google, or by us — keeps Pro.
Nothing in the app or the backend re-checks it, because entitlements are read from RevenueCat and
RevenueCat is waiting on a notification that no one sends.

**Accepted for 1.2.0, and not held for.** RTDN has **never** been configured on this app, so 1.1.4
behaves identically for a refunded Pro purchase — this is a pre-existing condition found by the pass,
not something this release introduces. The genuinely new surface is Club, and a subscription's normal
lapse is driven by the expiry timestamp RevenueCat already holds rather than by a notification, so
§1b's expiry rows are unaffected. Holding 1.2.0 for a defect it does not contain would be the wrong
trade. Carried in [ROADMAP.md](./ROADMAP.md).

**It needs no new binary** whenever it is fixed — console configuration in Play and RevenueCat only,
so it can land without a candidate and without invalidating any row ticked against candidate 3.

**The attempt to wire it was reverted.** A Pub/Sub topic was created and pointed at from Play
Console, then removed again: RevenueCat's _Connect to Google_ listed no topics to attach to, and
chasing that was costing more than the defect was worth mid-pass. The app is back in the state
described above.

**Wiring it up won't retroactively revoke the order already refunded** — RTDN fires at the time of
the event and does not replay. Expect the stale entitlement to persist until RevenueCat next
re-validates that purchase against Google, which is why the free-state rows may need a second
licence-tester account rather than this one.

**No row covered this.** §1 gained one, above. Cancelling a _purchase flow_ was tested; a refund
_after_ the fact never was, on either platform — the iOS column is ⬜ rather than ✅ because App
Store Server Notifications have not been checked either.

<a id="d3-session-not-persisted"></a>

### D3 — a restarted host silently leaves its own shared clock (§18)

**Found** on candidate 3, Android hosting and iPhone joined, running §18's host-restart rows.

**What happens.** Force-quit the host app and reopen it: the host is **no longer in the session it
started**. Killing it behaves correctly from the joiner's side — the joiner keeps counting down and
reads `stale` after ~15s, which is its own row and passes — but the host comes back to a clock
screen that has forgotten everything.

**Cause.** `status` and `code` in `SharedSessionContext` are plain `useState` with **no persistence
anywhere in the file**. A cold start resets them to `"off"` and `null`. The session itself is fine —
it is a `SESSION#<code>` row on the server with a six-hour TTL — so only the phone's memory of
belonging to it is lost.

**Why it matters more than it looks.** The feature's promise is one clock on every phone at the
table. When the host's phone comes back, every other phone has already gone `stale`, and the only
way out is starting a **new** session with a **new** code that everybody re-enters — mid-tournament.
Nothing tells the host any of this happened; from their side the screen is simply blank.

**Mitigating it slightly:** the Android timer runs behind a foreground service, which makes an OOM
kill much less likely than for an ordinary backgrounded app. The realistic triggers are a user
swiping the app away and a crash, not routine memory pressure.

**Two traps in the fix**, which is a `SessionStorage` on the existing `storageAdapter` pattern plus a
re-attach on launch:

- **The session may have expired.** Six-hour TTL, so a re-attach has to treat a 404 from
  `GET /sessions/{code}` as "clear it and show `off`", not as an error.
- **Entitlements are not known at mount, and this exact file has been bitten by that before.**
  `startHosting`/`join` once left the Club and sign-in refusals out of their `useCallback` deps and
  kept the first render's answer — signed out — refusing every subscriber. A naive re-attach on
  mount walks into the same race and would fail silently, which is indistinguishable from the bug it
  is meant to fix.

**Fixed in #283** — `createSessionStorage` in `@poker/core` plus a re-attach on launch that waits on
both readiness flags before deciding anything. It stores the membership and never the clock, and
re-checks the refusal so a subscription that lapsed between launches does not keep hosting. 🔧 until
§18's host-restart rows are re-run on candidate 4 — **and worth running a _joiner_ restart at the
same time**, which this defect never covered.

<a id="d4-prod-alerting"></a>

### D4 — production had no alarm delivery at all

**Found** filing a report from the app for §15b, and noticing no email arrived at `alertEmail`.

**Everything worked except the last hop.** Verified against prod, in order:

| Step                                                     | Result                                |
| -------------------------------------------------------- | ------------------------------------- |
| The app posts the report                                 | ✅                                    |
| The Groups λ logs `content reported`                     | ✅                                    |
| The metric filter raises `Poker/prod` → `ContentReports` | ✅ `Sum 1.0` at 18:27                 |
| The alarm fires                                          | ✅ `OK → ALARM` at 18:30              |
| The alarm publishes to the SNS topic                     | ✅                                    |
| **SNS delivers the email**                               | ❌ **the topic had zero subscribers** |

**Cause.** `PokerBackend-prod-ObservabilityAlarms` had **no subscriptions**. CloudFormation still
records one as `CREATE_COMPLETE` with a real subscription ARN — not `PendingConfirmation`, so it
_was_ confirmed when prod deployed on 2026-09-04 — and that ARN now answers
`Subscription does not exist`. **Dev's identical subscription is live**, which is what makes this
look like it works from anywhere except prod.

**The likely route is the unsubscribe link at the bottom of an SNS alarm email.** One click, no
confirmation step, permanent, and **CloudFormation never notices** — every deploy since has reported
success on a subscription that is not there.

**It is not only about reports.** That topic is the destination for _every_ prod alarm, API 5xx
included. Production has had **no alerting of any kind** since the subscription went.

**Why it matters for this release.** §20's _A report reaches a person_ row genuinely fails.
Guideline 1.2 requires reports to be **handled**, not collected, and `/support` promises an answer
within two business days — both untrue while nothing says a report exists.

**Re-subscribed on 2026-09-19** with `aws sns subscribe`, and it sits at `PendingConfirmation` until
somebody clicks the link. **Two things to know:** an unconfirmed email subscription is **discarded
after 3 days**, silently; and this one lives _outside_ CloudFormation, which is acceptable only
because the CFN-managed one is already a phantom. 🔧 until a report has been filed and the email
seen to arrive — the row is about the mail landing, not about the subscription existing.

<a id="d5-ipad-list-width"></a>

### D5 — the blind editor's iPad layout never reaches its 900pt cap (§7)

**Found** running §7 on an **iPad Pro 13-inch (M5) simulator**, app served by Metro from
`release/1.2.0`.

**What it should be.** `BlindStructureScreen` applies `centred` —
`{ maxWidth: TABLET_MAX_WIDTH_LIST, alignSelf: "center" }`, with the constant at **900** — to the
list's `contentContainerStyle`. §7's row asks for _"capped at 900 and centred"_.

**What it is.** Centred, but roughly **342pt wide on a 1032pt screen** — a phone-width column
floating in the middle of a 13-inch display, with about a third of the screen empty on each side.
Settings on the same device is correct: `TABLET_MAX_WIDTH_SETTINGS` is 1000, and it fills the width
as intended.

**Likely mechanism, stated as a hypothesis rather than a finding.** `alignSelf: "center"` makes a
flex child size to its own content instead of stretching, so the container shrinks to the intrinsic
width of the rows rather than expanding to the 900 cap. `maxWidth` then never binds. The rows have
no width of their own, so they collapse to their content. That would also explain why Settings is
fine — its cards are laid out differently.

**Not a regression.** §7 has never been run — every cell in it was ⬜ before today — so this is a
first observation rather than something that broke.

**Confirmed, then fixed.** The hypothesis was right, and the repo answered it itself: `SettingsScreen`,
`GameScreen`, `PayoutScreen`, `SharedSessionScreen`, `LeaderboardScreen`, `AccountScreen` and
`Sheet` **all** pair `maxWidth` with `alignSelf: "center"` **and `width: "100%"`**.
`BlindStructureScreen` carried only the first two, which is why it was the only surface that looked
wrong. Adding `width: "100%"` takes the list from ~342pt to the 900 cap, centred — re-shot on the
same iPad Pro simulator immediately after the change, so this is measured rather than argued.

**The sticky footer half was not triggered** — it appears only with an unapplied draft. The same
style object feeds both call sites, so the fix reaches it, but that is inference and the row says so.

---

## Known-and-accepted — do not file these

- **Renaming a shared board only renames it on the phone that did it.** There is no
  `PATCH /groups/{groupId}`, so the server's name is whatever the board was created with and can
  never be anything else. `mergeBoard` therefore keeps the **local** name — taking the server's
  would revert somebody's rename on the very next foreground, permanently — and the consequence is
  that two members can see different names for the same board. Deliberate, documented in
  `mergeBoard.ts`, `apps/infra/SYNC.md` under known gaps, and carried in `ROADMAP.md` with the fix.
  **§15's rename row is about the rename not _reverting_, which is a different thing**; it was
  re-discovered from scratch on the 1.2.0 pass because nothing here said so.

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
