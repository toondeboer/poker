import { describe, it, expect } from "vitest";
import {
  computePayouts,
  defaultPaidPlaces,
  suggestedBounty,
  validatePayoutOptions,
  MAX_PAID_PLACES,
  PAYOUT_SPLITS,
  formatPlace,
  PayoutOptions,
} from "./payoutStructure";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Every combination the invariants are claimed to hold across: buy-ins 1-60 ×
 * fields 1-30 × four denominations × three bounty shapes × four rebuy/add-on
 * mixes, skipping the ones validation rejects. Roughly 86k configurations.
 */
const sweep = (check: (options: PayoutOptions) => void) => {
  for (let buyIn = 1; buyIn <= 60; buyIn += 1) {
    for (let entrants = 1; entrants <= 30; entrants += 1) {
      for (const denomination of [1, 5, 10, 25]) {
        for (const bounty of [0, 1, Math.floor(buyIn / 4)]) {
          if (bounty >= buyIn) continue;
          for (const [rebuys, addOns] of [
            [0, 0],
            [3, 0],
            [0, 4],
            [2, 5],
          ]) {
            check({
              buyIn,
              entrants,
              bounty,
              denomination,
              rebuys,
              addOns,
              addOnPrice: 10,
            });
          }
        }
      }
    }
  }
};

const describeOptions = (o: PayoutOptions) =>
  `buyIn ${o.buyIn}, ${o.entrants} players, bounty ${o.bounty}, denom ${o.denomination}, ${o.rebuys ?? 0} rebuys, ${o.addOns ?? 0} add-ons`;

const structure = (options: PayoutOptions) => {
  const result = computePayouts(options);
  if (!result) throw new Error("expected a payout structure");
  return result;
};

describe("PAYOUT_SPLITS", () => {
  it("every split sums to 100", () => {
    for (const split of PAYOUT_SPLITS) {
      expect(sum([...split])).toBe(100);
    }
  });

  it("every split is non-increasing, so a better finish never pays less", () => {
    for (const split of PAYOUT_SPLITS) {
      for (let i = 1; i < split.length; i += 1) {
        expect(split[i]).toBeLessThanOrEqual(split[i - 1]);
      }
    }
  });

  it("pays 70/30 for two places, matching the website's guide", () => {
    expect(PAYOUT_SPLITS[1]).toEqual([70, 30]);
  });
});

describe("defaultPaidPlaces", () => {
  it.each([
    [1, 1],
    [4, 1],
    [5, 2],
    [7, 2],
    [8, 3],
    [12, 3],
    [13, 4],
    [17, 4],
    [18, 5],
    [24, 5],
    [25, 6],
    [200, 6],
  ])("pays %i entrants across %i places", (entrants, expected) => {
    expect(defaultPaidPlaces(entrants)).toBe(expected);
  });

  it("never pays more places than there are players", () => {
    expect(defaultPaidPlaces(2)).toBe(1);
    expect(defaultPaidPlaces(1)).toBe(1);
  });

  it("returns 0 for an empty or nonsense field", () => {
    expect(defaultPaidPlaces(0)).toBe(0);
    expect(defaultPaidPlaces(-5)).toBe(0);
    expect(defaultPaidPlaces(Number.NaN)).toBe(0);
  });

  it("caps at MAX_PAID_PLACES", () => {
    expect(defaultPaidPlaces(10_000)).toBe(MAX_PAID_PLACES);
  });
});

