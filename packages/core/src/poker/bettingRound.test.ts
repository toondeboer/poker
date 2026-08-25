import { describe, expect, it } from "vitest";
import {
  type BettingRound,
  type RoundSeat,
  applyAction,
  createBettingRound,
  isRoundComplete,
  legalActions,
} from "./bettingRound";

const seat = (
  playerId: string,
  stack: number,
  committed = 0,
  status: RoundSeat["status"] = "active",
): RoundSeat => ({ playerId, stack, committed, status, lastActedBet: null });

/**
 * Blinds already posted — small in seat 0, big in seat 1, action on seat 2.
 *
 * Posting can itself put a short stack all-in, which is real and is exactly
 * how the first version of this helper produced a "still active with no chips"
 * seat that the invariants then flagged.
 */
const post = (target: RoundSeat, amount: number) => {
  const paid = Math.min(amount, target.stack);
  target.stack -= paid;
  target.committed += paid;
  if (target.stack === 0) target.status = "all-in";
};

const preflop = (stacks: number[], bigBlind = 2) => {
  const seats = stacks.map((stack, i) => seat(`p${i}`, stack));
  post(seats[0], bigBlind / 2);
  post(seats[1], bigBlind);
  return createBettingRound({
    seats,
    firstToActIndex: 2 % stacks.length,
    currentBet: bigBlind,
    minimumRaiseSize: bigBlind,
  });
};

const toAct = (round: BettingRound) => legalActions(round)?.playerId;
const act = (round: BettingRound, action: Parameters<typeof applyAction>[2]) =>
  applyAction(round, legalActions(round)!.playerId, action);

describe("createBettingRound", () => {
  it("opens on the seat asked for", () => {
    const round = preflop([100, 100, 100]);
    expect(toAct(round)).toBe("p2");
    expect(round.currentBet).toBe(2);
  });

  it("rejects fractional chips", () => {
    expect(() =>
      createBettingRound({
        seats: [seat("a", 10.5)],
        firstToActIndex: 0,
        minimumRaiseSize: 2,
      }),
    ).toThrow(/whole number of chips/);
  });

  it("copies the seats rather than aliasing the caller's array", () => {
    const seats = [seat("a", 100), seat("b", 100)];
    const round = createBettingRound({
      seats,
      firstToActIndex: 0,
      minimumRaiseSize: 2,
    });
    act(round, { type: "raise", to: 10 });
    expect(seats[0].stack).toBe(100);
  });
});

describe("the basic actions", () => {
  it("passes the turn round the table", () => {
    let round = preflop([100, 100, 100]);
    expect(toAct(round)).toBe("p2");
    round = act(round, { type: "call" });
    expect(toAct(round)).toBe("p0");
    round = act(round, { type: "call" });
    expect(toAct(round)).toBe("p1");
  });

  it("gives the big blind its option even though it has already matched", () => {
    // p1 posted the big blind, so it owes nothing — but it has not acted, and
    // the round cannot close until it has.
    let round = preflop([100, 100, 100]);
    round = act(round, { type: "call" });
    round = act(round, { type: "call" });
    expect(toAct(round)).toBe("p1");
    expect(legalActions(round)!.canCheck).toBe(true);
    expect(legalActions(round)!.canRaise).toBe(true);
    round = act(round, { type: "check" });
    expect(isRoundComplete(round)).toBe(true);
  });

  it("charges a call exactly the difference", () => {
    let round = preflop([100, 100, 100]);
    round = act(round, { type: "call" });
    expect(round.seats[2].stack).toBe(98);
    expect(round.seats[2].committed).toBe(2);
  });

  it("takes a folded player out of the running", () => {
    let round = preflop([100, 100, 100]);
    round = act(round, { type: "fold" });
    expect(round.seats[2].status).toBe("folded");
    expect(toAct(round)).toBe("p0");
  });

  it("ends the round when everyone folds to one player", () => {
    let round = preflop([100, 100, 100]);
    round = act(round, { type: "fold" });
    round = act(round, { type: "fold" });
    expect(isRoundComplete(round)).toBe(true);
    expect(legalActions(round)).toBeNull();
  });

  it("refuses a check when there is a bet to face", () => {
    const round = preflop([100, 100, 100]);
    expect(() => act(round, { type: "check" })).toThrow(/cannot check/);
  });

  it("refuses a call when there is nothing owed", () => {
    let round = preflop([100, 100, 100]);
    round = act(round, { type: "call" });
    round = act(round, { type: "call" });
    expect(() => act(round, { type: "call" })).toThrow(/nothing to call/);
  });

  it("refuses to let the wrong player act", () => {
    const round = preflop([100, 100, 100]);
    expect(() => applyAction(round, "p0", { type: "call" })).toThrow(
      /it is p2's turn, not p0's/,
    );
  });

  it("refuses any action once the round has closed", () => {
    let round = preflop([100, 100, 100]);
    round = act(round, { type: "fold" });
    round = act(round, { type: "fold" });
    expect(() => applyAction(round, "p1", { type: "check" })).toThrow(
      /already complete/,
    );
  });
});

