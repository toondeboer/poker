/**
 * The channel names the realtime bus publishes on.
 *
 * **Here, and shared, because the two sides disagreeing is a security bug** —
 * not a broken feature that shows up in testing, but a quiet one. A review once
 * caught exactly that: the server guarded a namespace the private channels
 * never touched, so a path everyone assumed was protected was readable by any
 * signed-in account. Both sides build these paths from the same function.
 *
 * The shape matters. AppSync Events takes the **first path segment as the
 * namespace**, and a namespace is where a subscribe guard can be attached — so
 * anything needing its own rule has to lead with its own namespace.
 *
 * **The `table` and `player` namespaces were removed with the table backend.**
 * They carried a live hand and its hole cards; nothing publishes either any
 * more. See the Gambling classification section in `ROADMAP.md`. Only the
 * shared clock is left, and it has no transport yet either.
 */

/** A shared timer everyone at the table is watching. */
export const SESSION_NAMESPACE = "session";

/**
 * `/session/{sessionId}` — the tournament clock, shared.
 *
 * Its own namespace rather than a path under `table` for the same reason the
 * private channels have one: namespaces are where subscribe rules attach, and
 * a shared clock is readable by anyone holding the join code, which is a
 * *different* rule from a table's. A session has no hole cards in it — the
 * worst a stranger who guessed a code can do is watch a countdown.
 */
export const sessionChannel = (sessionId: string): string =>
  `/${SESSION_NAMESPACE}/${sessionId}`;
