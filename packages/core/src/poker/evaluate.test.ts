import { describe, expect, it } from "vitest";
import {
  type Card,
  cardToString,
  createDeck,
  createRandom,
  shuffle,
} from "./cards";
import { evaluateFive, handCategory } from "./handValue";
import { evaluateHand, rankHands } from "./evaluate";

const hand = (notation: string): Card[] =>
  notation.split(" ").map((token) => {
    const rankChar = token.slice(0, -1);
    const suit = token.slice(-1) as Card["suit"];
    const rank =
      rankChar === "A"
        ? 14
        : rankChar === "K"
          ? 13
          : rankChar === "Q"
            ? 12
            : rankChar === "J"
              ? 11
              : rankChar === "T"
                ? 10
                : Number(rankChar);
    return { rank, suit };
  });

/** Deal `count` seven-card hands, each from its own fresh shuffled deck. */
const sevens = (count: number, seed = 1): Card[][] => {
  const hands: Card[][] = [];
  for (let i = 0; i < count; i++) {
    hands.push(shuffle(createDeck(), createRandom(seed + i)).slice(0, 7));
  }
  return hands;
};

describe("evaluateHand", () => {
  it("finds the flush hiding among seven cards", () => {
    const result = evaluateHand(hand("Ah Kh 7h 4h 2h 9c 9d"));
    expect(result.category).toBe("flush");
    expect(result.cards.map(cardToString).sort()).toEqual(
      ["2h", "4h", "7h", "Ah", "Kh"].sort(),
    );
  });

  it("prefers a straight to the pair it could have played instead", () => {
    const result = evaluateHand(hand("9h 8c 7d 6s 5c 9d 2h"));
    expect(result.category).toBe("straight");
  });

  it("prefers a full house to the flush draw that didn't get there", () => {
    const result = evaluateHand(hand("8h 8c 8d 3s 3c Ah 2h"));
    expect(result.category).toBe("full-house");
  });

  it("takes the best five when six cards are suited", () => {
    // Six hearts: the evaluator must drop the 2h, not the first card it sees.
    const result = evaluateHand(hand("Ah Kh Qh Jh 9h 2h 3c"));
    expect(result.category).toBe("flush");
    expect(result.cards.map(cardToString)).not.toContain("2h");
  });

  it("finds the wheel using an ace as the low card", () => {
    const result = evaluateHand(hand("Ah 2c 3d 4s 5h Kc Qd"));
    expect(result.category).toBe("straight");
  });

  it("works on exactly five cards too", () => {
    const result = evaluateHand(hand("As Ks Qs Js Ts"));
    expect(result.category).toBe("straight-flush");
    expect(result.cards).toHaveLength(5);
  });

  it("refuses fewer than five cards rather than inventing a score", () => {
    expect(() => evaluateHand(hand("As Ks Qs Js"))).toThrow(/at least 5/);
  });

  it("always returns exactly the five cards it scored", () => {
    const failures: string[] = [];
    for (const cards of sevens(300, 500)) {
      const result = evaluateHand(cards);
      if (result.cards.length !== 5) {
        failures.push(`${result.cards.length} cards returned`);
        continue;
      }
      // Those five must be a subset of the input, and must re-score to the
      // same value — otherwise the reported hand isn't the one that won.
      const input = new Set(cards.map(cardToString));
      if (result.cards.some((c) => !input.has(cardToString(c)))) {
        failures.push(`returned a card that wasn't dealt`);
      }
      if (evaluateFive(result.cards) !== result.value) {
        failures.push(`returned cards don't re-score to the reported value`);
      }
      if (handCategory(result.value) !== result.category) {
        failures.push(`category disagrees with value`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("evaluateHand — invariants", () => {
  it("is order-independent", () => {
    // The class of bug a previous review caught in the money-splitting code:
    // totals and floors were checked, permutations were not. A hand's strength
    // cannot depend on the order the cards were dealt.
    const failures: string[] = [];
    for (const cards of sevens(400, 9000)) {
      const baseline = evaluateHand(cards).value;
      for (let p = 1; p <= 4; p++) {
        const permuted = shuffle(cards, createRandom(p * 7919));
        const value = evaluateHand(permuted).value;
        if (value !== baseline) {
          failures.push(
            `${cards.map(cardToString).join(" ")} scored ${baseline} then ${value}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("is never beaten by one of its own five-card subsets", () => {
    // The definition of "best of seven", asserted directly.
    const failures: string[] = [];
    for (const cards of sevens(400, 20000)) {
      const best = evaluateHand(cards).value;
      for (let a = 0; a < 7; a++) {
        for (let b = a + 1; b < 7; b++) {
          // Each five-card subset is the seven minus two cards.
          const subset = cards.filter((_, i) => i !== a && i !== b);
          if (evaluateFive(subset) > best) {
            failures.push(`subset beat the best of ${cards.map(cardToString).join(" ")}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("gives identical hands identical values, whatever the suits", () => {
    // Suits have no rank in poker, so a hand rotated through the suits must be
    // exactly equal — this is what makes split pots come out right.
    const rotate = (card: Card): Card => ({
      rank: card.rank,
      suit: (["d", "h", "s", "c"] as const)[
        ["c", "d", "h", "s"].indexOf(card.suit)
      ],
    });
    const failures: string[] = [];
    for (const cards of sevens(300, 31000)) {
      const rotated = cards.map(rotate);
      if (evaluateHand(cards).value !== evaluateHand(rotated).value) {
        failures.push(cards.map(cardToString).join(" "));
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("rankHands", () => {
  it("orders players strongest-first", () => {
    const tiers = rankHands([
      { id: "pair", cards: hand("Th Tc 8d 5s 2c 3h 4d") },
      { id: "flush", cards: hand("Ah Kh 7h 4h 2h 9c 9d") },
      { id: "highcard", cards: hand("Ah Jc 8d 5s 2c 3h 7d") },
    ]);
    expect(tiers.map((tier) => tier.ids)).toEqual([
      ["flush"],
      ["pair"],
      ["highcard"],
    ]);
  });

  it("groups an exact tie into one tier, which is how a split pot is paid", () => {
    // Both play the board: the same straight, no card of their own improves it.
    const board = "9h 8c 7d 6s 5c";
    const tiers = rankHands([
      { id: "a", cards: hand(`${board} 2h 3d`) },
      { id: "b", cards: hand(`${board} 2c 3s`) },
    ]);
    expect(tiers).toHaveLength(1);
    expect(tiers[0].ids.sort()).toEqual(["a", "b"]);
  });

  it("does not group hands that merely share a category", () => {
    const tiers = rankHands([
      { id: "acehigh", cards: hand("Ah Kh 7h 4h 2h 9c 9d") },
      { id: "kinghigh", cards: hand("Kh Qh 7h 4h 2h 9c 9d") },
    ]);
    expect(tiers.map((tier) => tier.ids)).toEqual([["acehigh"], ["kinghigh"]]);
  });

  it("handles a single entry", () => {
    const tiers = rankHands([{ id: 1, cards: hand("As Ks Qs Js Ts") }]);
    expect(tiers).toHaveLength(1);
    expect(tiers[0].ids).toEqual([1]);
  });

  it("returns nothing for nobody", () => {
    expect(rankHands([])).toEqual([]);
  });

  it("never puts the same player in two tiers, and never loses one", () => {
    const failures: string[] = [];
    for (let seed = 0; seed < 120; seed++) {
      const deck = shuffle(createDeck(), createRandom(seed));
      const board = deck.slice(0, 5);
      const entries = [0, 1, 2, 3, 4, 5].map((seat) => ({
        id: seat,
        cards: [...board, deck[5 + seat * 2], deck[6 + seat * 2]],
      }));
      const tiers = rankHands(entries);
      const seen = tiers.flatMap((tier) => tier.ids);
      if (seen.length !== entries.length) {
        failures.push(`seed ${seed}: ${seen.length} of ${entries.length} ranked`);
      }
      if (new Set(seen).size !== entries.length) {
        failures.push(`seed ${seed}: a player appeared twice`);
      }
      for (let i = 1; i < tiers.length; i++) {
        if (tiers[i].value >= tiers[i - 1].value) {
          failures.push(`seed ${seed}: tiers out of order`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
