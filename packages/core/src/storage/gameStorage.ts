import { StorageAdapter } from "./StorageAdapter";
import type { GameSession } from "../poker/session";

const STORAGE_KEY = "game_session";

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
 * Does this stored game still add up?
 *
 * **A game in progress is validated whole, then kept or dropped — no partial
 * recovery.** That is the opposite of the leaderboard, deliberately: a season
 * of results is irreplaceable, so one corrupt row is dropped and the rest kept.
 * A game is at most one evening and can be dealt again, whereas a half-valid
 * one is a table paying the wrong person from stacks that no longer add up.
 * Given the choice between losing an evening and silently mis-paying it, lose
 * the evening.
 *
 * The chip count is the check that earns its place: almost any corruption that
 * matters shows up as chips appearing or vanishing, and it needs nothing but
 * the setup to verify.
 */
const isConsistent = (setup: StoredGameSetup, session: unknown): boolean => {
  if (!isObject(session)) return false;
  if (!Array.isArray(session.seats)) return false;
  if (!isWholeNonNegative(session.handsPlayed)) return false;
  if (!Array.isArray(session.bustOrder)) return false;
  if (!isWholeNonNegative(session.buttonIndex)) return false;
  if (session.buttonIndex >= setup.players.length) return false;

  const seated: string[] = [];
  let chips = 0;
  for (const seat of session.seats) {
    if (!isObject(seat)) return false;
    if (typeof seat.playerId !== "string") return false;
    if (!isWholeNonNegative(seat.stack)) return false;
    seated.push(seat.playerId);
    chips += seat.stack;
  }

  // The same people, in the same seats, as the game was set up with.
  if (seated.length !== setup.players.length) return false;
  if (seated.some((id, index) => id !== setup.players[index])) return false;

  // Chips in stacks, plus whatever is in the middle of the hand being played,
  // must still equal what everyone sat down with.
  let committed = 0;
  if (isObject(session.hand)) {
    if (!Array.isArray(session.hand.seats)) return false;
    for (const seat of session.hand.seats) {
      if (!isObject(seat)) return false;
      if (!isWholeNonNegative(seat.committed)) return false;
      committed += seat.committed;
    }
    // While a hand runs the live stacks are the hand's, not the session's.
    chips = session.hand.seats.reduce(
      (sum: number, seat: unknown) =>
        sum + (isObject(seat) && isWholeNonNegative(seat.stack) ? seat.stack : 0),
      0,
    );
  } else if (session.hand !== null) {
    return false;
  }

  return chips + committed === setup.players.length * setup.startingStack;
};

const coerceSetup = (raw: unknown): StoredGameSetup | null => {
  if (!isObject(raw)) return null;
  if (!Array.isArray(raw.players)) return null;
  const players = raw.players.filter(
    (id): id is string => typeof id === "string",
  );
  if (players.length !== raw.players.length || players.length < 2) return null;
  if (new Set(players).size !== players.length) return null;
  if (!isWholeNonNegative(raw.startingStack) || raw.startingStack <= 0) return null;
  if (!isWholeNonNegative(raw.smallBlind) || raw.smallBlind <= 0) return null;
  if (!isWholeNonNegative(raw.bigBlind) || raw.bigBlind <= raw.smallBlind) return null;
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
        const raw = await storage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isObject(parsed)) return null;

        const setup = coerceSetup(parsed.setup);
        if (!setup) return null;
        if (!isConsistent(setup, parsed.session)) return null;

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
      await storage.setItem(STORAGE_KEY, JSON.stringify(game));
    },

    async clearGame(): Promise<void> {
      await storage.multiRemove([STORAGE_KEY]);
    },
  };
}
