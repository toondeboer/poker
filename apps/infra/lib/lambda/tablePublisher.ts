/**
 * Telling everybody what just happened.
 *
 * The write is only half of an action: a table that changed in DynamoDB and on
 * nobody's screen is not a table anybody is playing at. This is the other half.
 *
 * ## Secrecy is a property of where a thing is published
 *
 * The shared channel gets a hand with **every hole card removed**, and each
 * player's own cards go to a channel only they can subscribe to. There is no
 * code on a phone deciding what not to show you — which is the code that
 * eventually shows you the wrong thing — and no filtering in a client that a
 * modified client could skip.
 *
 * That makes {@link eventsFor} the security boundary of the whole feature, and
 * it is a pure function for exactly that reason: what leaves this process can
 * be asserted, exhaustively, without a network.
 */

import { playerChannel, tableChannel, type Hand } from "@poker/core";
import { publicView, privateView, type StoredTable } from "./tableAction";
import { signRequest, credentialsFromEnvironment } from "./sigv4";
import { log } from "./logging";

export type Publication = {
  channel: string;
  /** Already the shape that goes on the wire. */
  event: { type: "table"; version: number; hand: Hand } | {
    type: "cards";
    version: number;
    playerId: string;
    hole: Hand["seats"][number]["hole"];
  };
};

/**
 * Everything one action produces, and where each part goes.
 *
 * One public event, and one private event per player who has cards. The public
 * one is built with {@link publicView}, which is the function that decides
 * what a table may see; the private ones carry a single player's hole cards
 * and nothing else — not the deck, not the other seats.
 */
export const eventsFor = (
  tableId: string,
  table: StoredTable,
): Publication[] => {
  const publications: Publication[] = [
    {
      channel: tableChannel(tableId),
      event: {
        type: "table",
        version: table.version,
        hand: publicView(table.hand),
      },
    },
  ];

  for (const seat of table.hand.seats) {
    const view = privateView(table.hand, seat.playerId);
    // A player who has folded and been dealt out has nothing private left to
    // send, and sending an empty hand every action is noise on a channel
    // somebody is paying for by the message.
    if (!view || view.hole.length === 0) continue;
    publications.push({
      channel: playerChannel(seat.playerId, tableId),
      event: {
        type: "cards",
        version: table.version,
        playerId: view.playerId,
        hole: view.hole,
      },
    });
  }

  return publications;
};

/**
 * The body AppSync Events expects.
 *
 * Each event is a **stringified** JSON value inside a JSON array, which reads
 * like a mistake and is the documented format.
 */
export const publishBody = (
  channel: string,
  events: readonly Publication["event"][],
): string =>
  JSON.stringify({
    channel,
    events: events.map((event) => JSON.stringify(event)),
  });

export type Publisher = {
  send(publications: readonly Publication[]): Promise<boolean>;
};

/**
 * Publish over HTTP, signed with the Lambda's own credentials.
 *
 * IAM rather than a key, because the API's publish auth mode is IAM-only —
 * which is what makes the server the single writer rather than merely the
 * well-behaved one.
 */
export const createPublisher = (
  endpoint: string,
  region: string,
  fetcher: typeof fetch = fetch,
): Publisher => ({
  async send(publications) {
    const credentials = credentialsFromEnvironment();
    if (!credentials) {
      log("error", "no credentials to publish with");
      return false;
    }

    // One request per channel: a publish names a single channel, so events for
    // different players cannot share one however small they are.
    const results = await Promise.all(
      publications.map(async (publication) => {
        const url = `${endpoint.replace(/\/$/, "")}/event`;
        const body = publishBody(publication.channel, [publication.event]);
        const headers = signRequest(
          {
            method: "POST",
            url,
            headers: { "content-type": "application/json" },
            body,
            region,
            service: "appsync",
          },
          credentials,
          new Date(),
        );

        // **A publish that cannot be sent is a failed publish, not a failed
        // action.** The table is already written by the time this runs, so
        // letting a rejected fetch escape would reject the request for an
        // action that actually landed — the client then retries with the same
        // `expectedVersion` and is told it is stale. Reported the same way a
        // refusal is, which is what `handler` already documents happens.
        let response: Response;
        try {
          response = await fetcher(url, {
            method: "POST",
            headers,
            body,
          });
        } catch (error) {
          log("error", "publish could not be sent", {
            channel: publication.channel,
            error: String(error),
          });
          return false;
        }
        if (!response.ok) {
          // The channel, never the event: a private event is somebody's hole
          // cards, and a log is not where those go.
          log("error", "publish refused", {
            channel: publication.channel,
            status: response.status,
          });
        }
        return response.ok;
      }),
    );

    return results.every(Boolean);
  },
});
