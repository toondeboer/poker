import { describe, expect, it } from "vitest";
import { reasonFrom, requestFor, resultForStatus } from "./groupRequests";
import type { QueuedWrite } from "./pendingWrites";

const addPlayer = (groupId = "g1"): QueuedWrite => ({
  kind: "addPlayer",
  groupId,
  player: { id: "p1", name: "Ann" },
  id: "w1",
  queuedAt: 1,
});

const recordGame: QueuedWrite = {
  kind: "recordGame",
  groupId: "g1",
  result: {
    id: "r1",
    playedAt: 1,
    playerIds: ["p1"],
    placings: [],
    buyIn: 10,
    bounty: 0,
  },
  id: "w2",
  queuedAt: 2,
};

describe("where a write goes", () => {
  it("posts a player to the group's players", () => {
    expect(requestFor(addPlayer(), "https://api").url).toBe(
      "https://api/groups/g1/players",
    );
  });

  it("posts a game to the group's games", () => {
    expect(requestFor(recordGame, "https://api").url).toBe(
      "https://api/groups/g1/games",
    );
  });

  it("does not double the slash on a base url that has one", () => {
    expect(requestFor(addPlayer(), "https://api/").url).toBe(
      "https://api/groups/g1/players",
    );
  });

  it("escapes a group id rather than pasting it into a path", () => {
    expect(requestFor(addPlayer("a/b"), "https://api").url).toBe(
      "https://api/groups/a%2Fb/players",
    );
  });

  it("does not send an accountId with a player", () => {
    // Adding is not claiming. The server ignores it, and sending it would
    // suggest otherwise to whoever reads this next.
    const claimed: QueuedWrite = {
      ...addPlayer(),
      kind: "addPlayer",
      player: { id: "p1", name: "Ann", accountId: "me" },
    };
    expect(JSON.parse(requestFor(claimed, "https://api").body)).toEqual({
      player: { id: "p1", name: "Ann" },
    });
  });
});

describe("what an answer means", () => {
  it("takes 2xx as landed", () => {
    expect(resultForStatus(200, "")).toEqual({ status: "ok" });
    expect(resultForStatus(201, "")).toEqual({ status: "ok" });
  });

  it("takes an ordinary 4xx as the server saying no", () => {
    // An answer, so it is never retried and somebody is told.
    expect(resultForStatus(409, "already recorded")).toEqual({
      status: "refused",
      reason: "already recorded",
    });
    expect(resultForStatus(403, "an admin has to do that").status).toBe("refused");
  });

  it("does not take a 5xx as a refusal", () => {
    // **The server never considered the request.** Calling this refused would
    // tell somebody their game was rejected when nothing ever read it.
    expect(resultForStatus(500, "boom")).toEqual({ status: "unreachable" });
    expect(resultForStatus(503, "boom")).toEqual({ status: "unreachable" });
  });

  it("retries a timeout and a rate limit, though they are 4xx", () => {
    // "Ask again", not "no". Recording them as refusals throws away a write
    // because the server was busy — the failure a queue exists to prevent.
    expect(resultForStatus(408, "slow")).toEqual({ status: "unreachable" });
    expect(resultForStatus(429, "too many")).toEqual({ status: "unreachable" });
  });
});

describe("what somebody is told", () => {
  it("prefers the reason a conflict gives", () => {
    expect(reasonFrom({ status: "conflict", reason: "already recorded" })).toBe(
      "already recorded",
    );
  });

  it("falls back to the error a bad request gives", () => {
    expect(reasonFrom({ error: "no player" })).toBe("no player");
  });

  it("says something true when the body is no help", () => {
    // A refusal reaches a person eventually, so it has to be a sentence rather
    // than a status code.
    for (const body of [null, undefined, "", 42, {}, { reason: "" }]) {
      expect(reasonFrom(body)).toBe("the server would not accept it");
    }
  });
});
