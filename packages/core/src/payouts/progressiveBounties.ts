/**
 * Progressive bounties: the bounty on your head grows every time you take
 * somebody out.
 *
 * A flat bounty is a fixed amount paid for each elimination, and it is the
 * right default — it is one number, everybody understands it, and the cash
 * changes hands at the table. A progressive bounty splits each elimination in
 * two: **half of the busted player's bounty is paid in cash, and half is added
 * to the bounty on the winner's own head**. Whoever is knocking people out
 * becomes worth more to knock out, which is the whole appeal: the chip leader
 * is a target rather than an unassailable position.
 *
 * It is played as PKO in tournaments, and it is exactly the kind of thing a
 * home game cannot run on paper — the bounty on each head changes a dozen
 * times an evening, and nobody is going to keep that ledger by hand between
 * hands. It only became possible here once the app started tracking who
 * knocked out whom.
 *
 * Every amount is whole units. Money is not divisible past a note, and a
 * ledger that produces 2.5 leaves somebody arguing at the end of the night.
 */

/** Who is worth what, and who has collected what, at one moment. */
export type BountyLedger = {
  /** The bounty currently on each player's head. */
  heads: Record<string, number>;
  /** Cash collected so far, per player. */
  cash: Record<string, number>;
  /**
   * Money that reached nobody.
   *
   * A pot can end up with no claimant — everyone eligible folded — and the
   * bounty on the head of whoever busted into it has nowhere to go. It is
   * tracked rather than dropped so the ledger still balances against what was
   * put in, which is the only way to know it is right.
   */
  unclaimed: number;
};

/** Everybody starts worth the same. */
export const createBountyLedger = (
  playerIds: readonly string[],
  startingBounty: number,
): BountyLedger => {
  const heads: Record<string, number> = {};
  for (const playerId of playerIds) heads[playerId] = startingBounty;
  return { heads, cash: {}, unclaimed: 0 };
};

/**
 * Split an amount between the people who share it.
 *
 * Floor each share and hand the odd units out one at a time in order, which is
 * the same rule the pot itself splits by — and the order is already the seat
 * order the pot winners came in, so the odd unit goes to the same player it
 * would have gone to at the table.
 */
const shareOut = (amount: number, count: number): number[] => {
  const share = Math.floor(amount / count);
  const remainder = amount - share * count;
  return Array.from({ length: count }, (_, index) =>
    index < remainder ? share + 1 : share,
  );
};

/**
 * One elimination.
 *
 * `by` is who won the pot the busted player's last chips were in — empty when
 * nobody could claim it. The busted player's head is emptied either way: they
 * are out, and leaving a bounty on an empty seat would let it be collected
 * twice if they rebought.
 *
 * **The odd unit goes to the cash half, not the head.** Somebody has to be
 * handed money at the table tonight, and rounding in favour of the pocket is
 * both the friendlier answer and the one that keeps the arithmetic visible:
 * a bounty of 5 pays 3 now and puts 2 on the winner's head.
 */
export const applyKnockout = (
  ledger: BountyLedger,
  knockout: { playerId: string; by: readonly string[] },
): BountyLedger => {
  const head = ledger.heads[knockout.playerId] ?? 0;
  const heads = { ...ledger.heads, [knockout.playerId]: 0 };

  if (knockout.by.length === 0) {
    return {
      heads,
      cash: { ...ledger.cash },
      unclaimed: ledger.unclaimed + head,
    };
  }

  const toHeads = Math.floor(head / 2);
  const toCash = head - toHeads;
  const cashShares = shareOut(toCash, knockout.by.length);
  const headShares = shareOut(toHeads, knockout.by.length);

  const cash = { ...ledger.cash };
  knockout.by.forEach((playerId, index) => {
    // Nothing is written for a share of nothing — a bounty of zero, or a head
    // that was already empty. An entry reading 0 is not the same as no entry,
    // and it would show up as somebody who "collected" a bounty.
    if (cashShares[index] > 0) {
      cash[playerId] = (cash[playerId] ?? 0) + cashShares[index];
    }
    if (headShares[index] > 0) {
      heads[playerId] = (heads[playerId] ?? 0) + headShares[index];
    }
  });

  return { heads, cash, unclaimed: ledger.unclaimed };
};

/**
 * The last player standing collects the bounty on their own head.
 *
 * Nobody is left to knock them out, and the money is theirs — it came out of
 * their own buy-in in the first place. Without this the winner of a
 * progressive tournament is quietly short by however much their head had grown,
 * which in a long game is the largest bounty on the table.
 */
export const awardFinalBounty = (
  ledger: BountyLedger,
  winnerId: string,
): BountyLedger => {
  const head = ledger.heads[winnerId] ?? 0;
  if (head === 0) return ledger;
  return {
    heads: { ...ledger.heads, [winnerId]: 0 },
    cash: { ...ledger.cash, [winnerId]: (ledger.cash[winnerId] ?? 0) + head },
    unclaimed: ledger.unclaimed,
  };
};

/**
 * Run a whole game's eliminations through, in the order they happened.
 *
 * Order matters and cannot be recovered afterwards: a bounty collected early
 * grows the head that a later elimination pays out from. This is the reason
 * the game has to be dealt by the app for progressive bounties to work at all.
 */
export const runBounties = ({
  playerIds,
  startingBounty,
  knockouts,
  winnerId,
}: {
  playerIds: readonly string[];
  startingBounty: number;
  knockouts: readonly { playerId: string; by: readonly string[] }[];
  /** The last player standing, if the game finished. */
  winnerId?: string;
}): BountyLedger => {
  let ledger = createBountyLedger(playerIds, startingBounty);
  for (const knockout of knockouts) ledger = applyKnockout(ledger, knockout);
  return winnerId ? awardFinalBounty(ledger, winnerId) : ledger;
};

/** Everything the ledger is holding, which must equal what was paid in. */
export const ledgerTotal = (ledger: BountyLedger): number => {
  const sum = (record: Record<string, number>) =>
    Object.values(record).reduce((total, value) => total + value, 0);
  return sum(ledger.heads) + sum(ledger.cash) + ledger.unclaimed;
};
