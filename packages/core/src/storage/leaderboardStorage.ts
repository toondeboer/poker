import { StorageAdapter } from "./StorageAdapter";
import { GameResult, Player } from "../leaderboard/gameResult";
import {
  EMPTY_LEADERBOARD,
  type Group,
  type GroupState,
  type GroupedLeaderboard,
  migrateToGroups,
} from "../leaderboard/groups";

export const LEADERBOARD_KEY = "leaderboard";

/**
 * The shape that shipped first: one board, no groups.
 *
 * Kept because it is what is on people's phones, and {@link loadLeaderboard}
 * still has to read it. Nothing writes it any more.
 */
export type LeaderboardState = {
  players: Player[];
  results: GameResult[];
};

/**
 * What the loader needs to turn a legacy board into a group.
 *
 * Injected because @poker/core has neither a clock nor a way to mint an id, and
 * because a migration that invented its own would be untestable.
 */
export type LeaderboardMigration = {
  createGroupId: () => string;
  now: () => number;
  /** What the board someone already has gets called. */
  defaultGroupName: string;
};

export interface LeaderboardStorage {
  loadLeaderboard(): Promise<GroupedLeaderboard>;
  saveLeaderboard(state: GroupedLeaderboard): Promise<void>;
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
    // `accountId` is optional and only carried when it is genuinely a string,
    // so a corrupt value degrades the player to a guest rather than taking the
    // whole row with it. The key is omitted entirely when absent — writing
    // `accountId: undefined` would survive one JSON round-trip as a missing key
    // and compare unequal in the meantime.
    players.push(
      typeof entry.accountId === "string"
        ? { id: entry.id, name: entry.name, accountId: entry.accountId }
        : { id: entry.id, name: entry.name },
    );
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
    // **Carried, or a bounty game loses its money on every relaunch.** The
    // key is omitted rather than defaulted to `[]`: absent means "recorded by
    // hand, nobody knows", and an empty array would claim nobody knocked
    // anybody out. Same validation as `mergeBoard.isResult`, which is the
    // other reader of this field.
    const knockouts = Array.isArray(entry.knockouts)
      ? entry.knockouts.flatMap((knockout) =>
          isObject(knockout) &&
          typeof knockout.playerId === "string" &&
          typeof knockout.count === "number" &&
          Number.isFinite(knockout.count) &&
          typeof knockout.bounty === "number" &&
          Number.isFinite(knockout.bounty)
            ? [
                {
                  playerId: knockout.playerId,
                  count: knockout.count,
                  bounty: knockout.bounty,
                },
              ]
            : [],
        )
      : undefined;
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
      ...(knockouts ? { knockouts } : {}),
    });
  }
  return results;
};

/**
 * Only a missing id is fatal.
 *
 * A group's name is cosmetic; losing it costs a label, while dropping the group
 * costs a roster and every game it ever recorded. `createdAt` on the line below
 * was already defaulted for exactly that reason, and refusing a bad `name`
 * contradicted the rule this file states two functions up — one corrupt row
 * must not take the rest of the history with it.
 */
const coerceGroup = (raw: unknown, fallbackName: string): Group | null => {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : fallbackName,
    createdAt:
      typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : 0,
  };
};

const coerceIds = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];

