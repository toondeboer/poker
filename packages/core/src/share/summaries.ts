import { formatPlace, PayoutStructure } from "../payouts/payoutStructure";
import { LeaderboardStanding } from "../leaderboard/standings";

/**
 * Plain-text summaries a host can paste into the group chat.
 *
 * **Plain text on purpose** — these land in WhatsApp or iMessage, which render
 * no markdown, so anything clever turns into literal asterisks. Amounts are
 * bare numbers for the same reason the screens show them that way: this package
 * never learns which currency is being collected.
 *
 * Neither summary appends a link to the app. The host is telling their table
 * what the payouts are, not advertising — a trailing plug would make the
 * message read as spam. The timer's own share promotes the app because that is
 * what it is for.
 */

/** "Payouts — 20 buy-in, 8 players", then a line per place. */
export const formatPayoutSummary = (params: {
  structure: PayoutStructure;
  buyIn: number;
  entrants: number;
}): string => {
  const { structure, buyIn, entrants } = params;
  const rebuys = structure.totalEntries - entrants;

  const lines: string[] = [];
  let header = `Payouts — ${buyIn} buy-in, ${entrants} ${entrants === 1 ? "player" : "players"}`;
  if (rebuys > 0) {
    header += `, ${rebuys} ${rebuys === 1 ? "rebuy" : "rebuys"}`;
  }
  lines.push(header);
  if (structure.addOnPool > 0) {
    lines.push(`Add-ons: ${structure.addOnPool} into the pool`);
  }
  lines.push("");

  for (const payout of structure.payouts) {
    lines.push(`${formatPlace(payout.place)}  ${payout.amount}`);
  }

  lines.push("");
  lines.push(`Prize pool ${structure.prizePool}`);
  if (structure.bountyPerKnockout > 0) {
    lines.push(`Bounty ${structure.bountyPerKnockout} per knockout`);
  }

  return lines.join("\n");
};

/** Most rows a shared leaderboard lists before it stops being readable in a chat. */
export const MAX_SHARED_STANDINGS = 10;

/**
 * "Leaderboard — 6 games", then a ranked line per player.
 *
 * Players with no games are left out: they're on the roster but have nothing to
 * report, and a chat message padded with "0 games" rows buries the people who
 * actually turned up.
 */
export const formatStandingsSummary = (params: {
  standings: LeaderboardStanding[];
  gamesRecorded: number;
}): string => {
  const { standings, gamesRecorded } = params;
  const played = standings.filter((standing) => standing.gamesPlayed > 0);

  const lines: string[] = [
    `Leaderboard — ${gamesRecorded} ${gamesRecorded === 1 ? "game" : "games"}`,
    "",
  ];

  if (played.length === 0) {
    lines.push("No games recorded yet.");
    return lines.join("\n");
  }

  played.slice(0, MAX_SHARED_STANDINGS).forEach((standing, index) => {
    const parts = [
      `${standing.gamesPlayed} ${standing.gamesPlayed === 1 ? "game" : "games"}`,
    ];
    if (standing.wins > 0) {
      parts.unshift(`${standing.wins} ${standing.wins === 1 ? "win" : "wins"}`);
    }
    if (standing.totalWon > 0) parts.push(`won ${standing.totalWon}`);
    // Absent rather than zero for a board of hand-recorded games: nobody can
    // say who collected which bounties after the fact, so there is nothing to
    // share.
    if (standing.knockouts > 0) {
      parts.push(
        `${standing.knockouts} KO${standing.knockouts === 1 ? "" : "s"}`,
      );
    }
    lines.push(`${index + 1}. ${standing.name} — ${parts.join(", ")}`);
  });

  const hidden = played.length - MAX_SHARED_STANDINGS;
  if (hidden > 0) {
    lines.push(`…and ${hidden} more`);
  }

  return lines.join("\n");
};
