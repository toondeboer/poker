#!/usr/bin/env node
// Self-heals the "expo-dev-launcher" Gradle failure documented in the repo root CLAUDE.md:
// `expo run:android` (and even a background Android Studio / VS Code Gradle sync) can plant
// broken partial package shims — missing `package.json` and the platform folder, just a stray
// `android/` — at `node_modules/expo-dev-client/node_modules/expo-dev-launcher` and directly
// under `apps/mobile/node_modules/{expo,expo-constants,expo-modules-autolinking}`. These shadow
// the real, correctly-hoisted copies at the repo root for any Node-based module resolution
// (including Gradle's own `expo-modules-autolinking resolve` step), so the next build fails with
// "Project with path ':expo-dev-launcher' could not be found in project ':expo-dev-client'".
//
// Run automatically before `android`/`android:device` (see package.json's "preandroid*" scripts)
// so the very next invocation self-heals instead of requiring the manual cleanup dance every
// time. This can't prevent a shim planted *during* the same `expo run:android` invocation by a
// concurrently running IDE Gradle sync — closing any open Android Studio / Gradle-syncing IDE
// window for this project is still the fix for that specific case.
const fs = require("fs");
const path = require("path");

const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "..", "..");

const shimPaths = [
  path.join(repoRoot, "node_modules", "expo-dev-client", "node_modules"),
  path.join(mobileRoot, "node_modules", "expo"),
  path.join(mobileRoot, "node_modules", "expo-constants"),
  path.join(mobileRoot, "node_modules", "expo-modules-autolinking"),
];

// Only genuinely broken if it's missing package.json — expo/expo-constants are otherwise
// legitimately present as real hoisted-or-not packages, so don't delete a healthy install.
const isBrokenShim = (p) => {
  if (!fs.existsSync(p)) return false;
  return !fs.existsSync(path.join(p, "package.json"));
};

const broken = shimPaths.filter(isBrokenShim);

if (broken.length === 0) {
  console.log("[clean-expo-shims] no broken expo-dev-client/autolinking shims found, skipping.");
  process.exit(0);
}

for (const p of broken) {
  fs.rmSync(p, { recursive: true, force: true });
  console.log(`[clean-expo-shims] removed broken shim: ${path.relative(repoRoot, p)}`);
}

// Gradle caches the resolved autolinking list once it's read it; if that read happened while the
// shims above were broken, it keeps serving the same stale, truncated list even after the shims
// are cleaned up. Clear it too whenever we've just fixed a real breakage.
const gradleCacheDirs = [
  path.join(mobileRoot, "android", "build"),
  path.join(mobileRoot, "android", "app", "build"),
];
for (const dir of gradleCacheDirs) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[clean-expo-shims] cleared stale Gradle cache: ${path.relative(repoRoot, dir)}`);
  }
}

console.log(
  "[clean-expo-shims] fixed. Re-run `npm install` from the repo root before building if this " +
    "keeps recurring within the same session — that's a sign a concurrent Android Studio / VS " +
    "Code Gradle sync is actively replanting the shims.",
);
