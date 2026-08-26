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
  claimPlayer,
  addPlayer,
  computeStandings,
  createGameResult,
  createGroup,
  createPlayer,
  EMPTY_LEADERBOARD,
  isValidGroupName,
  MAX_GROUPS,
  removeGameResult,
  playerForAccount,
  removeGroup,
  removePlayer,
  renameGroup,
  setActiveGroup,
  unclaimPlayer,
  updateGroup,
  validateGameResult,
  ClaimError,
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

/** One group as the picker needs it: enough to list without loading a board. */
export type GroupSummary = {
  id: string;
  name: string;
  playerCount: number;
  gameCount: number;
};

type LeaderboardContextValue = {
  /** Every group, oldest first, for the picker. */
  groups: GroupSummary[];
  activeGroupId: string | null;
  /** The active group's name, or `""` when there is no group yet. */
  activeGroupName: string;
  canAddGroup: boolean;
  /** Whether a name is free to use, ignoring the group being renamed. */
  isGroupNameAvailable: (name: string, exceptId?: string) => boolean;
  selectGroup: (id: string) => void;
  createNewGroup: (name: string) => void;
  renameGroupById: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  /** The active group's roster. Empty when there is no group yet. */
  players: Player[];
  /** The active group's game history. */
  results: GameResult[];
  /** Derived from the two above; ranked and tie-broken in @poker/core. */
  standings: LeaderboardStanding[];
  isLoading: boolean;
  addNewPlayer: (name: string) => void;
  deletePlayer: (id: string) => void;
  /** Returns false when the result was refused, so a caller can say so
   * instead of reporting a save that never happened. */
  recordResult: (params: {
    playerIds: string[];
    placings: Placing[];
    buyIn: number;
    bounty: number;
  }) => boolean;
  deleteResult: (id: string) => void;
  /** The player this account holds on the active board, if any. */
  claimedPlayer: (accountId: string) => Player | null;
  /**
   * Say that a player on the board is you.
   *
   * Returns why not, if not. The account id is passed in rather than read from
   * a context here, because the auth provider is mounted *inside* this one —
   * and reordering the tree to read it would put every leaderboard consumer
   * behind an account it does not need.
   */
  claimPlayerAs: (playerId: string, accountId: string) => ClaimError | null;
  /**
   * Unlink whatever account holds this player.
   *
   * Deliberately **not** guarded on which account it is, unlike
   * {@link claimPlayerAs}, which refuses two of its cases. Claiming guards
   * because two claims genuinely conflict; releasing does not — and orphan
   * recovery *requires* releasing a claim that is not the current account's,
   * since a board is device-local while account ids are not. Sign out, sign
   * back in, and the id may differ; delete the account and no id matches at
   * all. Without this the player would be stuck: unclaimable because it is
   * claimed, unreleasable because the claim is not yours.
   */
  releasePlayer: (playerId: string) => void;
  /** Unlink every player this account holds, across every board on the device. */
  releaseAllFor: (accountId: string) => void;
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
        return false;
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
      return true;
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

  const claimedPlayer = useCallback(
    (accountId: string) =>
      state.activeGroupId
        ? playerForAccount(state, state.activeGroupId, accountId)
        : null,
    [state],
  );

  const claimPlayerAs = useCallback(
    (playerId: string, accountId: string): ClaimError | null => {
      if (!state.activeGroupId) return "no-such-group";
      const result = claimPlayer(state, {
        groupId: state.activeGroupId,
        playerId,
        accountId,
      });
      if (!result.ok) return result.error;
      persist(result.state);
      return null;
    },
    [state, persist],
  );

  const releasePlayer = useCallback(
    (playerId: string) => {
      if (!state.activeGroupId) return;
      persist(
        unclaimPlayer(state, { groupId: state.activeGroupId, playerId }),
      );
    },
    [state, persist],
  );

  /**
   * Let go of every player an account holds, everywhere on this device.
   *
   * Called when that account signs out or is deleted. Without it the claims
   * survive the account and point at nothing: the player cannot be claimed
   * (something holds it) and cannot be released (it is not yours), which is a
   * dead end reachable through the account deletion the App Store requires.
   */
  const releaseAllFor = useCallback(
    (accountId: string) => {
      let next = state;
      for (const entry of state.groups) {
        const held = entry.players.find(
          (player) => player.accountId === accountId,
        );
        if (!held) continue;
        next = unclaimPlayer(next, {
          groupId: entry.group.id,
          playerId: held.id,
        });
      }
      if (next !== state) persist(next);
    },
    [state, persist],
  );

  const standings = useMemo(
    () => computeStandings(board.players, board.results),
    [board.players, board.results],
  );

  const groups = useMemo<GroupSummary[]>(
    () =>
      state.groups.map((entry) => ({
        id: entry.group.id,
        name: entry.group.name,
        playerCount: entry.players.length,
        gameCount: entry.results.length,
      })),
    [state.groups],
  );

  const isGroupNameAvailable = useCallback(
    (name: string, exceptId?: string) =>
      isValidGroupName(name, state.groups, exceptId),
    [state.groups],
  );

  const selectGroup = useCallback(
    (id: string) => persist(setActiveGroup(state, id)),
    [state, persist],
  );

  const createNewGroup = useCallback(
    (name: string) => {
      if (!isValidGroupName(name, state.groups)) return;
      persist(
        addGroup(
          state,
          createGroup({ id: generateId(), name, now: Date.now() }),
        ),
      );
    },
    [state, persist],
  );

  const renameGroupById = useCallback(
    (id: string, name: string) => persist(renameGroup(state, id, name)),
    [state, persist],
  );

  const deleteGroup = useCallback(
    (id: string) => persist(removeGroup(state, id)),
    [state, persist],
  );

  return (
    <LeaderboardContext.Provider
      value={{
        groups,
        activeGroupId: state.activeGroupId,
        activeGroupName: activeEntry?.group.name ?? "",
        canAddGroup: state.groups.length < MAX_GROUPS,
        isGroupNameAvailable,
        selectGroup,
        createNewGroup,
        renameGroupById,
        deleteGroup,
        players: board.players,
        results: board.results,
        standings,
        isLoading,
        addNewPlayer,
        deletePlayer,
        recordResult,
        deleteResult,
        claimedPlayer,
        claimPlayerAs,
        releasePlayer,
        releaseAllFor,
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
