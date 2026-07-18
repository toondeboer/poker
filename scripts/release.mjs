#!/usr/bin/env node
// Cut a new mobile release: bump the marketing version across all three native
// version files (they must move in lockstep — see CLAUDE.md), roll the CHANGELOG
// [Unreleased] section into a dated release heading, and commit. Does NOT tag —
// the tag is created against the exact commit you build/submit (see RELEASING.md).
//
// Usage:  npm run release 1.1.3          (from the repo root)
//         npm run release 1.1.3 --no-commit
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const noCommit = args.includes("--no-commit");
const version = args.find((a) => !a.startsWith("-"));

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: npm run release <major.minor.patch>  (e.g. 1.1.3)");
  process.exit(1);
}

const files = {
  appJson: join(repoRoot, "apps/mobile/app.json"),
  infoPlist: join(repoRoot, "apps/mobile/ios/PokerTimer/Info.plist"),
  buildGradle: join(repoRoot, "apps/mobile/android/app/build.gradle"),
  changelog: join(repoRoot, "CHANGELOG.md"),
};

const read = (p) => readFileSync(p, "utf8");
const prevVersion = JSON.parse(read(files.appJson)).expo.version;

if (prevVersion === version) {
  console.error(`Version is already ${version}. Nothing to do.`);
  process.exit(1);
}

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

// 1. app.json  →  "version": "X"
replaceOnce(
  files.appJson,
  /("version":\s*")\d+\.\d+\.\d+(")/,
  `$1${version}$2`,
  "app.json",
);

// 2. iOS Info.plist  →  <key>CFBundleShortVersionString</key><string>X</string>
replaceOnce(
  files.infoPlist,
  /(<key>CFBundleShortVersionString<\/key>\s*<string>)\d+\.\d+\.\d+(<\/string>)/,
  `$1${version}$2`,
  "iOS Info.plist",
);

// 3. Android build.gradle  →  versionName "X"
replaceOnce(
  files.buildGradle,
  /(versionName\s+")\d+\.\d+\.\d+(")/,
  `$1${version}$2`,
  "Android build.gradle",
);

// 4. CHANGELOG: insert a dated heading under [Unreleased] (moving its contents
//    into the new version), and add the compare link at the bottom.
const today = new Date().toISOString().slice(0, 10);
let changelog = read(files.changelog);
if (!changelog.includes("## [Unreleased]")) {
  console.error("✗ CHANGELOG.md has no '## [Unreleased]' section to roll.");
  process.exit(1);
}
changelog = changelog.replace(
  "## [Unreleased]",
  `## [Unreleased]\n\n## [${version}] - ${today}`,
);
// Repoint the [Unreleased] compare link and insert the new version's compare link.
changelog = changelog.replace(
  /\[Unreleased\]:\s*(\S+)\/compare\/v[\d.]+\.\.\.HEAD/,
  (_m, base) =>
    `[Unreleased]: ${base}/compare/v${version}...HEAD\n` +
    `[${version}]: ${base}/compare/v${prevVersion}...v${version}`,
);
writeFileSync(files.changelog, changelog);
console.log(`✓ CHANGELOG.md → [${version}] - ${today}`);

console.log(`\nBumped ${prevVersion} → ${version}.`);

if (noCommit) {
  console.log("Skipped commit (--no-commit). Review and commit when ready.");
  process.exit(0);
}

execSync(
  "git add apps/mobile/app.json apps/mobile/ios/PokerTimer/Info.plist " +
    "apps/mobile/android/app/build.gradle CHANGELOG.md",
  { cwd: repoRoot, stdio: "inherit" },
);
execSync(`git commit -m "chore(release): v${version}"`, {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log(
  `\nCommitted chore(release): v${version}. Next: push, build, submit, then tag the\n` +
    `built commit (see RELEASING.md).`,
);