describe("raising", () => {
  it("requires at least a full raise", () => {
    const round = preflop([100, 100, 100]);
    // Bet is 2 and the last full raise was 2, so the minimum is 4.
    expect(legalActions(round)!.minRaiseTo).toBe(4);
    expect(() => act(round, { type: "raise", to: 3 })).toThrow(
      /must raise to at least 4/,
    );
  });

  it("grows the minimum with each raise", () => {
    let round = preflop([100, 100, 100]);
    round = act(round, { type: "raise", to: 6 }); // a raise of 4
    expect(legalActions(round)!.minRaiseTo).toBe(10);
    round = act(round, { type: "raise", to: 20 }); // a raise of 14
    expect(legalActions(round)!.minRaiseTo).toBe(34);
  });

  it("reopens the betting for players who had already acted", () => {
    let round = preflop([100, 100, 100]);
    round = act(round, { type: "call" }); // p2
    round = act(round, { type: "call" }); // p0
    round = act(round, { type: "raise", to: 10 }); // p1 raises
    expect(toAct(round)).toBe("p2");
    expect(legalActions(round)!.canRaise).toBe(true);
  });

  it("will not let someone raise beyond their stack", () => {
    const round = preflop([100, 100, 30]);
    expect(legalActions(round)!.maxRaiseTo).toBe(30);
    expect(() => act(round, { type: "raise", to: 31 })).toThrow(
      /cannot raise to 31 with 30 available/,
    );
  });

  it("counts a raise from a partial commitment by the total, not the increment", () => {
    // p0 has 1 in as the small blind. Raising "to 6" costs 5 more, not 6.
    let round = preflop([100, 100, 100]);
    round = act(round, { type: "call" }); // p2
    round = act(round, { type: "raise", to: 6 }); // p0
    expect(round.seats[0].committed).toBe(6);
    expect(round.seats[0].stack).toBe(94);
  });
});

describe("all-in", () => {
  it("lets a short stack put its last chip in below a full raise", () => {
    // p2 has 3 with the bet at 2: a raise to 3 is only 1, far short of the
    // minimum of 4, but a player may always go all-in.
    const round = preflop([100, 100, 3]);
    const legal = legalActions(round)!;
    expect(legal.minRaiseTo).toBe(3);
    expect(legal.maxRaiseTo).toBe(3);
    const after = applyAction(round, "p2", { type: "raise", to: 3 });
    expect(after.seats[2].status).toBe("all-in");
    expect(after.seats[2].stack).toBe(0);
  });

  it("marks an all-in call and stops asking it to act", () => {
    let round = preflop([100, 100, 100]);
    round = act(round, { type: "raise", to: 50 }); // p2
    round = act(round, { type: "fold" }); // p0
    // p1 has 98 behind having posted 2; calling 50 leaves it live, so raise
    // instead to put it all in.
    round = act(round, { type: "raise", to: 100 });
    expect(round.seats[1].status).toBe("all-in");
    round = act(round, { type: "call" }); // p2 calls
    expect(isRoundComplete(round)).toBe(true);
  });

  it("does NOT reopen the betting when an all-in is less than a full raise", () => {
    // The rule nobody remembers. p2 raises to 6 (a full raise of 4). p0 is
    // all-in for 8 — a raise of only 2. p2 must call or fold; it may not
    // raise again.
    let round = preflop([8, 100, 100]);
    round = act(round, { type: "raise", to: 6 }); // p2, full raise
    expect(toAct(round)).toBe("p0");
    round = act(round, { type: "raise", to: 8 }); // p0 all-in, short raise
    expect(round.seats[0].status).toBe("all-in");

    expect(toAct(round)).toBe("p1");
    // p1 has never acted, so it keeps the right to raise.
    expect(legalActions(round)!.canRaise).toBe(true);
    round = act(round, { type: "call" });

    expect(toAct(round)).toBe("p2");
    const p2 = legalActions(round)!;
    expect(p2.canCall).toBe(true);
    expect(p2.callAmount).toBe(2);
    expect(p2.canRaise).toBe(false); // the whole point
  });

  it("reopens again if a later full raise comes over the short all-in", () => {
    // Same shape as above, but p1 then makes it a genuine raise — which puts
    // p2's right to raise back.
    let round = preflop([8, 100, 100]);
    round = act(round, { type: "raise", to: 6 }); // p2, full raise of 4
    round = act(round, { type: "raise", to: 8 }); // p0 all-in, short raise
    round = act(round, { type: "raise", to: 12 }); // p1, a full raise of 4
    expect(toAct(round)).toBe("p2");
    // The bet has climbed 12 - 6 = 6 since p2 acted, which is at least a full
    // raise, so p2 may raise again.
    expect(legalActions(round)!.canRaise).toBe(true);
  });

  it("refuses a re-raise from a player the short all-in locked out", () => {
    // The same shape as above, but p2 tries it anyway. Silently allowing it
    // would let a player re-raise off a raise that was never legal to begin
    // with, which is how a table ends up arguing.
    let round = preflop([8, 100, 100]);
    round = act(round, { type: "raise", to: 6 });
    round = act(round, { type: "raise", to: 8 }); // p0 all-in, short
    round = act(round, { type: "call" }); // p1
    expect(toAct(round)).toBe("p2");
    expect(() => act(round, { type: "raise", to: 20 })).toThrow(
      /p2 may not raise/,
    );
  });

  it("caps a call at the stack rather than asking for chips that aren't there", () => {
    // p0 has 20 and posted 1 as the small blind. Facing a raise to 50 it owes
    // 49, but can only pay 19 — and calling puts it all-in rather than
    // demanding chips it hasn't got.
    let round = preflop([20, 100, 100]);
    round = act(round, { type: "raise", to: 50 }); // p2
    const legal = legalActions(round)!;
    expect(legal.playerId).toBe("p0");
    expect(legal.callAmount).toBe(19);
    round = act(round, { type: "call" });
    expect(round.seats[0].status).toBe("all-in");
    expect(round.seats[0].committed).toBe(20);
    expect(round.seats[0].stack).toBe(0);
  });

  it("closes the round when everyone still in is all-in", () => {
    let round = preflop([6, 6, 6]);
    round = act(round, { type: "raise", to: 6 }); // p2 all-in
    round = act(round, { type: "call" }); // p0 all-in for 6
    round = act(round, { type: "call" }); // p1 all-in for 6
    expect(isRoundComplete(round)).toBe(true);
    expect(round.seats.every((s) => s.status === "all-in")).toBe(true);
  });

  it("does not ask a lone remaining bettor to check into all-in opponents", () => {
    // p2 all-in short, p0 folds, p1 calls: nobody left to bet against, so the
    // round is over rather than offering p1 a pointless check.
    let round = preflop([100, 100, 10]);
    round = act(round, { type: "raise", to: 10 }); // p2 all-in
    round = act(round, { type: "fold" }); // p0
    round = act(round, { type: "call" }); // p1 matches
    expect(isRoundComplete(round)).toBe(true);
  });
});

