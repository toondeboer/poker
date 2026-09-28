#!/usr/bin/env node
/**
 * Check that STORE_LISTING.md is still true.
 *
 * **The whole value of that file is that its numbers are right**, because every
 * one of them is pasted into a console with a hard limit behind it. Nothing
 * checked them until this existed, and three were wrong once something did: a
 * promotional text claiming 154 that was 151, Play release notes claiming 421
 * that were 286, and then those same notes claiming 283 — which was the right
 * count of the wrong thing.
 *
 * **Counts are UTF-16 code units, because that is what a store counts.**
 * `String.length` gives that for free; counting "characters" the obvious way
 * undercounts emoji by one unit each, and 497 against a 500 limit is a
 * rejection when it was really 503.
 *
 * It also checks the thing that has drifted three times: the paywall's
 * `PRO_FEATURES` against the summary of it in the listing. That file already
 * carries a note telling whoever edits it to go and read `PRO_FEATURES` first.
 * A note is not a check.
 *
 * **Not a unit test, and deliberately not in a workspace.** It reads a document
 * at the repo root and a file inside `apps/mobile`, so `packages/core` is the
 * wrong home — apps depend on packages, never the other way round — and
 * `apps/infra` would be stranger still. A plain node script run by CI is what
 * this is, and `apps/mobile/scripts/clean-expo-shims.js` is the same shape.
 *
 * Run: `npm run check:listing`
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const listing = readFileSync(join(root, "STORE_LISTING.md"), "utf8");
const paywall = readFileSync(
  join(root, "apps/mobile/src/components/paywall/Paywall.tsx"),
  "utf8",
);

const failures = [];
const fail = (message) => failures.push(message);

/**
 * Every fenced block whose next few lines claim a character count.
 *
 * The count is on a following line rather than the fence, so the window is
 * three lines — enough for a blank line and a sentence, not enough to pick up
 * the *next* block's count.
 */
const checkCounts = () => {
  const lines = listing.split("\n");
  let checked = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== "```") continue;
    let j = i + 1;
    const body = [];
    while (j < lines.length && lines[j].trim() !== "```") {
      body.push(lines[j]);
      j += 1;
    }
    for (let k = j + 1; k < Math.min(j + 4, lines.length); k += 1) {
      const match = /`(\d{2,4})` chars/.exec(lines[k]);
      if (!match) continue;
      checked += 1;
      const claimed = Number(match[1]);
      const actual = body.join("\n").length;
      if (claimed !== actual) {
        fail(
          `STORE_LISTING.md:${k + 1} claims \`${claimed}\` chars; the block above is ${actual}.`,
        );
      }
      break;
    }
    i = j;
  }
  if (checked === 0) {
    // A silent pass because the format changed is worse than a failure.
    fail(
      "No counted blocks found at all — has the format of the file changed?",
    );
  }
  return checked;
};

/**
 * The paywall's promises against the listing's summary of them.
 *
 * Compared by **count**, not by text: the listing says "remove ads · deal the
 * cards · …" in shorthand and the paywall says whole sentences, so matching the
 * words would mean maintaining a translation table that drifts on its own. What
 * actually goes wrong is a feature being added or dropped and the store copy
 * not being revisited, and a count catches exactly that.
 */
const checkProFeatures = () => {
  const block = /const PRO_FEATURES = \[([\s\S]*?)\];/.exec(paywall);
  if (!block) {
    fail("Could not find PRO_FEATURES in Paywall.tsx — has it been renamed?");
    return 0;
  }
  const features = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  const written = /promises \*\*(\w+)\*\* things/.exec(listing);
  if (!written) {
    fail(
      'STORE_LISTING.md no longer says how many things the paywall promises ("promises **seven** things").',
    );
    return features.length;
  }
  const words = {
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const claimed = words[written[1].toLowerCase()];
  if (claimed === undefined) {
    fail(
      `STORE_LISTING.md says "${written[1]}" things, which is not a number I know.`,
    );
  } else if (claimed !== features.length) {
    fail(
      `PRO_FEATURES has ${features.length} entries; STORE_LISTING.md says ${claimed}. ` +
        `The store copy in all three consoles is written from that list — read it and update the copy, not just this number.`,
    );
  }
  return features.length;
};

const counted = checkCounts();
const features = checkProFeatures();

if (failures.length > 0) {
  console.error("STORE_LISTING.md is out of date:\n");
  for (const message of failures) console.error(`  ✗ ${message}`);
  console.error("");
  process.exit(1);
}

console.log(
  `STORE_LISTING.md checks out — ${counted} counted blocks, ${features} Pro features.`,
);
