/**
 * The leaderboard's record of who played what and how it finished.
 *
 * **Local-first and single-device by design.** There are no accounts and
 * nothing leaves the phone: the host's device is the source of truth for their
 * group. Syncing between players' phones would mean a backend, sign-in, and a
 * change to the app's data-collection disclosures — a different and much larger
 * product than "track who's won the most at our game night".
 *
 * Framework-agnostic like the rest of @poker/core: the app supplies `id` and
 * `now`, since there's no clock or crypto in here.
 */

/**
 * Someone who plays in this group.
 *
 * **A player is not an account.** Most people at a home game will never install
 * anything — someone who turns up once on holiday still belongs on the board —
 * so a name is all this needs, and `accountId` is the optional extra for the
 * ones who do sign in. Modelling it the other way round, with accounts as the
 * roster, would mean nobody can be scored until they have downloaded the app.
 *
 * Because every {@link Placing} and {@link GameResult} refers to `id` and never
 * to an account, attaching one later **never rewrites history**: the account
 * simply inherits everything that player has already done.
 */
export type Player = {
  id: string;
  name: string;
  /** The account that has claimed this player, if any. */
  accountId?: string;
};

/** One player's paid finish in a game. */
export type Placing = {
  playerId: string;
  /** 1 = winner. Only paid places are recorded. */
  place: number;
  /** Prize money won. Bounties are not included — see {@link GameResult}. */
  winnings: number;
};

export type GameResult = {
  id: string;
  /** Epoch ms the game was played (newest-first ordering). */
  playedAt: number;
  /**
   * Everyone who bought in. This is what makes "games played" honest: a
   * player who never cashes still played, and recording only the paid finishes
   * would leave them off the board entirely.
   */
  playerIds: string[];
  /** The paid finishes, a subset of `playerIds`. */
  placings: Placing[];
  /** What each player paid, carried over from the payout setup. */
  buyIn: number;
  /**
   * The per-knockout bounty in force, recorded for context only.
   *
   * **Bounty winnings are deliberately not tracked per player.** A flat bounty
   * changes hands in cash the moment someone busts, a dozen times over an
   * evening, usually while the host isn't watching — by the time a result is
   * being recorded nobody can say who collected what. A field for it would be
   * filled in with a guess, and a guess rendered as a total is worse than no
   * total at all.
   */
  bounty: number;
};

/** Keep storage small and the list scannable. */
export const MAX_GAME_RESULTS = 200;
export const MAX_PLAYERS = 50;

export const createPlayer = (params: {
  id: string;
  name: string;
  accountId?: string;
}): Player => ({
  id: params.id,
  name: params.name.trim(),
  ...(params.accountId === undefined ? {} : { accountId: params.accountId }),
});

/**
 * A name is usable when it's non-empty and not a case-insensitive duplicate —
 * two "Dave"s on one leaderboard are indistinguishable in every view that
 * matters, so the save button can disable on it.
 */
export const isValidPlayerName = (name: string, players: Player[]): boolean => {
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  return !players.some(
    (player) => player.name.toLowerCase() === trimmed.toLowerCase(),
  );
};

/** Add a player, enforcing {@link MAX_PLAYERS}. */
export const addPlayer = (players: Player[], player: Player): Player[] =>
  players.length >= MAX_PLAYERS ? players : [...players, player];

/** Remove a player from the roster. Past results keep their id — see below. */
export const removePlayer = (players: Player[], id: string): Player[] =>
  players.filter((player) => player.id !== id);

/** Reasons a recorded result can't be stored. */
export type GameResultValidationError =
  | "no-players"
  | "duplicate-players"
  | "placing-not-in-field"
  | "duplicate-placing"
  | "duplicate-place"
  | "place-out-of-range"
  | "negative-winnings";

/**
 * Check a result before recording it. Each failure is a distinct value so the
 * UI can say which one it hit rather than just refusing.
 */
export const validateGameResult = (
  result: Pick<GameResult, "playerIds" | "placings">,
): GameResultValidationError | null => {
  const { playerIds, placings } = result;

  if (playerIds.length === 0) return "no-players";
  if (new Set(playerIds).size !== playerIds.length) return "duplicate-players";

  const field = new Set(playerIds);
  const seenPlayers = new Set<string>();
  const seenPlaces = new Set<number>();

  for (const placing of placings) {
    if (!field.has(placing.playerId)) return "placing-not-in-field";
    if (seenPlayers.has(placing.playerId)) return "duplicate-placing";
    if (seenPlaces.has(placing.place)) return "duplicate-place";
    if (
      !Number.isFinite(placing.place) ||
      placing.place < 1 ||
      placing.place > playerIds.length
    ) {
      return "place-out-of-range";
    }
    if (!Number.isFinite(placing.winnings) || placing.winnings < 0) {
      return "negative-winnings";
    }
    seenPlayers.add(placing.playerId);
    seenPlaces.add(placing.place);
  }

  return null;
};

export const createGameResult = (params: {
  id: string;
  playerIds: string[];
  placings: Placing[];
  buyIn: number;
  bounty: number;
  now: number;
}): GameResult => ({
  id: params.id,
  playedAt: params.now,
  playerIds: [...params.playerIds],
  // Stored in finishing order regardless of the order they were entered, so
  // every reader gets the same shape without re-sorting.
  placings: [...params.placings].sort((a, b) => a.place - b.place),
  buyIn: params.buyIn,
  bounty: params.bounty,
});

/** Add a result (newest first), enforcing {@link MAX_GAME_RESULTS}. */
export const addGameResult = (
  results: GameResult[],
  result: GameResult,
): GameResult[] => [result, ...results].slice(0, MAX_GAME_RESULTS);

/** Remove a result by id. */
export const removeGameResult = (
  results: GameResult[],
  id: string,
): GameResult[] => results.filter((result) => result.id !== id);
