/**
 * What the app is allowed to do today.
 *
 * **A kill switch, and the only one a solo developer can actually use.** Every
 * other way of turning a misbehaving feature off is a new build and a store
 * review — days, during which the thing stays broken for everybody. This is a
 * flag on the server, read at launch, changed from a laptop in a minute.
 *
 * It is deliberately *not* a feature-flag system. Two booleans, no targeting,
 * no percentages, no user segments: the question it answers is "should the app
 * stop doing this right now", and anything more is a second system to maintain
 * for a case that has not happened.
 *
 * ## Why the defaults are the way round
 *
 * The app treats **unreachable as off** — see `readFeatures` in `@poker/core`.
 * That sounds severe and is the only safe direction: a backend that cannot be
 * reached is one where none of these features work anyway, so refusing early
 * turns a queue of failing requests into a feature that is simply absent. The
 * reverse would have the app cheerfully queueing writes at a server that is not
 * there.
 *
 * ## Why it is public
 *
 * No authorizer. The app has to be able to ask *before* it knows whether
 * accounts work at all, and there is nothing here worth protecting: it is two
 * booleans that are the same for everybody. Making it authenticated would mean
 * a signed-out phone could never learn that sign-in has been switched off,
 * which is exactly the state the switch exists for.
 */

import { log } from "./logging";

export type Features = {
  /** Whether the account screens should work at all. */
  accounts: boolean;
  /** Whether boards may be shared, joined and synced. */
  sharing: boolean;
};

/**
 * Read from the environment, so flipping one is a stack update rather than a
 * code change — and can be done to a running deployment without a build.
 *
 * **Absent means on.** A missing variable is far more likely to be an
 * environment somebody forgot to set than a deliberate shutdown, and defaulting
 * off there would take the features out of every deployment that had not been
 * explicitly told to keep them.
 */
export const featuresFrom = (env: Record<string, string | undefined>): Features => ({
  accounts: env.FEATURE_ACCOUNTS !== "off",
  sharing: env.FEATURE_SHARING !== "off",
});

export const handler = async (): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  const features = featuresFrom(process.env);
  // Logged so a switch being thrown is visible in the same place everything
  // else is, rather than being deduced from a sudden absence of traffic.
  log("info", "config served", features);
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      /**
       * **A minute, not an hour.** The whole value of this is how fast it takes
       * effect; a long cache would mean a switch thrown now reaching phones
       * some time later, which is the situation it exists to avoid. It is two
       * booleans, so the cost of asking often is nothing.
       */
      "cache-control": "public, max-age=60",
    },
    body: JSON.stringify(features),
  };
};
