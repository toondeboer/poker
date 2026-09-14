import { GameResult, Player } from "./gameResult";

/**
 * One row of the leaderboard.
 *
 * **No money on this row, deliberately.** It carried `totalWon`, `bountiesWon`
 * and a `cashes` count until the 1.2.0 rating work. A board that accumulates
 * what each player has won across sessions is a bankroll tracker, and the
 * comparable ones on the App Store are rated 18+ where a one-shot payout
 * calculator is 4+ — so the calculator kept its job and the board gave up money
 * entirely. See the Gambling classification section in `ROADMAP.md`.
 *
 * `cashes` went with it rather than being redefined. It meant "finished in a
 * place that actually paid", which needed the prize table to be knowable; the
 * only thing left to redefine it as is "was ranked", which is a different and
 * much less interesting fact wearing the old name.
 */
export type LeaderboardStanding = {
  playerId: string;
  name: string;
  /** Games played, whether or not they placed. */
  gamesPlayed: number;
  /** First-place finishes — what the board is ranked by. */
  wins: number;
  /** Top-three finishes, used to break a tie on wins. */
  podiums: number;
};

/**
 * Aggregate results into a ranked leaderboard.
 *
 * Ranked by **wins**, which is the question the feature exists to answer.
 * Every tie-break after that is deterministic and total — podiums, then fewer
 * games to get there, then name, then id — because a leaderboard that reorders
 * itself between renders on equal rows looks broken, and a stable order is the
 * only thing that makes this testable. Money used to sit between podiums and
 * games played; the chain is still total without it.
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

    // Deduplicated for the same reason `playerIds` is: `validateGameResult`
    // rejects a repeated placing, but nothing re-validates on the way *out* of
    // storage, so a hand-edited or half-written record could still carry one.
    // Left alone it would double a player's wins and podiums off a single game
    // while `gamesPlayed` counted it once.
    const placed = new Set<string>();
    for (const placing of result.placings) {
      const standing = standings.get(placing.playerId);
      if (!standing) continue;
      if (placed.has(placing.playerId)) continue;
      placed.add(placing.playerId);
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
  if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
  // A plain comparison rather than localeCompare: this only has to be stable
  // and identical everywhere, and locale-aware collation is neither.
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
};
