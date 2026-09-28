import { describe, expect, it } from "vitest";
import { GAME_KEY, createGameStorage, type StoredGame } from "./gameStorage";
import { createFailingAdapter, createMemoryAdapter } from "./testAdapters";
import { createRandom } from "../poker/cards";
import { isDealComplete } from "../poker/deal";
import {
  type DealerSession,
  createDealerSession,
  dealNextHand,
  nextStreet,
} from "../poker/dealerSession";

const PLAYERS = ["a", "b", "c"];

const between = (): DealerSession => createDealerSession({ players: PLAYERS });

const midHand = (): DealerSession =>
  dealNextHand(between(), { random: createRandom(1) });

const finished = (): DealerSession => {
  let s = midHand();
  while (s.deal && !isDealComplete(s.deal)) s = nextStreet(s);
  return s;
};

const game = (session: DealerSession): StoredGame => ({
  setup: { players: PLAYERS },
  session,
});

const seeded = (raw: string) =>
  createGameStorage(createMemoryAdapter({ [GAME_KEY]: raw }));

/** Store a game, mutate the raw blob, and read it back. */
const mangled = async (
  edit: (blob: Record<string, unknown>) => void,
  session: DealerSession = midHand(),
) => {
  const blob = JSON.parse(JSON.stringify(game(session))) as Record<
    string,
    unknown
  >;
  edit(blob);
  return seeded(JSON.stringify(blob)).loadGame();
};

describe("createGameStorage", () => {
  it("has nothing when nothing is stored", async () => {
    expect(
      await createGameStorage(createMemoryAdapter()).loadGame(),
    ).toBeNull();
  });

  it("round-trips a game between hands", async () => {
    const storage = createGameStorage(createMemoryAdapter());
    await storage.saveGame(game(between()));
    expect(await storage.loadGame()).toEqual(game(between()));
  });

  it("round-trips a hand in progress, cards and all", async () => {
    const storage = createGameStorage(createMemoryAdapter());
    const stored = game(midHand());
    await storage.saveGame(stored);
    const loaded = await storage.loadGame();
    expect(loaded).toEqual(stored);
    // The point of persisting at all: the app is the only thing that knows the
    // cards, so a phone dying mid-street must not lose them.
    expect(loaded!.session.deal!.seats[0].hole).toHaveLength(2);
  });

  it("round-trips a finished hand, so the showdown survives a relaunch", async () => {
    const storage = createGameStorage(createMemoryAdapter());
    await storage.saveGame(game(finished()));
    const loaded = await storage.loadGame();
    expect(loaded!.session.lastDeal!.showdown).not.toBeNull();
  });

  it("clears back to nothing", async () => {
    const adapter = createMemoryAdapter();
    const storage = createGameStorage(adapter);
    await storage.saveGame(game(midHand()));
    await storage.clearGame();
    expect(adapter.store.has(GAME_KEY)).toBe(false);
    expect(await storage.loadGame()).toBeNull();
  });

  it("gives up quietly when storage throws", async () => {
    const storage = createGameStorage(createFailingAdapter());
    expect(await storage.loadGame()).toBeNull();
    // Neither of these may throw: losing a write is survivable, throwing out of
    // a state update is not.
    await storage.saveGame(game(midHand()));
    await storage.clearGame();
  });

  it("drops anything that is not a game", async () => {
    for (const raw of ["{not json", "null", "42", '"hello"', "[]"]) {
      expect(await seeded(raw).loadGame()).toBeNull();
    }
  });
});