describe("validatePayoutOptions", () => {
  it("accepts a sane setup", () => {
    expect(validatePayoutOptions({ buyIn: 20, entrants: 9 })).toBeNull();
    expect(
      validatePayoutOptions({ buyIn: 20, entrants: 9, bounty: 5 }),
    ).toBeNull();
  });

  it.each([
    [{ buyIn: 0, entrants: 9 }, "buy-in-not-positive"],
    [{ buyIn: -1, entrants: 9 }, "buy-in-not-positive"],
    [{ buyIn: Number.NaN, entrants: 9 }, "buy-in-not-positive"],
    [{ buyIn: 20, entrants: 0 }, "no-entrants"],
    [{ buyIn: 20, entrants: Number.NaN }, "no-entrants"],
    [{ buyIn: 20, entrants: 9, bounty: -1 }, "bounty-negative"],
    [{ buyIn: 20, entrants: 9, bounty: 20 }, "bounty-not-below-buy-in"],
    [{ buyIn: 20, entrants: 9, bounty: 25 }, "bounty-not-below-buy-in"],
  ])("rejects %o as %s", (options, expected) => {
    expect(validatePayoutOptions(options as PayoutOptions)).toBe(expected);
  });

  it("validates the floored values, so a fractional setup can't sneak past", () => {
    // 1.2 really is less than 1.5, but both floor to 1 — which would mean a
    // "valid" tournament whose entire buy-in is bounty and whose prize pool is
    // zero. Validation has to see the same integers the calculator uses.
    expect(validatePayoutOptions({ buyIn: 1.5, entrants: 6, bounty: 1.2 })).toBe(
      "bounty-not-below-buy-in",
    );
    expect(computePayouts({ buyIn: 1.5, entrants: 6, bounty: 1.2 })).toBeNull();
  });

  it("rejects a buy-in that floors to nothing", () => {
    expect(validatePayoutOptions({ buyIn: 0.9, entrants: 6 })).toBe(
      "buy-in-not-positive",
    );
  });

  it("rejects a field that floors below one player", () => {
    expect(validatePayoutOptions({ buyIn: 20, entrants: 0.5 })).toBe(
      "no-entrants",
    );
  });

  it("rejects a bounty equal to the buy-in rather than paying nothing to win", () => {
    expect(validatePayoutOptions({ buyIn: 10, entrants: 6, bounty: 10 })).toBe(
      "bounty-not-below-buy-in",
    );
    expect(computePayouts({ buyIn: 10, entrants: 6, bounty: 10 })).toBeNull();
  });
});

