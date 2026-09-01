import { afterEach, describe, expect, it } from "vitest";
import type { GameResult, GroupState } from "@poker/core";
import {
  callerOf,
  handler,
  useGroupStore,
  visibleTo,
  type VerifiedRequest,
} from "../lib/lambda/groups";
import type { GroupStore, WriteOutcome } from "../lib/lambda/groupStore";
import { membershipItem, type MembershipItem, type Role } from "../lib/lambda/groupKeys";

const game = (id = "r1"): GameResult => ({
  id,
  playedAt: 1_700_000_000_000,
  playerIds: ["p1"],
  placings: [],
  buyIn: 10,
  bounty: 0,
});

const board: GroupState = {
  group: { id: "g1", name: "Thursday", createdAt: 1 },
  players: [
    { id: "p1", name: "Ann", accountId: "me" },
    { id: "p2", name: "Bo", accountId: "someone-else" },
    { id: "p3", name: "Cy" },
  ],
  results: [game()],
};

const calls: string[] = [];

const store = (role: Role | null, overrides: Partial<GroupStore> = {}): GroupStore =>
  ({
    membership: async (): Promise<MembershipItem | null> =>
      role ? membershipItem("me", "g1", role, 1) : null,
    members: async () => [],
    belongings: async () => [
      { pk: "ACCOUNT#me", sk: "GROUP#g1" },
      { pk: "ACCOUNT#me", sk: "CLAIM#g1#p1" },
    ],
    board: async () => board,
    addPlayer: async () => {
      calls.push("addPlayer");
      return { status: "ok" } as WriteOutcome;
    },
    recordGame: async () => {
      calls.push("recordGame");
      return { status: "ok" } as WriteOutcome;
    },
    removePlayer: async () => {
      calls.push("removePlayer");
      return { status: "ok" } as WriteOutcome;
    },
    removeGame: async () => {
      calls.push("removeGame");
      return { status: "ok" } as WriteOutcome;
    },
    claimPlayer: async () => {
      calls.push("claimPlayer");
      return { status: "ok" } as WriteOutcome;
    },
    releaseClaim: async () => ({ status: "ok" }) as WriteOutcome,
    setRole: async () => {
      calls.push("setRole");
      return { status: "ok" } as WriteOutcome;
    },
    promoteHeir: async () => ({ status: "ok" }) as WriteOutcome,
    createGroup: async () => ({ status: "ok" }) as WriteOutcome,
    setInvite: async () => ({ status: "ok" }) as WriteOutcome,
    groupForInvite: async () => "g1",
    join: async () => ({ status: "ok" }) as WriteOutcome,
    forget: async () => {},
    ...overrides,
  }) as GroupStore;

const request = (
  routeKey: string,
  options: {
    sub?: string | null;
    pathParameters?: Record<string, string>;
    body?: unknown;
  } = {},
): VerifiedRequest => ({
  routeKey,
  pathParameters: options.pathParameters ?? { groupId: "g1" },
  body: options.body === undefined ? null : JSON.stringify(options.body),
  requestContext: {
    requestId: "req-1",
    authorizer:
      options.sub === null ? {} : { jwt: { claims: { sub: options.sub ?? "me" } } },
  },
});

const body = (response: { body: string }) => JSON.parse(response.body);

afterEach(() => {
  useGroupStore(null);
  calls.length = 0;
});

describe("who is calling", () => {
  it("is the subject and nothing else", () => {
    // The one field in a request the caller cannot choose, put there by API
    // Gateway after it verified a signature.
    expect(callerOf(request("GET /groups"))).toBe("me");
    expect(callerOf(request("GET /groups", { sub: null }))).toBeNull();
  });

  it("refuses a request with no subject rather than guessing", async () => {
    useGroupStore(store("admin"));
    const response = await handler(request("GET /groups", { sub: null }));
    expect(response.statusCode).toBe(401);
  });
});

describe("a stranger", () => {
  it("is told the group does not exist, not that it is forbidden", async () => {
    // 404 rather than 403. Saying "this exists and you may not see it" confirms
    // a group id is real, which is the one bit an outsider does not have — and
    // ids travel, into logs and screenshots and pasted URLs.
    useGroupStore(store(null));
    const response = await handler(request("GET /groups/{groupId}"));
    expect(response.statusCode).toBe(404);
    expect(body(response).error).toBe("no such group");
  });

  it("cannot read, add, record or claim", async () => {
    useGroupStore(store(null));
    for (const route of [
      "GET /groups/{groupId}",
      "POST /groups/{groupId}/players",
      "POST /groups/{groupId}/games",
      "POST /groups/{groupId}/claims",
    ]) {
      const response = await handler(request(route, { body: { player: { id: "x", name: "X" } } }));
      expect(response.statusCode).toBe(404);
    }
    // Nothing reached the store. The check happens before the act, which is the
    // whole reason there is one entry point.
    expect(calls).toEqual([]);
  });
});

