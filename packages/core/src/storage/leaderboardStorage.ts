import { StorageAdapter } from "./StorageAdapter";
import { GameResult, Player } from "../leaderboard/gameResult";

const STORAGE_KEY = "leaderboard";

export type LeaderboardState = {
  players: Player[];
  results: GameResult[];
};

export interface LeaderboardStorage {
  loadLeaderboard(): Promise<LeaderboardState>;
  saveLeaderboard(state: LeaderboardState): Promise<void>;
  clearLeaderboard(): Promise<void>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const coercePlayers = (raw: unknown): Player[] => {
  if (!Array.isArray(raw)) return [];
  const players: Player[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    if (typeof entry.id !== "string" || typeof entry.name !== "string") {
      continue;
    }
    players.push({ id: entry.id, name: entry.name });
  }
  return players;
};

const coerceResults = (raw: unknown): GameResult[] => {
  if (!Array.isArray(raw)) return [];
  const results: GameResult[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    if (typeof entry.id !== "string") continue;
    if (!Array.isArray(entry.playerIds)) continue;
    const playerIds = entry.playerIds.filter(
      (id): id is string => typeof id === "string",
    );
    const placings = Array.isArray(entry.placings)
      ? entry.placings.flatMap((placing) =>
          isObject(placing) &&
          typeof placing.playerId === "string" &&
          typeof placing.place === "number" &&
          Number.isFinite(placing.place) &&
          typeof placing.winnings === "number" &&
          Number.isFinite(placing.winnings)
            ? [
                {
                  playerId: placing.playerId,
                  place: placing.place,
                  winnings: placing.winnings,
                },
              ]
            : [],
        )
      : [];
    results.push({
      id: entry.id,
      playedAt:
        typeof entry.playedAt === "number" && Number.isFinite(entry.playedAt)
          ? entry.playedAt
          : 0,
      playerIds,
      placings,
      buyIn: typeof entry.buyIn === "number" ? entry.buyIn : 0,
      bounty: typeof entry.bounty === "number" ? entry.bounty : 0,
    });
  }
  return results;
};

/**
 * Create a leaderboard store backed by any {@link StorageAdapter}.
 *
 * Players and results share **one key**, so a write that adds a player and the
 * game they just played can't half-land and leave results pointing at a player
 * who isn't in the roster.
 *
 * Entries are validated individually on the way out rather than the blob being
 * trusted or rejected wholesale: this is the one store here whose data is
 * genuinely unrecoverable if dropped — a season of game nights — so one corrupt
 * row must not take the rest of the history with it.
 */
export function createLeaderboardStorage(
  storage: StorageAdapter,
): LeaderboardStorage {
  return {
    async loadLeaderboard(): Promise<LeaderboardState> {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        if (!raw) return { players: [], results: [] };
        const parsed: unknown = JSON.parse(raw);
        if (!isObject(parsed)) return { players: [], results: [] };
        return {
          players: coercePlayers(parsed.players),
          results: coerceResults(parsed.results),
        };
      } catch {
        return { players: [], results: [] };
      }
    },

    async saveLeaderboard(state: LeaderboardState): Promise<void> {
      await storage.setItem(STORAGE_KEY, JSON.stringify(state));
    },

    async clearLeaderboard(): Promise<void> {
      await storage.multiRemove([STORAGE_KEY]);
    },
  };
}