describe("computePayouts", () => {
  it("returns null for invalid options", () => {
    expect(computePayouts({ buyIn: 0, entrants: 9 })).toBeNull();
  });

  it("splits a clean pool across the default places", () => {
    const result = structure({ buyIn: 20, entrants: 9 });
    expect(result.totalCollected).toBe(180);
    expect(result.prizePool).toBe(180);
    expect(result.bountyPool).toBe(0);
    expect(result.bountyPerKnockout).toBe(0);
    // 9 entrants → 3 places, 50/30/20 of 180.
    expect(result.payouts).toEqual([
      { place: 1, amount: 90 },
      { place: 2, amount: 54 },
      { place: 3, amount: 36 },
    ]);
  });

  it("carves the bounty out of the buy-in, not on top of it", () => {
    const result = structure({ buyIn: 20, entrants: 10, bounty: 5 });
    expect(result.totalCollected).toBe(200);
    expect(result.bountyPool).toBe(50);
    expect(result.prizePool).toBe(150);
    expect(result.bountyPerKnockout).toBe(5);
    // The host still collects exactly buyIn × entrants.
    expect(result.prizePool + result.bountyPool).toBe(result.totalCollected);
  });

  it("pays the whole pool to the winner in a one-place field", () => {
    const result = structure({ buyIn: 25, entrants: 3 });
    expect(result.payouts).toEqual([{ place: 1, amount: 75 }]);
  });

  it("honours a paidPlaces override", () => {
    const result = structure({ buyIn: 10, entrants: 20, paidPlaces: 2 });
    expect(result.payouts).toHaveLength(2);
    expect(result.payouts).toEqual([
      { place: 1, amount: 140 },
      { place: 2, amount: 60 },
    ]);
  });

  it("clamps an override to the field size and to MAX_PAID_PLACES", () => {
    expect(structure({ buyIn: 10, entrants: 2, paidPlaces: 5 }).payouts).toHaveLength(2);
    expect(
      structure({ buyIn: 10, entrants: 50, paidPlaces: 99 }).payouts,
    ).toHaveLength(MAX_PAID_PLACES);
    expect(structure({ buyIn: 10, entrants: 50, paidPlaces: 0 }).payouts).toHaveLength(1);
    expect(
      structure({ buyIn: 10, entrants: 50, paidPlaces: Number.NaN }).payouts,
    ).toHaveLength(1);
  });

  it("rounds to a denomination and still pays out the whole pool", () => {
    const result = structure({
      buyIn: 15,
      entrants: 7,
      denomination: 5,
    });
    // 105 across 2 places at 70/30 would be 73.5 / 31.5.
    expect(result.prizePool).toBe(105);
    for (const payout of result.payouts) {
      // The indivisible remainder lands on first place, so only the lower
      // places are guaranteed to sit on the denomination grid.
      if (payout.place > 1) expect(payout.amount % 5).toBe(0);
    }
    expect(sum(result.payouts.map((p) => p.amount))).toBe(105);
  });

  it("keeps a better finish paying at least as much as a worse one", () => {
    for (let entrants = 1; entrants <= 40; entrants += 1) {
      for (const denomination of [1, 5, 10, 25]) {
        const result = structure({ buyIn: 20, entrants, denomination });
        const amounts = result.payouts.map((p) => p.amount);
        for (let i = 1; i < amounts.length; i += 1) {
          expect(amounts[i]).toBeLessThanOrEqual(amounts[i - 1]);
        }
      }
    }
  });

  it("hands the leftover to first place rather than dropping it", () => {
    // 100 in a denomination of 30: three payable units and 10 that cannot be
    // expressed in 30s at all.
    const result = structure({
      buyIn: 100,
      entrants: 1,
      paidPlaces: 1,
      denomination: 30,
    });
    expect(result.payouts).toEqual([{ place: 1, amount: 100 }]);
  });

  it("survives a denomination larger than the whole pool", () => {
    const result = structure({ buyIn: 5, entrants: 1, denomination: 1000 });
    expect(sum(result.payouts.map((p) => p.amount))).toBe(5);
  });

  it("falls back to exact units for a nonsense denomination", () => {
    const result = structure({
      buyIn: 20,
      entrants: 9,
      denomination: Number.NaN,
    });
    expect(sum(result.payouts.map((p) => p.amount))).toBe(180);
  });

  it("truncates fractional input rather than leaking floats into the table", () => {
    const result = structure({ buyIn: 20.7, entrants: 9.9, bounty: 5.5 });
    expect(Number.isInteger(result.totalCollected)).toBe(true);
    for (const payout of result.payouts) {
      expect(Number.isInteger(payout.amount)).toBe(true);
    }
  });
});

