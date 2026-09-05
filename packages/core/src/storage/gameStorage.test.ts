import { describe, expect, it } from "vitest";
import { createGameStorage, type StoredGame } from "./gameStorage";
import { createMemoryAdapter, createFailingAdapter } from "./testAdapters";
import { createSession, startNextHand } from "../poker/session";
import { createRandom } from "../poker/cards";

const SETUP = {
  players: ["a", "b", "c"],
  startingStack: 500,
  smallBlind: 5,
  bigBlind: 10,
  groupId: "g1",
};

const between = createSession({
  players: SETUP.players,
  startingStack: SETUP.startingStack,
});

const midHand = startNextHand(between, {
  smallBlind: SETUP.smallBlind,
  bigBlind: SETUP.bigBlind,
  random: createRandom(5),
});

/**
 * A hand in progress with somebody already knocked out — so the session holds
 * a seat the hand does not. Their chips (none) still have to be counted, which
 * is a path every all-players-in fixture misses.
 */
const FOUR = { ...SETUP, players: ["a", "b", "c", "d"] };
const withBustedPlayer = (() => {
  const base = createSession({
    players: FOUR.players,
    startingStack: FOUR.startingStack,
  });
  // "d" is out, and their chips went to "a" — as they must have. The first
  // draft of this fixture simply zeroed them, and the validator rejected it
  // for exactly the right reason: 500 chips had left the table.
  const knockedOut = {
    ...base,
    seats: base.seats.map((seat) =>
      seat.playerId === "d"
        ? { ...seat, stack: 0 }
        : seat.playerId === "a"
          ? { ...seat, stack: seat.stack + FOUR.startingStack }
          : seat,
    ),
    bustOrder: ["d"],
    // Whoever took their chips took them out — the same fact from the other
    // side, and the validator now insists the two agree.
    knockouts: [{ playerId: "d", by: ["a"] }],
  };
  return startNextHand(knockedOut, {
    smallBlind: FOUR.smallBlind,
    bigBlind: FOUR.bigBlind,
    random: createRandom(11),
  });
})();

const stored = (session = between, recorded = false): StoredGame => ({
  setup: SETUP,
  session,
  recorded,
});

const seeded = (raw: string) =>
  createGameStorage(createMemoryAdapter({ game_session: raw }));

describe("createGameStorage", () => {
  it("has nothing when nothing is stored", async () => {
    expect(await createGameStorage(createMemoryAdapter()).loadGame()).toBeNull();
  });

  it("round-trips a game between hands", async () => {
    const storage = createGameStorage(createMemoryAdapter());
    await storage.saveGame(stored());
    expect(await storage.loadGame()).toEqual(stored());
  });

  it("round-trips a hand in progress, cards and all", async () => {
    const storage = createGameStorage(createMemoryAdapter());
    await storage.saveGame(stored(midHand));
    const loaded = await storage.loadGame();
    expect(loaded?.session.hand?.board).toEqual(midHand.hand?.board);
    expect(loaded?.session.hand?.seats[0].hole).toEqual(
      midHand.hand?.seats[0].hole,
    );
    expect(loaded?.session.hand?.deck).toHaveLength(
      midHand.hand?.deck.length ?? -1,
    );
  });

  it("remembers whether the game was already recorded", async () => {
    const storage = createGameStorage(createMemoryAdapter());
    await storage.saveGame(stored(between, true));
    expect((await storage.loadGame())?.recorded).toBe(true);
  });

  it("clears back to nothing", async () => {
    const adapter = createMemoryAdapter();
    const storage = createGameStorage(adapter);
    await storage.saveGame(stored());
    await storage.clearGame();
    expect(adapter.store.has("game_session")).toBe(false);
    expect(await storage.loadGame()).toBeNull();
  });

  it("gives up quietly when storage throws", async () => {
    expect(await createGameStorage(createFailingAdapter()).loadGame()).toBeNull();
  });
});

