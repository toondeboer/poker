// src/contexts/LeaderboardContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addGameResult,
  addGroup,
  addPlayer,
  computeStandings,
  createGameResult,
  createGroup,
  createPlayer,
  EMPTY_LEADERBOARD,
  removeGameResult,
  removePlayer,
  updateGroup,
  validateGameResult,
  GameResult,
  GroupedLeaderboard,
  GroupState,
  LeaderboardStanding,
  Placing,
  Player,
} from "@poker/core";
import {
  DEFAULT_GROUP_NAME,
  LeaderboardStorage,
} from "@/src/services/LeaderboardStorage";
import { generateId } from "@/src/utils/id";
import { logger } from "@/src/utils/logger";

type LeaderboardContextValue = {
  /** The active group's roster. Empty when there is no group yet. */
  players: Player[];
  /** The active group's game history. */
  results: GameResult[];
  /** Derived from the two above; ranked and tie-broken in @poker/core. */
  standings: LeaderboardStanding[];
  isLoading: boolean;
  addNewPlayer: (name: string) => void;
  deletePlayer: (id: string) => void;
  recordResult: (params: {
    playerIds: string[];
    placings: Placing[];
    buyIn: number;
    bounty: number;
  }) => void;
  deleteResult: (id: string) => void;
};

const LeaderboardContext = createContext<LeaderboardContextValue | null>(null);

const EMPTY_GROUP: Pick<GroupState, "players" | "results"> = {
  players: [],
  results: [],
};

/**
 * The group's players and game history (Pro feature).
 *
 * A context because the leaderboard screen and Settings' summary row both read
 * it, for the same reason as {@link PayoutProvider} — a stack push leaves the
 * screen underneath mounted, so two local copies would disagree the moment a
 * game is recorded.
 *
 * **Stored as groups; read here as one board.** The data model holds a board
 * per set of friends, but everything above this reads the *active* one, so the
 * screens are unchanged and a host who only ever plays with one crowd never
 * meets the concept. A board that already existed before groups is migrated on
 * load and stays selected.
 *
 * Everything is written under one key, so a save that adds a player and the
 * game they just played in can't half-land.
 */
export function LeaderboardProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [state, setState] = useState<GroupedLeaderboard>(EMPTY_LEADERBOARD);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    LeaderboardStorage.loadLeaderboard()
      .then((loaded) => {
        if (!active) return;
        setState(loaded);
      })
      .catch((error) => logger.error("Failed to load leaderboard:", error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: GroupedLeaderboard) => {
    setState(next);
    LeaderboardStorage.saveLeaderboard(next).catch((error) =>
      logger.error("Failed to save leaderboard:", error),
    );
  }, []);

  const activeEntry = useMemo(
    () => state.groups.find((entry) => entry.group.id === state.activeGroupId),
    [state],
  );
  const board = activeEntry ?? EMPTY_GROUP;

  /**
   * Apply a change to the active group, creating one first if there isn't one.
   *
   * The implicit first group is what keeps groups invisible until somebody
   * wants them: adding a player to an empty leaderboard works exactly as it did
   * before, rather than demanding a group be named up front for a feature the
   * user hasn't asked for yet.
   */
  const withActiveGroup = useCallback(
    (update: (entry: GroupState) => GroupState) => {
      if (activeEntry) {
        persist(updateGroup(state, activeEntry.group.id, update));
        return;
      }
      const group = createGroup({
        id: generateId(),
        name: DEFAULT_GROUP_NAME,
        now: Date.now(),
      });
      const seeded = addGroup(state, group);
      persist(updateGroup(seeded, group.id, update));
    },
    [activeEntry, state, persist],
  );

  const addNewPlayer = useCallback(
    (name: string) => {
      withActiveGroup((entry) => ({
        ...entry,
        players: addPlayer(entry.players, createPlayer({ id: generateId(), name })),
      }));
    },
    [withActiveGroup],
  );

  const deletePlayer = useCallback(
    (id: string) => {
      // Results keep the id. The games still happened, and everyone else's
      // history depends on the field sizes they were part of; computeStandings
      // simply ignores placings for players no longer on the roster.
      withActiveGroup((entry) => ({
        ...entry,
        players: removePlayer(entry.players, id),
      }));
    },
    [withActiveGroup],
  );

  const recordResult = useCallback(
    (params: {
      playerIds: string[];
      placings: Placing[];
      buyIn: number;
      bounty: number;
    }) => {
      // Guard the persistence boundary, not just the UI. The sheet already
      // constrains what it can build, but this is the one store whose data
      // can't be recreated by retyping it, so a malformed result must not reach
      // it if that ever stops being true.
      const invalid = validateGameResult({
        playerIds: params.playerIds,
        placings: params.placings,
      });
      if (invalid) {
        logger.error("Refusing to record an invalid game result:", invalid);
        return;
      }
      const result = createGameResult({
        id: generateId(),
        playerIds: params.playerIds,
        placings: params.placings,
        buyIn: params.buyIn,
        bounty: params.bounty,
        now: Date.now(),
      });
      withActiveGroup((entry) => ({
        ...entry,
        results: addGameResult(entry.results, result),
      }));
    },
    [withActiveGroup],
  );

  const deleteResult = useCallback(
    (id: string) =>
      withActiveGroup((entry) => ({
        ...entry,
        results: removeGameResult(entry.results, id),
      })),
    [withActiveGroup],
  );

  const standings = useMemo(
    () => computeStandings(board.players, board.results),
    [board.players, board.results],
  );

  return (
    <LeaderboardContext.Provider
      value={{
        players: board.players,
        results: board.results,
        standings,
        isLoading,
        addNewPlayer,
        deletePlayer,
        recordResult,
        deleteResult,
      }}
    >
      {children}
    </LeaderboardContext.Provider>
  );
}

export function useLeaderboard() {
  const context = useContext(LeaderboardContext);
  if (!context) {
    throw new Error("useLeaderboard must be used within a LeaderboardProvider");
  }
  return context;
}
