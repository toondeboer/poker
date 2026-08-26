import { describe, it, expect } from "vitest";
import {
  formatPayoutSummary,
  formatStandingsSummary,
  MAX_SHARED_STANDINGS,
} from "./summaries";
import { computePayouts, PayoutOptions } from "../payouts/payoutStructure";
import { computeStandings } from "../leaderboard/standings";
import type { LeaderboardStanding } from "../leaderboard/standings";
import { createGameResult, createPlayer } from "../leaderboard/gameResult";

const summarise = (options: PayoutOptions) => {
  const structure = computePayouts(options);
  if (!structure) throw new Error("expected a payout structure");
  return formatPayoutSummary({
    structure,
    buyIn: options.buyIn,
    entrants: options.entrants,
  });
};

describe("formatPayoutSummary", () => {
  it("reads as a message you'd actually paste into a group chat", () => {
    expect(summarise({ buyIn: 20, entrants: 8, denomination: 5 })).toBe(
      [
        "Payouts — 20 buy-in, 8 players",
        "",
        "1st  80",
        "2nd  50",
        "3rd  30",
        "",
        "Prize pool 160",
      ].join("\n"),
    );
  });

  it("names the bounty only when there is one", () => {
    expect(summarise({ buyIn: 20, entrants: 8 })).not.toContain("Bounty");
    expect(summarise({ buyIn: 20, entrants: 8, bounty: 5 })).toContain(
      "Bounty 5 per knockout",
    );
  });

  it("mentions rebuys and add-ons only when they happened", () => {
    const plain = summarise({ buyIn: 20, entrants: 8 });
    expect(plain).not.toContain("rebuy");
    expect(plain).not.toContain("Add-ons");

    const busy = summarise({
      buyIn: 20,
      entrants: 8,
      rebuys: 4,
      addOns: 3,
      addOnPrice: 10,
    });
    expect(busy).toContain("8 players, 4 rebuys");
    expect(busy).toContain("Add-ons: 30 into the pool");
  });

  it("gets the singulars right", () => {
    const solo = summarise({ buyIn: 20, entrants: 1, rebuys: 1 });
    expect(solo).toContain("1 player, 1 rebuy");
  });

  it("lists exactly the places that are paid", () => {
    const summary = summarise({ buyIn: 20, entrants: 3 });
    expect(summary).toContain("1st  60");
    expect(summary).not.toContain("2nd");
  });

  it("contains no markdown, since chat apps render none of it", () => {
    const summary = summarise({
      buyIn: 20,
      entrants: 12,
      bounty: 5,
      rebuys: 2,
    });
    expect(summary).not.toMatch(/[*_`#|]/);
  });
});

const player = (id: string, name: string) => createPlayer({ id, name });

const game = (
  id: string,
  playerIds: string[],
  placings: { playerId: string; place: number; winnings: number }[],
) =>
  createGameResult({
    id,
    playerIds,
    placings,
    buyIn: 20,
    bounty: 0,
    now: 1,
  });

describe("formatStandingsSummary", () => {
  const roster = [player("a", "Ana"), player("b", "Ben"), player("c", "Cy")];
  const results = [
    game(
      "g1",
      ["a", "b", "c"],
      [
        { playerId: "a", place: 1, winnings: 80 },
        { playerId: "b", place: 2, winnings: 50 },
      ],
    ),
    game("g2", ["a", "b", "c"], [{ playerId: "a", place: 1, winnings: 90 }]),
  ];

  it("ranks the players who have actually played", () => {
    const summary = formatStandingsSummary({
      standings: computeStandings(roster, results),
      gamesRecorded: results.length,
    });
    expect(summary).toBe(
      [
        "Leaderboard — 2 games",
        "",
        "1. Ana — 2 wins, 2 games, won 170",
        "2. Ben — 2 games, won 50",
        "3. Cy — 2 games",
      ].join("\n"),
    );
  });

  it("leaves out roster members with no games", () => {
    const withNewcomer = [...roster, player("d", "Di")];
    const summary = formatStandingsSummary({
      standings: computeStandings(withNewcomer, results),
      gamesRecorded: results.length,
    });
    // Di is on the roster and belongs on the in-app board, but padding a chat
    // message with "0 games" buries the people who turned up.
    expect(summary).not.toContain("Di");
  });

  it("says so when nothing has been recorded", () => {
    const summary = formatStandingsSummary({
      standings: computeStandings(roster, []),
      gamesRecorded: 0,
    });
    expect(summary).toContain("Leaderboard — 0 games");
    expect(summary).toContain("No games recorded yet.");
  });

  it("caps the list and says how many were left off", () => {
    const many = Array.from({ length: MAX_SHARED_STANDINGS + 3 }, (_, i) =>
      player(`p${i}`, `P${i}`),
    );
    const played = many.map((p, i) =>
      game(`g${i}`, [p.id], [{ playerId: p.id, place: 1, winnings: 10 }]),
    );
    const summary = formatStandingsSummary({
      standings: computeStandings(many, played),
      gamesRecorded: played.length,
    });
    expect(summary.split("\n").filter((l) => /^\d+\. /.test(l))).toHaveLength(
      MAX_SHARED_STANDINGS,
    );
    expect(summary).toContain("…and 3 more");
  });

  it("contains no markdown", () => {
    const summary = formatStandingsSummary({
      standings: computeStandings(roster, results),
      gamesRecorded: results.length,
    });
    expect(summary).not.toMatch(/[*_`#|]/);
  });
});

describe("knockouts in a shared board", () => {
  it("mentions them when the app dealt the games", () => {
    const standings: LeaderboardStanding[] = [
      {
        playerId: "a",
        name: "Ann",
        gamesPlayed: 3,
        wins: 2,
        podiums: 2,
        cashes: 2,
        totalWon: 120,
        knockouts: 5,
        bountiesWon: 25,
      },
    ];
    expect(formatStandingsSummary({ standings, gamesRecorded: 3 })).toContain("5 KOs");
  });

  it("says nothing about them for a board recorded by hand", () => {
    // Zero here means "nobody was watching", not "nobody knocked anybody out".
    const standings: LeaderboardStanding[] = [
      {
        playerId: "a",
        name: "Ann",
        gamesPlayed: 3,
        wins: 2,
        podiums: 2,
        cashes: 2,
        totalWon: 120,
        knockouts: 0,
        bountiesWon: 0,
      },
    ];
    expect(formatStandingsSummary({ standings, gamesRecorded: 3 })).not.toContain("KO");
  });

  it("counts one knockout in the singular", () => {
    const standings: LeaderboardStanding[] = [
      {
        playerId: "a",
        name: "Ann",
        gamesPlayed: 1,
        wins: 1,
        podiums: 1,
        cashes: 1,
        totalWon: 40,
        knockouts: 1,
        bountiesWon: 5,
      },
    ];
    expect(formatStandingsSummary({ standings, gamesRecorded: 3 })).toContain("1 KO");
    expect(formatStandingsSummary({ standings, gamesRecorded: 3 })).not.toContain("1 KOs");
  });
});

describe("sharing a bounty tournament", () => {
  const options: PayoutOptions = { buyIn: 20, entrants: 8, bounty: 5 };

  it("says what a flat bounty pays", () => {
    const structure = computePayouts(options)!;
    expect(
      formatPayoutSummary({ structure, buyIn: 20, entrants: 8 }),
    ).toContain("Bounty 5 per knockout");
  });

  it("says what a progressive one does instead", () => {
    // Somebody reading this in a group chat is deciding what to bring; the two
    // formats pay differently enough that one line cannot describe both.
    const structure = computePayouts({
      ...options,
      bountyMode: "progressive",
    })!;
    const summary = formatPayoutSummary({ structure, buyIn: 20, entrants: 8 });
    expect(summary).toContain("Progressive bounty");
    expect(summary).not.toContain("per knockout");
  });
});