describe("rebuys and add-ons", () => {
  it("a rebuy is another buy-in: it grows the pool and the bounties", () => {
    const plain = structure({ buyIn: 20, entrants: 10, bounty: 5 });
    const withRebuys = structure({
      buyIn: 20,
      entrants: 10,
      bounty: 5,
      rebuys: 4,
    });
    expect(withRebuys.totalEntries).toBe(14);
    expect(withRebuys.totalCollected).toBe(280);
    expect(withRebuys.prizePool).toBe(plain.prizePool + 4 * 15);
    // A rebuy re-arms that player's bounty, so bounty money grows too.
    expect(withRebuys.bountyPool).toBe(plain.bountyPool + 4 * 5);
  });

  it("does not pay more places just because there were rebuys", () => {
    // Thirteen players with five rebuys is still thirteen people to pay.
    const withRebuys = structure({ buyIn: 20, entrants: 13, rebuys: 5 });
    expect(withRebuys.payouts).toHaveLength(defaultPaidPlaces(13));
  });

  it("can afford one more place once rebuy money is in the pool", () => {
    // The place *rule* keys off players, not entries — but the reduce-until-
    // funded loop keys off the pool, so more money can restore a place that a
    // thinner pool was dropping. Pinned because it's the exact thing an
    // "adding rebuys never changes the paid count" claim gets wrong.
    const thin = structure({
      buyIn: 5,
      entrants: 13,
      bounty: 1,
      denomination: 10,
    });
    const fatter = structure({
      buyIn: 5,
      entrants: 13,
      bounty: 1,
      denomination: 10,
      rebuys: 5,
    });
    expect(thin.payouts).toHaveLength(3);
    expect(fatter.payouts).toHaveLength(4);
    // Both still pay out the whole pool with nothing winning zero.
    for (const result of [thin, fatter]) {
      expect(sum(result.payouts.map((p) => p.amount))).toBe(result.prizePool);
      for (const payout of result.payouts) {
        expect(payout.amount).toBeGreaterThan(0);
      }
    }
  });

  it("puts add-on money entirely in the prize pool, never the bounties", () => {
    const withAddOns = structure({
      buyIn: 20,
      entrants: 10,
      bounty: 5,
      addOns: 6,
      addOnPrice: 10,
    });
    expect(withAddOns.addOnPool).toBe(60);
    // Bounties are unchanged by add-ons: an add-on buys chips, not a bounty.
    expect(withAddOns.bountyPool).toBe(50);
    expect(withAddOns.prizePool).toBe(10 * 15 + 60);
    expect(withAddOns.totalCollected).toBe(260);
  });

  it("ignores an add-on price when no add-ons were sold", () => {
    const result = structure({
      buyIn: 20,
      entrants: 8,
      addOns: 0,
      addOnPrice: 999,
    });
    expect(result.addOnPool).toBe(0);
    expect(result.totalCollected).toBe(160);
  });

  it("defaults both to zero, leaving the plain case untouched", () => {
    const plain = structure({ buyIn: 20, entrants: 9 });
    expect(plain.totalEntries).toBe(9);
    expect(plain.addOnPool).toBe(0);
    expect(plain.totalCollected).toBe(180);
  });

  it.each([
    [{ buyIn: 20, entrants: 8, rebuys: -1 }, "rebuys-negative"],
    [{ buyIn: 20, entrants: 8, addOns: -1 }, "add-ons-negative"],
    [
      { buyIn: 20, entrants: 8, addOns: 3, addOnPrice: 0 },
      "add-on-price-not-positive",
    ],
  ])("rejects %o as %s", (options, expected) => {
    expect(validatePayoutOptions(options as PayoutOptions)).toBe(expected);
    expect(computePayouts(options as PayoutOptions)).toBeNull();
  });

  it("accepts an unused add-on price sitting at zero", () => {
    expect(
      validatePayoutOptions({ buyIn: 20, entrants: 8, addOnPrice: 0 }),
    ).toBeNull();
  });
});

describe("every paid place actually wins something", () => {
  it("never announces a place that pays nothing", () => {
    // The sum invariant below is satisfied perfectly by handing someone 0,
    // which is exactly how this shipped unnoticed: 938 combinations in this
    // very sweep produced a paid place winning nothing.
    //
    // Failures are collected and asserted once rather than asserted per
    // iteration: `expect` in a loop this size is what the work actually is,
    // and doing it ~350k times timed the suite out on CI while passing
    // locally. One assertion, same coverage, and a message that names the
    // combination instead of just the amount.
    let failure: string | null = null;
    sweep((options) => {
      const result = structure(options);
      for (const payout of result.payouts) {
        if (payout.amount <= 0) {
          failure ??= `${describeOptions(options)} → place ${payout.place} wins ${payout.amount}`;
        }
      }
    });
    expect(failure).toBeNull();
  });

  it("pays fewer places when the pool can't fund them at that denomination", () => {
    // 13 × (5 − 1) = 52, which in 10s split four ways gave 22/20/10/0.
    const result = structure({
      buyIn: 5,
      entrants: 13,
      bounty: 1,
      denomination: 10,
    });
    expect(defaultPaidPlaces(13)).toBe(4);
    expect(result.payouts.length).toBeLessThan(4);
    expect(sum(result.payouts.map((p) => p.amount))).toBe(result.prizePool);
  });

  it("reduces an explicit override too, not just the automatic count", () => {
    const result = structure({
      buyIn: 1,
      entrants: 5,
      paidPlaces: 2,
      denomination: 5,
    });
    expect(result.payouts).toEqual([{ place: 1, amount: 5 }]);
  });

  it("still pays one place when the pool can fund nothing more", () => {
    const result = structure({ buyIn: 1, entrants: 1, denomination: 25 });
    expect(result.payouts).toEqual([{ place: 1, amount: 1 }]);
  });
});

