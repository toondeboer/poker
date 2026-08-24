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
  addPlayer,
  computeStandings,
  createGameResult,
  createPlayer,
  removeGameResult,
  removePlayer,
  validateGameResult,
  GameResult,
  LeaderboardStanding,
  Placing,
  Player,
} from "@poker/core";
import { LeaderboardStorage } from "@/src/services/LeaderboardStorage";
import { logger } from "@/src/utils/logger";

/** Short, collision-resistant id — core stays clock/crypto-free, so we mint it here. */
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

type LeaderboardContextValue = {
  players: Player[];
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

/**
 * The group's players and game history (Pro feature).
 *
 * A context because the leaderboard screen and Settings' summary row both read
 * it, for the same reason as {@link PayoutProvider} — a stack push leaves the
 * screen underneath mounted, so two local copies would disagree the moment a
 * game is recorded.
 *
 * Players and results are written together under one key, so a save that adds
 * a player and the game they just played in can't half-land.
 */
export function LeaderboardProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<GameResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    LeaderboardStorage.loadLeaderboard()
      .then((loaded) => {
        if (!active) return;
        setPlayers(loaded.players);
        setResults(loaded.results);
      })
      .catch((error) => logger.error("Failed to load leaderboard:", error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback(
    (nextPlayers: Player[], nextResults: GameResult[]) => {
      setPlayers(nextPlayers);
      setResults(nextResults);
      LeaderboardStorage.saveLeaderboard({
        players: nextPlayers,
        results: nextResults,
      }).catch((error) => logger.error("Failed to save leaderboard:", error));
    },
    [],
  );

  const addNewPlayer = useCallback(
    (name: string) => {
      persist(
        addPlayer(players, createPlayer({ id: generateId(), name })),
        results,
      );
    },
    [players, results, persist],
  );

  const deletePlayer = useCallback(
    (id: string) => {
      // Results keep the id. The games still happened, and everyone else's
      // history depends on the field sizes they were part of; computeStandings
      // simply ignores placings for players no longer on the roster.
      persist(removePlayer(players, id), results);
    },
    [players, results, persist],
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
      persist(players, addGameResult(results, result));
    },
    [players, results, persist],
  );

  const deleteResult = useCallback(
    (id: string) => persist(players, removeGameResult(results, id)),
    [players, results, persist],
  );

  const standings = useMemo(
    () => computeStandings(players, results),
    [players, results],
  );

  return (
    <LeaderboardContext.Provider
      value={{
        players,
        results,
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
