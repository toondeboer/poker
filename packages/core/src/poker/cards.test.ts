import { describe, expect, it } from "vitest";
import {
  DECK_SIZE,
  MAX_RANK,
  MIN_RANK,
  SUITS,
  cardToString,
  createDeck,
  createRandom,
  shuffle,
} from "./cards";

describe("createDeck", () => {
  it("is 52 distinct cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(DECK_SIZE);
    expect(new Set(deck.map(cardToString)).size).toBe(DECK_SIZE);
  });

  it("covers every rank in every suit", () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      const ranks = deck.filter((c) => c.suit === suit).map((c) => c.rank);
      expect(ranks).toHaveLength(MAX_RANK - MIN_RANK + 1);
      expect(Math.min(...ranks)).toBe(MIN_RANK);
      expect(Math.max(...ranks)).toBe(MAX_RANK);
    }
  });

  it("returns a fresh array each call, so a shuffled deck can't corrupt the next", () => {
    const first = createDeck();
    first[0].rank = 99;
    expect(createDeck()[0].rank).toBe(MIN_RANK);
  });
});

describe("cardToString", () => {
  it("names the picture cards and the ten", () => {
    expect(cardToString({ rank: 14, suit: "s" })).toBe("As");
    expect(cardToString({ rank: 13, suit: "h" })).toBe("Kh");
    expect(cardToString({ rank: 12, suit: "d" })).toBe("Qd");
    expect(cardToString({ rank: 11, suit: "c" })).toBe("Jc");
    expect(cardToString({ rank: 10, suit: "s" })).toBe("Ts");
    expect(cardToString({ rank: 2, suit: "c" })).toBe("2c");
  });
});

describe("shuffle", () => {
  it("is deterministic for a seed — the whole point of injecting randomness", () => {
    const a = shuffle(createDeck(), createRandom(12345)).map(cardToString);
    const b = shuffle(createDeck(), createRandom(12345)).map(cardToString);
    expect(a).toEqual(b);
  });

  it("differs between seeds", () => {
    const a = shuffle(createDeck(), createRandom(1)).map(cardToString);
    const b = shuffle(createDeck(), createRandom(2)).map(cardToString);
    expect(a).not.toEqual(b);
  });

  it("never mutates its input", () => {
    const deck = createDeck();
    const before = deck.map(cardToString);
    shuffle(deck, createRandom(7));
    expect(deck.map(cardToString)).toEqual(before);
  });

  it("is a permutation — same cards back, no duplicates, none lost", () => {
    const failures: string[] = [];
    const original = createDeck().map(cardToString).sort();
    for (let seed = 0; seed < 200; seed++) {
      const shuffled = shuffle(createDeck(), createRandom(seed))
        .map(cardToString)
        .sort();
      if (shuffled.length !== DECK_SIZE) {
        failures.push(`seed ${seed}: length ${shuffled.length}`);
        continue;
      }
      for (let i = 0; i < DECK_SIZE; i++) {
        if (shuffled[i] !== original[i]) {
          failures.push(`seed ${seed}: card set changed`);
          break;
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("reaches every position — no index is pinned across seeds", () => {
    // Fisher-Yates done wrong (picking from the whole array each step) is still
    // a permutation, so the permutation test above cannot catch it. What it
    // does do is skew the distribution, and the cheapest honest check is that
    // no card is stuck.
    const seen = new Map<string, Set<number>>();
    for (let seed = 0; seed < 400; seed++) {
      shuffle(createDeck(), createRandom(seed)).forEach((card, position) => {
        const key = cardToString(card);
        const positions = seen.get(key) ?? new Set<number>();
        positions.add(position);
        seen.set(key, positions);
      });
    }
    const pinned = [...seen.entries()]
      .filter(([, positions]) => positions.size < 20)
      .map(([card]) => card);
    expect(pinned).toEqual([]);
  });

  it("survives a source that returns exactly 1.0", () => {
    // The contract is [0, 1), but `random` is injected and the obvious
    // crypto adapter — getRandomValues(u32)[0] / (2 ** 32 - 1) — hits 1.0
    // roughly once in four billion. Unclamped, that indexes past the end:
    // a card slot becomes undefined and the deck grows to 53.
    const alwaysOne = () => 1;
    const result = shuffle(createDeck(), alwaysOne);
    expect(result).toHaveLength(DECK_SIZE);
    expect(result.every((card) => card !== undefined)).toBe(true);
    expect(new Set(result.map(cardToString)).size).toBe(DECK_SIZE);
  });

  it("survives a source pinned at 0", () => {
    const result = shuffle(createDeck(), () => 0);
    expect(new Set(result.map(cardToString)).size).toBe(DECK_SIZE);
  });

  it("handles the degenerate sizes", () => {
    expect(shuffle([], createRandom(1))).toEqual([]);
    expect(shuffle(["only"], createRandom(1))).toEqual(["only"]);
  });
});

describe("createRandom", () => {
  it("stays inside [0, 1)", () => {
    const failures: number[] = [];
    const random = createRandom(99);
    for (let i = 0; i < 20000; i++) {
      const value = random();
      if (!(value >= 0 && value < 1)) failures.push(value);
    }
    expect(failures).toEqual([]);
  });
});