const coerceGroups = (raw: unknown, fallbackName: string): GroupState[] => {
  if (!Array.isArray(raw)) return [];
  const groups: GroupState[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const group = coerceGroup(entry.group, fallbackName);
    if (!group) continue;
    /**
     * **Read back, or a delete undoes itself on the next launch.** Nothing
     * tells the server about a removal, so this list is the only thing keeping
     * a pull from restoring what somebody deleted — and a pull happens the
     * moment the app comes forward.
     */
    const deleted = isObject(entry.deleted)
      ? {
          players: coerceIds(entry.deleted.players),
          results: coerceIds(entry.deleted.results),
        }
      : null;
    // Kept across launches so the share button does not flicker back on for a
    // board this account is only a member of, until the first pull lands.
    const role = entry.role === "admin" || entry.role === "member" ? entry.role : null;
    groups.push({
      group,
      players: coercePlayers(entry.players),
      results: coerceResults(entry.results),
      ...(role ? { role } : {}),
      // Omitted rather than stored empty, so a board that has never deleted
      // anything round-trips to the same shape it had before this existed.
      ...(deleted && (deleted.players.length > 0 || deleted.results.length > 0)
        ? { deleted }
        : {}),
    });
  }
  return groups;
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
/**
 * What actually goes on disk: the grouped board **plus a copy of the active
 * group in the old single-board shape**.
 *
 * This is a downgrade shim, and it exists because the alternative silently
 * destroys data. Writing only `groups` makes the update one-way: a build from
 * before groups reads `players`/`results`, finds neither, shows an empty
 * leaderboard, and the first thing the user does there saves that emptiness
 * over a season of history. Downgrades are not hypothetical — a halted Play
 * staged rollout, a TestFlight revert, or reinstalling the previous binary all
 * do it, and this is the one store whose contents cannot be retyped.
 *
 * The cost is the active group's data written twice. That is kilobytes, and it
 * buys a rollback that loses nothing.
 *
 * **Removable once no supported version reads the old shape** — the grouped
 * fields are what every current reader uses, so deleting `toStored`'s spread is
 * the whole change.
 */
const toStored = (state: GroupedLeaderboard) => {
  const active =
    state.groups.find((entry) => entry.group.id === state.activeGroupId) ??
    state.groups[0];
  return {
    ...state,
    players: active?.players ?? [],
    results: active?.results ?? [],
  };
};

export function createLeaderboardStorage(
  storage: StorageAdapter,
  migration: LeaderboardMigration,
): LeaderboardStorage {
  return {
    async loadLeaderboard(): Promise<GroupedLeaderboard> {
      try {
        const raw = await storage.getItem(LEADERBOARD_KEY);
        if (!raw) return EMPTY_LEADERBOARD;
        const parsed: unknown = JSON.parse(raw);
        if (!isObject(parsed)) return EMPTY_LEADERBOARD;

        // Already grouped: read it back as it was written.
        if (Array.isArray(parsed.groups)) {
          const groups = coerceGroups(parsed.groups, migration.defaultGroupName);
          /**
           * **Read back, and read back *before* the empty check.** A deleted
           * board's membership is still on the server and `GET /groups` keeps
           * listing it, so this list is the only thing stopping the pull from
           * putting the whole board back — and deleting your *only* board takes
           * exactly the path below, which is precisely when it matters most.
           */
          const dismissed = coerceIds(parsed.dismissed);
          const withDismissals = <T extends GroupedLeaderboard>(state: T) =>
            dismissed.length > 0 ? { ...state, dismissed } : state;
          if (groups.length === 0) return withDismissals(EMPTY_LEADERBOARD);
          // A selection pointing at a group that didn't survive coercion would
          // show an empty board indistinguishable from a real one.
          const stored = parsed.activeGroupId;
          const activeGroupId =
            typeof stored === "string" &&
            groups.some((entry) => entry.group.id === stored)
              ? stored
              : groups[0].group.id;
          // Omitted when empty, so a leaderboard that has deleted nothing
          // round-trips to the shape it had before this existed.
          return withDismissals({ groups, activeGroupId });
        }

        // The single board that shipped first. Migrate it in place: it is
        // somebody's real history, so it becomes a group rather than being
        // replaced by one, and it stays selected.
        const migrated = migrateToGroups(
          {
            players: coercePlayers(parsed.players),
            results: coerceResults(parsed.results),
          },
          {
            id: migration.createGroupId(),
            name: migration.defaultGroupName,
            now: migration.now(),
          },
        );

        // Write it back, so the migration happens once rather than on every
        // launch. Without this the old blob stays on disk until something else
        // happens to save, and the group is rebuilt with a **new id** every
        // time — which is invisible while there is one group and becomes a real
        // bug the moment a group can be selected or renamed.
        //
        // Best-effort: a load must still succeed if the write fails, because
        // the alternative is a user with a full season of history seeing an
        // empty board because the disk was full.
        try {
          await storage.setItem(LEADERBOARD_KEY, JSON.stringify(toStored(migrated)));
        } catch {
          // Nothing to do but try again next launch.
        }

        return migrated;
      } catch {
        return EMPTY_LEADERBOARD;
      }
    },

    async saveLeaderboard(state: GroupedLeaderboard): Promise<void> {
      await storage.setItem(LEADERBOARD_KEY, JSON.stringify(toStored(state)));
    },

    async clearLeaderboard(): Promise<void> {
      await storage.multiRemove([LEADERBOARD_KEY]);
    },
  };
}
