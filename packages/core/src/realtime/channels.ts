/**
 * The channel names a live table publishes on.
 *
 * **Here, and shared, because the two sides disagreeing is a security bug** —
 * not a broken feature that shows up in testing, but a quiet one. A review
 * caught exactly that: the server guarded a namespace the private channels
 * never touched, so a path everyone assumed was protected was readable by any
 * signed-in account. Both sides now build these paths from the same function.
 *
 * The shape matters. AppSync Events takes the **first path segment as the
 * namespace**, and a namespace is where a subscribe guard can be attached — so
 * anything needing its own rule has to lead with its own namespace, and
 * anything identifying *who may read it* has to sit at a fixed position the
 * guard can find without parsing the rest.
 */

/** Everything the whole table may see: the board, the bets, whose turn it is. */
export const TABLE_NAMESPACE = "table";

/** One player's own cards. Never carries anybody else's. */
export const PLAYER_NAMESPACE = "player";

/** `/table/{tableId}` — the shared view of a hand. */
export const tableChannel = (tableId: string): string =>
  `/${TABLE_NAMESPACE}/${tableId}`;

/**
 * `/player/{playerId}/table/{tableId}` — one player's private view.
 *
 * The player id comes **immediately after the namespace**, so the guard is
 * "segment 2 must equal your own subject" and needs to know nothing else. The
 * obvious alternative — `/table/{tableId}/player/{playerId}` — reads better and
 * is unguardable: its namespace is `table`, so it lands in the shared
 * namespace's rules and the private guard never runs.
 */
export const playerChannel = (playerId: string, tableId: string): string =>
  `/${PLAYER_NAMESPACE}/${playerId}/${TABLE_NAMESPACE}/${tableId}`;

/**
 * The player a private channel belongs to, or `null` if it is not one.
 *
 * The guard's half of {@link playerChannel}, kept beside it so the two cannot
 * drift apart — which is the failure this whole module exists to prevent.
 */
export const playerFromChannel = (channel: string): string | null => {
  const segments = channel.split("/");
  // ["", "player", playerId, "table", tableId]
  if (segments.length !== 5) return null;
  if (segments[0] !== "" || segments[1] !== PLAYER_NAMESPACE) return null;
  if (segments[3] !== TABLE_NAMESPACE) return null;
  const playerId = segments[2];
  const tableId = segments[4];
  if (playerId.length === 0 || tableId.length === 0) return null;
  return playerId;
};

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