describe("invariants", () => {
  /** Play a whole round out with pseudo-random but always legal choices. */
  const playRound = (seed: number) => {
    let state = seed >>> 0;
    const next = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const stacks = Array.from(
      { length: 2 + Math.floor(next() * 5) },
      () => 2 + Math.floor(next() * 200),
    );
    let round = preflop(stacks);
    const startingChips = round.seats.reduce(
      (sum, s) => sum + s.stack + s.committed,
      0,
    );

    let guard = 0;
    while (!isRoundComplete(round)) {
      if (++guard > 500) return { round, startingChips, ranAway: true };
      const legal = legalActions(round)!;
      const roll = next();
      if (roll < 0.15) {
        round = applyAction(round, legal.playerId, { type: "fold" });
      } else if (legal.canRaise && roll < 0.4) {
        const span = legal.maxRaiseTo - legal.minRaiseTo;
        const to = legal.minRaiseTo + Math.floor(next() * (span + 1));
        round = applyAction(round, legal.playerId, { type: "raise", to });
      } else if (legal.canCall) {
        round = applyAction(round, legal.playerId, { type: "call" });
      } else {
        round = applyAction(round, legal.playerId, { type: "check" });
      }
    }
    return { round, startingChips, ranAway: false };
  };

  it("always terminates", () => {
    // A betting round that cannot end is the worst possible bug here: the game
    // simply stops, with everyone's money in the middle.
    const failures: number[] = [];
    for (let seed = 1; seed <= 4000; seed++) {
      if (playRound(seed).ranAway) failures.push(seed);
    }
    expect(failures).toEqual([]);
  });

  it("never creates or destroys a chip", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 4000; seed++) {
      const { round, startingChips } = playRound(seed);
      const ending = round.seats.reduce(
        (sum, s) => sum + s.stack + s.committed,
        0,
      );
      if (ending !== startingChips) {
        failures.push(`seed ${seed}: ${startingChips} became ${ending}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("never lets a stack go negative, or a seat commit what it hasn't got", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 4000; seed++) {
      const { round } = playRound(seed);
      for (const s of round.seats) {
        if (s.stack < 0) failures.push(`seed ${seed}: ${s.playerId} at ${s.stack}`);
        if (s.stack === 0 && s.status === "active") {
          failures.push(`seed ${seed}: ${s.playerId} broke but still active`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("leaves everyone still in either matched or all-in", () => {
    // The definition of a closed betting round, and what side-pot building
    // downstream assumes.
    const failures: string[] = [];
    for (let seed = 1; seed <= 4000; seed++) {
      const { round } = playRound(seed);
      const contenders = round.seats.filter((s) => s.status !== "folded");
      if (contenders.length < 2) continue; // everyone folded out
      for (const s of contenders) {
        if (s.committed !== round.currentBet && s.status !== "all-in") {
          failures.push(
            `seed ${seed}: ${s.playerId} at ${s.committed} of ${round.currentBet}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
