/**
 * Side pots, and paying them out.
 *
 * This is the part of a poker game that people actually argue about at the
 * table, and the part where being *almost* right means somebody is quietly
 * short-changed. Two things carry the weight:
 *
 * - **Every chip put in comes back out.** The awards always sum to exactly the
 *   money in the pots, so nothing is lost to rounding and nothing is invented.
 * - **The result never depends on the order anyone happens to be listed in.**
 *   A previous review of this repo's chop calculator found a fairness bug that
 *   property tests missed precisely because they checked totals and floors but
 *   never permuted the input. Odd chips here are assigned by *seat*, not by
 *   array position, and there is a test that permutes everything to prove it.
 */

/** What one player has put into the pot this hand, and whether they're still in. */
export type Contribution = {
  playerId: string;
  /** Total chips committed across every street of this hand. */
  contributed: number;
  /** Folded players' chips stay in the pot; they just can't win any of it. */
  folded: boolean;
};

export type Pot = {
  amount: number;
  /**
   * Who can win this pot: everyone still in the hand who paid up to its level.
   * In seat order, because that is the order the caller supplies.
   */
  eligiblePlayerIds: string[];
};

export type Award = {
  playerId: string;
  amount: number;
};

/**
 * Split the money into a main pot and however many side pots the all-ins
 * require.
 *
 * The method is the standard one: take each distinct amount someone committed
 * as a level, and at each level collect what every player paid *between* the
 * previous level and this one. A player can only win a pot they paid into, so
 * eligibility at each level is "still in the hand, and committed at least this
 * much".
 *
 * **Folded players' chips are collected but win nothing** — that is what makes
 * a fold cost money, and it is why `contributed` and `folded` are separate
 * fields rather than a fold being modelled as contributing zero.
 *
 * Consecutive pots with the same eligible players are merged, because they are
 * one pot: a folded player creates a level boundary without creating a genuine
 * side pot, and leaving them split would hand out an extra odd chip.
 *
 * The last pot may have a single eligible player — that is the uncalled part
 * of a bet nobody could match, and awarding it back to them is exactly the
 * "return the excess" rule.
 */
export const buildPots = (contributions: readonly Contribution[]): Pot[] => {
  const levels = Array.from(
    new Set(contributions.map((c) => c.contributed).filter((c) => c > 0)),
  ).sort((a, b) => a - b);

  const pots: Pot[] = [];
  let previous = 0;

  for (const level of levels) {
    let amount = 0;
    for (const contribution of contributions) {
      // What this player paid within this slice: nothing below `previous`,
      // and never more than the slice is wide.
      const withinSlice = Math.min(contribution.contributed, level) - previous;
      if (withinSlice > 0) amount += withinSlice;
    }

    const eligiblePlayerIds = contributions
      .filter((c) => !c.folded && c.contributed >= level)
      .map((c) => c.playerId);

    // `amount` is necessarily positive: the level came from someone's own
    // contribution, so at least one player pays the full width of this slice.
    // No guard, because a branch that can't be taken is a branch nobody can
    // test and everybody has to read.
    const last = pots[pots.length - 1];
    if (last && samePlayers(last.eligiblePlayerIds, eligiblePlayerIds)) {
      last.amount += amount;
    } else {
      pots.push({ amount, eligiblePlayerIds });
    }

    previous = level;
  }

  // Dead money above everyone still in the hand.
  //
  // Eligibility only shrinks as the levels rise, so a pot nobody can win is
  // always the last one — it is what a folded player committed beyond anything
  // a live player matched. Real play can't quite produce this (you never fold
  // facing no bet, and an uncalled bet comes back), but the function has to be
  // total, and silently building a pot with no winner means those chips leave
  // the game. They belong to the last contested pot.
  const last = pots[pots.length - 1];
  if (pots.length > 1 && last.eligiblePlayerIds.length === 0) {
    pots[pots.length - 2].amount += last.amount;
    pots.pop();
  }

  return pots;
};

const samePlayers = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Pay out every pot to whoever wins it.
 *
 * `ranking` is strongest-first tiers, the shape {@link rankHands} returns — so
 * a tie is a tier with several ids in it, and each pot goes to the best tier
 * that has anyone eligible for it. That last part is the whole reason side
 * pots exist: the strongest hand at the table doesn't win a pot it couldn't
 * have paid into.
 *
 * **Odd chips.** A pot that doesn't divide evenly leaves a remainder of fewer
 * chips than there are winners. They go one each, in `oddChipOrder` — which the
 * caller builds as seat order starting to the left of the button, the standard
 * rule. Because that order comes from the seating and not from how the winners
 * were listed, the result is the same however the inputs are shuffled.
 *
 * A winner not present in `oddChipOrder` sorts last, so a caller that forgets a
 * seat loses the tie-break rather than the chip.
 */
export const awardPots = (
  pots: readonly Pot[],
  ranking: readonly { ids: readonly string[] }[],
  oddChipOrder: readonly string[],
): Award[] => {
  const seatIndex = new Map<string, number>();
  oddChipOrder.forEach((id, index) => seatIndex.set(id, index));
  const bySeat = (a: string, b: string) =>
    (seatIndex.get(a) ?? Number.MAX_SAFE_INTEGER) -
    (seatIndex.get(b) ?? Number.MAX_SAFE_INTEGER);

  const totals = new Map<string, number>();
  const add = (playerId: string, amount: number) => {
    if (amount === 0) return;
    totals.set(playerId, (totals.get(playerId) ?? 0) + amount);
  };

  for (const pot of pots) {
    const eligible = new Set(pot.eligiblePlayerIds);
    const tier = ranking.find((t) => t.ids.some((id) => eligible.has(id)));
    if (!tier) continue; // nobody eligible can be ranked: leave it untouched

    const winners = tier.ids.filter((id) => eligible.has(id)).sort(bySeat);
    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - share * winners.length;

    winners.forEach((playerId, index) => {
      add(playerId, share + (index < remainder ? 1 : 0));
    });
  }

  // Seat order, so the result reads the same way twice.
  return Array.from(totals.entries())
    .map(([playerId, amount]) => ({ playerId, amount }))
    .sort((a, b) => bySeat(a.playerId, b.playerId));
};

/** Total money in a set of pots. Used by callers to assert conservation. */
export const totalPotAmount = (pots: readonly Pot[]): number =>
  pots.reduce((sum, pot) => sum + pot.amount, 0);
