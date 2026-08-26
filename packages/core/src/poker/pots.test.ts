import { describe, expect, it } from "vitest";
import {
  type Contribution,
  awardPots,
  potWinners,
  buildPots,
  totalPotAmount,
} from "./pots";
import { createRandom, shuffle } from "./cards";

const player = (
  playerId: string,
  contributed: number,
  folded = false,
): Contribution => ({ playerId, contributed, folded });

/** Strongest-first tiers, written as `["a"], ["b","c"]` for readability. */
const ranking = (...tiers: string[][]) => tiers.map((ids) => ({ ids }));

describe("buildPots", () => {
  it("makes a single pot when everyone paid the same", () => {
    expect(
      buildPots([player("a", 100), player("b", 100), player("c", 100)]),
    ).toEqual([{ amount: 300, eligiblePlayerIds: ["a", "b", "c"] }]);
  });

  it("caps a short stack's pot at what they could pay", () => {
    // b is all-in for 40; a and c go on to 100 each.
    expect(
      buildPots([player("a", 100), player("b", 40), player("c", 100)]),
    ).toEqual([
      { amount: 120, eligiblePlayerIds: ["a", "b", "c"] },
      { amount: 120, eligiblePlayerIds: ["a", "c"] },
    ]);
  });

  it("keeps a folded player's chips but not their eligibility", () => {
    // This is what makes folding cost money: b's 30 is in the pot, b cannot
    // win it. And since the level b created is contested by the same two
    // players either side of it, it is one pot of 230, not two.
    expect(
      buildPots([player("a", 100), player("b", 30, true), player("c", 100)]),
    ).toEqual([{ amount: 230, eligiblePlayerIds: ["a", "c"] }]);
  });

  it("merges levels that a folded player created but nobody contests", () => {
    // Only one all-in here, so there should be exactly two real pots even
    // though three distinct amounts were committed.
    const pots = buildPots([
      player("a", 100),
      player("b", 30, true),
      player("c", 100),
      player("d", 50),
    ]);
    expect(pots).toEqual([
      { amount: 180, eligiblePlayerIds: ["a", "c", "d"] },
      { amount: 100, eligiblePlayerIds: ["a", "c"] },
    ]);
  });

  it("keeps dead money above everyone still in, rather than losing it", () => {
    // b folded having committed more than a ever matched. Real play cannot
    // reach this — you don't fold facing no bet, and an uncalled bet is
    // returned — but the money must not disappear if it does.
    const pots = buildPots([player("a", 100), player("b", 150, true)]);
    expect(pots).toEqual([{ amount: 250, eligiblePlayerIds: ["a"] }]);
    expect(totalPotAmount(pots)).toBe(250);
  });

  it("gives dead money to whoever is left when there is no earlier pot", () => {
    // a is still in the hand having committed nothing; b put money in and
    // folded. There is no earlier pot to fold the dead money into, so a — the
    // last player standing — takes it. Losing it here would be 100 chips
    // leaving the table.
    const pots = buildPots([player("a", 0), player("b", 100, true)]);
    expect(pots).toEqual([{ amount: 100, eligiblePlayerIds: ["a"] }]);
    expect(awardPots(pots, ranking(["a"]), ["a", "b"])).toEqual([
      { playerId: "a", amount: 100 },
    ]);
  });

  it("rejects fractional or negative chips instead of rounding them away", () => {
    // Contributions come from the engine, not from a text field, so a
    // fractional chip is a bug rather than input to be sanitised.
    expect(() => buildPots([player("a", 10.5)])).toThrow(
      /a's contribution must be a whole number of chips, got 10.5/,
    );
    expect(() => buildPots([player("a", -5)])).toThrow(/got -5/);
  });

  it("still reports a pot nobody can win when literally everyone folded", () => {
    // Degenerate, and also unreachable — the last aggressor wins uncontested —
    // but there is no sensible owner to hand it to, so it is surfaced rather
    // than silently given away.
    expect(buildPots([player("a", 50, true), player("b", 50, true)])).toEqual([
      { amount: 100, eligiblePlayerIds: [] },
    ]);
  });

  it("returns an uncalled bet as a pot only its bettor can win", () => {
    // a bets 100, b calls all-in for 50. a's extra 50 comes straight back.
    const pots = buildPots([player("a", 100), player("b", 50)]);
    expect(pots).toEqual([
      { amount: 100, eligiblePlayerIds: ["a", "b"] },
      { amount: 50, eligiblePlayerIds: ["a"] },
    ]);
  });

  it("builds a ladder of side pots for stacked all-ins", () => {
    const pots = buildPots([
      player("a", 10),
      player("b", 25),
      player("c", 60),
      player("d", 60),
    ]);
    expect(pots).toEqual([
      { amount: 40, eligiblePlayerIds: ["a", "b", "c", "d"] },
      { amount: 45, eligiblePlayerIds: ["b", "c", "d"] },
      { amount: 70, eligiblePlayerIds: ["c", "d"] },
    ]);
  });

  it("ignores players who put nothing in", () => {
    expect(buildPots([player("a", 100), player("b", 0, true)])).toEqual([
      { amount: 100, eligiblePlayerIds: ["a"] },
    ]);
  });

  it("has nothing to build before any money goes in", () => {
    expect(buildPots([])).toEqual([]);
    expect(buildPots([player("a", 0), player("b", 0)])).toEqual([]);
  });
});

