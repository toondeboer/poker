/**
 * Cards, decks and shuffling for the multiplayer game.
 *
 * Framework-agnostic like the rest of @poker/core: **randomness is injected,
 * never generated**. Every shuffle takes an explicit source, which is what
 * makes the deal deterministic in tests and provable after the fact on the
 * server — a shuffle can be replayed from its seed to show it wasn't rigged.
 */

/** 2–10, then 11 = J, 12 = Q, 13 = K, 14 = A. Ace is high everywhere except
 * the wheel (A-2-3-4-5), which straight detection handles explicitly. */
export type Rank = number;

/** Clubs, diamonds, hearts, spades. The order carries no meaning — poker has
 * no suit ranking — it exists only so a deck has a stable, testable order. */
export const SUITS = ["c", "d", "h", "s"] as const;
export type Suit = (typeof SUITS)[number];

export type Card = {
  rank: Rank;
  suit: Suit;
};

/** Position of each suit in a four-bit mask. Order is arbitrary — poker has no
 * suit ranking — and exists only so a hand can be summarised as bits. */
export const SUIT_INDEX: Record<Suit, number> = { c: 0, d: 1, h: 2, s: 3 };

export const MIN_RANK = 2;
export const MAX_RANK = 14;
export const DECK_SIZE = 52;

/** A source of randomness returning a float in [0, 1), same shape as
 * `Math.random`. Injected so the caller owns determinism. */
export type RandomSource = () => number;

/**
 * A small deterministic PRNG (mulberry32), **for tests and replay only**.
 *
 * **Never deal a real hand from this, however the seed was chosen.** It carries
 * 32 bits of state, so the entire seed space is about four billion shuffles —
 * sweepable in roughly fifteen minutes on one core. An opponent who sees their
 * own two cards and the flop has enough information to narrow 2^32 seeds to a
 * handful of candidates, and the turn pins it exactly; from there they know the
 * river and everybody's hole cards. Choosing the seed with a cryptographic
 * source does not help: the weakness is the *size* of the space, not how the
 * seed was picked. For the same reason a commit-reveal scheme over a 32-bit
 * seed proves nothing, because the commitment can be brute-forced before the
 * reveal.
 *
 * A real dealer must draw its shuffle from a CSPRNG — `crypto.getRandomValues`
 * on the platform hosting the game — passed in as a {@link RandomSource}. This
 * module deliberately does not provide one: `@poker/core` has no platform to
 * get it from, and guessing would put a fake in the one place it must not be.
 *
 * What this *is* good for is reproducibility: the same seed always yields the
 * same shuffle, so a hand can be replayed exactly in a test.
 */
export const createRandom = (seed: number): RandomSource => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A fresh 52-card deck in a fixed order: all clubs low-to-high, then
 * diamonds, hearts, spades. */
export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = MIN_RANK; rank <= MAX_RANK; rank++) {
      deck.push({ rank, suit });
    }
  }
  return deck;
};

/**
 * Fisher-Yates, returning a new array — the input is never mutated, so a
 * caller can shuffle the same deck twice and compare.
 *
 * Iterating downward and picking from `[0, i]` is the unbiased form; the
 * common "pick from anywhere each time" variant is not uniform.
 */
export const shuffle = <T>(items: readonly T[], random: RandomSource): T[] => {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    // Clamped because `random` is injected and the contract is [0, 1), not
    // [0, 1]. A source returning exactly 1.0 — which the obvious
    // `getRandomValues(u32)[0] / (2 ** 32 - 1)` adapter does — would otherwise
    // index past the end on the first pass, leaving a hole in the deck and a
    // 53rd entry. Cheaper to clamp than to trust every future caller.
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    const swap = result[i];
    result[i] = result[j];
    result[j] = swap;
  }
  return result;
};

/** Canonical text for a card, e.g. `As`, `Td`, `2c`. Used by tests and by
 * anything that needs a stable key; never shown to a player as-is. */
export const cardToString = (card: Card): string => {
  const rank =
    card.rank === 14
      ? "A"
      : card.rank === 13
        ? "K"
        : card.rank === 12
          ? "Q"
          : card.rank === 11
            ? "J"
            : card.rank === 10
              ? "T"
              : String(card.rank);
  return `${rank}${card.suit}`;
};
