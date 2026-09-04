import { describe, expect, it } from "vitest";
import {
  createPublisher,
  eventsFor,
  publishBody,
  type Publication,
} from "../lib/lambda/tablePublisher";
import type { StoredTable } from "../lib/lambda/tableAction";
import {
  createRandom,
  createSession,
  playerChannel,
  startNextHand,
  tableChannel,
  cardToString,
} from "@poker/core";

/** A real dealt hand, so the cards under test are cards the engine dealt. */
const dealt = (): StoredTable => {
  const session = startNextHand(
    createSession({ players: ["u-1", "u-2", "u-3"], startingStack: 200 }),
    { smallBlind: 1, bigBlind: 2, random: createRandom(9) },
  );
  return { hand: session.hand!, version: 7 };
};

const publicEvent = (publications: Publication[]) =>
  publications.find((p) => p.channel === tableChannel("t-1"))!;

describe("what the whole table sees", () => {
  it("carries the hand and the version", () => {
    const event = publicEvent(eventsFor("t-1", dealt())).event;
    expect(event.type).toBe("table");
    expect(event.version).toBe(7);
  });

  it("contains nobody's cards", () => {
    // The security boundary of the entire feature, asserted against the actual
    // cards the engine dealt.
    //
    // **Compared as the objects they serialise to, not as `cardToString`.** The
    // first version of this searched a JSON string for `"2c"`, which a hand
    // rendered as `{"rank":2,"suit":"c"}` never contains — so it passed while
    // asserting nothing at all. The private-cards test below is what caught
    // it, by failing in the opposite direction.
    const table = dealt();
    const rendered = JSON.stringify(publicEvent(eventsFor("t-1", table)).event);
    const everyCard = table.hand.seats.flatMap((seat) => seat.hole);
    expect(everyCard.length).toBeGreaterThan(0);
    const leaked = everyCard
      .filter((card) => rendered.includes(JSON.stringify(card)))
      .map(cardToString);
    expect(leaked).toEqual([]);
  });

  it("contains no deck, which is the rest of the game", () => {
    const table = dealt();
    const event = publicEvent(eventsFor("t-1", table)).event;
    expect(table.hand.deck.length).toBeGreaterThan(0);
    expect((event as { hand: { deck: unknown[] } }).hand.deck).toEqual([]);
  });
});

