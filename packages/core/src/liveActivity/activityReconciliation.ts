/**
 * Deciding which iOS Live Activities to keep and which to end.
 *
 * **Why this is here rather than in the app.** The app can hold at most one
 * Live Activity, but the platform does not enforce that and the app's own
 * record of which one is *in memory only*. Kill the app mid-round and iOS keeps
 * the activity running; on relaunch the app remembers nothing, starts another,
 * and the user collects a stack of stale cards in Notification Centre. The
 * decision has four cases and getting it wrong is what caused the bug — so it
 * is a pure function with tests, and the service is left to carry the plan out.
 *
 * Framework-agnostic like the rest of @poker/core: activity ids are opaque
 * strings and nothing here talks to ActivityKit.
 */

export type ActivityReconciliation = {
  /** An existing activity to keep and update, or `null` to start a new one. */
  adoptId: string | null;
  /** Activities to end. Never contains `adoptId`. */
  endIds: string[];
  /** True when the caller must start a new activity — i.e. `adoptId` is null. */
  createNew: boolean;
};

export type ActivityReconciliationInput = {
  /** Every activity the platform currently reports as live. */
  activeIds: readonly string[];
  /** The activity this session believes it owns, if any. */
  currentId: string | null;
  /**
   * When true, never reduce to zero: if something is live but none of it is
   * ours, keep one rather than ending everything and asking for a new card.
   *
   * This is for callers that **reconcile without being able to create** — the
   * foreground sync knows what exists but not what the round currently says, so
   * ending everything would leave the user with no card until something else
   * happened to draw one. Any surviving card is refreshed moments later; a
   * stale card for a moment beats no card for a blind level.
   *
   * Callers that hold fresh state and will create immediately leave this false,
   * so they get a correct new card rather than an arbitrary old one.
   */
  mustKeepOne?: boolean;
};

/**
 * Reduce however many activities exist to exactly one.
 *
 * The cases, in the order they're decided:
 *
 * 1. **Our activity is still live** — keep it, end everything else as strays.
 * 2. **We own nothing and exactly one is live** — adopt it. This is the cold
 *    launch after a force-quit, and adopting avoids ending a perfectly good
 *    card only to immediately draw another one in its place.
 * 3. **We own nothing and several are live** — end all of them and start fresh,
 *    unless `mustKeepOne` says the caller cannot create one, in which case keep
 *    the first and end the rest. ActivityKit does not document an ordering for
 *    its `activities` array, so "the first" carries no meaning and is only ever
 *    a placeholder to be refreshed — which is why the *default* is to create a
 *    correct card instead. The previous code always took `activeIds[0]`, and
 *    could therefore keep a stale card and end the live one.
 * 4. **Nothing is live** — start fresh. `mustKeepOne` cannot help here; there is
 *    nothing to keep.
 *
 * A `currentId` that is no longer in `activeIds` is treated as owning nothing:
 * the platform has already ended it.
 */
export const reconcileActivities = ({
  activeIds,
  currentId,
  mustKeepOne = false,
}: ActivityReconciliationInput): ActivityReconciliation => {
  const ours = currentId !== null && activeIds.includes(currentId);

  if (ours) {
    return {
      adoptId: currentId,
      endIds: activeIds.filter((id) => id !== currentId),
      createNew: false,
    };
  }

  if (activeIds.length === 1) {
    return { adoptId: activeIds[0], endIds: [], createNew: false };
  }

  if (mustKeepOne && activeIds.length > 1) {
    return {
      adoptId: activeIds[0],
      endIds: activeIds.slice(1),
      createNew: false,
    };
  }

  return { adoptId: null, endIds: activeIds.slice(), createNew: true };
};