describe("buildPots — invariants", () => {
  it("always collects exactly what was contributed, and never more", () => {
    const failures: string[] = [];
    const random = createRandom(4242);
    for (let trial = 0; trial < 3000; trial++) {
      const size = 2 + Math.floor(random() * 8);
      const contributions: Contribution[] = [];
      for (let i = 0; i < size; i++) {
        contributions.push(
          player(`p${i}`, Math.floor(random() * 200), random() < 0.3),
        );
      }
      const collected = totalPotAmount(buildPots(contributions));
      const committed = contributions.reduce((s, c) => s + c.contributed, 0);
      if (collected !== committed) {
        failures.push(
          `collected ${collected} of ${committed}: ${JSON.stringify(contributions)}`,
        );
      }
    }
    expect(failures).toEqual([]);
  });

  it("never makes an empty pot, and never one nobody can win while someone is still in", () => {
    const failures: string[] = [];
    const random = createRandom(777);
    for (let trial = 0; trial < 2000; trial++) {
      const size = 2 + Math.floor(random() * 6);
      const contributions: Contribution[] = [];
      for (let i = 0; i < size; i++) {
        contributions.push(
          player(`p${i}`, Math.floor(random() * 100), random() < 0.25),
        );
      }
      // Deliberately NOT `&& c.contributed > 0`: a live player who has
      // committed nothing is still in the hand and can still win the pot.
      // Defining it the other way is what hid a bug where a lone unwinnable
      // pot silently dropped its chips.
      const anyoneLeft = contributions.some((c) => !c.folded);
      for (const pot of buildPots(contributions)) {
        if (pot.amount <= 0) failures.push(`pot of ${pot.amount}`);
        if (anyoneLeft && pot.eligiblePlayerIds.length === 0) {
          failures.push(`pot with nobody eligible: ${JSON.stringify(pot)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("awardPots", () => {
  it("gives the whole pot to the best hand", () => {
    const pots = buildPots([player("a", 100), player("b", 100)]);
    expect(awardPots(pots, ranking(["b"], ["a"]), ["a", "b"])).toEqual([
      { playerId: "b", amount: 200 },
    ]);
  });

  it("splits an even pot exactly", () => {
    const pots = buildPots([player("a", 100), player("b", 100)]);
    expect(awardPots(pots, ranking(["a", "b"]), ["a", "b"])).toEqual([
      { playerId: "a", amount: 100 },
      { playerId: "b", amount: 100 },
    ]);
  });

  it("does not give a side pot to someone who couldn't pay into it", () => {
    // b is all-in short and has the best hand: b wins the main pot only, and
    // the side pot goes to the better of a and c. This is the entire reason
    // side pots exist.
    const pots = buildPots([player("a", 100), player("b", 40), player("c", 100)]);
    const awards = awardPots(pots, ranking(["b"], ["c"], ["a"]), ["a", "b", "c"]);
    expect(awards).toEqual([
      { playerId: "b", amount: 120 },
      { playerId: "c", amount: 120 },
    ]);
  });

  it("hands odd chips out one at a time, by seat", () => {
    // 101 between three players: 33 each, two chips over.
    const pots = [{ amount: 101, eligiblePlayerIds: ["a", "b", "c"] }];
    expect(awardPots(pots, ranking(["a", "b", "c"]), ["a", "b", "c"])).toEqual([
      { playerId: "a", amount: 34 },
      { playerId: "b", amount: 34 },
      { playerId: "c", amount: 33 },
    ]);
  });

  it("follows the button, not the alphabet, for odd chips", () => {
    // Same pot, but the seat to the left of the button is c.
    const pots = [{ amount: 101, eligiblePlayerIds: ["a", "b", "c"] }];
    expect(awardPots(pots, ranking(["a", "b", "c"]), ["c", "a", "b"])).toEqual([
      { playerId: "c", amount: 34 },
      { playerId: "a", amount: 34 },
      { playerId: "b", amount: 33 },
    ]);
  });

  it("gives everything to the last player standing when the rest folded", () => {
    const pots = buildPots([
      player("a", 100),
      player("b", 100, true),
      player("c", 20, true),
    ]);
    expect(awardPots(pots, ranking(["a"]), ["a", "b", "c"])).toEqual([
      { playerId: "a", amount: 220 },
    ]);
  });

  it("leaves a pot alone when nobody eligible was ranked", () => {
    // Defensive: a caller that ranks nobody should not silently lose chips to
    // a player who wasn't in the running.
    const pots = [{ amount: 50, eligiblePlayerIds: ["a"] }];
    expect(awardPots(pots, ranking(["b"]), ["a", "b"])).toEqual([]);
  });

  it("has nothing to pay out from nothing", () => {
    expect(awardPots([], ranking(["a"]), ["a"])).toEqual([]);
  });

  it("leaves a winner off the list rather than paying them nothing", () => {
    // A pot smaller than the number of winners: two get a chip, the third gets
    // nothing at all and should simply not appear.
    const pots = [{ amount: 2, eligiblePlayerIds: ["a", "b", "c"] }];
    expect(awardPots(pots, ranking(["a", "b", "c"]), ["a", "b", "c"])).toEqual([
      { playerId: "a", amount: 1 },
      { playerId: "b", amount: 1 },
    ]);
  });

  it("rejects a fractional pot rather than inventing a chip", () => {
    // 10.5 split two ways paid 6 + 5 = 11 before this guard.
    expect(() =>
      awardPots([{ amount: 10.5, eligiblePlayerIds: ["a", "b"] }], ranking(["a", "b"]), ["a", "b"]),
    ).toThrow(/pot amount must be a whole number of chips/);
  });

  it("stays order-independent even when nobody is in the seating", () => {
    // Both winners unknown to `oddChipOrder` compare equal on seat, and a
    // stable sort would then follow the caller's list order — the exact
    // order-dependence this module claims not to have.
    const pots = [{ amount: 3, eligiblePlayerIds: ["a", "b"] }];
    expect(awardPots(pots, ranking(["a", "b"]), [])).toEqual(
      awardPots(pots, ranking(["b", "a"]), []),
    );
  });

  it("puts a winner missing from the seating last for odd chips", () => {
    // Defensive: a caller that forgets a seat should lose the tie-break, not
    // the chip. "b" is unknown to the seating and so sorts behind "a".
    const pots = [{ amount: 3, eligiblePlayerIds: ["a", "b"] }];
    expect(awardPots(pots, ranking(["a", "b"]), ["a"])).toEqual([
      { playerId: "a", amount: 2 },
      { playerId: "b", amount: 1 },
    ]);
  });
});

describe("awardPots — invariants", () => {
  /** One random hand's worth of contributions plus a random ranking. */
  const scenario = (random: () => number) => {
    const size = 2 + Math.floor(random() * 7);
    const ids = Array.from({ length: size }, (_, i) => `p${i}`);
    // Contributions start at 0, not 1, on purpose: a live player who has
    // committed nothing is the case that hid the lone-unwinnable-pot bug, and
    // a generator that can't produce it can't catch it.
    const contributions = ids.map((id) =>
      player(id, Math.floor(random() * 150), random() < 0.3),
    );
    // Somebody always survives the hand: a pot with nobody left to win it is
    // unreachable in real play, and has no defined payout.
    if (contributions.every((c) => c.folded)) contributions[0].folded = false;
    const live = contributions.filter((c) => !c.folded).map((c) => c.playerId);
    // Random tiers over the live players, so ties of every size occur.
    const tiers: string[][] = [];
    let rest = shuffle(live, random);
    while (rest.length > 0) {
      const take = 1 + Math.floor(random() * Math.min(3, rest.length));
      tiers.push(rest.slice(0, take));
      rest = rest.slice(take);
    }
    return { contributions, tiers, seatOrder: ids };
  };

  it("pays out exactly the money in the pots — never loses a chip, never invents one", () => {
    const failures: string[] = [];
    const random = createRandom(31337);
    for (let trial = 0; trial < 3000; trial++) {
      const { contributions, tiers, seatOrder } = scenario(random);
      const pots = buildPots(contributions);
      const awards = awardPots(pots, tiers.map((ids) => ({ ids })), seatOrder);
      const paid = awards.reduce((s, a) => s + a.amount, 0);
      const inPots = totalPotAmount(pots);
      // The only money that legitimately stays unpaid is a pot whose eligible
      // players are all unranked, which `scenario` never produces.
      if (paid !== inPots) {
        failures.push(`paid ${paid} of ${inPots}`);
      }
      if (awards.some((a) => a.amount <= 0)) {
        failures.push(`non-positive award: ${JSON.stringify(awards)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("gives the same answer however the inputs are ordered", () => {
    // The bug class a previous review caught in the chop calculator: totals and
    // floors were asserted, permutations were not. Shuffling the contributions
    // and the ids inside each tier must change nothing at all.
    const failures: string[] = [];
    const random = createRandom(90210);
    for (let trial = 0; trial < 2000; trial++) {
      const { contributions, tiers, seatOrder } = scenario(random);
      const baseline = awardPots(
        buildPots(contributions),
        tiers.map((ids) => ({ ids })),
        seatOrder,
      );

      for (let p = 0; p < 3; p++) {
        const shuffledContributions = shuffle(contributions, random);
        const shuffledTiers = tiers.map((ids) => ({ ids: shuffle(ids, random) }));
        const awards = awardPots(
          buildPots(shuffledContributions),
          shuffledTiers,
          seatOrder,
        );
        if (JSON.stringify(awards) !== JSON.stringify(baseline)) {
          failures.push(
            `order changed the result:\n  ${JSON.stringify(baseline)}\n  ${JSON.stringify(awards)}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("never pays a player more than the pots they were eligible for", () => {
    const failures: string[] = [];
    const random = createRandom(5150);
    for (let trial = 0; trial < 2000; trial++) {
      const { contributions, tiers, seatOrder } = scenario(random);
      const pots = buildPots(contributions);
      const awards = awardPots(pots, tiers.map((ids) => ({ ids })), seatOrder);
      for (const award of awards) {
        const ceiling = pots
          .filter((pot) => pot.eligiblePlayerIds.includes(award.playerId))
          .reduce((s, pot) => s + pot.amount, 0);
        if (award.amount > ceiling) {
          failures.push(`${award.playerId} got ${award.amount}, ceiling ${ceiling}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("never gives a folded player anything", () => {
    const failures: string[] = [];
    const random = createRandom(60606);
    for (let trial = 0; trial < 2000; trial++) {
      const { contributions, tiers, seatOrder } = scenario(random);
      const folded = new Set(
        contributions.filter((c) => c.folded).map((c) => c.playerId),
      );
      const awards = awardPots(
        buildPots(contributions),
        tiers.map((ids) => ({ ids })),
        seatOrder,
      );
      for (const award of awards) {
        if (folded.has(award.playerId)) {
          failures.push(`folded ${award.playerId} was paid ${award.amount}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("who won which pot", () => {
  const ranking = [{ ids: ["a"] }, { ids: ["b"] }, { ids: ["c"] }];

  it("names a winner per pot, in the same order", () => {
    const pots = [
      { amount: 300, eligiblePlayerIds: ["a", "b", "c"] },
      { amount: 200, eligiblePlayerIds: ["b", "c"] },
    ];
    expect(potWinners(pots, ranking, ["a", "b", "c"])).toEqual([["a"], ["b"]]);
  });

  it("agrees with the money, pot by pot", () => {
    // The property that matters: whoever is credited with a pot is whoever was
    // paid for it. Both read the same rule, and this is what holds them there.
    const pots = [
      { amount: 90, eligiblePlayerIds: ["a", "b", "c"] },
      { amount: 40, eligiblePlayerIds: ["b", "c"] },
    ];
    const order = ["a", "b", "c"];
    const credited = potWinners(pots, ranking, order);
    const paid = new Map(
      awardPots(pots, ranking, order).map((award) => [
        award.playerId,
        award.amount,
      ]),
    );

    const failures: string[] = [];
    credited.forEach((winners, index) => {
      for (const winner of winners) {
        if (!paid.has(winner)) failures.push(`${winner} credited, never paid`);
      }
      if (winners.length === 0 && pots[index].amount > 0) {
        failures.push(`pot ${index} credited to nobody`);
      }
    });
    expect(failures).toEqual([]);
  });

  it("credits everybody in a split", () => {
    const pots = [{ amount: 100, eligiblePlayerIds: ["a", "b"] }];
    expect(potWinners(pots, [{ ids: ["a", "b"] }], ["a", "b"])).toEqual([
      ["a", "b"],
    ]);
  });

  it("credits nobody for money nobody can claim", () => {
    // Dead money: everyone eligible has folded. Inventing a winner here would
    // invent a knockout too.
    const pots = [{ amount: 50, eligiblePlayerIds: ["d"] }];
    expect(potWinners(pots, ranking, ["a", "b", "c"])).toEqual([[]]);
  });

  it("orders a split by seat, the way the odd chip goes", () => {
    const pots = [{ amount: 100, eligiblePlayerIds: ["b", "a"] }];
    expect(potWinners(pots, [{ ids: ["b", "a"] }], ["a", "b"])).toEqual([
      ["a", "b"],
    ]);
  });
});
