import { describe, expect, it } from "vitest";
import { createGameResult, createPlayer } from "./gameResult";
import {
  EMPTY_LEADERBOARD,
  type GroupedLeaderboard,
  MAX_GROUPS,
  activeGroup,
  addGroup,
  claimPlayer,
  createGroup,
  isValidGroupName,
  migrateToGroups,
  playerForAccount,
  removeGroup,
  renameGroup,
  setActiveGroup,
  unclaimPlayer,
  updateGroup,
} from "./groups";

const group = (id: string, name = id, now = 0) => createGroup({ id, name, now });

/** A board with one group and the given player names on its roster. */
const withPlayers = (names: string[]): GroupedLeaderboard => {
  const state = addGroup(EMPTY_LEADERBOARD, group("g1", "Thursday"));
  return updateGroup(state, "g1", (entry) => ({
    ...entry,
    players: names.map((name) => createPlayer({ id: name, name })),
  }));
};

describe("groups", () => {
  it("starts with nothing and no selection", () => {
    expect(EMPTY_LEADERBOARD).toEqual({ groups: [], activeGroupId: null });
    expect(activeGroup(EMPTY_LEADERBOARD)).toBeNull();
  });

  it("selects a group as soon as it is added", () => {
    const state = addGroup(EMPTY_LEADERBOARD, group("g1", "Thursday"));
    expect(state.activeGroupId).toBe("g1");
    expect(activeGroup(state)?.group.name).toBe("Thursday");
  });

  it("trims the name it is given", () => {
    expect(group("g1", "  Thursday  ").name).toBe("Thursday");
  });

  it("stops at the maximum", () => {
    let state = EMPTY_LEADERBOARD;
    for (let i = 0; i < MAX_GROUPS; i++) state = addGroup(state, group(`g${i}`));
    expect(state.groups).toHaveLength(MAX_GROUPS);
    const full = addGroup(state, group("one-too-many"));
    expect(full).toBe(state);
  });

  it("refuses an empty or duplicate name, ignoring case", () => {
    const state = addGroup(EMPTY_LEADERBOARD, group("g1", "Thursday"));
    expect(isValidGroupName("Friday", state.groups)).toBe(true);
    expect(isValidGroupName("  ", state.groups)).toBe(false);
    expect(isValidGroupName("thursday", state.groups)).toBe(false);
  });

  it("renames without disturbing anything else", () => {
    let state = addGroup(EMPTY_LEADERBOARD, group("g1", "Thursday"));
    state = addGroup(state, group("g2", "Friday"));
    const renamed = renameGroup(state, "g1", "  Wednesday  ");
    expect(renamed.groups[0].group.name).toBe("Wednesday");
    expect(renamed.groups[1].group.name).toBe("Friday");
    expect(renamed.activeGroupId).toBe("g2");
  });

  it("holds a rename to the same rule as creating a group", () => {
    let state = addGroup(EMPTY_LEADERBOARD, group("g1", "Thursday"));
    state = addGroup(state, group("g2", "Friday"));
    expect(renameGroup(state, "g1", "   ")).toBe(state);
    expect(renameGroup(state, "g1", "friday")).toBe(state);
    expect(renameGroup(state, "nope", "Anything")).toBe(state);
  });

  it("lets a group keep its own name, in any casing", () => {
    // Fixing a group's own capitalisation must not read as a duplicate — and
    // without excluding the group itself, a caller cannot validate a rename.
    const state = addGroup(EMPTY_LEADERBOARD, group("g1", "Thursday"));
    expect(isValidGroupName("THURSDAY", state.groups, "g1")).toBe(true);
    expect(isValidGroupName("THURSDAY", state.groups)).toBe(false);
    expect(renameGroup(state, "g1", "THURSDAY").groups[0].group.name).toBe(
      "THURSDAY",
    );
  });

  it("hands back the very same state when nothing changed", () => {
    // Consumers compare by reference to decide whether to re-render and write
    // to disk, so an equal-but-new object is a pointless save and hides a typo
    // in an id.
    let state = addGroup(EMPTY_LEADERBOARD, group("g1"));
    state = addGroup(state, group("g2"));
    expect(updateGroup(state, "nope", (entry) => entry)).toBe(state);
    expect(removeGroup(state, "nope")).toBe(state);
    expect(setActiveGroup(state, "nope")).toBe(state);
    expect(unclaimPlayer(state, { groupId: "nope", playerId: "x" })).toBe(state);
  });

  it("cannot be corrupted through the shared empty value", () => {
    // EMPTY_LEADERBOARD is a singleton that migrateToGroups also returns; one
    // in-place push would poison every board in the process.
    expect(Object.isFrozen(EMPTY_LEADERBOARD)).toBe(true);
    expect(Object.isFrozen(EMPTY_LEADERBOARD.groups)).toBe(true);
  });

  it("moves the selection when the selected group is deleted", () => {
    // Coming back to a group that no longer exists would show an empty board
    // with no way to tell it apart from a real one.
    let state = addGroup(EMPTY_LEADERBOARD, group("g1"));
    state = addGroup(state, group("g2"));
    expect(state.activeGroupId).toBe("g2");
    const after = removeGroup(state, "g2");
    expect(after.activeGroupId).toBe("g1");
  });

  it("leaves the selection alone when a different group is deleted", () => {
    let state = addGroup(EMPTY_LEADERBOARD, group("g1"));
    state = addGroup(state, group("g2"));
    expect(removeGroup(state, "g1").activeGroupId).toBe("g2");
  });

  it("clears the selection when the last group goes", () => {
    const state = addGroup(EMPTY_LEADERBOARD, group("g1"));
    expect(removeGroup(state, "g1")).toEqual(EMPTY_LEADERBOARD);
  });

  it("ignores a delete for a group that isn't there", () => {
    const state = addGroup(EMPTY_LEADERBOARD, group("g1"));
    expect(removeGroup(state, "nope")).toBe(state);
  });

  it("ignores a selection of a group that isn't there", () => {
    const state = addGroup(EMPTY_LEADERBOARD, group("g1"));
    expect(setActiveGroup(state, "nope")).toBe(state);
    expect(setActiveGroup(state, "g1").activeGroupId).toBe("g1");
  });

  it("updates one group's board and no other", () => {
    let state = addGroup(EMPTY_LEADERBOARD, group("g1"));
    state = addGroup(state, group("g2"));
    const after = updateGroup(state, "g1", (entry) => ({
      ...entry,
      players: [createPlayer({ id: "p1", name: "Dave" })],
    }));
    expect(after.groups[0].players).toHaveLength(1);
    expect(after.groups[1].players).toHaveLength(0);
  });
});

