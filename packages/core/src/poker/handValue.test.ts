import { describe, expect, it } from "vitest";
import type { Card } from "./cards";
import {
  HAND_CATEGORIES,
  evaluateFive,
  handCategory,
  packHandValue,
} from "./handValue";

/** `"As Kh Qd Jc Ts"` → cards. Keeps the tests readable as poker. */
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

const categoryOf = (notation: string) =>
  handCategory(evaluateFive(hand(notation)));

describe("evaluateFive — categories", () => {
  it.each([
    ["As Ks Qs Js Ts", "straight-flush"],
    ["5s 4s 3s 2s As", "straight-flush"], // the steel wheel
    ["9h 9c 9d 9s 2c", "four-of-a-kind"],
    ["8h 8c 8d 3s 3c", "full-house"],
    ["Ah Jh 8h 5h 2h", "flush"],
    ["9h 8c 7d 6s 5c", "straight"],
    ["5h 4c 3d 2s Ac", "straight"], // the wheel
    ["Qh Qc Qd 7s 2c", "three-of-a-kind"],
    ["Kh Kc 4d 4s 9c", "two-pair"],
    ["Th Tc 8d 5s 2c", "pair"],
    ["Ah Jc 8d 5s 2c", "high-card"],
  ])("%s is %s", (notation, expected) => {
    expect(categoryOf(notation)).toBe(expected);
  });

  it("does not call A-K-Q-J-T wrapping round to 2 a straight", () => {
    expect(categoryOf("Ah Kc Qd Js 2c")).toBe("high-card");
    expect(categoryOf("Ah Kc Qd 3s 2c")).toBe("high-card");
  });

  it("rejects a hand that isn't five cards rather than scoring it", () => {
    expect(() => evaluateFive(hand("Ah Kc Qd Js"))).toThrow(/5 cards, got 4/);
    expect(() => evaluateFive(hand("Ah Kc Qd Js Ts 9h"))).toThrow(/got 6/);
  });

  it("rejects the same card twice rather than scoring it as a pair", () => {
    // Without this, Ah Ah reads as a pair of aces: a plausible number, and a
    // plausible wrong number is what quietly loses somebody a pot.
    expect(() => evaluateFive(hand("Ah Ah Kc Qd Js"))).toThrow(
      /same card twice: Ah/,
    );
  });

  it("rejects five of a kind, which used to score as nothing at all", () => {
    // Five cards of one rank means at least one duplicate, so this is caught
    // by the same guard — previously it fell through the count loop (which
    // only runs 4 down to 1) and silently returned a value of 0.
    expect(() => evaluateFive(hand("Ah Ah Ah Ah Ah"))).toThrow(/same card twice/);
  });

  it("still accepts four of a kind, which is the legitimate limit", () => {
    expect(categoryOf("9h 9c 9d 9s 2c")).toBe("four-of-a-kind");
  });
});

