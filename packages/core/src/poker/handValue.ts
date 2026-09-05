/**
 * Five-card hand strength, packed into a single comparable integer.
 *
 * **Why one integer rather than a struct plus a comparator:** split pots turn
 * on exact ties, so "these two hands are equal" has to be `===` rather than a
 * multi-field walk that can be got subtly wrong in one of its branches.
 * Packing makes ordering and equality the same operation, and both total.
 *
 * Layout, 24 bits:
 *
 *     (category << 20) | (k1 << 16) | (k2 << 12) | (k3 << 8) | (k4 << 4) | k5
 *
 * `k1..k5` are ranks in descending order of significance, zero-padded when a
 * category needs fewer than five. Ranks run 2..14, so each fits in four bits.
 */

import {
  MAX_RANK,
  MIN_RANK,
  SUIT_INDEX,
  cardToString,
  type Card,
  type Rank,
} from "./cards";

export const HAND_CATEGORIES = [
  "high-card",
  "pair",
  "two-pair",
  "three-of-a-kind",
  "straight",
  "flush",
  "full-house",
  "four-of-a-kind",
  "straight-flush",
] as const;

export type HandCategory = (typeof HAND_CATEGORIES)[number];

/** Packed hand strength. Higher is better; equal is a genuine tie. */
export type HandValue = number;

/** Cards in one evaluated hand. Five, always. */
export const HAND_SIZE = 5;

const CATEGORY_INDEX: Record<HandCategory, number> = {
  "high-card": 0,
  pair: 1,
  "two-pair": 2,
  "three-of-a-kind": 3,
  straight: 4,
  flush: 5,
  "full-house": 6,
  "four-of-a-kind": 7,
  "straight-flush": 8,
};

/** Index one past the highest rank, so a per-rank array covers 0..14. */
const RANK_SLOTS = 15;

/** Set bits in a four-bit suit mask — i.e. how many of that rank are held. A
 * table rather than a loop because this sits in the hot path. */
const POPCOUNT_4 = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export const packHandValue = (
  category: HandCategory,
  kickers: readonly Rank[],
): HandValue => {
  let value = CATEGORY_INDEX[category] << 20;
  for (let i = 0; i < HAND_SIZE; i++) {
    value |= (kickers[i] ?? 0) << (16 - i * 4);
  }
  return value >>> 0;
};

/** The category half of a packed value — for naming a winning hand, and for
 * tests that care about the category and not the kickers. */
export const handCategory = (value: HandValue): HandCategory =>
  HAND_CATEGORIES[value >>> 20];

/**
 * The highest rank completing a straight given rank multiplicities, or 0.
 *
 * The wheel is the whole reason this isn't a one-liner. A-2-3-4-5 is a straight
 * and it is the *lowest* one, scored as five-high — so the ace is treated as
 * present at both 14 and 1, and the downward scan finds the wheel last.
 *
 * Takes the per-rank suit masks rather than the cards, so the caller builds
 * them once and every use reads the same array.
 */
const straightHigh = (suitsByRank: readonly number[]): Rank => {
  const has = (rank: number) =>
    rank === 1 ? suitsByRank[MAX_RANK] > 0 : suitsByRank[rank] > 0;

  for (let high = MAX_RANK; high >= 5; high--) {
    if (
      has(high) &&
      has(high - 1) &&
      has(high - 2) &&
      has(high - 3) &&
      has(high - 4)
    ) {
      return high;
    }
  }
  return 0;
};

/**
 * Evaluate exactly five cards. Callers holding seven use `evaluateHand`, which
 * delegates here once per five-card subset.
 *
 * Throws on any other count: a hand of the wrong size is a programming error,
 * and silently scoring four cards would produce a plausible-looking number that
 * quietly loses somebody a pot.
 *
 * **Written to allocate almost nothing.** Production calls this 21 times per
 * showdown and would not care, but `handFrequency.test.ts` calls it 2,598,960
 * times, and the readable Map-and-sort version made that test slow enough to
 * risk tripping vitest's default 5s per-test timeout on CI hardware.
 */
export const evaluateFive = (cards: readonly Card[]): HandValue => {
  if (cards.length !== HAND_SIZE) {
    throw new Error(
      `evaluateFive needs ${HAND_SIZE} cards, got ${cards.length}`,
    );
  }

  // One four-bit suit mask per rank. This does the work three separate things
  // would otherwise need — how many of each rank, whether it is a flush, and
  // whether the same card arrived twice — from a single array and a single
  // pass, which is what keeps the whole-deck frequency test affordable.
  const suitsByRank = new Array<number>(RANK_SLOTS).fill(0);
  const firstSuit = cards[0].suit;
  let isFlush = true;
  for (const card of cards) {
    const bit = 1 << SUIT_INDEX[card.suit];
    if ((suitsByRank[card.rank] & bit) !== 0) {
      // The length guard's own reasoning applies here: a duplicate would score
      // as a plausible-looking hand — two of the same ace reads as a pair —
      // and a plausible wrong number is what quietly loses somebody a pot.
      throw new Error(`evaluateFive got the same card twice: ${cardToString(card)}`);
    }
    suitsByRank[card.rank] |= bit;
    if (card.suit !== firstSuit) isFlush = false;
  }

  // Ranks ordered by (count descending, then rank descending) — which is
  // exactly the kicker order every paired category wants, so quads, full
  // houses, trips, two pair and one pair all read off this one list. With no
  // pairs at all every count is 1, so it is simply the ranks high-to-low,
  // which is what flushes and high-card hands need too.
  const byCount: Rank[] = [];
  // The multiplicities as digits, high to low: 41, 32, 311, 221, 2111, 11111.
  let shape = 0;
  for (let count = HAND_SIZE - 1; count >= 1; count--) {
    for (let rank = MAX_RANK; rank >= MIN_RANK; rank--) {
      if (POPCOUNT_4[suitsByRank[rank]] === count) {
        byCount.push(rank);
        shape = shape * 10 + count;
      }
    }
  }

  const high = straightHigh(suitsByRank);

  if (isFlush && high) return packHandValue("straight-flush", [high]);
  if (shape === 41) return packHandValue("four-of-a-kind", byCount);
  if (shape === 32) return packHandValue("full-house", byCount);
  if (isFlush) return packHandValue("flush", byCount);
  if (high) return packHandValue("straight", [high]);
  if (shape === 311) return packHandValue("three-of-a-kind", byCount);
  if (shape === 221) return packHandValue("two-pair", byCount);
  if (shape === 2111) return packHandValue("pair", byCount);
  return packHandValue("high-card", byCount);
};