describe("a member", () => {
  it("may add a player, record a game and claim", async () => {
    useGroupStore(store("member"));
    const ok = [
      await handler(
        request("POST /groups/{groupId}/players", {
          body: { player: { id: "p9", name: "Di" } },
        }),
      ),
      await handler(
        request("POST /groups/{groupId}/games", { body: { result: game("r2") } }),
      ),
      await handler(request("POST /groups/{groupId}/claims", { body: { playerId: "p3" } })),
    ];
    expect(ok.map((r) => r.statusCode)).toEqual([200, 200, 200]);
    expect(calls).toEqual(["addPlayer", "recordGame", "claimPlayer"]);
  });

  it("leaves the last-admin guard to the write, not a read", async () => {
    // Reading the members and then writing is a check two people can both pass.
    // The store decrements a counter conditional on staying above one, so the
    // route just reports what the write said.
    useGroupStore(
      store("admin", {
        setRole: async () => ({
          status: "conflict",
          reason: "a group needs at least one admin",
        }),
      }),
    );
    const response = await handler(
      request("PUT /groups/{groupId}/members/{accountId}", {
        pathParameters: { groupId: "g1", accountId: "someone" },
        body: { role: "member" },
      }),
    );
    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).reason).toBe("a group needs at least one admin");
  });

  it("may not remove anything", async () => {
    // The asymmetry: anybody can write down a name, only somebody trusted can
    // make a season disappear.
    useGroupStore(store("member"));
    const removals = [
      await handler(
        request("DELETE /groups/{groupId}/players/{playerId}", {
          pathParameters: { groupId: "g1", playerId: "p1" },
        }),
      ),
      await handler(
        request("DELETE /groups/{groupId}/games/{gameId}", {
          pathParameters: { groupId: "g1", gameId: "r1" },
          body: { result: game() },
        }),
      ),
    ];
    expect(removals.map((r) => r.statusCode)).toEqual([403, 403]);
    expect(calls).toEqual([]);
  });

  it("cannot claim a player by adding one that names an account", async () => {
    // Adding is not claiming. Honouring an `accountId` here would route around
    // the transaction that checks nobody else already holds the player.
    let added: { accountId?: string } | null = null;
    useGroupStore(
      store("member", {
        addPlayer: async (_g, player) => {
          added = player;
          return { status: "ok" };
        },
      }),
    );
    await handler(
      request("POST /groups/{groupId}/players", {
        body: { player: { id: "p9", name: "Di", accountId: "someone-else" } },
      }),
    );
    expect(added).toEqual({ id: "p9", name: "Di" });
  });
});

