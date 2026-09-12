import { StorageAdapter } from "./StorageAdapter";
import type { DealerSession } from "../poker/dealerSession";
import { BOARD_CARDS, HOLE_CARDS, MAX_SEATS } from "../poker/deal";

export const GAME_KEY = "game_session";

/** Who sat down. All a dealt hand needs to be checked against. */
export type StoredGameSetup = {
  players: string[];
};

export type StoredGame = {
  setup: StoredGameSetup;
  session: DealerSession;
};

export interface GameStorage {
  loadGame(): Promise<StoredGame | null>;
  saveGame(game: StoredGame): Promise<void>;
  clearGame(): Promise<void>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isWholeNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/**
 * How thorough this validator has to be, and why.
 *
 * The promise is that a stored hand is **kept whole or dropped**, and that is
 * only worth making if it is actually checked.
 *
 * **Persistence matters more in dealer mode than it did before, not less.**
 * When the app ran the game it held the chips too, so a lost session lost a
 * bookkeeping record. Now the chips are on the table in front of everybody and
 * the app is the only thing that knows *the cards* — so a hand lost to a phone
 * dying mid-street is a hand that cannot be reconstructed by anybody. Hence
 * this, and hence the card checks below being the strict part.
 *
 * The card checks are also the only real invariant left. Chip conservation used
 * to be the headline — a stored game whose stacks did not sum to
 * `players × startingStack` was refused — and there are no chips to conserve.
 * What survives is stronger in the way that matters here: every card in the
 * deck, the board and every hole hand appears **exactly once**, which catches
 * truncation and partial writes, which is what storage actually produces.
 */

const SUITS = new Set(["c", "d", "h", "s"]);
const STREETS = new Set(["preflop", "flop", "turn", "river", "showdown"]);
const DECK_SIZE = 52;

const isCard = (raw: unknown): boolean =>
  isObject(raw) &&
  typeof raw.rank === "number" &&
  Number.isInteger(raw.rank) &&
  raw.rank >= 2 &&
  raw.rank <= 14 &&
  typeof raw.suit === "string" &&
  SUITS.has(raw.suit);

const cardsOf = (raw: unknown): Record<string, unknown>[] | null => {
  if (!Array.isArray(raw)) return null;
  if (!raw.every(isCard)) return null;
  return raw as Record<string, unknown>[];
};

/** A dealt hand, checked field by field against the players who sat down. */
const validDeal = (raw: unknown, setup: StoredGameSetup): string[] | null => {
  if (!isObject(raw)) return null;
  if (typeof raw.street !== "string" || !STREETS.has(raw.street)) return null;
  if (!isWholeNonNegative(raw.buttonIndex)) return null;

  const board = cardsOf(raw.board);
  const deck = cardsOf(raw.deck);
  if (!board || !deck) return null;
  if (board.length > BOARD_CARDS) return null;

  if (!Array.isArray(raw.seats) || raw.seats.length < 2) return null;
  if (raw.seats.length > MAX_SEATS) return null;
  if (raw.buttonIndex >= raw.seats.length) return null;

  const seen: string[] = [];
  const cards: string[] = [...board, ...deck].map(
    (card) => `${String(card.rank)}${String(card.suit)}`,
  );

  for (const entry of raw.seats) {
    if (!isObject(entry)) return null;
    if (typeof entry.playerId !== "string") return null;
    // A hand dealt to somebody who never sat down is not recoverable — the
    // screen would render a seat with no name against it.
    if (!setup.players.includes(entry.playerId)) return null;
    if (seen.includes(entry.playerId)) return null;
    if (typeof entry.mucked !== "boolean") return null;
    const hole = cardsOf(entry.hole);
    if (!hole || hole.length !== HOLE_CARDS) return null;
    seen.push(entry.playerId);
    for (const card of hole) {
      cards.push(`${String(card.rank)}${String(card.suit)}`);
    }
  }

  // Every card exactly once, and all 52 present. Anything else means the blob
  // was written partially, which is the failure storage actually produces.
  if (cards.length !== DECK_SIZE) return null;
  if (new Set(cards).size !== DECK_SIZE) return null;

  return seen;
};

const coerceSetup = (raw: unknown): StoredGameSetup | null => {
  if (!isObject(raw)) return null;
  if (!Array.isArray(raw.players)) return null;
  const players = raw.players.filter(
    (id): id is string => typeof id === "string",
  );
  if (players.length !== raw.players.length) return null;
  if (players.length < 2 || players.length > MAX_SEATS) return null;
  if (new Set(players).size !== players.length) return null;
  return { players };
};

/**
 * The dealt hand on this phone, so an evening survives the app closing.
 *
 * **Whole or nothing.** A partially recovered hand is worse than none: the
 * table would be looking at a board with cards missing from it and no way to
 * tell. Anything that does not check out is dropped and the screen offers a
 * fresh deal.
 */
export function createGameStorage(storage: StorageAdapter): GameStorage {
  return {
    async loadGame() {
      try {
        const raw = await storage.getItem(GAME_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isObject(parsed)) return null;

        const setup = coerceSetup(parsed.setup);
        if (!setup) return null;

        const session = parsed.session;
        if (!isObject(session)) return null;
        if (!isWholeNonNegative(session.handsPlayed)) return null;
        if (!isWholeNonNegative(session.buttonIndex)) return null;
        if (!Array.isArray(session.seats)) return null;
        if (session.buttonIndex >= session.seats.length) return null;

        for (const seat of session.seats) {
          if (!isObject(seat)) return null;
          if (typeof seat.playerId !== "string") return null;
          if (!setup.players.includes(seat.playerId)) return null;
          if (typeof seat.sittingOut !== "boolean") return null;
        }

        // Both are optional — a session between hands has neither — but a
        // present one has to be whole.
        if (session.deal !== null && session.deal !== undefined) {
          if (!validDeal(session.deal, setup)) return null;
        }
        if (session.lastDeal !== null && session.lastDeal !== undefined) {
          if (!validDeal(session.lastDeal, setup)) return null;
        }

        return {
          setup,
          session: parsed.session as unknown as DealerSession,
        };
      } catch {
        return null;
      }
    },

    async saveGame(game) {
      try {
        await storage.setItem(GAME_KEY, JSON.stringify(game));
      } catch {
        // A game that cannot be saved is still playable on screen. Losing the
        // write is survivable; throwing out of a state update is not.
      }
    },

    async clearGame() {
      try {
        await storage.multiRemove([GAME_KEY]);
      } catch {
        // Same reasoning as above.
      }
    },
  };
}
