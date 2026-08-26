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

  it("refuses anything that is not a stored game at all", async () => {
    for (const raw of ["{not json", "null", "42", "[]", "{}", '{"setup":null}']) {
      expect(await seeded(raw).loadGame()).toBeNull();
    }
  });
});