describe("a stored game is kept whole or not at all", () => {
  // The opposite of the leaderboard, deliberately: a season of results is
  // irreplaceable so one bad row is dropped and the rest kept, but a game is
  // one evening and a half-valid one pays the wrong person.

  it("drops a game whose chips no longer add up", async () => {
    // The check that earns its place: almost any corruption that matters
    // shows up as chips appearing or vanishing.
    const raw = JSON.stringify({
      setup: SETUP,
      session: {
        ...between,
        seats: [
          { playerId: "a", stack: 500 },
          { playerId: "b", stack: 500 },
          { playerId: "c", stack: 900 },
        ],
      },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("keeps a game mid-hand, where the chips are split between stacks and the pot", async () => {
    const storage = createGameStorage(createMemoryAdapter());
    await storage.saveGame(stored(midHand));
    expect(await storage.loadGame()).not.toBeNull();
  });

  it("drops a game whose seats are not the players it was set up with", async () => {
    const raw = JSON.stringify({
      setup: SETUP,
      session: {
        ...between,
        seats: [
          { playerId: "a", stack: 500 },
          { playerId: "stranger", stack: 500 },
          { playerId: "c", stack: 500 },
        ],
      },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("drops a game whose seats have been reordered", async () => {
    // Seat order is the button's frame of reference; shuffling it moves the
    // blinds to the wrong people.
    const raw = JSON.stringify({
      setup: SETUP,
      session: {
        ...between,
        seats: [
          { playerId: "c", stack: 500 },
          { playerId: "b", stack: 500 },
          { playerId: "a", stack: 500 },
        ],
      },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("drops a game whose button is not a seat", async () => {
    const raw = JSON.stringify({
      setup: SETUP,
      session: { ...between, buttonIndex: 7 },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("drops fractional or negative stacks", async () => {
    for (const stack of [166.5, -1]) {
      const raw = JSON.stringify({
        setup: SETUP,
        session: {
          ...between,
          seats: [
            { playerId: "a", stack },
            { playerId: "b", stack: 500 },
            { playerId: "c", stack: 500 },
          ],
        },
        recorded: false,
      });
      expect(await seeded(raw).loadGame()).toBeNull();
    }
  });

  it("refuses a setup that could not have started a game", async () => {
    const bad = [
      { ...SETUP, players: ["a"] },
      { ...SETUP, players: ["a", "a", "c"] },
      { ...SETUP, startingStack: 0 },
      { ...SETUP, smallBlind: 0 },
      { ...SETUP, bigBlind: 5 },
    ];
    for (const setup of bad) {
      const raw = JSON.stringify({ setup, session: between, recorded: false });
      expect(await seeded(raw).loadGame()).toBeNull();
    }
  });

  it("drops a session that is not shaped like one", async () => {
    // Every early return in the consistency check, so a malformed session
    // cannot slip through on a field nobody thought to look at.
    const malformed: unknown[] = [
      "not an object",
      null,
      { ...between, seats: "nope" },
      { ...between, handsPlayed: -1 },
      { ...between, handsPlayed: 1.5 },
      { ...between, bustOrder: "nope" },
      { ...between, buttonIndex: -1 },
      { ...between, seats: [{ playerId: "a", stack: 500 }, "nope", { playerId: "c", stack: 500 }] },
      { ...between, seats: [{ stack: 500 }, { playerId: "b", stack: 500 }, { playerId: "c", stack: 500 }] },
      { ...between, hand: "not an object" },
      { ...between, hand: { ...midHand.hand, seats: "nope" } },
      { ...between, hand: { ...midHand.hand, seats: ["nope"] } },
      {
        ...between,
        hand: {
          ...midHand.hand,
          seats: (midHand.hand?.seats ?? []).map((seat, i) =>
            i === 0 ? { ...seat, committed: 2.5 } : seat,
          ),
        },
      },
    ];
    for (const session of malformed) {
      const raw = JSON.stringify({ setup: SETUP, session, recorded: false });
      expect(await seeded(raw).loadGame()).toBeNull();
    }
  });

  it("treats a missing or unusable group as no group", async () => {
    // A game can be played without a leaderboard group; only a string is one.
    for (const groupId of [undefined, null, 42]) {
      const raw = JSON.stringify({
        setup: { ...SETUP, groupId },
        session: between,
        recorded: false,
      });
      expect((await seeded(raw).loadGame())?.setup.groupId).toBeNull();
    }
  });

  it("refuses a setup that is not shaped like one", async () => {
    const malformed: unknown[] = [
      "not an object",
      { ...SETUP, players: "nope" },
      { ...SETUP, players: ["a", 42, "c"] },
      { ...SETUP, startingStack: 1.5 },
      { ...SETUP, smallBlind: "5" },
      { ...SETUP, bigBlind: 2.5 },
    ];
    for (const setup of malformed) {
      const raw = JSON.stringify({ setup, session: between, recorded: false });
      expect(await seeded(raw).loadGame()).toBeNull();
    }
  });

  it("counts a knocked-out player who is sitting the hand out", async () => {
    // The session holds four seats; the hand only deals to three. The fourth
    // still has to be counted, or the chip total comes up short and a
    // perfectly good game is thrown away.
    const storage = createGameStorage(createMemoryAdapter());
    await storage.saveGame({
      setup: FOUR,
      session: withBustedPlayer,
      recorded: false,
    });
    const loaded = await storage.loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded?.session.hand?.seats).toHaveLength(3);
    expect(loaded?.session.seats).toHaveLength(4);
  });

  it("still catches a short total when somebody is sitting out", async () => {
    const raw = JSON.stringify({
      setup: FOUR,
      session: {
        ...withBustedPlayer,
        seats: withBustedPlayer.seats.map((seat) => ({ ...seat, stack: 1 })),
      },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("refuses a knocked-out player who still has chips", async () => {
    // Otherwise they are resurrected: `settle` only overwrites seats that were
    // in the hand, so the stack survives, `finishingOrder` lists them twice,
    // and the game can never end.
    const raw = JSON.stringify({
      setup: SETUP,
      session: {
        ...between,
        seats: [
          { playerId: "a", stack: 1000 },
          { playerId: "b", stack: 500 },
          { playerId: "c", stack: 0 },
        ],
        bustOrder: ["b"],
      },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("refuses a bust order naming people who never sat down, or naming one twice", async () => {
    for (const bustOrder of [["stranger"], ["b", "b"], [42]]) {
      const raw = JSON.stringify({
        setup: SETUP,
        session: { ...between, bustOrder },
        recorded: false,
      });
      expect(await seeded(raw).loadGame()).toBeNull();
    }
  });

  it("refuses a hand missing the bookkeeping the engine reads without checking", async () => {
    // roundBaseline missing throws from inside a state updater with no error
    // boundary — and the same blob reloads every launch, so the screen would
    // be permanently dead with no way to clear it.
    const withoutBaseline = { ...midHand.hand } as Record<string, unknown>;
    delete withoutBaseline.roundBaseline;
    const raw = JSON.stringify({
      setup: SETUP,
      session: { ...midHand, hand: withoutBaseline },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("refuses a hand where two seats share a player id", async () => {
    // startHand refuses duplicates because awards are paid by id: two seats
    // sharing one silently merge and lose chips at settle.
    const seats = midHand.hand!.seats.map((seat, i) =>
      i === 1 ? { ...seat, playerId: "a" } : seat,
    );
    const raw = JSON.stringify({
      setup: SETUP,
      session: { ...midHand, hand: { ...midHand.hand, seats } },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("refuses a hand seat with an unusable stack rather than reading it as zero", async () => {
    const seats = midHand.hand!.seats.map((seat, i) =>
      i === 0 ? { ...seat, stack: null } : seat,
    );
    const raw = JSON.stringify({
      setup: SETUP,
      session: { ...midHand, hand: { ...midHand.hand, seats } },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("refuses a hand whose cards do not make one deck", async () => {
    // The check that catches a slicing mistake anywhere in the deal: every
    // card accounted for, exactly once, across the board, the deck and every
    // hole.
    const dealt = midHand.hand!;
    for (const broken of [
      { ...dealt, deck: dealt.deck.slice(1) },
      { ...dealt, deck: [...dealt.deck, dealt.seats[0].hole[0]] },
      { ...dealt, board: [{ rank: 99, suit: "h" }] },
      { ...dealt, deck: "not cards" },
    ]) {
      const raw = JSON.stringify({
        setup: SETUP,
        session: { ...midHand, hand: broken },
        recorded: false,
      });
      expect(await seeded(raw).loadGame()).toBeNull();
    }
  });

  it("refuses a hand seat that is not one of the players who sat down", async () => {
    const seats = midHand.hand!.seats.map((seat, i) =>
      i === 1 ? { ...seat, playerId: "stranger" } : seat,
    );
    const raw = JSON.stringify({
      setup: SETUP,
      session: { ...midHand, hand: { ...midHand.hand, seats } },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("refuses a hand seat with no player id at all", async () => {
    const seats = midHand.hand!.seats.map((seat, i) =>
      i === 0 ? { stack: seat.stack, committed: seat.committed } : seat,
    );
    const raw = JSON.stringify({
      setup: SETUP,
      session: { ...midHand, hand: { ...midHand.hand, seats } },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("refuses a hand seat holding cards that are not cards", async () => {
    const seats = midHand.hand!.seats.map((seat, i) =>
      i === 0 ? { ...seat, hole: ["Ace of spades"] } : seat,
    );
    const raw = JSON.stringify({
      setup: SETUP,
      session: { ...midHand, hand: { ...midHand.hand, seats } },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("refuses a hand dealt to fewer than two seats", async () => {
    const raw = JSON.stringify({
      setup: SETUP,
      session: {
        ...midHand,
        hand: { ...midHand.hand, seats: [midHand.hand!.seats[0]] },
      },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("refuses a roundBaseline that does not line up with the seats", async () => {
    for (const roundBaseline of [[0, 0], [0, 0, -1], "nope"]) {
      const raw = JSON.stringify({
        setup: SETUP,
        session: { ...midHand, hand: { ...midHand.hand, roundBaseline } },
        recorded: false,
      });
      expect(await seeded(raw).loadGame()).toBeNull();
    }
  });

  it("refuses a hand with a street or status it does not understand", async () => {
    const dealt = midHand.hand!;
    const broken = [
      { ...dealt, street: "fifth" },
      {
        ...dealt,
        seats: dealt.seats.map((seat, i) =>
          i === 0 ? { ...seat, status: "thinking" } : seat,
        ),
      },
      { ...dealt, showdown: "nope" },
      { ...dealt, pots: "nope" },
      { ...dealt, buttonIndex: 9 },
    ];
    for (const hand of broken) {
      const raw = JSON.stringify({
        setup: SETUP,
        session: { ...midHand, hand },
        recorded: false,
      });
      expect(await seeded(raw).loadGame()).toBeNull();
    }
  });

  it("validates the last finished hand as strictly as the live one", async () => {
    const raw = JSON.stringify({
      setup: SETUP,
      session: { ...between, lastHand: { street: "flop" } },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("refuses more players than one deck can deal", async () => {
    const players = Array.from({ length: 24 }, (_, i) => `p${i}`);
    const raw = JSON.stringify({
      setup: { ...SETUP, players },
      session: {
        ...between,
        seats: players.map((playerId) => ({ playerId, stack: 500 })),
      },
      recorded: false,
    });
    expect(await seeded(raw).loadGame()).toBeNull();
  });

  it("refuses anything that is not a stored game at all", async () => {
    for (const raw of ["{not json", "null", "42", "[]", "{}", '{"setup":null}']) {
      expect(await seeded(raw).loadGame()).toBeNull();
    }
  });
});

describe("knockouts on a stored game", () => {
  const withKnockout = (over: Record<string, unknown>) =>
    JSON.stringify({
      setup: FOUR,
      session: { ...withBustedPlayer, ...over },
      recorded: false,
    });

  it("drops a game claiming a knockout nobody suffered", async () => {
    // A bounty is money. An entry for somebody still sitting at the table pays
    // it for a knockout that never happened.
    expect(
      await seeded(withKnockout({ knockouts: [{ playerId: "b", by: ["a"] }] }))
        .loadGame(),
    ).toBeNull();
  });

  it("drops a game crediting somebody who never sat down", async () => {
    expect(
      await seeded(withKnockout({ knockouts: [{ playerId: "d", by: ["z"] }] }))
        .loadGame(),
    ).toBeNull();
  });

  it("drops a game where somebody knocked themselves out", async () => {
    // Winning the pot your chips were in leaves you with chips.
    expect(
      await seeded(withKnockout({ knockouts: [{ playerId: "d", by: ["d"] }] }))
        .loadGame(),
    ).toBeNull();
  });

  it("keeps a game saved before knockouts were tracked", async () => {
    // Somebody went out and nothing says by whom, because the build that saved
    // it did not know to. That is an evening in progress, and dropping it to
    // avoid losing the bounty attribution for it would be the wrong trade by a
    // distance — the game is worth more than the footnote.
    const loaded = await seeded(
      withKnockout({ knockouts: undefined }),
    ).loadGame();
    expect(loaded).not.toBeNull();
    expect(await seeded(withKnockout({ knockouts: [] })).loadGame()).not.toBeNull();
  });

  it("drops a game whose knockouts are not a list at all", async () => {
    expect(
      await seeded(withKnockout({ knockouts: "d was knocked out by a" }))
        .loadGame(),
    ).toBeNull();
  });

  it("drops a game claiming the same exit twice", async () => {
    // The other direction is not forgivable: every entry is money, and one
    // person only ever goes out once.
    expect(
      await seeded(
        withKnockout({
          knockouts: [
            { playerId: "d", by: ["a"] },
            { playerId: "d", by: ["b"] },
          ],
        }),
      ).loadGame(),
    ).toBeNull();
  });

  it("keeps a knockout nobody could be credited for", async () => {
    // Dead money: the pot went unclaimed, so no bounty is owed. That is a real
    // state, not a corrupt one.
    const loaded = await seeded(
      withKnockout({ knockouts: [{ playerId: "d", by: [] }] }),
    ).loadGame();
    expect(loaded?.session.knockouts).toEqual([{ playerId: "d", by: [] }]);
  });

  it("drops a knockout that is not a knockout at all", async () => {
    // Whatever a half-written or hand-edited store produced, it is not a record
    // of who took whom out, and a bounty must not be paid off it.
    const failures: string[] = [];
    for (const entry of [null, "d", { playerId: 7, by: ["a"] }, { playerId: "d" }, { playerId: "d", by: "a" }]) {
      const loaded = await seeded(withKnockout({ knockouts: [entry] })).loadGame();
      if (loaded !== null) failures.push(JSON.stringify(entry));
    }
    expect(failures).toEqual([]);
  });

  it("drops a hand whose pot winners are not lists of players", async () => {
    const failures: string[] = [];
    for (const winners of [["a"], [null], ["z"], [["a"]], "a"]) {
      const stored = JSON.parse(withKnockout({})) as {
        session: { hand: { potWinners: unknown; pots: unknown[] } };
      };
      // One pot, so a single well-formed entry is the only thing that passes.
      stored.session.hand.pots = [
        { amount: 0, eligiblePlayerIds: ["a", "b", "c"] },
      ];
      stored.session.hand.potWinners = [winners];
      const loaded = await seeded(JSON.stringify(stored)).loadGame();
      const shouldLoad = JSON.stringify(winners) === JSON.stringify(["a"]);
      if ((loaded !== null) !== shouldLoad) {
        failures.push(JSON.stringify(winners));
      }
    }
    expect(failures).toEqual([]);
  });

  it("drops a hand whose pot winners do not line up with its pots", async () => {
    const stored = JSON.parse(withKnockout({})) as {
      session: { hand: { potWinners: unknown } };
    };
    stored.session.hand.potWinners = [["a"]];
    expect(await seeded(JSON.stringify(stored)).loadGame()).toBeNull();
  });
});
