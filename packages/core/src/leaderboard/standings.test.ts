import { describe, it, expect } from "vitest";
import { computeStandings } from "./standings";
import {
  createGameResult,
  createPlayer,
  GameResult,
  Player,
} from "./gameResult";

const players: Player[] = [
  createPlayer({ id: "a", name: "Ana" }),
  createPlayer({ id: "b", name: "Ben" }),
  createPlayer({ id: "c", name: "Cy" }),
];

let nextId = 0;
const game = (
  playerIds: string[],
  placings: { playerId: string; place: number; winnings: number }[],
): GameResult =>
  createGameResult({
    id: `g${nextId++}`,
    playerIds,
    placings,
    buyIn: 20,
    bounty: 0,
    now: nextId,
  });

const byId = (standings: ReturnType<typeof computeStandings>, id: string) => {
  const found = standings.find((s) => s.playerId === id);
  if (!found) throw new Error(`no standing for ${id}`);
  return found;
};

describe("computeStandings", () => {
  it("returns every player, at zero, when nothing has been played", () => {
    const standings = computeStandings(players, []);
    expect(standings).toHaveLength(3);
    for (const standing of standings) {
      expect(standing.gamesPlayed).toBe(0);
      expect(standing.wins).toBe(0);
      expect(standing.totalWon).toBe(0);
    }
  });

  it("counts games played for everyone who bought in, not just who cashed", () => {
    // The whole reason playerIds exists: Cy played and won nothing, and must
    // still appear with a game to their name.
    const standings = computeStandings(players, [
      game(["a", "b", "c"], [{ playerId: "a", place: 1, winnings: 60 }]),
    ]);
    expect(byId(standings, "c").gamesPlayed).toBe(1);
    expect(byId(standings, "c").cashes).toBe(0);
    expect(byId(standings, "c").totalWon).toBe(0);
  });

  it("aggregates wins, podiums, cashes and money across games", () => {
    const standings = computeStandings(players, [
      game(
        ["a", "b", "c"],
        [
          { playerId: "a", place: 1, winnings: 60 },
          { playerId: "b", place: 2, winnings: 40 },
        ],
      ),
      game(
        ["a", "b", "c"],
        [
          { playerId: "a", place: 1, winnings: 50 },
          { playerId: "c", place: 3, winnings: 20 },
        ],
      ),
    ]);
    const ana = byId(standings, "a");
    expect(ana.gamesPlayed).toBe(2);
    expect(ana.wins).toBe(2);
    expect(ana.podiums).toBe(2);
    expect(ana.cashes).toBe(2);
    expect(ana.totalWon).toBe(110);

    const cy = byId(standings, "c");
    expect(cy.wins).toBe(0);
    expect(cy.podiums).toBe(1);
    expect(cy.totalWon).toBe(20);
  });

  it("counts a fourth-place finish as a cash but not a podium", () => {
    const four = [...players, createPlayer({ id: "d", name: "Di" })];
    const standings = computeStandings(four, [
      game(
        ["a", "b", "c", "d"],
        [{ playerId: "d", place: 4, winnings: 10 }],
      ),
    ]);
    expect(byId(standings, "d").cashes).toBe(1);
    expect(byId(standings, "d").podiums).toBe(0);
  });

  it("does not count a ranked-but-unpaid finish as a cash", () => {
    // RecordResultSheet ranks the top three even when only one place pays, so
    // the podium tie-break has something to work from in a small field. Those
    // finishes win nothing and must not read as cashes.
    const standings = computeStandings(players, [
      game(
        ["a", "b", "c"],
        [
          { playerId: "a", place: 1, winnings: 60 },
          { playerId: "b", place: 2, winnings: 0 },
        ],
      ),
    ]);
    expect(byId(standings, "b").cashes).toBe(0);
    expect(byId(standings, "b").podiums).toBe(1);
    expect(byId(standings, "a").cashes).toBe(1);
  });

  it("ranks by wins first", () => {
    const standings = computeStandings(players, [
      game(["a", "b", "c"], [{ playerId: "b", place: 1, winnings: 10 }]),
      game(["a", "b", "c"], [{ playerId: "b", place: 1, winnings: 10 }]),
      game(["a", "b", "c"], [{ playerId: "a", place: 1, winnings: 999 }]),
    ]);
    expect(standings.map((s) => s.playerId)).toEqual(["b", "a", "c"]);
  });

  it("breaks a wins tie on podiums, then money, then fewer games", () => {
    const onPodiums = computeStandings(players, [
      game(
        ["a", "b", "c"],
        [
          { playerId: "a", place: 1, winnings: 10 },
          { playerId: "b", place: 2, winnings: 10 },
        ],
      ),
      game(["a", "b", "c"], [{ playerId: "b", place: 1, winnings: 10 }]),
    ]);
    // Both on one win; Ben has two podiums to Ana's one.
    expect(onPodiums.slice(0, 2).map((s) => s.playerId)).toEqual(["b", "a"]);

    const onMoney = computeStandings(players, [
      game(["a", "b", "c"], [{ playerId: "a", place: 1, winnings: 100 }]),
      game(["a", "b", "c"], [{ playerId: "b", place: 1, winnings: 50 }]),
    ]);
    expect(onMoney.slice(0, 2).map((s) => s.playerId)).toEqual(["a", "b"]);
  });

  it("puts a player who needed fewer games ahead when all else is equal", () => {
    const standings = computeStandings(
      [
        createPlayer({ id: "a", name: "Ana" }),
        createPlayer({ id: "b", name: "Ben" }),
      ],
      [
        game(["a", "b"], [{ playerId: "a", place: 1, winnings: 20 }]),
        game(["b"], [{ playerId: "b", place: 1, winnings: 20 }]),
      ],
    );
    // Ana: 1 win / 2 games. Ben: 1 win / 2 games. Equal — falls through to name.
    expect(standings.map((s) => s.playerId)).toEqual(["a", "b"]);
  });

  it("falls back to name, then id, so the order is total and stable", () => {
    const tied = [
      createPlayer({ id: "z", name: "Zoe" }),
      createPlayer({ id: "m", name: "Al" }),
      createPlayer({ id: "n", name: "Al" }),
    ];
    const standings = computeStandings(tied, []);
    expect(standings.map((s) => s.playerId)).toEqual(["m", "n", "z"]);
    // Re-running must give the identical order — a board that reshuffles
    // between renders on equal rows looks broken.
    expect(computeStandings(tied, []).map((s) => s.playerId)).toEqual([
      "m",
      "n",
      "z",
    ]);
  });

  it("ignores placings for a player who has been removed from the roster", () => {
    // The game still happened, and the remaining players' history must survive
    // someone leaving the group.
    const standings = computeStandings(
      [createPlayer({ id: "a", name: "Ana" })],
      [
        game(
          ["a", "gone"],
          [
            { playerId: "gone", place: 1, winnings: 60 },
            { playerId: "a", place: 2, winnings: 40 },
          ],
        ),
      ],
    );
    expect(standings).toHaveLength(1);
    expect(byId(standings, "a").gamesPlayed).toBe(1);
    expect(byId(standings, "a").totalWon).toBe(40);
  });

  it("counts a player listed twice in one game only once", () => {
    const standings = computeStandings(players, [
      game(["a", "a", "b"], [{ playerId: "a", place: 1, winnings: 10 }]),
    ]);
    expect(byId(standings, "a").gamesPlayed).toBe(1);
  });

  it("does not invent standings for players who aren't on the roster", () => {
    const standings = computeStandings(
      [],
      [game(["a"], [{ playerId: "a", place: 1, winnings: 10 }])],
    );
    expect(standings).toEqual([]);
  });
});
