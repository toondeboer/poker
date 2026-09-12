/**
 * Best five-card hand out of however many cards a player can use.
 *
 * At showdown that's seven — two hole cards plus the five-card board — which
 * means 21 subsets. Enumerating all of them and keeping the best is
 * deliberately not a lookup table: there is no generated data to get wrong, the
 * correctness argument is one sentence, and 21 evaluations per showdown against
 * a handful of showdowns per hand is nothing.
 */

import type { Card } from "./cards";
import {
  HAND_SIZE,
  type HandCategory,
  type HandValue,
  evaluateFive,
  handCategory,
} from "./handValue";

export type EvaluatedHand = {
  /** Packed strength. Compare with `<`/`>`; equal means a genuine tie. */
  value: HandValue;
  /** What to call it — "flush", "two-pair" — for the showdown display. */
  category: HandCategory;
  /** The five cards that make the hand, for showing *why* it won. */
  cards: Card[];
};

/**
 * Visit every k-sized subset of `[0, n)` as an array of indices.
 *
 * The index array is reused between visits, so a caller that keeps one must
 * copy it. Every caller here copies only for the current best, which is what
 * keeps this allocation-light.
 */
const forEachCombination = (
  n: number,
  k: number,
  visit: (indices: readonly number[]) => void,
): void => {
  const indices = new Array<number>(k);
  const walk = (start: number, depth: number): void => {
    if (depth === k) {
      visit(indices);
      return;
    }
    for (let i = start; i <= n - (k - depth); i++) {
      indices[depth] = i;
      walk(i + 1, depth + 1);
    }
  };
  walk(0, 0);
};

/**
 * The best five-card hand available from `cards`.
 *
 * Ties between subsets keep the first one found, which is arbitrary but
 * harmless: two subsets scoring identically *are* the same hand, so which
 * physical cards get shown is cosmetic. What matters — the value — is
 * order-independent, and there is a test that permutes the input to prove it.
 */
export const evaluateHand = (cards: readonly Card[]): EvaluatedHand => {
  if (cards.length < HAND_SIZE) {
    throw new Error(
      `evaluateHand needs at least ${HAND_SIZE} cards, got ${cards.length}`,
    );
  }

  let bestValue = -1;
  let bestIndices: number[] = [];
  const hand = new Array<Card>(HAND_SIZE);

  forEachCombination(cards.length, HAND_SIZE, (indices) => {
    for (let i = 0; i < HAND_SIZE; i++) hand[i] = cards[indices[i]];
    const value = evaluateFive(hand);
    if (value > bestValue) {
      bestValue = value;
      bestIndices = indices.slice();
    }
  });

  return {
    value: bestValue,
    category: handCategory(bestValue),
    cards: bestIndices.map((i) => cards[i]),
  };
};

/**
 * Rank hands strongest-first, grouping exact ties together.
 *
 * Returned as tiers rather than a sorted list because that is the shape a
 * showdown actually needs: everyone in tier 0 splits the pot, and a caller
 * that sorted a flat list would have to re-discover the tie boundaries — which
 * is precisely the step where split pots get paid wrong.
 */
export const rankHands = <T>(
  entries: readonly { id: T; cards: readonly Card[] }[],
): { value: HandValue; ids: T[] }[] => {
  const byValue = new Map<HandValue, T[]>();
  for (const entry of entries) {
    const { value } = evaluateHand(entry.cards);
    const bucket = byValue.get(value);
    if (bucket) bucket.push(entry.id);
    else byValue.set(value, [entry.id]);
  }

  return Array.from(byValue.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([value, ids]) => ({ value, ids }));
};