describe("claiming a player", () => {
  it("attaches an account to a guest already on the roster", () => {
    const state = withPlayers(["Dave", "Sam"]);
    const result = claimPlayer(state, {
      groupId: "g1",
      playerId: "Dave",
      accountId: "acct-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(playerForAccount(result.state, "g1", "acct-1")?.name).toBe("Dave");
    expect(result.state.groups[0].players[1].accountId).toBeUndefined();
  });

  it("leaves every past game exactly where it was", () => {
    // The whole reason guests are first class: claiming is additive, so a
    // season played as a name on someone else's phone becomes yours intact.
    let state = withPlayers(["Dave", "Sam"]);
    const played = createGameResult({
      id: "game-1",
      playerIds: ["Dave", "Sam"],
      placings: [{ playerId: "Dave", place: 1, winnings: 40 }],
      buyIn: 20,
      bounty: 0,
      now: 1000,
    });
    state = updateGroup(state, "g1", (entry) => ({
      ...entry,
      results: [played],
    }));

    const result = claimPlayer(state, {
      groupId: "g1",
      playerId: "Dave",
      accountId: "acct-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.groups[0].results).toEqual([played]);
  });

  it("refuses a player another account already holds", () => {
    const state = withPlayers(["Dave"]);
    const first = claimPlayer(state, {
      groupId: "g1",
      playerId: "Dave",
      accountId: "acct-1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(
      claimPlayer(first.state, {
        groupId: "g1",
        playerId: "Dave",
        accountId: "acct-2",
      }),
    ).toEqual({ ok: false, error: "player-already-claimed" });
  });

  it("is idempotent for the account that already holds the player", () => {
    // A retried request must not fail the second time.
    const state = withPlayers(["Dave"]);
    const first = claimPlayer(state, {
      groupId: "g1",
      playerId: "Dave",
      accountId: "acct-1",
    });
    if (!first.ok) throw new Error("unreachable");
    const again = claimPlayer(first.state, {
      groupId: "g1",
      playerId: "Dave",
      accountId: "acct-1",
    });
    expect(again).toEqual({ ok: true, state: first.state });
  });

  it("refuses an account a second seat in the same group", () => {
    // One person is one seat: holding two would double-count their nights and
    // let them appear twice in one game's standings.
    const state = withPlayers(["Dave", "Sam"]);
    const first = claimPlayer(state, {
      groupId: "g1",
      playerId: "Dave",
      accountId: "acct-1",
    });
    if (!first.ok) throw new Error("unreachable");
    expect(
      claimPlayer(first.state, {
        groupId: "g1",
        playerId: "Sam",
        accountId: "acct-1",
      }),
    ).toEqual({ ok: false, error: "account-already-in-group" });
  });

  it("lets one account hold a player in each of several groups", () => {
    // Different friends, different boards, same person.
    let state = withPlayers(["Dave"]);
    state = addGroup(state, group("g2", "Friday"));
    state = updateGroup(state, "g2", (entry) => ({
      ...entry,
      players: [createPlayer({ id: "davey", name: "Davey" })],
    }));

    const first = claimPlayer(state, {
      groupId: "g1",
      playerId: "Dave",
      accountId: "acct-1",
    });
    if (!first.ok) throw new Error("unreachable");
    const second = claimPlayer(first.state, {
      groupId: "g2",
      playerId: "davey",
      accountId: "acct-1",
    });
    expect(second.ok).toBe(true);
  });

  it("says which thing was missing", () => {
    const state = withPlayers(["Dave"]);
    expect(
      claimPlayer(state, { groupId: "nope", playerId: "Dave", accountId: "a" }),
    ).toEqual({ ok: false, error: "no-such-group" });
    expect(
      claimPlayer(state, { groupId: "g1", playerId: "nope", accountId: "a" }),
    ).toEqual({ ok: false, error: "no-such-player" });
  });
});

describe("unclaiming", () => {
  it("returns the player to being a guest, keeping their history", () => {
    const state = withPlayers(["Dave"]);
    const claimed = claimPlayer(state, {
      groupId: "g1",
      playerId: "Dave",
      accountId: "acct-1",
    });
    if (!claimed.ok) throw new Error("unreachable");

    const after = unclaimPlayer(claimed.state, {
      groupId: "g1",
      playerId: "Dave",
    });
    expect(after.groups[0].players[0].name).toBe("Dave");
    expect(playerForAccount(after, "g1", "acct-1")).toBeNull();
  });

  it("drops the key rather than leaving it undefined, so JSON round-trips", () => {
    const state = withPlayers(["Dave"]);
    const claimed = claimPlayer(state, {
      groupId: "g1",
      playerId: "Dave",
      accountId: "acct-1",
    });
    if (!claimed.ok) throw new Error("unreachable");
    const after = unclaimPlayer(claimed.state, { groupId: "g1", playerId: "Dave" });
    expect(Object.hasOwn(after.groups[0].players[0], "accountId")).toBe(false);
    expect(JSON.parse(JSON.stringify(after))).toEqual(after);
  });

  it("frees the account to claim someone else in that group", () => {
    const state = withPlayers(["Dave", "Sam"]);
    const claimed = claimPlayer(state, {
      groupId: "g1",
      playerId: "Dave",
      accountId: "acct-1",
    });
    if (!claimed.ok) throw new Error("unreachable");
    const freed = unclaimPlayer(claimed.state, { groupId: "g1", playerId: "Dave" });
    expect(
      claimPlayer(freed, { groupId: "g1", playerId: "Sam", accountId: "acct-1" }).ok,
    ).toBe(true);
  });

  it("does nothing for a player who was never claimed", () => {
    const state = withPlayers(["Dave"]);
    expect(unclaimPlayer(state, { groupId: "g1", playerId: "Dave" })).toBe(state);
  });

  it("does nothing for a player or group that isn't there", () => {
    const state = withPlayers(["Dave"]);
    expect(unclaimPlayer(state, { groupId: "g1", playerId: "nope" })).toBe(state);
    expect(unclaimPlayer(state, { groupId: "nope", playerId: "Dave" })).toBe(state);
  });
});

describe("migrating the board that shipped first", () => {
  it("turns an existing board into a group, still selected", () => {
    const legacy = {
      players: [createPlayer({ id: "p1", name: "Dave" })],
      results: [
        createGameResult({
          id: "game-1",
          playerIds: ["p1"],
          placings: [{ playerId: "p1", place: 1, winnings: 20 }],
          buyIn: 20,
          bounty: 0,
          now: 1000,
        }),
      ],
    };
    const migrated = migrateToGroups(legacy, {
      id: "g1",
      name: "My group",
      now: 5000,
    });
    expect(migrated.activeGroupId).toBe("g1");
    expect(migrated.groups).toHaveLength(1);
    expect(migrated.groups[0].players).toEqual(legacy.players);
    expect(migrated.groups[0].results).toEqual(legacy.results);
  });

  it("makes no group at all from an empty board", () => {
    // Someone who never used the feature should not find a group they now
    // have to delete.
    expect(
      migrateToGroups({ players: [], results: [] }, { id: "g1", name: "x", now: 1 }),
    ).toEqual(EMPTY_LEADERBOARD);
  });

  it("keeps a roster with no games yet", () => {
    const legacy = { players: [createPlayer({ id: "p1", name: "Dave" })], results: [] };
    const migrated = migrateToGroups(legacy, { id: "g1", name: "x", now: 1 });
    expect(migrated.groups[0].players).toHaveLength(1);
  });

  it("keeps games whose players have since been removed", () => {
    // removePlayer deliberately leaves past results intact, so a migration
    // that dropped them would lose history the app went out of its way to keep.
    const legacy = {
      players: [],
      results: [
        createGameResult({
          id: "game-1",
          playerIds: ["gone"],
          placings: [],
          buyIn: 20,
          bounty: 0,
          now: 1000,
        }),
      ],
    };
    const migrated = migrateToGroups(legacy, { id: "g1", name: "x", now: 1 });
    expect(migrated.groups[0].results).toHaveLength(1);
  });
});
