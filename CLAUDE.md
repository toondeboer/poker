# CLAUDE.md

Guidance for working in this repo. See [README.md](./README.md) for setup, commands, and deploy,
and [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

## Conventions & guardrails

- **npm workspaces + Turborepo.** Always `npm install` from the **repo root** (one lockfile);
  don't introduce yarn/pnpm. Target one workspace with `npm run <script> -w @poker/<core|web|mobile>`.
- **Where a dependency goes: the workspace that imports it, and nowhere else.**
  - **Root** — workspace config and cross-cutting tooling only (`turbo`; `typescript` pinned once so
    every workspace and the editor agree). **Never app dependencies.** A package declared at the
    root has its peers resolved in the root's context, which is how a stray `next` there floated a
    second React (see below).
  - **`apps/*`** — everything that app imports. `dependencies` = needed to run or build the shipped
    artifact; `devDependencies` = tooling that never ends up in it (`@types/*`, `eslint*`,
    `@babel/core`, `tailwindcss`). On mobile this is not cosmetic: anything Metro must bundle has
    to be a real `dependency`.
  - **`packages/core`** — devDependencies only, because it has no runtime dependencies at all and
    should stay that way. If it ever needs one, it goes in `dependencies`; anything the *host* app
    must supply belongs in `peerDependencies`, never `dependencies`.
  - **Duplication between workspaces is fine and correct** — both apps declaring `react` is how
    npm knows to hoist one shared copy. Don't "deduplicate" by lifting a shared dep to the root.
  - Every workspace is `private: true`. None of them are published; `@poker/core` is consumed
    through the workspace protocol.
- **Shared logic goes in `@poker/core`** and must stay framework-agnostic — no `react`,
  `react-native`, or DOM imports (its tsconfig uses `lib: ["esnext"]`, `types: []`, so even
  `console` is unavailable). Put types, blind/timer math, serialization, and the ad-gating
  policy (`shouldShowAds`) here. Apps depend on packages, never the reverse.
- **Platform code stays in the app.** Audio, notifications, haptics, storage, billing, ads, and
  native modules are app-specific — wire them into core through an interface (e.g. `StorageAdapter`,
  and `EntitlementProvider` for Pro). Add a web no-op for mobile-only features (Live Activities,
  foreground service, push) instead of importing native modules on web.
- **Imports:** cross-package → `@poker/core`; within mobile → `@/src/...`; within web → `@/...`.
- **Mobile styling goes through the theme, not hardcoded hex.** `apps/mobile/src/theme` holds the
  colour/spacing/radius/typography tokens and `isTabletWidth`; `apps/mobile/src/components/ui` holds
  the shared primitives (`Card`, `Button`, `IconButton`, `TextField`, `NumberField`,
  `DurationField`, `Badge`, `ProPill`, `ListRow`, `NavRow`, `SegmentedControl`, `StickyFooter`,
  `Sheet`). Reach for those before writing a new `StyleSheet.create` full of literals — the app had
  no design system until the Settings redesign and every screen re-derived the same palette by hand.
  `PokerTimer.tsx` is the deliberate exception: it does its own measure-and-rescale layout.
- **Numeric inputs use `NumberField`**, which keeps the raw string while editing. Binding a
  `TextInput` straight to `Number(text)` makes a cleared field show a literal `0` that the user has
  to select and overwrite.
- **Don't move the sheets to `presentation: "formSheet"` — it was tried and reverted.**
  `react-native-screens` 4.25.2 does ship real native sheets (verified working on Android), and
  `expo-router`'s docstring claiming Android falls back to a full-screen modal is out of date. **But
  the iOS path does not lay out correctly on this RN/RNS combination.** `ScreenStackItem` gives
  form-sheet content `position: absolute` with **no bottom constraint** on iOS unless
  `featureFlags.experiment.synchronousScreenUpdatesEnabled` is on — and that flag defaults to
  `false`, is explicitly experimental ("might be removed w/o notice"), and changes screen-update
  behaviour app-wide, not just for sheets. Without it the content has to derive its own height, and
  both a `flex: 1` container and a `maxHeight`-bounded `ScrollView` still rendered an empty sheet
  with the content stranded below the sheet frame. Two attempts, neither worked.
  - So the sheets stay hand-rolled on `Modal` (`components/ui/Sheet.tsx`). Revisit when that flag
    graduates out of `experiment`, and **verify on a real iOS build before believing it** — Android
    looked perfect the whole time this was broken on iOS.
  - **Retested on `react-native-screens` 4.26.2 (SDK 56, RN 0.85.3, iOS 26.5 simulator) — still
    broken. Don't spend the day on it a third time.** The flag *did* change: in 4.25.2
    `RNS_SYNCHRONOUS_SCREEN_STATE_UPDATES_DEFAULT` is `false`, in 4.26.2 it is `true`. That looks
    like the blocker lifting, and it isn't. The whole diff to `getPositioningStyle()` between the
    two versions is the removal of a now-redundant `rnMinorVersion >= 82` check; the
    `allowedDetents !== 'fitToContents'` condition is untouched, so on iOS:
    - **`sheetAllowedDetents: "fitToContents"`** (what the attempt used — archived at the
      `archive/native-form-sheets` tag, the branch is gone) short-circuits
      that condition and still gets `absoluteWithNoBottom` **regardless of the flag**. Observed: the
      sheet frame draws correctly — grabber, corner radius, dimmed backdrop — and is then **empty**,
      with the content stranded below it, half off the bottom of the screen. Identical to 4.25.2.
    - **Fixed detents** (`[0.6, 1.0]`) take the path the flag was supposed to fix, and render an
      **entirely empty sheet** — worse, since the content isn't visible anywhere.
    - RNS's own source says of the no-bottom-constraint style: *"It was tested reliably only on
      Android."* Take that at face value.
  - **An element being "visible" to a test does not mean this works.** An `assertVisible` on
    "Generate structure" passed on the `fitToContents` run — the node is in the view hierarchy, just
    positioned outside the sheet frame. This defect is only visible in a screenshot, so verify it
    with pixels. It's the standing example of why layout is on the manual checklist rather than
    automated (see [RELEASE_TESTING.md](./RELEASE_TESTING.md)).
- **Only one scroller per screen.** Settings is a single `ScrollView`, the blind editor a single
  `FlatList`. A nested scroll region (`nestedScrollEnabled`) was the defect the Settings redesign
  removed — don't reintroduce one. A `ScrollView` inside a `Modal`/`Sheet` is fine: a modal is its
  own scroll context.
- **React lint rules are enforced as errors**, not warnings: no writing refs during render
  (`react-hooks/refs`) and no `setState` in an effect body (`react-hooks/set-state-in-effect`). To
  sync state from a prop, adjust it during render behind a previous-value comparison rather than in
  a `useEffect` — see `DurationField` and `GenerateStructureSheet`.

## Release process

Mobile releases are batched on a short-lived branch per version, not shipped straight from
`main` — avoids cutting a new App Store/Play submission for every small merged PR while a review
(which can take days) is pending.

- **What's live on mobile is the `v<version>` tag, not a branch.** Tags are immutable, so this can't
  drift; branch from `v<version>` for a hotfix (below). **`main` is the integration branch and the
  *website's* production branch** — the Vercel project deploys on every push to it (see
  [README.md](./README.md#deploy)), so web and docs changes must land there to ship, and they ship
  continuously.
  - This used to read "`main` always matches what's actually live in the App Store", which was never
    compatible with the web deploying from the same branch: every web fix would have had to wait
    behind a pending mobile review. Predictably, it didn't hold — `main` was 21 commits ahead of
    `v1.1.3` by the time 1.1.4 was cut, almost all of it web, docs and Dependabot, i.e. changes that
    *belonged* there. The rule was wrong, not the commits, and pointing "what's live" at the tag
    fixes it without asking anyone to hold web releases hostage to the App Store.
  - Never version-bump, tag, or `eas submit` from `main` directly — those happen on the release
    branch, so that a mobile submission is always a deliberate act on a known set of commits.
  - The consequence to keep in mind: **`main` is not a buildable "what shipped" for mobile.** Don't
    reach for it when you need the exact code behind a store binary — use the tag, or
    `eas build:view <id>` for the built commit.
- **A release branch exists only while a release is being built.** Cut it when feature work for the
  next version starts, not the moment the last one shipped — a branch standing empty between
  releases just adds a routing decision to every PR for no benefit. Between releases, everything
  goes to `main`; 1.1.5's branch was cut at 1.1.4's ship time and deleted again unused, which is
  what prompted this.
- **`release/<version>` is the integration branch for that release** (e.g. `release/1.1.4`),
  cut from `main` when you start batching work toward it:
  `git checkout main && git pull && git checkout -b release/<version>`. Name it
  `release/<version>`, not `v<version>` — a branch and the eventual `v<version>` tag can't share a
  name without ambiguous-ref problems (`git checkout v1.1.3` becomes unpredictable).
- **Never commit directly to `release/<version>`, even for a docs-only change** (e.g. a
  `ROADMAP.md` update) — the whole point of the release branch is that nothing lands there
  without going through a PR. Branch off it (`git checkout -b feature/<name>`), commit there, and
  PR into the release branch. The only exception is the release-prep commit(s) made as part of
  *cutting* the release itself (step-by-step below) — those go directly on the release branch.
- **What targets the release branch, and what targets `main`** — the test is *"does this change the
  mobile binary?"*, and it only applies **while a release branch is open**:
  - **No release branch open:** everything goes to `main`, including mobile changes. `main` is the
    integration branch, and nothing reaches a store without a deliberate `eas build` + `eas submit`
    from a release branch — so mobile work sitting on `main` isn't shipped work, it's queued work.
  - **Release branch open** (`gh pr create --base release/<version>`): anything under `apps/mobile`,
    anything in `packages/core` that mobile consumes, and **dependency bumps that mobile bundles**
    (`expo*`, `react-native*`, `react`, `react-native-purchases`, …) target it instead. Those change
    what gets submitted, so they belong to a version and want the release's testing pass.
  - **Always `main`, release branch or not:** `apps/web`, **docs**, CI, and tooling-only or web-only
    dependency bumps. Docs and Dependabot may be **pushed straight to `main` without a PR** — they
    can't change a binary, and a PR for a typo fix is ceremony. (Everything touching `apps/mobile`
    or `packages/core` still goes through review.)
  - **The one exception: web copy that describes an unreleased app targets the release branch.**
    The rule above exists so web *fixes* aren't held hostage to App Store review. It does not
    follow that a landing page advertising features nobody can download yet should go to `main`,
    where Vercel deploys it immediately. Point that PR at `release/<version>` instead and it goes
    live exactly when the release does — the RC merge at cutting step 8 is the deploy — instead of
    sitting open on a promise to remember. 1.2.0's website PR (#155) was held open this way for
    weeks before being retargeted. The cost is web files in the mobile RC diff, which is noise and
    nothing more: `apps/web` cannot change a binary. **A web fix still goes straight to `main`** —
    this is only for copy that would be lying until the store catches up.
  - **Dependabot targets `main`, and that's correct** — don't set `target-branch` in
    `.github/dependabot.yml` to redirect it. Two reasons: a per-version branch is deleted at ship
    time, so the pin goes stale every cycle and errors in between; and `target-branch` only
    redirects *version* updates — **security updates are raised against the default branch
    regardless**, so it can never give you a `main` free of Dependabot anyway. Retargeting a
    mobile-affecting bump (`gh pr edit <n> --base release/<version>`) only matters while a release
    branch is open; otherwise merge it to `main`.
  - **The real filter for a mobile dependency isn't semver, it's the SDK.** Run
    `npx expo install --check` in `apps/mobile`: it reports what the *installed* Expo SDK expects,
    and for anything Expo version-matches that beats the registry's latest. Dependabot proposed
    `react-native-screens` 4.27.0 and `react-native` 0.87.0 while SDK 56 wanted ~4.26.0 and 0.85.x
    — un-mergeable, and it took a CI run to work out why. Close those and let
    `npx expo install --fix` set them at SDK-upgrade time. `expo` and `react-native` are already in
    the ignore list for this reason; the rest of the family still gets proposed and still needs the
    check run against it.
- **Merging a stack of dependent PRs: never `--delete-branch` one that another PR is based on, and
  rebase the children rather than merging into them.** Both bite, and both did:
  - `gh pr merge <n> --squash --delete-branch` **closes** any PR whose base was that branch instead
    of retargeting it, and a closed PR can't have its base changed. Recovery is possible but ugly —
    push the deleted branch back, `gh pr reopen`, `gh pr edit --base`, delete the branch again. Merge
    without `--delete-branch` while anything is stacked on it, and clean up at the end.
  - After a squash merge the parent's content is on the release branch as a **different commit**, so
    `git merge release/<version>` into a child conflicts the child against its own changes. Replay
    only the child's own commits instead:
    `git rebase --onto origin/release/<version> <parent-branch-tip-before-the-merge> <child>`. Note
    *before the merge*: if you already rebased and force-pushed the parent, the tip you need is the
    one the child was actually branched from, not the rebased one.
- Every change still gets a `CHANGELOG.md` entry under `[Unreleased]` in the same commit/PR that
  lands it (Keep a Changelog format) — no exceptions, don't defer this to release time, or the
  changelog stops being a reliable diff of what changed. Entries keep accumulating there across
  however many PRs land before the release ships; don't roll them into a dated heading until the
  release is actually being cut (last step below).
- **Renaming a release branch closes its standing RC PR — it does not retarget it.** GitHub's
  branch-rename API (`gh api -X POST repos/{owner}/{repo}/branches/<old>/rename -f new_name=<new>`)
  moves the branch and retargets pull requests that *point at* it, but the RC PR's **head** is that
  branch, and that one is **closed**. It cannot be recovered either: a closed PR can't have its head
  changed, and can't be reopened once its branch is gone. Renaming `release/1.1.5` → `release/1.2.0`
  cost PR #129 exactly this way; #147 replaces it. If you rename, expect to open a fresh RC PR and
  leave a comment on the old one pointing at it.
- **Open the `release/<version>` → `main` PR as soon as the first change lands on the branch, and
  leave it open** (`gh pr create --base main --head release/<version>`). Not *immediately* after
  cutting, as this used to say — GitHub refuses with "No commits between main and
  release/<version>" until the branch has diverged, so the first merged PR is the earliest it can
  exist — don't merge it until the release
  actually ships. It's the running release-candidate diff, not a normal feature PR. Every time
  something merges into `release/<version>`, update this PR's description so it still reflects
  what's in the release — easiest way is to mirror the current `[Unreleased]` section of
  `CHANGELOG.md` into it (`gh pr edit <number> --body "..."`).
- **Cutting the release**, once everything intended for it is merged into `release/<version>`:
  1. Bump native version files for whichever platform(s) are shipping. The marketing version
     lives in **`apps/mobile/ios/PokerTimer/Info.plist`** (`CFBundleShortVersionString`,
     hardcoded — not `$(MARKETING_VERSION)`) and **`apps/mobile/android/app/build.gradle`**
     (`versionName`); `app.json`'s `version` is cosmetic (prebuild isn't run, so it never syncs)
     but keep it in sync anyway. iOS and Android version numbers are independent counters, **not
     tied to each other** — they can diverge (e.g. iOS at 1.1.2, Android still at 1.1.1) when only
     one platform ships, or share the same number when both ship together. Either way, bump the
     native file only for the platform(s) shipping *in this release*, or the binary ships the old
     version and App Store Connect rejects it (ITMS-90186 "train … is closed" / ITMS-90062).
     Build numbers are fine to leave — `eas.json` `appVersionSource: remote` + `autoIncrement`
     manages `CFBundleVersion` / `versionCode` on EAS's servers.
  2. Roll the accumulated `[Unreleased]` entries into a dated heading (e.g.
     `## [1.1.3] - 2026-07-20 — Android`, or `— iOS & Android` when both platforms ship together
     in one heading), add the compare link at the bottom.
  3. **Clear the finished work out of `ROADMAP.md` and `RELEASE_TESTING.md`.** Neither is a
     record — `CHANGELOG.md` and git history are. Delete every ✅ item from `ROADMAP.md` (an item
     that shipped is described in the changelog and reasoned about in its commit; keeping it here
     just buries what's actually open — the file was 1,044 lines and almost none of it was work),
     and reset `RELEASE_TESTING.md`'s rows to ⬜, dropping the defect write-ups and the pass log.
     What survives in both is only what's still open, accepted (🟡), or durable — a
     known-and-accepted entry, a blocker explaining *why* a row can't be run locally. Anything carried into the next version (a fix that shipped untested, say)
     moves to a "Carried over from `<version>`" section at the top of `ROADMAP.md`, so it can't be
     lost between cycles.
  4. Commit those release-prep changes on the release branch.
  5. `eas build` **from the release branch** — EAS builds whatever's checked out locally, so make
     sure `release/<version>` is checked out when you run it.
  6. **Submit to the testing track first, never straight to production:**
     `npm run eas:submit -w @poker/mobile` (or `:ios` / `:android`). Those scripts pass
     `--profile internal`, which puts Android on Play's `internal` track; iOS is the same upload
     either way, since every build uploaded to App Store Connect lands in TestFlight and submitting
     for App Store *review* is a separate, deliberate action in ASC afterwards. The
     `eas:submit:*:production` variants exist for step 7 and name production in full, so it can't be
     reached by accident.
     - **Never run a bare `eas submit`.** With no `--profile` it silently uses the profile *named*
       `production`, which is how 1.1.4 reached Play's production track with its billing rows never
       once run. The scripts existed and didn't pass a profile at all; that's fixed, but the CLI
       still behaves this way if you invoke it directly.
     - **Keep [managed publishing](https://support.google.com/googleplay/android-developer/answer/9859654)
       on in Play Console** (Publishing overview → Managed publishing status). It holds *approved*
       releases at "Ready to publish" instead of letting them go live, which is the only real safety
       net here: Play has **no way to cancel a release once it's in review**. It can be turned on
       mid-review and still catches that release when it's approved.
     - The reason this matters is Android-only and asymmetric: **Play Billing can't be exercised
       from a local build at all**, so purchase/restore/cancel are unverifiable until the app is on
       a Play track (uploaded, matching signing key, tester on the licence-testing list). Submitting
       with the `production` profile would put unverified billing on the production track.
     - Run whatever rows in [RELEASE_TESTING.md](./RELEASE_TESTING.md) are marked 🚫 — they exist
       precisely because they need this build — plus anything a dev client couldn't show honestly
       (deep-link cold launch, since the dev launcher owns the URL scheme).
  7. Promote to production once those pass: Play Console's release dashboard, and "Submit for
     review" in App Store Connect. `eas submit --profile production` also works for Android if you
     prefer the CLI.
  8. Once the release is actually live: merge the standing `release/<version>` → `main` PR (update
     its description one last time first), then tag the built commit — not just wherever
     the version string changed, since one version number can span several commits before the one
     that actually ships:
     `git tag -a v<version> <built-commit-sha> -m "v<version> (<platform>, build <n>)"` then
     `git push origin v<version>`. Find the built commit via `eas build:view <id>` or the EAS
     build page. **The tag is what "live" means now** (see the top of this section), so it has to
     point at the commit that was actually built, not at the merge.
  9. Delete `release/<version>`. Cut the next `release/<version>` from the new `main` tip when you
     start batching the next round of work.
- **Hotfixing the live version while a release branch is mid-cycle**: branch `hotfix/<version>`
  **from the `v<version>` tag of what's actually live** — `git checkout -b hotfix/1.1.5 v1.1.4` —
  not from `main` and not from the active release branch. Neither of those is what shipped: `main`
  carries web/docs/dependency work that has never been through a mobile testing pass, and the
  release branch carries the whole next version. Branching from the tag gives you exactly the code
  in the store plus your fix, which is the entire point of a hotfix.
  - Ship it through the same version/changelog/tag steps above (bump, roll the changelog, build and
    submit from the hotfix branch, tag the built commit).
  - Then merge it **both** into `main` *and* into the in-progress `release/<version>`, or it'll be
    silently reverted the moment that release merges over it. Two merges, every time.

## Things that bite in this monorepo

- **React must stay a single version across web + mobile — `19.2.3`, the version Expo bundles.**
  Declared exactly (no `^`, no `~`) in `apps/web` and `apps/mobile`, and **nowhere else**. Bump both
  together. With those two pins and nothing declaring react at the root, npm hoists one copy and
  both workspaces share it.
  - **A root react declaration is what breaks this, not what fixes it.** While `next` sat in the
    root devDependencies it peer-depended on `react: ^18.2.0 || ^19.0.0`, and with no root react to
    satisfy that peer npm fetched the newest match (measured `19.2.8`), hoisted *that*, and pushed
    both apps' exact pins into nested copies — **three copies of React**, which breaks hooks and
    context. Adding react to the root papers over it; removing `next` from the root removes the
    cause. Keep app dependencies out of the root and this doesn't arise.
- **There are deliberately zero `overrides` in this repo. Keep it that way.** Every override that
  used to exist turned out to be masking a declaration we control, and each was removed by fixing
  the real cause:
  - `react`/`react-dom` → the root declaration above, not an override.
  - `@types/react`/`@types/react-dom` → `apps/web` declared `^19` against `apps/mobile`'s
    `~19.2.0`, so npm could satisfy them separately. Both now declare `~19.2.0`/`~19.2`; keep them
    in step.
  - `postcss` → added for an advisory upstream has since fixed. It had started forcing Next off
    `postcss: 8.5.23`, a version Next pins exactly and tests against.

  **Before adding an override, find which declaration is actually causing the conflict** — in a
  workspace repo it is usually one of ours. If you genuinely must add one, write down the condition
  under which it can be removed, or it will outlive its purpose unnoticed like `postcss` did.
- **Verify any dependency-resolution change from a deleted lockfile — then throw that lockfile
  away.** The committed `package-lock.json` already encodes the correct resolutions, so a change
  that removes a pin appears to change nothing when tested against it. Only
  `rm -rf node_modules package-lock.json && npm install` shows what the declarations really produce.
  But **do not commit the regenerated lockfile**: a from-scratch resolve pulls newer transitives and
  has been observed introducing duplicate *native* modules (`expo-constants`, `react-native-screens`,
  `expo-asset`). Once you've read the result, `git checkout -- package-lock.json` and re-run
  `npm install` so the committed lockfile is adjusted minimally instead of rewritten.
  - Check with `npx expo-doctor` in `apps/mobile` — its "no duplicate dependencies" check is the
    authority. **Clean the expo shims immediately before running it** (below), or it crashes with a
    misleading `ENOENT` on `apps/mobile/node_modules/expo-constants/package.json` and reports as a
    failure unrelated to duplicates. `npm ls --all | grep -c invalid` should be `0`; if it isn't,
    check for shims before believing it — they show up as `invalid` `expo`/`expo-constants`/
    `expo-dev-launcher` entries. Note `npm install` itself re-plants the shims, so clean *after*
    installing, not before.
- **A transitive advisory is usually a stale lockfile pin, not a case for an override.** Check the
  parents' accepted ranges first: `js-yaml` sat at the vulnerable 4.2.0 while both consumers
  (`@expo/xcpretty`, `@eslint/eslintrc`) accepted `^4.1.x`, so a plain `npm update js-yaml` moved it
  to the patched 4.3.1 with no override and a 4-line lockfile diff. Only when no in-range fix exists
  is there a real decision to make — `uuid` is the counter-example: `xcode@3.0.1` hard-requires
  `^7.0.3` and the fix needs `>= 11.1.1`, so the only options are a four-major override on the
  library that rewrites the Xcode project during prebuild, or waiting for `xcode` to publish. **It's
  left unfixed deliberately**; it's build tooling, never reachable from app code, and the override
  is more dangerous than the advisory.
- **Keep every workspace's `eslint` and `@eslint/js` on the same major.** `packages/core` once
  declared `@eslint/js: ^10.0.1` beside `eslint: ^9.39.4`; `@eslint/js@10` peer-requires
  `eslint@^10`, so npm marked the whole tree `invalid` and a lockfile-free `npm install` failed
  outright — which silently breaks the clean-install step above. `npm ls --all | grep invalid`
  catches this class of thing.
- **Nothing app-specific belongs in the root `package.json`.** Root carries only the workspace
  config and the tooling that orchestrates all of them (`turbo`, plus `typescript` pinned once so
  every workspace and the editor agree). `next`, `react` and `react-dom` were all declared there at
  various points and none of them needed to be — see the React entry above for what that cost.
  - The old rule here said `next` had to be a root devDependency or `eslint-config-next` couldn't
    resolve it. **That is no longer true** (verified: web lint runs with 21 `@next/next/*` rules
    active with no root `next`). `apps/web` declares `next` itself and npm hoists it to the root
    `node_modules` regardless — a declaration was never what made it resolvable. If you hit a
    resolution error, check `require.resolve('next/package.json', { paths: ['apps/web'] })` before
    adding anything to the root.
- **`expo lint` caches module resolution, so a file created after a failed run stays "unresolvable".**
  Symptom: `import/no-unresolved` on a path that exists, typechecks, and lints clean when eslint is
  run directly on that one file. The cache is **not** `.eslintcache` — `expo lint` passes
  `--cache-location=apps/mobile/.expo/cache/eslint/`, so `rm -rf apps/mobile/.expo/cache/eslint`
  is the fix. Reached by creating `src/app/account.tsx` before the component it imports; the
  component appeared a minute later and lint kept insisting it did not exist.
- **`@types/node` leaks to mobile via hoisting** — use `ReturnType<typeof setInterval>` for interval
  refs, not `number`.
- **`expo-router` does not hoist to the root `node_modules`, and the expo CLI can't find it without
  `NODE_PATH`.** This is why `start`/`android`/`android:device`/`ios`/`ios:device` in
  `apps/mobile/package.json` are all prefixed `NODE_PATH=node_modules`. Remove it and every one of
  them dies before Metro serves anything:
  ```
  Error: Cannot find module 'expo-router/_ctx-shared'
    at typedRoutes (…/@expo/cli/build/src/start/server/type-generation/routes.js:77)
  ```
  - **The path matters more than the package.** npm installs `expo-router` to
    `apps/mobile/node_modules/expo-router`, but `@expo/router-server` — which does the bare
    `require('expo-router/_ctx-shared')` — lives at
    `node_modules/expo/node_modules/@expo/cli/node_modules/@expo/router-server`. Node walks *up*
    from there, so it sees `node_modules/expo/node_modules` and the root `node_modules`, and never
    `apps/mobile/node_modules`. `NODE_PATH` is appended *after* that chain, so it fixes the lookup
    without shadowing anything — which also means it can't reintroduce the shim problem below, and
    the `pre*` hooks have cleaned those out by then anyway.
  - **It's `app.json`'s `experiments.typedRoutes: true` that makes this fatal** rather than a
    warning. Turning that off also "fixes" it — don't. It's a real feature, and the generated
    `.expo/types/router.d.ts` is gitignored, so CI never notices either way.
  - **Not lockfile rot — don't try to fix it by regenerating.** A full
    `rm -rf node_modules package-lock.json && npm install` nests it exactly the same way. It's
    `apps/web`'s presence in the workspace that does it: an identical install with only
    `apps/mobile` + `packages/core` hoists `expo-router` to the root. Nothing in expo-router's
    dependencies or its *required* peers conflicts with root by then, so this is npm's placement
    heuristic, not a declaration of ours to correct — which is why the fix is `NODE_PATH` and not a
    root dependency (forbidden, see below) or an `override` (also forbidden).
  - It regressed in `45c1573` (the SDK 56 alignment): before it, `expo-router@56.2.11` sat at
    `node_modules/expo-router`; after, `56.2.19` sits under `apps/mobile` and the root entry is gone.
    Nothing about that commit was wrong — the version bump just changed what npm decided to hoist.
- **Metro monorepo config** is in `apps/mobile/metro.config.js`; if Metro can't resolve a hoisted
  dep or `@poker/core`, check `watchFolders`/`nodeModulesPaths` there.
- **Mobile is a bare Expo workflow** — `apps/mobile/ios` and `apps/mobile/android` are committed.
  App-config/native changes need `expo prebuild` (+ `npm run pods`); EAS builds the committed projects.
- **The floating gear-icon-in-a-circle in the top corner of every screen on a dev-client build is
  Expo's own dev-menu trigger** (`expo-dev-client`/`expo-dev-menu`), not app UI — it doesn't exist
  in the app's source and never ships in a release build. Ignore it when reviewing screenshots or
  debugging layout; it's not a bug to fix and not a system accessibility overlay either.
- **`expo run:android` plants broken package shims that also break iOS.** **Every affected command
  now self-heals** — `apps/mobile` has `pre*` hooks on `android`, `android:device`, `ios`,
  `ios:device`, `prebuild`, `pods`, **`lint` and `typecheck`**, and the root has a `postinstall`, all
  calling `apps/mobile/scripts/clean-expo-shims.js`. It detects the shims (via a missing
  `package.json`, not just presence) and removes them plus the stale Gradle autolinking cache before
  the real command runs. `lint`/`typecheck`/`postinstall` were added after the shims repeatedly made
  lint look broken repo-wide mid-session; **`npm install` itself re-plants them**, which is why the
  root `postinstall` exists and why any manual cleaning must come *after* installing.
  - **The replanting is real and does not require Android Studio.** Confirmed with no IDE open in
    the usual sense: **VS Code's Red Hat Java extension** (`redhat.java`) keeps its own Gradle
    daemons alive against this project — four were running (Gradle 8.9 ×3, 9.3.1) — and each
    background sync can replant the shims. If the shims keep coming back, `pgrep -fl GradleDaemon`
    will show them; killing those daemons or disabling the Java/Gradle extension for this workspace
    stops it at the source.

  That covers shims left over from a *previous* run; if it still recurs mid-build (a concurrent
  Gradle sync replanting them *during* the same invocation, or you built via some
  other entrypoint like a bare `npx expo run:android` that skips the npm script), the manual fix
  below still applies; `node apps/mobile/scripts/clean-expo-shims.js` on its own removes the shims
  and is safe to re-run any time. **Add `--gradle-cache` to also wipe `android/build` +
  `android/app/build`** — needed before an Android build (Gradle caches the resolved autolinking
  list and will keep serving a stale one), but deliberately *not* the default, because the script
  also runs from `lint`/`typecheck` and those have no business deleting a multi-minute Android
  build. `preandroid*`/`preprebuild` pass the flag; `preios*`/`prepods`/`prelint`/`pretypecheck`
  and the root `postinstall` don't. Root cause, for when the automatic
  fix isn't enough: Expo's autolinking creates partial proxy directories — missing `package.json`
  and the platform folder, just a stray `android/` — at
  `node_modules/expo-dev-client/node_modules/expo-dev-launcher` and directly under
  `apps/mobile/node_modules/{expo,expo-constants,expo-modules-autolinking}`. These shadow the
  real, correctly-hoisted copies at root `node_modules/` for *any* Node-based resolution,
  including CocoaPods' iOS autolinking. **Two of the symptoms don't look like the shim bug at all,
  and will send you down the wrong path if you don't know them:**
  - `npm run lint` dies with `Error: File 'expo/tsconfig.base' not found.` and exit code 2 — the
    broken `apps/mobile/node_modules/expo` shadows the real hoisted copy, so `expo lint` can't load
    its own config. **It fails before running a single rule**, so this reads as "lint is broken
    repo-wide" and is easy to mistake for a pre-existing condition to baseline against. It isn't:
    CI installs cleanly and lints fine, so **CI is the source of truth if local lint disagrees**.
  - `npx expo-doctor`'s "no duplicate dependencies" check crashes with
    `ENOENT ... apps/mobile/node_modules/expo-constants/package.json` and is reported as a *failed
    check*, which looks like a real duplicate-dependency problem.
  Both clear instantly with `node apps/mobile/scripts/clean-expo-shims.js`. Run that first whenever
  lint or expo-doctor behaves strangely. The rest of the symptoms: Android — `Project with path
  ':expo-dev-launcher' could not be found in project ':expo-dev-client'` (surfaces once the Gradle
  daemon/cache goes cold; harmless while warm). iOS — `expo-modules-autolinking resolve -p ios`
  silently omits the `expo` package (every other `expo-*` package resolves fine), so `pod install`
  never links the `Expo` pod and `AppDelegate.swift`'s `public import Expo` fails (`no such module
  'Expo'`); patching around *that* (e.g. adding `pod 'Expo'` to the Podfile by hand) only gets you
  to a runtime crash instead (`Cannot find native module 'ExpoFetchModule'`), since the Swift
  module-registration codegen is driven by the same broken resolve output. Don't do that — fix the
  actual shims: `rm -rf node_modules/expo-dev-client/node_modules
  apps/mobile/node_modules/{expo,expo-constants,expo-modules-autolinking}`, confirm with `cd
  apps/mobile && npx expo-modules-autolinking resolve -p ios --json | grep -c
  '"packageName":"expo"'` → should be `1`, then `npm install` (Android) or `npm run pods -w
  @poker/mobile` (iOS) and rebuild. **Also clear
  `apps/mobile/android/build/generated/autolinking/`** (or just `rm -rf
  apps/mobile/android/build apps/mobile/android/app/build`) after fixing the shims — Gradle caches
  the resolved autolinking list there and only re-runs the resolution command when a lockfile hash
  changes (`ReactSettingsExtension.checkAndUpdateCache`), so if the cache was written while the
  shims were broken it keeps serving that same truncated dependency list (symptom: `resource
  style/Theme.EdgeToEdge`/`Theme.SplashScreen ... not found` during `processDebugResources`, from
  `react-native-edge-to-edge`/`expo-splash-screen` silently missing from the linked modules) even
  after the shims themselves are cleaned up. This surfaced here from **background Gradle syncs
  alone** (Android Studio + the VS Code Gradle extension both open against the project, each
  running their own daemon) re-triggering the shim bug with no `expo run:android` or other
  explicit command involved — if a local Android build seems to spontaneously re-break after
  being fixed, check for a concurrent IDE Gradle sync before assuming the fix didn't take.
- **Bumping a native module invalidates every existing dev-client binary — rebuild, don't just
  reload.** A dev client ships compiled native modules; Metro only replaces the JS. Update one and
  the new JS talks to the old native code, which fails at *runtime* with nothing at build time to
  warn you. Observed on the `react-native-purchases` 10.4.0 → 10.4.4 bump: the app red-screened at
  launch with `RNPurchases.setupPurchases called with too many arguments, expected up to 14, got 15`
  from `revenueCatProvider.ts`, because 10.4.4's JS passes an extra argument that 10.4.0's native
  module doesn't accept. Nothing was wrong with the code. After any change under `dependencies` that
  has native code, run `npm run pods -w @poker/mobile` (iOS) and rebuild the dev client on both
  platforms before trusting anything you see. `pod install` refusing to run is the *good* case —
  it's the mismatch surfacing early rather than at launch.
- **iOS must build from source.** SDK-56 precompiled XCFrameworks break this hoisted monorepo
  (archive fails on `Build ExpoModulesJSI xcframework` / safe-area-context "Directory not found",
  even with `--clear-cache`). `apps/mobile/ios/Podfile` bakes
  `ENV['EXPO_USE_PRECOMPILED_MODULES'] = '0'` and `ENV['RCT_USE_PREBUILT_RNCORE'] = '0'` at the
  top, so a plain `pod install` / `npm run pods` is safe — no env prefix needed. `app.json`'s
  `ios.buildReactNativeFromSource: true` documents the intent but has no effect on its own —
  nothing bridges it to the env var, so the Podfile lines are what actually enforce this. The
  matching `eas.json` build-profile env vars are a redundant guard specifically for EAS Build,
  which sets `EXPO_USE_PRECOMPILED_MODULES=1` ambiently in its cloud environment. Verify:
  `grep -c React-Core-prebuilt apps/mobile/ios/Podfile.lock` → `0`; if it's non-zero, someone
  removed the Podfile `ENV` lines — restore them rather than just reverting the lock file.
- **Keep `ios.supportsTablet: true`.** The app shipped universal (iPhone + iPad); an update that
  drops iPad is rejected at upload with App Store error 90101.
- **Fixed: Android could crash with `java.lang.NullPointerException` when the activity was
  paused/resumed/reconfigured before the JS bridge finished attaching** (e.g. backgrounded within
  the first second of a cold dev-client launch — reliably reproducible via rapid `adb shell am
  force-stop` + `am start` cycles, which showed it 100% of the time, not just as an occasional
  race). Real root cause: **`com.facebook.react.ReactActivityDelegate`'s** own
  `onUserLeaveHint()`/`onPause()`/`onResume()`/`onDestroy()`/`onActivityResult()`/
  `onWindowFocusChanged()`/`onConfigurationChanged()` all do
  `Objects.requireNonNull(mReactDelegate).xxx(...)` with no null-check, and `mReactDelegate` isn't
  set until the underlying `ReactDelegate` has attached — this is `react-native` itself
  (`ReactActivityDelegate.java`), not `expo`'s `ReactActivityDelegateWrapper.kt` (which just awaits
  `loadAppReady` and forwards to the real delegate; an earlier version of this note incorrectly
  placed the bug there). Can't be patched at the vendored-source level: `com.facebook.react:
  react-android` resolves as a **prebuilt AAR from Maven** (`~/.gradle/caches/modules-2/files-2.1/
  com.facebook.react/react-android/`), not compiled from `node_modules/react-native/ReactAndroid`
  — editing that source tree (e.g. via `patch-package`) has zero effect on the compiled app, since
  no `:ReactAndroid` Gradle task ever runs (confirmed by grepping a full build log for it — nothing
  matches). **Fix:** override all seven of those lifecycle methods in our own `MainActivity.kt`
  (`apps/mobile/android/app/src/main/java/com/toondeboer/pokerkit/MainActivity.kt`), wrapping each
  `super.<method>()` call in a try/catch for `NullPointerException` via a small `guardReactLifecycle`
  helper. Safe because Android's own `Activity`-level handling for each of these already runs
  synchronously *first* inside `super.<method>()`, before the react-native-specific call that can
  throw — catching only skips react-native's own bookkeeping for an instance that was never
  attached, never any real OS-level lifecycle work. Verified with the same rapid force-stop/start
  reproduction: 10/10 clean (previously 5/5 and 8/8 crashed) on a `Pixel_stable` API 35 emulator,
  app fully usable afterward.
