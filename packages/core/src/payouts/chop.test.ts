import { describe, it, expect } from "vitest";
import { computeChop, validateChop, ChopOptions } from "./chop";
import { computePayouts, PayoutStructure } from "./payoutStructure";

const structureFor = (entrants: number, buyIn = 20, denomination = 5) => {
  const result = computePayouts({ buyIn, entrants, denomination });
  if (!result) throw new Error("expected a payout structure");
  return result;
};

const chop = (options: ChopOptions) => {
  const result = computeChop(options);
  if (!result) throw new Error("expected a chop");
  return result;
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("validateChop", () => {
  const structure = structureFor(9);

  it("accepts a deal between everyone still in the money", () => {
    expect(validateChop({ structure, chips: [100, 60, 40] })).toBeNull();
  });

  it.each([
    [[100], "too-few-players"],
    [[100, 60, 40, 20], "more-players-than-places"],
    [[100, -5], "negative-chips"],
    [[100, Number.NaN], "negative-chips"],
    [[0, 0], "no-chips"],
  ])("rejects %o as %s", (chips, expected) => {
    expect(validateChop({ structure, chips: chips as number[] })).toBe(expected);
    expect(computeChop({ structure, chips: chips as number[] })).toBeNull();
  });

  it("refuses a deal while someone is still outside the money", () => {
    // 9 players pays 3 places; four left means one of them is playing for
    // nothing, and a chop would hand them money that isn't theirs yet.
    expect(validateChop({ structure, chips: [10, 10, 10, 10] })).toBe(
      "more-players-than-places",
    );
  });
});

describe("computeChop", () => {
  it("guarantees the lowest live prize and splits the rest by chips", () => {
    // 9 players at 20 pays 90/54/36 → 180 between the last three.
    const structure = structureFor(9, 20, 1);
    const result = chop({ structure, chips: [100, 50, 50], denomination: 1 });

    expect(result.remainingMoney).toBe(180);
    expect(result.guaranteedEach).toBe(36);
    expect(result.surplus).toBe(180 - 36 * 3);
    // Chip leader has half the chips, so half the surplus on top of the floor.
    expect(result.shares.map((s) => s.amount)).toEqual([72, 54, 54]);
    expect(sum(result.shares.map((s) => s.amount))).toBe(180);
  });

  it("nobody ends up below the place they had already locked up", () => {
    // The whole reason the guarantee exists: a 1-chip short stack would get
    // almost nothing on a purely proportional split.
    const structure = structureFor(9, 20, 1);
    const result = chop({ structure, chips: [1000, 1000, 1], denomination: 1 });
    for (const share of result.shares) {
      expect(share.amount).toBeGreaterThanOrEqual(result.guaranteedEach);
    }
  });

  it("splits evenly when the stacks are level", () => {
    const structure = structureFor(9, 20, 1);
    const result = chop({ structure, chips: [60, 60, 60], denomination: 1 });
    const amounts = result.shares.map((s) => s.amount);
    expect(amounts).toEqual([60, 60, 60]);
  });

  it("keeps a chipless survivor on the guarantee, not below it", () => {
    const structure = structureFor(9, 20, 1);
    const result = chop({ structure, chips: [100, 100, 0], denomination: 1 });
    expect(result.shares[2].amount).toBe(result.guaranteedEach);
    expect(sum(result.shares.map((s) => s.amount))).toBe(result.remainingMoney);
  });

  it("handles a heads-up deal", () => {
    const structure = structureFor(9, 20, 1);
    const result = chop({ structure, chips: [75, 25], denomination: 1 });
    expect(result.remainingMoney).toBe(90 + 54);
    expect(result.guaranteedEach).toBe(54);
    expect(sum(result.shares.map((s) => s.amount))).toBe(144);
    expect(result.shares[0].amount).toBeGreaterThan(result.shares[1].amount);
  });

  it("gives a player the same share wherever they were typed in", () => {
    // The sum-and-floor properties below are both satisfied by an unfair deal:
    // the indivisible remainder used to go to index 0, so two identical 1-chip
    // stacks came out 10 apart and a 1-chip stack typed first beat a 1000-chip
    // stack. Rotating the input is what catches it.
    const fingerprint = (chips: number[], denomination: number, structure: PayoutStructure) => {
      const result = computeChop({ structure, chips, denomination });
      if (!result) return "none";
      return result.shares
        .map((share) => `${share.chips}:${share.amount}`)
        .sort()
        .join(",");
    };

    let failure: string | null = null;
    for (let entrants = 2; entrants <= 30; entrants += 1) {
      for (const denomination of [1, 5, 10, 25]) {
        const structure = structureFor(entrants, 20, denomination);
        for (let n = 2; n <= structure.payouts.length; n += 1) {
          const stacks = Array.from({ length: n }, (_, i) =>
            i === n - 1 ? 1000 : 1,
          );
          const rotated = [stacks[n - 1], ...stacks.slice(0, n - 1)];
          const before = fingerprint(stacks, denomination, structure);
          const after = fingerprint(rotated, denomination, structure);
          if (before !== after) {
            failure ??= `${entrants} entrants, ${n} left, denom ${denomination}: ${before} vs ${after}`;
          }
        }
      }
    }
    expect(failure).toBeNull();
  });

  it("keeps two identical stacks within a note of each other", () => {
    // **The tie was the case the rotation test above cannot reach.** With the
    // largest weights exactly equal, the `>` scan that picks who gets the
    // indivisible leftover always chose the earlier one — and when the
    // rounding had already favoured that same player, the leftover widened the
    // gap instead of closing it. Two people with identical stacks then came
    // out more than one note apart, decided by who was typed in first.
    let failure: string | null = null;
    for (let entrants = 2; entrants <= 30; entrants += 1) {
      for (const denomination of [1, 5, 10, 25]) {
        const structure = structureFor(entrants, 20, denomination);
        for (let n = 2; n <= structure.payouts.length; n += 1) {
          // Two equal leaders, the rest short, so the tie is at the top.
          const stacks = Array.from({ length: n }, (_, i) =>
            i < 2 ? 1000 : 1,
          );
          const result = computeChop({ structure, chips: stacks, denomination });
          if (!result) continue;
          const gap = Math.abs(result.shares[0].amount - result.shares[1].amount);
          if (gap > denomination) {
            failure ??= `${entrants} entrants, ${n} left, denom ${denomination}: gap ${gap}`;
          }
        }
      }
    }
    expect(failure).toBeNull();
  });

  it("never lets a smaller stack out-earn a larger one", () => {
    const structure = structureFor(8, 20, 25);
    const result = chop({ structure, chips: [1, 1, 1000], denomination: 25 });
    const [a, b, big] = result.shares;
    expect(a.amount).toBe(b.amount);
    expect(big.amount).toBeGreaterThan(a.amount);
  });

  it("pays out the whole remaining pot for every stack shape and note size", () => {
    let failure: string | null = null;
    let visited = 0;
    for (let entrants = 2; entrants <= 30; entrants += 1) {
      for (const denomination of [1, 5, 10, 25]) {
        const structure = structureFor(entrants, 20, denomination);
        for (let players = 2; players <= structure.payouts.length; players += 1) {
          for (const shape of [
            Array.from({ length: players }, () => 100),
            Array.from({ length: players }, (_, i) => (i + 1) * 37),
            Array.from({ length: players }, (_, i) => (i === 0 ? 9999 : 1)),
          ]) {
            visited += 1;
            const result = computeChop({
              structure,
              chips: shape,
              denomination,
            });
            if (!result) {
              failure ??= `no chop for ${players} of ${entrants}`;
              continue;
            }
            const total = sum(result.shares.map((s) => s.amount));
            if (total !== result.remainingMoney) {
              failure ??= `${entrants} entrants, ${players} left, denom ${denomination} → paid ${total} of ${result.remainingMoney}`;
            }
            for (const share of result.shares) {
              if (share.amount < result.guaranteedEach) {
                failure ??= `${entrants}/${players}/${denomination} → ${share.amount} below floor ${result.guaranteedEach}`;
              }
            }
          }
        }
      }
    }
    expect(visited).toBeGreaterThan(200);
    expect(failure).toBeNull();
  });

  it("gives everyone the same when every live place pays the same", () => {
    // A flat table leaves no surplus to split, so chips stop mattering — and
    // the surplus path is skipped entirely rather than dividing by zero.
    const flat: PayoutStructure = {
      totalEntries: 3,
      addOnPool: 0,
      totalCollected: 90,
      prizePool: 90,
      bountyPool: 0,
      bountyPerKnockout: 0,
      payouts: [
        { place: 1, amount: 30 },
        { place: 2, amount: 30 },
        { place: 3, amount: 30 },
      ],
    };
    const result = chop({ structure: flat, chips: [500, 300, 1] });
    expect(result.surplus).toBe(0);
    expect(result.shares.map((s) => s.amount)).toEqual([30, 30, 30]);
  });

  it("keeps the chips alongside each share so callers can pair them up", () => {
    const structure = structureFor(9, 20, 1);
    const result = chop({ structure, chips: [100, 50, 50], denomination: 1 });
    expect(result.shares.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(result.shares.map((s) => s.chips)).toEqual([100, 50, 50]);
  });
});