describe("an admin", () => {
  it("may remove a player and a game", async () => {
    useGroupStore(store("admin"));
    const removals = [
      await handler(
        request("DELETE /groups/{groupId}/players/{playerId}", {
          pathParameters: { groupId: "g1", playerId: "p1" },
        }),
      ),
      await handler(
        request("DELETE /groups/{groupId}/games/{gameId}", {
          pathParameters: { groupId: "g1", gameId: "r1" },
          body: { result: game() },
        }),
      ),
    ];
    expect(removals.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(calls).toEqual(["removePlayer", "removeGame"]);
  });

  it("cannot delete a game by sending a different one", async () => {
    // The body carries the game because the sort key needs `playedAt`. Without
    // this check, the path would name one game and the tombstone land on
    // another — and the condition on the write would not catch it, because the
    // other game exists.
    useGroupStore(store("admin"));
    const response = await handler(
      request("DELETE /groups/{groupId}/games/{gameId}", {
        pathParameters: { groupId: "g1", gameId: "r1" },
        body: { result: game("r-other") },
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(calls).toEqual([]);
  });
});

describe("what a board shows", () => {
  it("hides which account holds somebody else's player", () => {
    // `accountId` says which Cognito account a person is. Nobody at the table
    // needs that; they need the name, which is what is on the board.
    const seen = visibleTo("me", board);
    expect(seen.players.find((p) => p.id === "p2")).toEqual({ id: "p2", name: "Bo" });
  });

  it("keeps the caller's own claim, because the app shows you which one is you", () => {
    expect(visibleTo("me", board).players.find((p) => p.id === "p1")?.accountId).toBe("me");
  });

  it("leaves unclaimed players alone", () => {
    expect(visibleTo("me", board).players.find((p) => p.id === "p3")).toEqual({
      id: "p3",
      name: "Cy",
    });
  });

  it("is applied by the route, not left to the client", async () => {
    useGroupStore(store("member"));
    const response = await handler(request("GET /groups/{groupId}"));
    const players = body(response).players as { id: string; accountId?: string }[];
    expect(players.find((p) => p.id === "p2")).not.toHaveProperty("accountId");
  });
});

describe("listing my boards", () => {
  it("returns group ids and not claims", async () => {
    useGroupStore(store("member"));
    const response = await handler(request("GET /groups", { pathParameters: {} }));
    expect(body(response).groups).toEqual(["g1"]);
  });
});

describe("refusals that are not errors", () => {
  it("answers 409 when somebody else claimed first", async () => {
    // Ordinary at a table where two people tap at once. 409 says "look again",
    // which is different from "you did something wrong".
    useGroupStore(
      store("member", {
        claimPlayer: async () => ({ status: "conflict", reason: "already claimed" }),
      }),
    );
    const response = await handler(
      request("POST /groups/{groupId}/claims", { body: { playerId: "p3" } }),
    );
    expect(response.statusCode).toBe(409);
    expect(body(response).reason).toBe("already claimed");
  });

  it("answers 404 for a membership pointing at a group that is gone", async () => {
    // A membership row can outlive the group it names. The honest answer is the
    // same as never having been a member: there is nothing to show.
    useGroupStore(store("member", { board: async () => null }));
    const response = await handler(request("GET /groups/{groupId}"));
    expect(response.statusCode).toBe(404);
  });
});

describe("what a shared board will accept", () => {
  it("refuses a game with a malformed placing", async () => {
    // **A result is stored verbatim and served to every member.** A client
    // sending nonsense does not break its own screen; it puts something on a
    // shared board that everybody else's app then has to render. The player
    // route sidesteps this by rebuilding `{id, name}`; a result is too big for
    // that, so it is validated.
    useGroupStore(store("member"));
    const bad = { ...game(), placings: [{ playerId: "p1", place: 0, winnings: "lots" }] };
    const response = await handler(
      request("POST /groups/{groupId}/games", { body: { result: bad } }),
    );
    expect(response.statusCode).toBe(400);
    expect(calls).toEqual([]);
  });

  it("refuses a player whose id is empty", async () => {
    // Written happily, then dropped by `boardFrom` on every read: a row that
    // exists, answered 200, never appears, and cannot be deleted through an API
    // that addresses it by the id it does not have.
    useGroupStore(store("member"));
    const response = await handler(
      request("POST /groups/{groupId}/players", { body: { player: { id: "", name: "Ann" } } }),
    );
    expect(response.statusCode).toBe(400);
    expect(calls).toEqual([]);
  });

  it("refuses an id that would break the key it lands in", async () => {
    useGroupStore(store("member"));
    const response = await handler(
      request("POST /groups/{groupId}/players", {
        body: { player: { id: "a#b", name: "Ann" } },
      }),
    );
    expect(response.statusCode).toBe(400);
  });
});

describe("redeeming an invite", () => {
  it("refuses a link to a group that is gone", async () => {
    // An invite row outlives the group it names. Joining one would grant a
    // membership to something that answers 404 forever.
    useGroupStore(store("member", { board: async () => null }));
    const response = await handler(
      request("POST /invites/{token}", { pathParameters: { token: "tok" } }),
    );
    expect(response.statusCode).toBe(404);
  });
});

describe("bad requests", () => {
  it("refuses an unknown route rather than falling through to something", async () => {
    useGroupStore(store("admin"));
    expect((await handler(request("POST /groups/{groupId}/whatever"))).statusCode).toBe(
      404,
    );
  });

  it("refuses a write with nothing to write", async () => {
    useGroupStore(store("member"));
    expect(
      (await handler(request("POST /groups/{groupId}/players", { body: {} }))).statusCode,
    ).toBe(400);
    expect(
      (await handler(request("POST /groups/{groupId}/games", { body: {} }))).statusCode,
    ).toBe(400);
    expect(calls).toEqual([]);
  });
});
