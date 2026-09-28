import { nameRejection, type NameRejection } from "../moderation/textFilter";

/**
 * The leaderboard's record of who played what and how it finished.
 *
 * **Local-first by design, and shared only on purpose.** A board lives on the
 * phone that made it and works with no account at all; sharing one is a
 * deliberate act that puts it on a server so other people can see it. That is
 * why names are validated for content and not just for uniqueness — see
 * {@link playerNameRejection}.
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

/**
 * One player's finish in a game.
 *
 * **No money.** This carried a `winnings` figure until the 1.2.0 rating work:
 * a board that accumulates what each player has won across sessions is a
 * bankroll tracker, and the comparable ones on the App Store are rated 18+
 * where a one-shot payout calculator is 4+. The calculator still works out what
 * each place wins tonight; the board keeps who finished where, and nothing else.
 * See the Gambling classification section in `ROADMAP.md`.
 */
export type Placing = {
  playerId: string;
  /** 1 = winner. Only placed finishes are recorded. */
  place: number;
};

export type GameResult = {
  id: string;
  /** Epoch ms the game was played (newest-first ordering). */
  playedAt: number;
  /**
   * Everyone who played. This is what makes "games played" honest: a player who
   * never places still played, and recording only the finishes would leave them
   * off the board entirely.
   */
  playerIds: string[];
  /** The recorded finishes, a subset of `playerIds`. */
  placings: Placing[];
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
 * Why a proposed player name can't be used, or `null` when it can.
 *
 * The duplicate rule is the original one — two "Dave"s on one leaderboard are
 * indistinguishable in every view that matters. The length and content rules
 * arrived with sharing: a player name is written onto other people's phones
 * now, which makes it user-generated content and gets it the same treatment as
 * any other. See {@link nameRejection}.
 */
export const playerNameRejection = (
  name: string,
  players: Player[],
): NameRejection | null =>
  nameRejection(
    name,
    players.map((player) => player.name),
  );

/**
 * The same question as a boolean, for callers that only enable a button.
 *
 * Kept so the disable-the-save-button call sites read as they did; anything
 * that wants to *say* what is wrong calls {@link playerNameRejection}.
 */
export const isValidPlayerName = (name: string, players: Player[]): boolean =>
  playerNameRejection(name, players) === null;

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
  | "place-out-of-range";

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
    seenPlayers.add(placing.playerId);
    seenPlaces.add(placing.place);
  }

  return null;
};

export const createGameResult = (params: {
  id: string;
  playerIds: string[];
  placings: Placing[];
  now: number;
}): GameResult => ({
  id: params.id,
  playedAt: params.now,
  playerIds: [...params.playerIds],
  // Stored in finishing order regardless of the order they were entered, so
  // every reader gets the same shape without re-sorting.
  placings: [...params.placings].sort((a, b) => a.place - b.place),
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