describe("the payout table always sums to the prize pool", () => {
  it("actually visits the input space it claims to", () => {
    // Guards the collapsed assertions above and below: a sweep that stopped
    // iterating would now pass silently, since a loop that runs zero times
    // records zero failures.
    let visited = 0;
    sweep(() => {
      visited += 1;
    });
    expect(visited).toBeGreaterThan(80_000);
  });

  it("holds across the whole realistic input space", () => {
    let failure: string | null = null;
    sweep((options) => {
      const result = structure(options);
      const total = sum(result.payouts.map((p) => p.amount));
      if (total !== result.prizePool) {
        failure ??= `${describeOptions(options)} → paid ${total}, pool ${result.prizePool}`;
      }
      if (result.prizePool + result.bountyPool !== result.totalCollected) {
        failure ??= `${describeOptions(options)} → ${result.prizePool} + ${result.bountyPool} != ${result.totalCollected}`;
      }
      if (result.totalEntries !== options.entrants + (options.rebuys ?? 0)) {
        failure ??= `${describeOptions(options)} → entries ${result.totalEntries}`;
      }
    });
    expect(failure).toBeNull();
  });

  it("holds for every explicit place count too", () => {
    for (let places = 1; places <= MAX_PAID_PLACES; places += 1) {
      for (let entrants = places; entrants <= 30; entrants += 1) {
        const result = structure({
          buyIn: 37,
          entrants,
          paidPlaces: places,
          denomination: 5,
        });
        expect(result.payouts).toHaveLength(places);
        expect(sum(result.payouts.map((p) => p.amount))).toBe(result.prizePool);
      }
    }
  });
});

describe("suggestedBounty", () => {
  it("is a fifth of the buy-in, snapped to a round number", () => {
    expect(suggestedBounty(20)).toBe(4);
    expect(suggestedBounty(50)).toBe(10);
    expect(suggestedBounty(100)).toBe(20);
  });

  it("is always payable and always below the buy-in", () => {
    for (let buyIn = 2; buyIn <= 500; buyIn += 1) {
      const bounty = suggestedBounty(buyIn);
      expect(bounty).toBeGreaterThanOrEqual(1);
      expect(bounty).toBeLessThan(buyIn);
      expect(Number.isInteger(bounty)).toBe(true);
      expect(
        validatePayoutOptions({ buyIn, entrants: 8, bounty }),
      ).toBeNull();
    }
  });

  it("offers nothing for a buy-in too small to carry a bounty", () => {
    expect(suggestedBounty(1)).toBe(0);
    expect(suggestedBounty(0)).toBe(0);
    expect(suggestedBounty(Number.NaN)).toBe(0);
  });
});

describe("formatPlace", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [5, "5th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [101, "101st"],
  ])("formats %i as %s", (place, expected) => {
    expect(formatPlace(place)).toBe(expected);
  });

  it("uses -th for the eleven-to-thirteen exceptions", () => {
    expect(formatPlace(11)).toBe("11th");
    expect(formatPlace(12)).toBe("12th");
    expect(formatPlace(13)).toBe("13th");
    expect(formatPlace(111)).toBe("111th");
    expect(formatPlace(112)).toBe("112th");
    expect(formatPlace(113)).toBe("113th");
  });

  it("survives nonsense rather than rendering NaN into the table", () => {
    expect(formatPlace(Number.NaN)).toBe("0th");
    expect(formatPlace(2.9)).toBe("2nd");
  });
});
