import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import { HAND_CATEGORIES, evaluateFive, handCategory } from "./handValue";

/**
 * Every five-card hand in the deck, counted by category, checked against the
 * published frequencies.
 *
 * **This is the evaluator's correctness proof**, and it is worth its runtime.
 * Example-based tests show that the hands someone thought of are scored right;
 * this shows that all 2,598,960 of them are, because getting any single hand
 * into the wrong category moves two of these counts. A wheel mis-detected, an
 * ace mis-ranked, a shape string off by one — all of them show up here and most
 * of them would slip past a sampled test.
 *
 * The numbers are the standard ones (the 40 straight flushes include the four
 * royals, which are not a separate category here).
 *
 * Cost: roughly 1.2s bare, and about 3.4s under v8 coverage instrumentation,
 * which is what CI runs. Deliberately paid — but note the **explicit timeout**
 * on the test below. Vitest's default is 5s *per test*, and 3.4s on this
 * machine leaves no headroom on slower CI hardware; a previous property sweep
 * in this repo passed locally and timed out in CI for exactly that reason.
 * `evaluateFive` was also rewritten to allocate almost nothing on the strength
 * of this test, though the win is clear only without instrumentation.
 *
 * The loop calls `evaluateFive` directly and does its own counting, with **no
 * `expect` inside it** — asserting in a hot loop is the other half of how that
 * earlier sweep got so expensive.
 */
const EXPECTED_FREQUENCY: Record<string, number> = {
  "high-card": 1302540,
  pair: 1098240,
  "two-pair": 123552,
  "three-of-a-kind": 54912,
  straight: 10200,
  flush: 5108,
  "full-house": 3744,
  "four-of-a-kind": 624,
  "straight-flush": 40,
};

const TOTAL_FIVE_CARD_HANDS = 2598960;

describe("hand frequencies across the whole deck", () => {
  it("matches the published five-card frequencies exactly", () => {
    const deck = createDeck();
    const counts = new Map<string, number>();
    const hand = new Array(5);
    let total = 0;

    for (let a = 0; a < 48; a++) {
      hand[0] = deck[a];
      for (let b = a + 1; b < 49; b++) {
        hand[1] = deck[b];
        for (let c = b + 1; c < 50; c++) {
          hand[2] = deck[c];
          for (let d = c + 1; d < 51; d++) {
            hand[3] = deck[d];
            for (let e = d + 1; e < 52; e++) {
              hand[4] = deck[e];
              const category = handCategory(evaluateFive(hand));
              counts.set(category, (counts.get(category) ?? 0) + 1);
              total++;
            }
          }
        }
      }
    }

    expect(total).toBe(TOTAL_FIVE_CARD_HANDS);
    expect(
      Object.fromEntries(HAND_CATEGORIES.map((c) => [c, counts.get(c) ?? 0])),
    ).toEqual(EXPECTED_FREQUENCY);
    // Generous on purpose: see the note above. This is a fixed amount of work,
    // so a run that needs more than a minute means something is badly wrong
    // rather than merely slow.
  }, 60_000);
});
