import { describe, expect, it } from "vitest";
import {
  applyKnockout,
  awardFinalBounty,
  createBountyLedger,
  ledgerTotal,
  runBounties,
  type BountyLedger,
} from "./progressiveBounties";

const PLAYERS = ["a", "b", "c", "d"];

describe("starting out", () => {
  it("puts the same bounty on everybody", () => {
    const ledger = createBountyLedger(PLAYERS, 5);
    expect(ledger.heads).toEqual({ a: 5, b: 5, c: 5, d: 5 });
    expect(ledger.cash).toEqual({});
    expect(ledger.unclaimed).toBe(0);
  });

  it("holds exactly what was paid in", () => {
    expect(ledgerTotal(createBountyLedger(PLAYERS, 5))).toBe(20);
  });
});

describe("one elimination", () => {
  it("pays half in cash and puts half on the winner's head", () => {
    // The whole point: whoever is knocking people out becomes worth more to
    // knock out, so the chip leader is a target rather than untouchable.
    const after = applyKnockout(createBountyLedger(PLAYERS, 10), {
      playerId: "d",
      by: ["a"],
    });
    expect(after.cash.a).toBe(5);
    expect(after.heads.a).toBe(15);
    expect(after.heads.d).toBe(0);
  });

  it("rounds the odd unit into the pocket, not onto the head", () => {
    // Somebody is handed money at the table tonight; rounding in their favour
    // is friendlier and keeps the arithmetic visible. 5 pays 3 and adds 2.
    const after = applyKnockout(createBountyLedger(PLAYERS, 5), {
      playerId: "d",
      by: ["a"],
    });
    expect(after.cash.a).toBe(3);
    expect(after.heads.a).toBe(7);
  });

  it("empties the head of whoever went out", () => {
    // Leaving a bounty on an empty seat would let it be collected twice if
    // that player bought back in.
    const after = applyKnockout(createBountyLedger(PLAYERS, 10), {
      playerId: "d",
      by: ["a"],
    });
    expect(after.heads.d).toBe(0);
  });

  it("splits between two players who chopped the pot", () => {
    const after = applyKnockout(createBountyLedger(PLAYERS, 10), {
      playerId: "d",
      by: ["a", "b"],
    });
    expect(after.cash).toEqual({ a: 3, b: 2 });
    expect(after.heads.a).toBe(13);
    expect(after.heads.b).toBe(12);
  });

  it("holds on to money nobody could claim", () => {
    // A pot everyone eligible folded out of. The bounty has nowhere to go, and
    // dropping it would leave the ledger silently short.
    const after = applyKnockout(createBountyLedger(PLAYERS, 10), {
      playerId: "d",
      by: [],
    });
    expect(after.unclaimed).toBe(10);
    expect(ledgerTotal(after)).toBe(40);
  });

  it("credits somebody who joined the ledger part-way through", () => {
    // A player added mid-evening has no head and no cash yet. Both have to
    // come into existence rather than being added to nothing.
    const ledger = applyKnockout(createBountyLedger(["d"], 10), {
      playerId: "d",
      by: ["late"],
    });
    expect(ledger.cash.late).toBe(5);
    expect(ledger.heads.late).toBe(5);
  });

  it("leaves the ledger alone rather than mutating it", () => {
    const before = createBountyLedger(PLAYERS, 10);
    applyKnockout(before, { playerId: "d", by: ["a"] });
    expect(before.heads).toEqual({ a: 10, b: 10, c: 10, d: 10 });
    expect(before.cash).toEqual({});
  });
});

