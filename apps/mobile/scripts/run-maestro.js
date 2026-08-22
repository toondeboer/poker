#!/usr/bin/env node
// Runs the Maestro e2e flows for one platform.
//
// Why a script rather than `maestro test e2e/maestro` straight from a package
// script:
//
// 1. **The flows are split by filename suffix, not by tag.** `*-ios.yaml` is
//    the iOS variant of the file next to it; everything else is Android. Handing
//    Maestro the whole directory would run both sets against whichever single
//    device is attached, so half of them would fail on selectors written for the
//    other platform.
// 2. **`_`-prefixed files are subflows, not tests.** They're `runFlow:` targets
//    (`_cold-start.yaml`, `_dismiss-logbox.yaml`) and are meaningless on their
//    own — running the directory would execute them as top-level flows too.
// 3. **Android's cold-start subflow needs this machine's LAN address.** The dev
//    launcher only bypasses its picker screen when it's handed a deep link
//    carrying the Metro URL, and that URL has to be reachable *from the
//    emulator*, so `localhost` won't do. This used to be a hardcoded IP checked
//    into the flow, which broke on every new DHCP lease.
//
// Usage: node scripts/run-maestro.js <ios|android> [extra maestro args…]

const { spawnSync } = require("node:child_process");
const { networkInterfaces } = require("node:os");
const { readdirSync } = require("node:fs");
const path = require("node:path");

const FLOW_DIR = path.join(__dirname, "..", "e2e", "maestro");

const platform = process.argv[2];
if (platform !== "ios" && platform !== "android") {
  console.error("usage: run-maestro.js <ios|android> [maestro args…]");
  process.exit(2);
}

/**
 * The address the *emulator/simulator* can reach this machine on. An emulator is
 * a separate network host, so a loopback address resolves to the emulator
 * itself, not to Metro. Overridable because a wired/VPN setup can present
 * several plausible interfaces and only the caller knows which one is right.
 */
function detectMetroHost() {
  if (process.env.METRO_HOST) return process.env.METRO_HOST;
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) return address.address;
    }
  }
  throw new Error(
    "could not detect a LAN address for Metro — pass METRO_HOST=<ip> explicitly",
  );
}

const isIosFlow = (name) => name.endsWith("-ios.yaml");
const isSubflow = (name) => name.startsWith("_");

const flows = readdirSync(FLOW_DIR)
  .filter((name) => name.endsWith(".yaml"))
  .filter((name) => !isSubflow(name))
  .filter((name) => (platform === "ios" ? isIosFlow(name) : !isIosFlow(name)))
  .sort()
  .map((name) => path.join(FLOW_DIR, name));

if (flows.length === 0) {
  console.error(`[e2e] no ${platform} flows found in ${FLOW_DIR}`);
  process.exit(1);
}

const metroHost = detectMetroHost();
console.log(
  `[e2e] ${platform}: ${flows.length} flows, METRO_HOST=${metroHost}`,
);

// `maestro` installs to ~/.maestro/bin and is not always on a non-interactive
// shell's PATH (CI, npm scripts), so look there before giving up on the name.
const maestroBin = path.join(
  process.env.HOME ?? "",
  ".maestro",
  "bin",
  "maestro",
);

const result = spawnSync(
  maestroBin,
  ["test", "-e", `METRO_HOST=${metroHost}`, ...flows, ...process.argv.slice(3)],
  { stdio: "inherit", env: process.env },
);

if (result.error && result.error.code === "ENOENT") {
  console.error(
    "[e2e] maestro not found. Install it with:\n" +
      "      curl -Ls https://get.maestro.mobile.dev | bash",
  );
  process.exit(127);
}

process.exit(result.status ?? 1);
