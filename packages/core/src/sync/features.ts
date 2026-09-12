/**
 * What the server says the app may do today.
 *
 * **A kill switch, read at launch.** Every other way of turning a misbehaving
 * feature off is a new build and a store review — days, during which it stays
 * broken for everybody. This is a flag on the server, changed in a minute.
 *
 * Parsing it lives here rather than in the app for the usual reason: the
 * decision about what an unreadable or unreachable answer *means* is the part
 * that can be wrong, and it is exactly the part a screen cannot test.
 */

/** What the app may do. Both default to off — see `readFeatures`. */
export type Features = {
  accounts: boolean;
  sharing: boolean;
};

/**
 * **Off**, and this is the important default in the whole file.
 *
 * A backend that cannot be reached is one where none of these features work
 * anyway, so refusing early turns a queue of failing requests into a feature
 * that is simply absent — which is a far better thing for somebody to meet. The
 * other way round has the app cheerfully queueing writes at a server that is
 * not there, and telling people their board is syncing when nothing is.
 *
 * It is also what makes the switch a switch: if an unreachable server meant
 * "carry on", turning something off would require every phone to successfully
 * ask permission to stop.
 */
export const NO_FEATURES: Features = Object.freeze({
  accounts: false,
  sharing: false,
});

/**
 * Read the answer, or refuse to guess.
 *
 * **A field that is not a boolean is treated as off**, not as missing. The
 * server sends both every time; anything else is a version mismatch or a
 * response that is not ours, and neither is a reason to assume yes.
 */
export const readFeatures = (value: unknown): Features => {
  if (typeof value !== "object" || value === null) return NO_FEATURES;
  const body = value as Record<string, unknown>;
  return {
    accounts: body.accounts === true,
    sharing: body.sharing === true,
  };
};