describe("a stored hand is kept whole or not at all", () => {
  it("refuses a setup that could not have started a game", async () => {
    for (const players of [[], ["a"], ["a", "a"], ["a", 7], "nope"]) {
      expect(
        await mangled(
          (b) => ((b.setup as Record<string, unknown>).players = players),
        ),
      ).toBeNull();
    }
    expect(await mangled((b) => (b.setup = "nope"))).toBeNull();
  });

  it("refuses a session that is not shaped like one", async () => {
    expect(await mangled((b) => (b.session = "nope"))).toBeNull();
    expect(
      await mangled(
        (b) => ((b.session as Record<string, unknown>).handsPlayed = -1),
      ),
    ).toBeNull();
    expect(
      await mangled(
        (b) => ((b.session as Record<string, unknown>).handsPlayed = 1.5),
      ),
    ).toBeNull();
    expect(
      await mangled(
        (b) => ((b.session as Record<string, unknown>).seats = "nope"),
      ),
    ).toBeNull();
  });

  it("refuses a button that is not a seat", async () => {
    expect(
      await mangled(
        (b) => ((b.session as Record<string, unknown>).buttonIndex = 9),
      ),
    ).toBeNull();
    expect(
      await mangled(
        (b) => ((b.session as Record<string, unknown>).buttonIndex = -1),
      ),
    ).toBeNull();
  });

  it("refuses a seat who never sat down", async () => {
    expect(
      await mangled((b) => {
        const seats = (b.session as { seats: Record<string, unknown>[] }).seats;
        seats[0].playerId = "stranger";
      }),
    ).toBeNull();
  });

  it("refuses a seat with no sitting-out flag", async () => {
    expect(
      await mangled((b) => {
        const seats = (b.session as { seats: Record<string, unknown>[] }).seats;
        delete seats[0].sittingOut;
      }),
    ).toBeNull();
  });

  /**
   * **The card checks are the invariant that replaced chip conservation.**
   * Truncation and partial writes are what storage actually produces, and every
   * one of them shows up as a deck that is not 52 distinct cards.
   */
  it("refuses a hand whose cards do not make one deck", async () => {
    // A card removed.
    expect(
      await mangled((b) => {
        const deal = (b.session as { deal: { deck: unknown[] } }).deal;
        deal.deck = deal.deck.slice(1);
      }),
    ).toBeNull();
    // A card duplicated.
    expect(
      await mangled((b) => {
        const deal = (b.session as { deal: { deck: unknown[] } }).deal;
        deal.deck = [deal.deck[0], ...deal.deck.slice(2), deal.deck[0]];
      }),
    ).toBeNull();
  });

  it("refuses cards that are not cards", async () => {
    expect(
      await mangled((b) => {
        const deal = (b.session as { deal: { deck: unknown[] } }).deal;
        deal.deck[0] = { rank: 99, suit: "z" };
      }),
    ).toBeNull();
    expect(
      await mangled((b) => {
        const deal = (b.session as { deal: { board: unknown } }).deal;
        deal.board = "nope";
      }),
    ).toBeNull();
  });

  it("refuses a hand seat holding the wrong number of cards", async () => {
    expect(
      await mangled((b) => {
        const seats = (b.session as { deal: { seats: { hole: unknown[] }[] } })
          .deal.seats;
        seats[0].hole = seats[0].hole.slice(1);
      }),
    ).toBeNull();
  });

  it("refuses a hand dealt to somebody who never sat down", async () => {
    expect(
      await mangled((b) => {
        const seats = (
          b.session as {
            deal: { seats: Record<string, unknown>[] };
          }
        ).deal.seats;
        seats[0].playerId = "stranger";
      }),
    ).toBeNull();
  });

  it("refuses a hand where two seats share a player id", async () => {
    expect(
      await mangled((b) => {
        const seats = (
          b.session as {
            deal: { seats: Record<string, unknown>[] };
          }
        ).deal.seats;
        seats[1].playerId = seats[0].playerId;
      }),
    ).toBeNull();
  });

  it("refuses a hand dealt to fewer than two seats", async () => {
    expect(
      await mangled((b) => {
        const deal = (b.session as { deal: { seats: unknown[] } }).deal;
        deal.seats = deal.seats.slice(0, 1);
      }),
    ).toBeNull();
  });

  it("refuses a street it does not recognise", async () => {
    expect(
      await mangled((b) => {
        (b.session as { deal: Record<string, unknown> }).deal.street = "flopp";
      }),
    ).toBeNull();
  });

  it("refuses a mucked flag that is not a boolean", async () => {
    expect(
      await mangled((b) => {
        const seats = (
          b.session as {
            deal: { seats: Record<string, unknown>[] };
          }
        ).deal.seats;
        seats[0].mucked = "yes";
      }),
    ).toBeNull();
  });

  it("refuses a board longer than a board", async () => {
    expect(
      await mangled((b) => {
        const deal = (
          b.session as { deal: { board: unknown[]; deck: unknown[] } }
        ).deal;
        deal.board = deal.deck.slice(0, 6);
      }),
    ).toBeNull();
  });

  it("checks the finished hand too, not just the live one", async () => {
    expect(
      await mangled((b) => {
        const deal = (b.session as { lastDeal: { deck: unknown[] } }).lastDeal;
        deal.deck = deal.deck.slice(1);
      }, finished()),
    ).toBeNull();
  });

  it("refuses a seat that is not an object at all", async () => {
    expect(
      await mangled((b) => {
        (b.session as { deal: { seats: unknown[] } }).deal.seats[0] = "nope";
      }),
    ).toBeNull();
    expect(
      await mangled((b) => {
        (b.session as { seats: unknown[] }).seats[0] = 42;
      }),
    ).toBeNull();
  });

  it("refuses a session seat with no player id", async () => {
    expect(
      await mangled((b) => {
        const seats = (b.session as { seats: Record<string, unknown>[] }).seats;
        delete seats[0].playerId;
      }),
    ).toBeNull();
  });

  it("refuses a hand dealt to more seats than a deck can serve", async () => {
    expect(
      await mangled((b) => {
        const deal = (b.session as { deal: { seats: unknown[] } }).deal;
        deal.seats = Array.from({ length: 24 }, () => deal.seats[0]);
      }),
    ).toBeNull();
  });

  it("keeps a session between hands, where there is no deal to check", async () => {
    expect(await mangled(() => {}, between())).not.toBeNull();
  });
});