describe("the last player standing", () => {
  it("collects the bounty on their own head", () => {
    // It came out of their own buy-in. Without this the winner of a long game
    // is quietly short by the largest bounty on the table.
    const ledger = runBounties({
      playerIds: PLAYERS,
      startingBounty: 10,
      knockouts: [
        { playerId: "d", by: ["a"] },
        { playerId: "c", by: ["a"] },
        { playerId: "b", by: ["a"] },
      ],
      winnerId: "a",
    });
    expect(ledger.heads.a).toBe(0);
    // 5 + 5 + 5 collected in cash, and a head that grew 5 + 5 + 5 on top of
    // the 10 they started with.
    expect(ledger.cash.a).toBe(40);
  });

  it("does nothing for a game still in progress", () => {
    const ledger = runBounties({
      playerIds: PLAYERS,
      startingBounty: 10,
      knockouts: [{ playerId: "d", by: ["a"] }],
    });
    expect(ledger.heads.a).toBe(15);
    expect(ledger.cash.a).toBe(5);
  });

  it("does nothing for somebody who was never in the game", () => {
    const ledger = createBountyLedger(PLAYERS, 10);
    expect(awardFinalBounty(ledger, "stranger")).toBe(ledger);
  });

  it("does nothing twice", () => {
    const once = awardFinalBounty(createBountyLedger(["a"], 10), "a");
    expect(awardFinalBounty(once, "a")).toBe(once);
  });
});

describe("a whole evening", () => {
  const knockouts = [
    { playerId: "d", by: ["c"] },
    { playerId: "c", by: ["b"] },
    { playerId: "b", by: ["a"] },
  ];

  it("passes a growing head down the chain", () => {
    // "c" takes out "d" and is worth more; "b" then takes out a *bigger*
    // bounty than "c" started with. That escalation is the feature.
    const ledger = runBounties({
      playerIds: PLAYERS,
      startingBounty: 10,
      knockouts,
      winnerId: "a",
    });
    // c: 10 + 5 = 15 on their head, of which b takes half in cash (8, odd unit
    // to the pocket) and 7 onto their own.
    expect(ledger.cash.c).toBe(5);
    expect(ledger.cash.b).toBe(8);
    expect(ledger.cash.a).toBeGreaterThan(10);
  });

  it("never loses or invents a unit, whatever happens", () => {
    // The invariant worth having: money in equals money out, across every
    // ordering, split and unclaimed pot.
    const failures: string[] = [];
    const orderings: { playerId: string; by: string[] }[][] = [
      knockouts,
      [
        { playerId: "d", by: ["a", "b"] },
        { playerId: "c", by: [] },
        { playerId: "b", by: ["a"] },
      ],
      [
        { playerId: "b", by: ["d"] },
        { playerId: "d", by: ["c", "a"] },
        { playerId: "c", by: ["a"] },
      ],
    ];
    for (const startingBounty of [1, 3, 5, 10, 25]) {
      for (const [index, order] of orderings.entries()) {
        for (const winnerId of ["a", undefined]) {
          const ledger = runBounties({
            playerIds: PLAYERS,
            startingBounty,
            knockouts: order,
            winnerId,
          });
          const expected = startingBounty * PLAYERS.length;
          if (ledgerTotal(ledger) !== expected) {
            failures.push(
              `${startingBounty}/${index}/${winnerId}: ${ledgerTotal(ledger)} != ${expected}`,
            );
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("never puts a negative number anywhere", () => {
    const ledger: BountyLedger = runBounties({
      playerIds: PLAYERS,
      startingBounty: 1,
      knockouts,
      winnerId: "a",
    });
    const negatives = [
      ...Object.values(ledger.heads),
      ...Object.values(ledger.cash),
      ledger.unclaimed,
    ].filter((value) => value < 0);
    expect(negatives).toEqual([]);
  });

  it("deals with a bounty of nothing at all", () => {
    // A tournament with no bounty still runs every one of these paths.
    const ledger = runBounties({
      playerIds: PLAYERS,
      startingBounty: 0,
      knockouts,
      winnerId: "a",
    });
    expect(ledgerTotal(ledger)).toBe(0);
    expect(ledger.cash).toEqual({});
  });

  it("ignores a knockout for somebody who was never in the game", () => {
    // Nothing on their head, so nothing to pay — and nothing invented.
    const ledger = runBounties({
      playerIds: PLAYERS,
      startingBounty: 10,
      knockouts: [{ playerId: "stranger", by: ["a"] }],
    });
    expect(ledger.cash).toEqual({});
    expect(ledgerTotal(ledger)).toBe(40);
  });
});
