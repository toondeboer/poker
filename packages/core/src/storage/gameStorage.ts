import { StorageAdapter } from "./StorageAdapter";
import type { GameSession } from "../poker/session";
import { MAX_SEATS } from "../poker/table";

export const GAME_KEY = "game_session";

/**
 * What was agreed before the first hand: who is in, what they started with,
 * and the blinds. Kept beside the session because the session cannot be
 * checked without it — see {@link isConsistent}.
 */
export type StoredGameSetup = {
  players: string[];
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  groupId: string | null;
};

export type StoredGame = {
  setup: StoredGameSetup;
  session: GameSession;
  /** Whether this game has already been put on the leaderboard. */
  recorded: boolean;
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
 * The promise is that a stored game is **kept whole or dropped**, and that is
 * only worth making if it is actually checked. Chip totals and seat identity
 * are the headline checks, but almost every field here decides who gets paid:
 * `bustOrder` alone determines every finishing position below the chip leader,
 * and `roundBaseline` missing throws from inside a state updater that no error
 * boundary catches — permanently, since the same blob reloads every launch.
 *
 * So everything is checked, and anything not understood is refused.
 *
 * **One thing this cannot catch, stated plainly:** a `bustOrder` that has been
 * *reordered* is still a well-formed history, and nothing else in the game
 * encodes it, so no amount of cross-checking recovers the truth. Detecting it
 * would need a signature over the whole blob, which protects against a class
 * of corruption (an array quietly permuted in place, everything else intact)
 * that storage does not realistically produce — truncation and partial writes
 * are what actually happen, and every one of those is caught below.
 */

const SUITS = new Set(["c", "d", "h", "s"]);
const STATUSES = new Set(["active", "folded", "all-in"]);
const STREETS = new Set(["preflop", "flop", "turn", "river", "complete"]);
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

/** A hand, checked field by field against the players who sat down. */
const validHand = (raw: unknown, setup: StoredGameSetup): number | null => {
  if (!isObject(raw)) return null;
  if (typeof raw.street !== "string" || !STREETS.has(raw.street)) return null;
  if (!Array.isArray(raw.seats) || raw.seats.length < 2) return null;
  if (!Array.isArray(raw.pots) || !Array.isArray(raw.awards)) return null;
  if (raw.showdown !== null && !Array.isArray(raw.showdown)) return null;
  if (!isWholeNonNegative(raw.buttonIndex)) return null;
  if (raw.buttonIndex >= raw.seats.length) return null;

  const board = cardsOf(raw.board);
  const deck = cardsOf(raw.deck);
  if (!board || !deck) return null;

  // Aligned with the pots by index — a mismatch would credit a knockout to
  // whoever won some *other* pot, which is a bounty paid to the wrong person.
  if (!Array.isArray(raw.potWinners)) return null;
  if (raw.potWinners.length !== raw.pots.length) return null;
  if (
    !raw.potWinners.every(
      (winners: unknown) =>
        Array.isArray(winners) &&
        winners.every((id) => typeof id === "string" && setup.players.includes(id)),
    )
  ) {
    return null;
  }

  // `roundBaseline` is bookkeeping the engine reads without checking; missing
  // it throws from inside a state updater rather than failing here.
  if (!Array.isArray(raw.roundBaseline)) return null;
  if (raw.roundBaseline.length !== raw.seats.length) return null;
  if (!raw.roundBaseline.every(isWholeNonNegative)) return null;

  const seen = new Set<string>();
  const cards: string[] = [...board, ...deck].map(
    (card) => `${card.rank}${card.suit}`,
  );
  let inPlay = 0;

  for (const seat of raw.seats) {
    if (!isObject(seat)) return null;
    if (typeof seat.playerId !== "string") return null;
    // Awards are paid by id, which is why `startHand` refuses duplicates: two
    // seats sharing one would silently merge and lose chips at settle.
    if (seen.has(seat.playerId)) return null;
    if (!setup.players.includes(seat.playerId)) return null;
    seen.add(seat.playerId);
    if (!isWholeNonNegative(seat.stack)) return null;
    if (!isWholeNonNegative(seat.committed)) return null;
    if (typeof seat.status !== "string" || !STATUSES.has(seat.status)) {
      return null;
    }
    const hole = cardsOf(seat.hole);
    if (!hole) return null;
    cards.push(...hole.map((card) => `${card.rank}${card.suit}`));
    inPlay += seat.stack + seat.committed;
  }

  // Every card accounted for, exactly once. A slicing mistake anywhere in the
  // deal shows up here and nowhere else.
  if (cards.length !== DECK_SIZE) return null;
  if (new Set(cards).size !== DECK_SIZE) return null;

  return inPlay;
};

/**
 * Does this stored game still add up?
 *
 * Returns the total chips it accounts for, or `null` if anything about it is
 * unusable. The caller compares that total against what everybody sat down
 * with — the check that catches almost any corruption worth catching.
 */
const chipsAccountedFor = (
  setup: StoredGameSetup,
  session: unknown,
): number | null => {
  if (!isObject(session)) return null;
  if (!Array.isArray(session.seats)) return null;
  if (!isWholeNonNegative(session.handsPlayed)) return null;
  if (!isWholeNonNegative(session.buttonIndex)) return null;
  if (session.buttonIndex >= setup.players.length) return null;

  const seated: string[] = [];
  let idle = 0;
  for (const seat of session.seats) {
    if (!isObject(seat)) return null;
    if (typeof seat.playerId !== "string") return null;
    if (!isWholeNonNegative(seat.stack)) return null;
    seated.push(seat.playerId);
    idle += seat.stack;
  }

  // The same people, in the same seats, as the game was set up with. Seat
  // order is the button's frame of reference: shuffling it moves the blinds
  // to the wrong players.
  if (seated.length !== setup.players.length) return null;
  if (seated.some((id, index) => id !== setup.players[index])) return null;

  // Everyone knocked out is somebody who sat down, listed once, and broke.
  if (!Array.isArray(session.bustOrder)) return null;
  const busted = new Set<string>();
  for (const id of session.bustOrder) {
    if (typeof id !== "string") return null;
    if (busted.has(id) || !setup.players.includes(id)) return null;
    busted.add(id);
  }
  for (const seat of session.seats) {
    const out = busted.has((seat as { playerId: string }).playerId);
    const broke = (seat as { stack: number }).stack === 0;
    // Being broke without being out is normal mid-hand (all-in). Being out
    // with chips is not, and it resurrects a player: `settle` only overwrites
    // seats that were in the hand, so the stack survives and the game can
    // never end.
    if (out && !broke) return null;
  }

  // Every knockout is somebody who actually went out, credited to people who
  // actually sat down. A stray entry is a bounty paid for a knockout that never
  // happened, and money is the one thing this file exists to protect.
  if (!Array.isArray(session.knockouts)) return null;
  for (const knockout of session.knockouts) {
    if (!isObject(knockout)) return null;
    if (typeof knockout.playerId !== "string") return null;
    if (!busted.has(knockout.playerId)) return null;
    if (!Array.isArray(knockout.by)) return null;
    if (
      !knockout.by.every(
        (id) => typeof id === "string" && setup.players.includes(id),
      )
    ) {
      return null;
    }
    // Nobody knocks themselves out — a player who wins the pot their chips
    // were in still has chips.
    if (knockout.by.includes(knockout.playerId)) return null;
  }
  if (session.knockouts.length !== busted.size) return null;

  if (session.lastHand !== null && validHand(session.lastHand, setup) === null) {
    return null;
  }

  if (session.hand === null) return idle;

  const inHand = validHand(session.hand, setup);
  if (inHand === null) return null;
  // While a hand runs its seats hold the live stacks, so the session's own are
  // stale for those players — count the hand's instead, plus anyone not in it.
  const playing = new Set(
    (session.hand as { seats: { playerId: string }[] }).seats.map(
      (seat) => seat.playerId,
    ),
  );
  const outside = session.seats
    .filter((seat) => !playing.has((seat as { playerId: string }).playerId))
    .reduce((sum, seat) => sum + (seat as { stack: number }).stack, 0);
  return inHand + outside;
};

const coerceSetup = (raw: unknown): StoredGameSetup | null => {
  if (!isObject(raw)) return null;
  if (!Array.isArray(raw.players)) return null;
  const players = raw.players.filter(
    (id): id is string => typeof id === "string",
  );
  // Two is a game; more than one deck can deal is not, and `startHand` would
  // refuse it — from inside a state updater, on the first Deal.
  if (players.length !== raw.players.length) return null;
  if (players.length < 2 || players.length > MAX_SEATS) return null;
  if (new Set(players).size !== players.length) return null;
  if (!isWholeNonNegative(raw.startingStack) || raw.startingStack <= 0) {
    return null;
  }
  if (!isWholeNonNegative(raw.smallBlind) || raw.smallBlind <= 0) return null;
  if (!isWholeNonNegative(raw.bigBlind) || raw.bigBlind <= raw.smallBlind) {
    return null;
  }
  return {
    players,
    startingStack: raw.startingStack,
    smallBlind: raw.smallBlind,
    bigBlind: raw.bigBlind,
    groupId: typeof raw.groupId === "string" ? raw.groupId : null,
  };
};

/**
 * Persist the game in progress, so an evening survives the app being killed.
 *
 * One key, so the setup and the session can never half-land — a session
 * without the setup it was created from cannot be checked, and cannot be
 * dealt from either.
 */
export function createGameStorage(storage: StorageAdapter): GameStorage {
  return {
    async loadGame(): Promise<StoredGame | null> {
      try {
        const raw = await storage.getItem(GAME_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isObject(parsed)) return null;

        const setup = coerceSetup(parsed.setup);
        if (!setup) return null;
        const chips = chipsAccountedFor(setup, parsed.session);
        if (chips === null) return null;
        if (chips !== setup.players.length * setup.startingStack) return null;

        return {
          setup,
          session: parsed.session as GameSession,
          recorded: parsed.recorded === true,
        };
      } catch {
        return null;
      }
    },

    async saveGame(game: StoredGame): Promise<void> {
      await storage.setItem(GAME_KEY, JSON.stringify(game));
    },

    async clearGame(): Promise<void> {
      await storage.multiRemove([GAME_KEY]);
    },
  };
}
