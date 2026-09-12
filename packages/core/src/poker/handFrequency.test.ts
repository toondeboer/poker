import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import { HAND_CATEGORIES, evaluateFive, handCategory } from "./handValue";

/**
 * Every five-card hand in the deck, counted by category, checked against the
 * published frequencies.
 *
 * **This is the evaluator's correctness proof**, and it is worth its runtime.
 * It checks two independent things in one pass: which category every hand
 * lands in, and how many genuinely different values each category holds.
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

/**
 * How many *distinct* packed values each category should produce.
 *
 * The frequency counts above prove that every hand lands in the right
 * category. They say nothing about the kickers — a packing that collapsed
 * two different two-pair hands onto one value, or spread one hand across two,
 * would leave every frequency untouched. These counts close that gap: they are
 * the number of genuinely different hands in each category, so they check the
 * kicker ordering and the bit layout across the whole deck as well.
 *
 * They are the standard equivalence-class counts, e.g. 13 x C(12,3) = 2860 for
 * one pair, C(13,2) x 11 = 858 for two pair, 13 x 12 = 156 for a full house.
 * Summed: the well-known 7,462 distinct five-card hand values.
 */
const EXPECTED_DISTINCT_VALUES: Record<string, number> = {
  "high-card": 1277,
  pair: 2860,
  "two-pair": 858,
  "three-of-a-kind": 858,
  straight: 10,
  flush: 1277,
  "full-house": 156,
  "four-of-a-kind": 156,
  "straight-flush": 10,
};

const TOTAL_DISTINCT_VALUES = 7462;

describe("hand frequencies across the whole deck", () => {
  it("matches the published five-card frequencies exactly", () => {
    const deck = createDeck();
    const counts = new Map<string, number>();
    const distinct = new Map<string, Set<number>>();
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
              const value = evaluateFive(hand);
              const category = handCategory(value);
              counts.set(category, (counts.get(category) ?? 0) + 1);
              const seen = distinct.get(category);
              if (seen) seen.add(value);
              else distinct.set(category, new Set([value]));
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

    expect(
      Object.fromEntries(
        HAND_CATEGORIES.map((c) => [c, distinct.get(c)?.size ?? 0]),
      ),
    ).toEqual(EXPECTED_DISTINCT_VALUES);

    const allValues = new Set<number>();
    for (const values of distinct.values()) {
      for (const value of values) allValues.add(value);
    }
    expect(allValues.size).toBe(TOTAL_DISTINCT_VALUES);
    // Generous on purpose: see the note above. This is a fixed amount of work,
    // so a run that needs more than a minute means something is badly wrong
    // rather than merely slow.
  }, 60_000);
});
