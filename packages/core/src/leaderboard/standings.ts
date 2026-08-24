import { GameResult, Player } from "./gameResult";

/** One row of the leaderboard. */
export type LeaderboardStanding = {
  playerId: string;
  name: string;
  /** Games bought into, whether or not they cashed. */
  gamesPlayed: number;
  /** First-place finishes — what the board is ranked by. */
  wins: number;
  /** Top-three finishes, used to break a tie on wins. */
  podiums: number;
  /**
   * Games finishing in a place that actually won money.
   *
   * Not simply "was ranked": `RecordResultSheet` deliberately records finishes
   * past the paid places so the podium tie-break has something to work from in
   * small fields, and those win nothing. Counting them here would make "cashes"
   * mean "was ranked", which is a different and much less interesting fact.
   */
  cashes: number;
  /**
   * Prize money won.
   *
   * Deliberately **not** net profit. Buy-ins paid are knowable, but bounty
   * winnings are not (see {@link GameResult.bounty}), so subtracting stakes
   * would produce a confidently wrong number for anyone in a bounty game.
   * "Won" is a figure the app can actually stand behind.
   */
  totalWon: number;
};

/**
 * Aggregate results into a ranked leaderboard.
 *
 * Ranked by **wins**, which is the question the feature exists to answer.
 * Every tie-break after that is deterministic and total — podiums, then money,
 * then fewer games to get there, then name — because a leaderboard that
 * reorders itself between renders on equal rows looks broken, and a stable
 * order is the only thing that makes this testable.
 *
 * Players with no games are included, at the bottom. Someone just added to the
 * roster should appear on the board rather than vanish until their first game.
 *
 * Placings referencing a player who is no longer on the roster are skipped:
 * removing someone shouldn't corrupt the history of the games they played in,
 * and their entry in `playerIds` still counts toward everyone else's field
 * size.
 */
export const computeStandings = (
  players: Player[],
  results: GameResult[],
): LeaderboardStanding[] => {
  const standings = new Map<string, LeaderboardStanding>();
  for (const player of players) {
    standings.set(player.id, {
      playerId: player.id,
      name: player.name,
      gamesPlayed: 0,
      wins: 0,
      podiums: 0,
      cashes: 0,
      totalWon: 0,
    });
  }

  for (const result of results) {
    // A player listed twice in one game must not count twice. Tracked with a
    // `seen` set while walking the array rather than by iterating the set
    // itself: this package sets no `target`, so TypeScript compiles as ES5 and
    // rejects iterating a Set or Map directly.
    const counted = new Set<string>();
    for (const playerId of result.playerIds) {
      if (counted.has(playerId)) continue;
      counted.add(playerId);
      const standing = standings.get(playerId);
      if (standing) standing.gamesPlayed += 1;
    }

    for (const placing of result.placings) {
      const standing = standings.get(placing.playerId);
      if (!standing) continue;
      if (placing.winnings > 0) standing.cashes += 1;
      standing.totalWon += placing.winnings;
      if (placing.place === 1) standing.wins += 1;
      if (placing.place <= 3) standing.podiums += 1;
    }
  }

  const rows: LeaderboardStanding[] = [];
  standings.forEach((standing) => rows.push(standing));
  return rows.sort(compareStandings);
};

const compareStandings = (
  a: LeaderboardStanding,
  b: LeaderboardStanding,
): number => {
  if (a.wins !== b.wins) return b.wins - a.wins;
  if (a.podiums !== b.podiums) return b.podiums - a.podiums;
  if (a.totalWon !== b.totalWon) return b.totalWon - a.totalWon;
  if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
  // A plain comparison rather than localeCompare: this only has to be stable
  // and identical everywhere, and locale-aware collation is neither.
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
};
