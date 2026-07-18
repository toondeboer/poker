#!/usr/bin/env node
// Cut a new mobile release: bump the marketing version, roll the CHANGELOG
// [Unreleased] section into a dated release heading, and commit. Does NOT tag —
// the tag is created against the exact commit you build/submit (see RELEASING.md).
//
// iOS and Android version INDEPENDENTLY (a version number belongs to one platform;
// they last shared a number at 1.1.1). Pass the platform you're releasing so only
// that platform's native version file moves. The marketing version in each native
// file must stay accurate on its own — see CLAUDE.md.
//
// Usage:  npm run release -- 1.1.3 --android      (bump Android + app.json)
//         npm run release -- 1.1.4 --ios          (bump iOS + app.json)
//         npm run release -- 1.2.0                (both — only if shipping the
//                                                  same version to both at once)
//         add --no-commit to stage the edits without committing
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const noCommit = args.includes("--no-commit");
const ios = args.includes("--ios");
const android = args.includes("--android");
const version = args.find((a) => !a.startsWith("-"));

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(
    "Usage: npm run release -- <major.minor.patch> [--ios|--android]  (e.g. 1.1.3 --android)",
  );
  process.exit(1);
}
if (ios && android) {
  console.error("Pass at most one of --ios / --android (omit both to bump both).");
  process.exit(1);
}
// No flag = both platforms (a rare synchronized release).
const bumpIos = ios || (!ios && !android);
const bumpAndroid = android || (!ios && !android);
const platformLabel = ios ? "iOS" : android ? "Android" : null;

const files = {
  appJson: join(repoRoot, "apps/mobile/app.json"),
  infoPlist: join(repoRoot, "apps/mobile/ios/PokerTimer/Info.plist"),
  buildGradle: join(repoRoot, "apps/mobile/android/app/build.gradle"),
  changelog: join(repoRoot, "CHANGELOG.md"),
};

const read = (p) => readFileSync(p, "utf8");
const prevVersion = JSON.parse(read(files.appJson)).expo.version;

// Replace exactly one occurrence and fail loudly if the anchor isn't found, so a
// changed file format can never silently leave a version file un-bumped.
function replaceOnce(path, regex, replacement, label) {
  const before = read(path);
  const after = before.replace(regex, replacement);
  if (after === before) {
    console.error(`✗ Could not find the version anchor in ${label} (${path}).`);
    process.exit(1);
  }
  writeFileSync(path, after);
  console.log(`✓ ${label} → ${version}`);
}

// app.json version is cosmetic in a bare workflow (EAS reads the native files),
// but keep it pointing at the most recent release regardless of platform.
replaceOnce(
  files.appJson,
  /("version":\s*")\d+\.\d+\.\d+(")/,
  `$1${version}$2`,
  "app.json",
);

if (bumpIos) {
  replaceOnce(
    files.infoPlist,
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)\d+\.\d+\.\d+(<\/string>)/,
    `$1${version}$2`,
    "iOS Info.plist",
  );
}

if (bumpAndroid) {
  replaceOnce(
    files.buildGradle,
    /(versionName\s+")\d+\.\d+\.\d+(")/,
    `$1${version}$2`,
    "Android build.gradle",
  );
}

// CHANGELOG: insert a dated heading under [Unreleased] (moving its contents into
// the new version), tagged with the platform, and add the compare link.
const today = new Date().toISOString().slice(0, 10);
const heading = platformLabel
  ? `## [${version}] - ${today} — ${platformLabel}`
  : `## [${version}] - ${today}`;
let changelog = read(files.changelog);
if (!changelog.includes("## [Unreleased]")) {
  console.error("✗ CHANGELOG.md has no '## [Unreleased]' section to roll.");
  process.exit(1);
}
changelog = changelog.replace("## [Unreleased]", `## [Unreleased]\n\n${heading}`);
changelog = changelog.replace(
  /\[Unreleased\]:\s*(\S+)\/compare\/v[\d.]+\.\.\.HEAD/,
  (_m, base) =>
    `[Unreleased]: ${base}/compare/v${version}...HEAD\n` +
    `[${version}]: ${base}/compare/v${prevVersion}...v${version}`,
);
writeFileSync(files.changelog, changelog);
console.log(`✓ CHANGELOG.md → ${heading.replace(/^## /, "")}`);

const scope = platformLabel ? ` (${platformLabel.toLowerCase()})` : "";
console.log(`\nPrepared ${version}${scope} (was ${prevVersion}).`);

if (noCommit) {
  console.log("Skipped commit (--no-commit). Review and commit when ready.");
  process.exit(0);
}

const staged = ["apps/mobile/app.json", "CHANGELOG.md"];
if (bumpIos) staged.push("apps/mobile/ios/PokerTimer/Info.plist");
if (bumpAndroid) staged.push("apps/mobile/android/app/build.gradle");
execSync(`git add ${staged.join(" ")}`, { cwd: repoRoot, stdio: "inherit" });
execSync(`git commit -m "chore(release): v${version}${scope}"`, {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log(
  `\nCommitted chore(release): v${version}${scope}. Next: push, build, submit, then tag\n` +
    `the built commit (see RELEASING.md).`,
);