describe("evaluateFive — ordering", () => {
  it("orders the categories exactly as poker does", () => {
    const examples: [string, string][] = [
      ["high-card", "Ah Jc 8d 5s 2c"],
      ["pair", "Th Tc 8d 5s 2c"],
      ["two-pair", "Kh Kc 4d 4s 9c"],
      ["three-of-a-kind", "Qh Qc Qd 7s 2c"],
      ["straight", "9h 8c 7d 6s 5c"],
      ["flush", "Ah Jh 8h 5h 2h"],
      ["full-house", "8h 8c 8d 3s 3c"],
      ["four-of-a-kind", "9h 9c 9d 9s 2c"],
      ["straight-flush", "As Ks Qs Js Ts"],
    ];
    // Sanity: the examples are in the same order the type declares.
    expect(examples.map(([category]) => category)).toEqual([...HAND_CATEGORIES]);

    const values = examples.map(([, notation]) => evaluateFive(hand(notation)));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it("the wheel is the lowest straight", () => {
    expect(evaluateFive(hand("5h 4c 3d 2s Ac"))).toBeLessThan(
      evaluateFive(hand("6h 5c 4d 3s 2c")),
    );
  });

  it("the steel wheel is the lowest straight flush", () => {
    expect(evaluateFive(hand("5s 4s 3s 2s As"))).toBeLessThan(
      evaluateFive(hand("6s 5s 4s 3s 2s")),
    );
  });

  it("an ace-high flush beats a king-high flush", () => {
    expect(evaluateFive(hand("Ah Jh 8h 5h 2h"))).toBeGreaterThan(
      evaluateFive(hand("Kh Qh 8h 5h 2h")),
    );
  });

  it("separates pairs by kicker, all the way down", () => {
    expect(evaluateFive(hand("Th Tc Ad Ks 2c"))).toBeGreaterThan(
      evaluateFive(hand("Th Tc Ad Qs 2c")),
    );
    expect(evaluateFive(hand("Th Tc Ad Ks 3c"))).toBeGreaterThan(
      evaluateFive(hand("Th Tc Ad Ks 2c")),
    );
  });

  it("ranks two pair by the higher pair, then the lower, then the kicker", () => {
    const kingsAndFours = evaluateFive(hand("Kh Kc 4d 4s 9c"));
    expect(kingsAndFours).toBeGreaterThan(evaluateFive(hand("Qh Qc Jd Js 9c")));
    expect(kingsAndFours).toBeGreaterThan(evaluateFive(hand("Kh Kc 3d 3s Ac")));
    expect(evaluateFive(hand("Kh Kc 4d 4s Ac"))).toBeGreaterThan(kingsAndFours);
  });

  it("ranks a full house by the trips first, not the pair", () => {
    expect(evaluateFive(hand("8h 8c 8d 2s 2c"))).toBeGreaterThan(
      evaluateFive(hand("7h 7c 7d As Ac")),
    );
  });

  it("ranks quads by the quad rank, then the kicker", () => {
    expect(evaluateFive(hand("9h 9c 9d 9s 2c"))).toBeGreaterThan(
      evaluateFive(hand("8h 8c 8d 8s Ac")),
    );
    expect(evaluateFive(hand("9h 9c 9d 9s Ac"))).toBeGreaterThan(
      evaluateFive(hand("9h 9c 9d 9s Kc")),
    );
  });
});

describe("evaluateFive — ties", () => {
  it("is exactly equal for the same hand in different suits", () => {
    // Split pots depend on this being `===`, not merely close.
    expect(evaluateFive(hand("Ah Kh Qh Jd Ts"))).toBe(
      evaluateFive(hand("Ac Kc Qc Jh Td")),
    );
  });

  it("ignores the order the cards arrive in", () => {
    expect(evaluateFive(hand("2c 5s Ad 4h 3d"))).toBe(
      evaluateFive(hand("Ad 2c 3d 4h 5s")),
    );
  });
});

describe("packHandValue", () => {
  it("pads missing kickers rather than shifting the ones present", () => {
    expect(packHandValue("straight", [9])).toBe(
      packHandValue("straight", [9, 0, 0, 0, 0]),
    );
  });

  it("round-trips the category", () => {
    for (const category of HAND_CATEGORIES) {
      expect(handCategory(packHandValue(category, [14, 13, 12, 11, 9]))).toBe(
        category,
      );
    }
  });

  it("keeps every category's whole kicker range below the next category", () => {
    // The packing is only safe if no kicker combination can overflow into the
    // category bits — an off-by-one in a shift width would do exactly that,
    // and would show up as a wildly wrong winner rather than a near miss.
    const failures: string[] = [];
    for (let i = 1; i < HAND_CATEGORIES.length; i++) {
      const strongestBelow = packHandValue(HAND_CATEGORIES[i - 1], [
        14, 14, 14, 14, 14,
      ]);
      const weakestAbove = packHandValue(HAND_CATEGORIES[i], [0, 0, 0, 0, 0]);
      if (strongestBelow >= weakestAbove) {
        failures.push(
          `${HAND_CATEGORIES[i - 1]} can outrank ${HAND_CATEGORIES[i]}`,
        );
      }
    }
    expect(failures).toEqual([]);
  });
});
