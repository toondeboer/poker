import { describe, expect, it } from "vitest";
import { createPushSender, resultRecordedMessage } from "../lib/lambda/push";
import { isExpoPushToken } from "../lib/lambda/pushStore";
import type { PushStore } from "../lib/lambda/pushStore";

const store = (tokens: Record<string, string[]>) => {
  const forgotten: { accountId: string; token: string }[] = [];
  const impl: PushStore = {
    async remember() {},
    async forget(accountId, token) {
      forgotten.push({ accountId, token });
    },
    async tokensFor(accountId) {
      return tokens[accountId] ?? [];
    },
  };
  return { impl, forgotten };
};

const ok = (tickets: unknown[] = []) =>
  ({
    ok: true,
    async json() {
      return { data: tickets };
    },
  }) as unknown as Response;

describe("what a token has to look like", () => {
  it("accepts what Expo issues", () => {
    expect(isExpoPushToken("ExponentPushToken[abc-123_XYZ.9]")).toBe(true);
  });

  it("refuses anything else, because this arrives in a request body", () => {
    for (const value of [
      "",
      "abc",
      "ExponentPushToken[]",
      "ExponentPushToken[bad token]",
      42,
      null,
    ]) {
      expect(isExpoPushToken(value)).toBe(false);
    }
  });
});

describe("what the notification says", () => {
  it("names the board rather than the player", () => {
    // A board name is chosen by the group; a player name is typed by whoever
    // added them. Only one of those belongs on a stranger's lock screen.
    const message = resultRecordedMessage("tok", "Thursday night", "g-1");
    expect(message.title).toBe("Thursday night");
    expect(message.body).not.toContain("Ann");
    expect(message.data).toEqual({ kind: "result-recorded", groupId: "g-1" });
  });
});

describe("who gets told", () => {
  it("tells the other members", async () => {
    const { impl } = store({ b: ["ExponentPushToken[b]"] });
    const sent: unknown[] = [];
    const sender = createPushSender(impl, (async (
      _url: unknown,
      init: RequestInit,
    ) => {
      sent.push(JSON.parse(String(init.body)));
      return ok();
    }) as unknown as typeof fetch);

    await sender.resultRecorded({
      groupId: "g-1",
      boardName: "Board",
      memberIds: ["a", "b"],
      actorId: "a",
    });

    expect(sent).toEqual([
      [resultRecordedMessage("ExponentPushToken[b]", "Board", "g-1")],
    ]);
  });

  it("never tells the person who recorded it — they are holding the phone", async () => {
    const { impl } = store({ a: ["ExponentPushToken[a]"] });
    let called = false;
    const sender = createPushSender(impl, (async () => {
      called = true;
      return ok();
    }) as unknown as typeof fetch);

    await sender.resultRecorded({
      groupId: "g-1",
      boardName: "Board",
      memberIds: ["a"],
      actorId: "a",
    });

    expect(called).toBe(false);
  });

  it("sends nothing when nobody else registered a device", async () => {
    const { impl } = store({});
    let called = false;
    const sender = createPushSender(impl, (async () => {
      called = true;
      return ok();
    }) as unknown as typeof fetch);

    await sender.resultRecorded({
      groupId: "g-1",
      boardName: "Board",
      memberIds: ["a", "b"],
      actorId: "a",
    });

    expect(called).toBe(false);
  });
});

describe("when sending goes wrong", () => {
  it("swallows a refusal, because a push must never fail a recorded game", async () => {
    const { impl } = store({ b: ["ExponentPushToken[b]"] });
    const sender = createPushSender(
      impl,
      (async () =>
        ({
          ok: false,
          status: 500,
        }) as unknown as Response) as unknown as typeof fetch,
    );

    await expect(
      sender.resultRecorded({
        groupId: "g-1",
        boardName: "Board",
        memberIds: ["a", "b"],
        actorId: "a",
      }),
    ).resolves.toBeUndefined();
  });

  it("swallows a thrown request too", async () => {
    const { impl } = store({ b: ["ExponentPushToken[b]"] });
    const sender = createPushSender(impl, (async () => {
      throw new Error("no network");
    }) as unknown as typeof fetch);

    await expect(
      sender.resultRecorded({
        groupId: "g-1",
        boardName: "Board",
        memberIds: ["a", "b"],
        actorId: "a",
      }),
    ).resolves.toBeUndefined();
  });

  it("forgets a token Expo says is gone, with the account it belonged to", async () => {
    // The only signal an app was uninstalled. Without it the row lives to its
    // TTL and every send pays for a device that cannot receive.
    const { impl, forgotten } = store({
      b: ["ExponentPushToken[b]"],
      c: ["ExponentPushToken[c]"],
    });
    const sender = createPushSender(impl, (async () =>
      ok([
        { status: "ok" },
        { status: "error", details: { error: "DeviceNotRegistered" } },
      ])) as unknown as typeof fetch);

    await sender.resultRecorded({
      groupId: "g-1",
      boardName: "Board",
      memberIds: ["a", "b", "c"],
      actorId: "a",
    });

    // Positional: the second ticket is the verdict on the second message, which
    // is c's token — and the account has to travel with it or the row cannot
    // be found.
    expect(forgotten).toEqual([
      { accountId: "c", token: "ExponentPushToken[c]" },
    ]);
  });
});
