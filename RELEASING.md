# Releasing

How to cut a new release of the **Poker Blinds Buzzer** mobile app. The web app deploys
continuously via Vercel and isn't versioned this way — this is about the App Store / Play Store
binary.

## Concepts

- **Marketing version** (`1.1.3`) — what users see. It lives in **three** files that must move
  together (a bare Expo workflow footgun; see [CLAUDE.md](./CLAUDE.md)): `apps/mobile/app.json`,
  `apps/mobile/ios/PokerTimer/Info.plist`, `apps/mobile/android/app/build.gradle`. The
  `npm run release` script bumps all three at once so they can't drift.
- **Build number** (`CFBundleVersion` / `versionCode`) — the true, unique identifier of a
  production binary. EAS manages it automatically (`eas.json` → `appVersionSource: remote` +
  `autoIncrement`), and **records the exact git commit for every build**. This is why a version
  number alone can appear on several commits but you can always trace what actually shipped: the
  build number → commit mapping lives in EAS forever.

## Steps

1. **Make sure `main` is green** and holds everything you want to ship. Keep the
   [CHANGELOG.md](./CHANGELOG.md) `[Unreleased]` section up to date as you merge.

2. **Bump the version** (from the repo root). This edits the three version files, rolls the
   CHANGELOG `[Unreleased]` block into a dated `[x.y.z]` heading, and commits `chore(release):
   vx.y.z`:
   ```bash
   npm run release 1.1.3
   ```
   Review the commit, then push it to `main`.

3. **Build** the binary in EAS's cloud (iOS shown; use `android` for Play):
   ```bash
   npm run eas:build:ios
   ```

4. **Submit** the finished build to the store:
   ```bash
   npm run eas:submit:ios
   ```

5. **Tag the commit you actually built**, once the submission succeeds. `eas build:view` (or the
   build page) shows the commit and build number for the build you submitted — tag *that* commit,
   not merely wherever the version string changed:
   ```bash
   git tag -a v1.1.3 <built-commit-sha> -m "v1.1.3 (build <n>)"
   git push origin v1.1.3
   ```
   The tag is a human-friendly pointer to the shipped commit; EAS's build-number → commit record
   is the machine source of truth.

6. **Release in the store console.** `eas submit` only *uploads* the binary. Finish the release in
   [App Store Connect](https://appstoreconnect.apple.com/apps/6749512168) / Google Play Console
   (attach the build to the version, paste the CHANGELOG entry as the "What's New" notes, submit
   for review).

## Bugfix after a release

A version that has shipped is frozen. If you find a bug in `1.1.3` after it's out, **bump to
`1.1.4`** (`npm run release 1.1.4`) — never keep committing new code under an already-released
version. That's exactly what a patch bump is for, and it keeps every version tag pointing at a
single, unambiguous shipped commit.
