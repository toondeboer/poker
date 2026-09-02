// src/contexts/LeaderboardContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  addBoard,
  noteDeleted,
  removePlayer,
  replaceBoard,
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
  type KnockoutCount,
  type RefusedWrite,
} from "@poker/core";
import {
  DEFAULT_GROUP_NAME,
  LeaderboardStorage,
} from "@/src/services/LeaderboardStorage";
import { generateId } from "@/src/utils/id";
import { logger } from "@/src/utils/logger";
import { useGroupSync } from "@/src/hooks/useGroupSync";

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
    /**
     * Who knocked out how many, when that is actually known — which is only
     * ever a game the app dealt. Left off by the record-a-game sheet, because
     * nobody can say afterwards.
     */
    knockouts?: readonly KnockoutCount[];
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

  /**
   * Writes the server would not take.
   *
   * **A write is checked when it syncs, not when it was made**, so a game
   * recorded on Tuesday can be refused on Thursday because an admin removed you
   * on Wednesday. Silently dropping it loses somebody's evening and silently
   * applying it is a lie, so it surfaces here for a screen to show and for
   * somebody to acknowledge.
   */
  refusedWrites: RefusedWrite[];
  acknowledgeRefusal: (id: string) => void;
  /**
   * Make a link that puts somebody on the active board.
   *
   * `null` when the server refused — you are not an admin of it, or the board
   * has never reached the server at all.
   */
  inviteToBoard: (groupId: string) => Promise<string | null>;
  /**
   * Redeem a link somebody sent, and put the board on this device.
   *
   * Says the board's name so a screen can say what happened, or why not.
   */
  joinBoard: (token: string) => Promise<
    { ok: true; name: string } | { ok: false; reason: string }
  >;
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
  /**
   * What the server has not been told yet.
   *
   * **Deliberately beside the board rather than inside it.** The board is what
   * somebody sees and is written first; this only remembers what still needs
   * sending, so losing it costs the news and never the night.
   */
  const sync = useGroupSync();
  // The stable half of it. `sync` itself changes whenever the queue does, and a
  // callback that depended on the object would be rebuilt on every write.
  const recordWrite = sync.record;
  const announceGroups = sync.announce;
  const cancelWrite = sync.cancel;
  const cancelBoardWrites = sync.cancelBoard;
  const fetchBoard = sync.fetchBoard;
  const mergeInto = sync.mergeInto;
  const { pullsWanted } = sync;

  /**
   * The board as it is *right now*, for the pull to fold its answer back into.
   *
   * A pull takes as long as the network does, and `state` inside the effect is
   * the snapshot from when it started — so a game recorded while boards were in
   * flight would be overwritten by a copy that predates it.
   */
  const latestState = useRef(state);

  const persist = useCallback((next: GroupedLeaderboard) => {
    // **Set here, not in an effect.** React defers the re-render, so without
    // this the ref is stale for the rest of the tick — and the pull loop reads
    // it again on its very next iteration. The same mistake the outbox made,
    // where it cost every write a foreground's delay. (The lint rule forbids
    // writing a ref from an effect body, so this is also the only place it can
    // go.)
    latestState.current = next;
    setState(next);
    LeaderboardStorage.saveLeaderboard(next).catch((error) =>
      logger.error("Failed to save leaderboard:", error),
    );
  }, []);

  useEffect(() => {
    let active = true;
    LeaderboardStorage.loadLeaderboard()
      .then((loaded) => {
        if (!active) return;
        latestState.current = loaded;
        setState(loaded);
        /**
         * **Every board, not only the ones made from now on.**
         *
         * Only newly created groups were announced, so a board that existed
         * before any of this — including the implicit first one the app makes
         * on its own, which nobody ever "creates" — was unknown to the server,
         * and every player and game recorded on it would have been refused *no
         * such group*, permanently, with nothing that would ever have fixed it.
         *
         * Cheap to repeat: the server answers *ok* to a board this account is
         * already on, and the queue ignores one it is already carrying.
         */
        announceGroups(
          loaded.groups.map((entry) => ({
            id: entry.group.id,
            name: entry.group.name,
            createdAt: entry.group.createdAt,
          })),
        );
      })
      .catch((error) => logger.error("Failed to load leaderboard:", error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
    // Once, on mount: `announce` is stable, and the board is read here exactly
    // once. Re-running would re-read storage over live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  /**
   * Read every board back from the server and merge it in.
   *
   * **Merged, never replaced** — see `mergeBoard`. A board that predates
   * syncing has a history nothing has told the server about, so the server's
   * copy is legitimately emptier and overwriting would delete a season.
   *
   * Runs when the app comes forward and again after the outbox drains, which
   * is what `pullsWanted` counts. Boards are pulled one at a time rather than
   * in parallel: there are at most a handful, and a phone that has just woken
   * up on a bad connection should not open five requests at once.
   */
  useEffect(() => {
    if (pullsWanted === 0 || isLoading) return;
    let active = true;
    void (async () => {
      for (const id of latestState.current.groups.map((entry) => entry.group.id)) {
        const remote = await fetchBoard(id);
        // **Superseded, so stop.** Carrying on would fetch every remaining
        // board alongside its replacement, doubling the requests on exactly the
        // bad connection this loop goes one at a time to avoid.
        if (!active) return;
        if (!remote) continue;
        /**
         * The local board is read **here**, after the request came back, not
         * when the loop started. Somebody can record a game while boards are in
         * flight, and merging into the copy the fetch began with writes that
         * game straight back out of the board.
         */
        const current = latestState.current;
        const mine = current.groups.find((entry) => entry.group.id === id);
        // Deleted while the request was in flight. Nothing to merge into, and
        // `replaceBoard` would ignore it anyway.
        if (!mine) continue;
        persist(replaceBoard(current, mergeInto(mine, remote)));
      }
    })();
    return () => {
      active = false;
    };
  }, [pullsWanted, isLoading, fetchBoard, mergeInto, persist]);


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
    (update: (entry: GroupState) => GroupState): string => {
      if (activeEntry) {
        persist(updateGroup(state, activeEntry.group.id, update));
        return activeEntry.group.id;
      }
      const group = createGroup({
        id: generateId(),
        name: DEFAULT_GROUP_NAME,
        now: Date.now(),
      });
      const seeded = addGroup(state, group);
      persist(updateGroup(seeded, group.id, update));
      // **The group is announced before anything in it.** This one was created
      // implicitly by somebody adding a player to an empty leaderboard, so the
      // server has never heard of it and would refuse the player that follows.
      recordWrite({
        kind: "createGroup",
        groupId: group.id,
        name: group.name,
        createdAt: group.createdAt,
      });
      return group.id;
    },
    [activeEntry, state, persist, recordWrite],
  );

  const addNewPlayer = useCallback(
    (name: string) => {
      const player = createPlayer({ id: generateId(), name });
      // **The board first, the queue second**, which is what makes the queue
      // safe to lose: it carries the news that a player was added, never the
      // only record of it.
      const groupId = withActiveGroup((entry) => ({
        ...entry,
        players: addPlayer(entry.players, player),
      }));
      recordWrite({ kind: "addPlayer", groupId, player });
    },
    [withActiveGroup, recordWrite],
  );

  const deletePlayer = useCallback(
    (id: string) => {
      // Results keep the id. The games still happened, and everyone else's
      // history depends on the field sizes they were part of; computeStandings
      // simply ignores placings for players no longer on the roster.
      const groupId = withActiveGroup((entry) =>
        // Noted as deleted, or the next pull reads it back off the server and
        // faithfully puts it back — nothing tells the server about a removal.
        noteDeleted({ ...entry, players: removePlayer(entry.players, id) }, "players", id),
      );
      /**
       * **A name added with no signal and deleted before it went must not go.**
       *
       * Removing a player from a shared board is admin-only and deliberately
       * not a thing the queue can carry, so an add that survives its own
       * deletion is permanent: the typo appears on every member's board on the
       * next foreground and only an admin can take it off again.
       *
       * Cancels nothing that has already been sent — there is no recalling
       * that, and the board here has diverged from the server either way,
       * which is the same state a build with no backend has always been in.
       */
      cancelWrite({ kind: "addPlayer", groupId, playerId: id });
    },
    [withActiveGroup, cancelWrite],
  );

  const recordResult = useCallback(
    (params: {
      playerIds: string[];
      placings: Placing[];
      buyIn: number;
      bounty: number;
      knockouts?: readonly KnockoutCount[];
    }) => {
      // Guard the persistence boundary, not just the UI. The sheet already
      // constrains what it can build, but this is the one store whose data
      // can't be recreated by retyping it, so a malformed result must not reach
      // it if that ever stops being true.
      const invalid = validateGameResult({
        playerIds: params.playerIds,
        placings: params.placings,
        knockouts: params.knockouts ? [...params.knockouts] : undefined,
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
        knockouts: params.knockouts,
      });
      const groupId = withActiveGroup((entry) => ({
        ...entry,
        results: addGameResult(entry.results, result),
      }));
      recordWrite({ kind: "recordGame", groupId, result });
      return true;
    },
    [withActiveGroup, recordWrite],
  );

  const deleteResult = useCallback(
    (id: string) => {
      const groupId = withActiveGroup((entry) =>
        noteDeleted(
          { ...entry, results: removeGameResult(entry.results, id) },
          "results",
          id,
        ),
      );
      // Same as deleting a player: a game recorded at the table and deleted
      // before there was any signal should not turn up later on everybody
      // else's board, where removing it is somebody else's job.
      cancelWrite({ kind: "recordGame", groupId, resultId: id });
    },
    [withActiveGroup, cancelWrite],
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
      const group = createGroup({ id: generateId(), name, now: Date.now() });
      persist(addGroup(state, group));
      recordWrite({
        kind: "createGroup",
        groupId: group.id,
        name: group.name,
        createdAt: group.createdAt,
      });
    },
    [state, persist, recordWrite],
  );

  const renameGroupById = useCallback(
    (id: string, name: string) => {
      persist(renameGroup(state, id, name));
      /**
       * A board still waiting to be created should be created under its new
       * name. Replacing the queued write is the whole of what can be done here:
       * **there is no route that renames a board**, so one the server already
       * has keeps the name it was created with. Latent while nothing reads the
       * server's copy; it needs a `PATCH /groups/{id}` before anything does.
       */
      cancelWrite({ kind: "createGroup", groupId: id });
      const group = state.groups.find((entry) => entry.group.id === id)?.group;
      if (group) {
        recordWrite({ kind: "createGroup", groupId: id, name, createdAt: group.createdAt });
      }
    },
    [state, persist, cancelWrite, recordWrite],
  );

  const inviteToBoard = useCallback(
    (groupId: string) => sync.createInvite(groupId),
    [sync],
  );

  const joinBoard = useCallback(
    async (token: string) => {
      const redeemed = await sync.redeemInvite(token);
      if (!redeemed.ok) return redeemed;
      /**
       * **Joined, then read.** Redeeming writes the membership and says which
       * board; it does not hand the board back. Without the read that follows,
       * somebody taps a link and arrives at an empty leaderboard — which is
       * indistinguishable from the link not having worked.
       */
      const remote = await sync.fetchBoard(redeemed.groupId);
      if (!remote) {
        return {
          ok: false as const,
          reason: "Joined, but the board could not be loaded. Try again in a moment.",
        };
      }
      const current = latestState.current;
      const mine = current.groups.find((entry) => entry.group.id === redeemed.groupId);
      // Merged when it is already here — redeeming a link for a board you are
      // on is ordinary — and taken whole when it is not.
      const board = mine
        ? sync.mergeInto(mine, remote)
        : { ...remote.state, group: { ...remote.state.group, id: redeemed.groupId } };
      const next = addBoard(current, board);
      if (next === current) {
        return {
          ok: false as const,
          reason: `You can only have ${MAX_GROUPS} boards on this device.`,
        };
      }
      persist(next);
      return { ok: true as const, name: board.group.name };
    },
    [sync, persist],
  );

  const deleteGroup = useCallback(
    (id: string) => {
      persist(removeGroup(state, id));
      // **Everything queued for it, not just its creation.** A board made with
      // no signal and deleted before it synced would otherwise be created on
      // the server, with its players — and no route deletes a board, so it
      // would be there for good.
      cancelBoardWrites(id);
    },
    [state, persist, cancelBoardWrites],
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
        refusedWrites: sync.queue.refused,
        acknowledgeRefusal: sync.acknowledge,
        inviteToBoard,
        joinBoard,
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