describe("what one player sees", () => {
  it("goes to a channel only that player can subscribe to", () => {
    const publications = eventsFor("t-1", dealt());
    const mine = publications.find(
      (p) => p.channel === playerChannel("u-1", "t-1"),
    );
    expect(mine).toBeDefined();
    expect(mine!.event.type).toBe("cards");
  });

  it("carries that player's cards and no one else's", () => {
    // The other half of the boundary. A private event that included a second
    // seat would be a leak with a correct-looking channel name.
    const table = dealt();
    const publications = eventsFor("t-1", table);
    const failures: string[] = [];

    for (const seat of table.hand.seats) {
      const publication = publications.find(
        (p) => p.channel === playerChannel(seat.playerId, "t-1"),
      );
      if (!publication) {
        failures.push(`${seat.playerId}: nothing sent`);
        continue;
      }
      const rendered = JSON.stringify(publication.event);
      const others = table.hand.seats
        .filter((other) => other.playerId !== seat.playerId)
        .flatMap((other) => other.hole);
      for (const card of others) {
        // Only a genuine leak: two seats can legitimately hold the same *rank*,
        // so the whole card object is what gets compared.
        if (rendered.includes(JSON.stringify(card))) {
          failures.push(`${seat.playerId} was sent ${cardToString(card)}`);
        }
      }
      for (const card of seat.hole) {
        if (!rendered.includes(JSON.stringify(card))) {
          failures.push(
            `${seat.playerId} was not sent their own ${cardToString(card)}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("sends nothing to somebody with no cards left", () => {
    // A player dealt out has nothing private to say, and an empty event every
    // action is noise on a channel somebody pays for by the message.
    const table = dealt();
    const foldedOut = {
      ...table,
      hand: {
        ...table.hand,
        seats: table.hand.seats.map((seat, index) =>
          index === 0 ? { ...seat, hole: [] } : seat,
        ),
      },
    };
    const publications = eventsFor("t-1", foldedOut);
    expect(
      publications.some(
        (p) => p.channel === playerChannel(table.hand.seats[0].playerId, "t-1"),
      ),
    ).toBe(false);
  });

  it("builds its channel from the same function the server guards with", () => {
    // The two disagreeing about a path is a silent security bug, and was one.
    const publications = eventsFor("t-1", dealt());
    const channels = publications.map((p) => p.channel);
    expect(channels).toContain(playerChannel("u-2", "t-1"));
    expect(channels.every((channel) => channel.startsWith("/"))).toBe(true);
  });
});

describe("the body AppSync wants", () => {
  it("stringifies each event inside the JSON, which reads like a mistake", () => {
    const body = JSON.parse(
      publishBody("/table/t-1", [{ type: "table", version: 1, hand: {} as never }]),
    ) as { channel: string; events: string[] };
    expect(body.channel).toBe("/table/t-1");
    expect(typeof body.events[0]).toBe("string");
    expect(JSON.parse(body.events[0])).toMatchObject({ type: "table" });
  });
});

describe("sending", () => {
  const publication: Publication = {
    channel: "/table/t-1",
    event: { type: "table", version: 1, hand: {} as never },
  };

  it("signs the request and posts it to /event", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const publisher = createPublisher(
      "https://abc.appsync-api.eu-west-1.amazonaws.com",
      "eu-west-1",
      (async (url: string, init: RequestInit) => {
        calls.push({
          url,
          headers: init.headers as Record<string, string>,
        });
        return { ok: true, status: 200 } as Response;
      }) as unknown as typeof fetch,
    );

    process.env.AWS_ACCESS_KEY_ID = "AKIDEXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    expect(await publisher.send([publication])).toBe(true);

    expect(calls[0].url).toBe(
      "https://abc.appsync-api.eu-west-1.amazonaws.com/event",
    );
    expect(calls[0].headers.authorization).toContain("AWS4-HMAC-SHA256");
    expect(calls[0].headers.authorization).toContain("/appsync/aws4_request");
  });

  it("says it failed when any channel was refused", async () => {
    // Partial success is the state the caller most needs to know about: some
    // phones have the new hand and some do not.
    const publisher = createPublisher(
      "https://abc.example.com",
      "eu-west-1",
      (async (url: string) => ({
        ok: !url.includes("event") || false,
        status: 403,
      })) as unknown as typeof fetch,
    );
    process.env.AWS_ACCESS_KEY_ID = "AKIDEXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    expect(await publisher.send([publication])).toBe(false);
  });

  it("reports a failure rather than throwing when the send never lands", async () => {
    // **The table is already written by the time this runs.** A rejected fetch
    // — DNS, a reset connection, a socket timeout — used to escape
    // `Promise.all` and out of the action handler, so the client was told its
    // action failed for an action that had actually landed, then retried and
    // got a 409. `handler` documents that a failed publish leaves the table
    // correct and the screens stale; this is what makes that true.
    const publisher = createPublisher(
      "https://abc.example.com",
      "eu-west-1",
      (async () => {
        throw new TypeError("network request failed");
      }) as unknown as typeof fetch,
    );
    process.env.AWS_ACCESS_KEY_ID = "AKIDEXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    await expect(publisher.send([publication])).resolves.toBe(false);
  });

  it("refuses to publish with no credentials rather than unsigned", async () => {
    const before = process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_ACCESS_KEY_ID;
    const publisher = createPublisher("https://abc.example.com", "eu-west-1");
    expect(await publisher.send([publication])).toBe(false);
    process.env.AWS_ACCESS_KEY_ID = before;
  });
});
