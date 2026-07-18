# Releasing

How to cut a new release of the **Poker Blinds Buzzer** mobile app. The web app deploys
continuously via Vercel and isn't versioned this way — this is about the App Store / Play Store
binary.

## Concepts

- **Per-platform versions.** iOS and Android version **independently** — a marketing version
  number belongs to one platform (they last shared a number at 1.1.1; iOS is now on 1.1.2,
  Android's next is 1.1.3). Never reuse a number across platforms, so plain `vX.Y.Z` tags stay
  unambiguous.
- **Marketing version** — what users see. Per platform it lives in a native file that must be
  bumped (a bare Expo workflow footgun; see [CLAUDE.md](./CLAUDE.md)): iOS in
  `apps/mobile/ios/PokerTimer/Info.plist` (`CFBundleShortVersionString`), Android in
  `apps/mobile/android/app/build.gradle` (`versionName`). `apps/mobile/app.json` `version` is
  cosmetic. `npm run release` bumps the right file(s) for you.
- **Build number** (`CFBundleVersion` / `versionCode`) — the true, unique identifier of a
  production binary. EAS manages it automatically (`eas.json` → `appVersionSource: remote` +
  `autoIncrement`), and **records the exact git commit for every build**. This is why a version
  number can appear on several commits but you can always trace what shipped: the build number →
  commit mapping lives in EAS forever.

## Steps (per platform)

1. **Make sure `main` is green** and holds everything you want to ship. Keep the
   [CHANGELOG.md](./CHANGELOG.md) `[Unreleased]` section up to date as you merge.

2. **Bump the version** for the platform you're releasing (from the repo root). This edits that
   platform's native version file (+ cosmetic `app.json`), rolls the CHANGELOG `[Unreleased]`
   block into a dated, platform-tagged heading, and commits `chore(release): vx.y.z (<platform>)`:
   ```bash
   npm run release -- 1.1.3 --android      # or: --ios
   ```
   (Omit the flag only for a rare synchronized release that ships the same version to both at
   once.) Review the commit, then push it to `main`.

3. **Build** the binary in EAS's cloud:
   ```bash
   npm run eas:build:android               # or: eas:build:ios
   ```

4. **Submit** the finished build to the store:
   ```bash
   npm run eas:submit:android              # or: eas:submit:ios
   ```

5. **Tag the commit you actually built**, once the submission succeeds. `eas build:view` (or the
   build page) shows the commit and build number for the build you submitted — tag *that* commit,
   not merely wherever the version string changed:
   ```bash
   git tag -a v1.1.3 <built-commit-sha> -m "v1.1.3 (Android, build <n>)"
   git push origin v1.1.3
   ```
   The tag is a human-friendly pointer to the shipped commit; EAS's build-number → commit record
   is the machine source of truth.

6. **Release in the store console.** `eas submit` only *uploads* the binary. Finish the release in
   [App Store Connect](https://appstoreconnect.apple.com/apps/6749512168) / Google Play Console
   (attach the build to the version, paste the CHANGELOG entry as the "What's New" notes, submit
   for review).

## Bugfix after a release

A version that has shipped is frozen. If you find a bug in a released version, **bump to the next
patch** (e.g. `npm run release -- 1.1.4 --ios`) — never keep committing new code under an
already-released version. That's what a patch bump is for, and it keeps every version tag pointing
at a single, unambiguous shipped commit.
