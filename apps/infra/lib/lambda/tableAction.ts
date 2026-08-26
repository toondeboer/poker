/**
 * The one thing allowed to change a poker table.
 *
 * Read the hand, run the rules, write it back on a version check, publish what
 * changed. The rules are `@poker/core`'s — the same module the phone runs — so
 * a client predicting its own action optimistically is running literally the
 * same code as the authority, and the two cannot drift.
 *
 * Optimistic concurrency instead of a lock: two players acting in the same
 * instant means one conditional write wins and the other retries against fresh
 * state. Poker is turn-based and a few actions a minute, so contention is rare
 * and a retry is cheap — and there is no lock to leak if a Lambda dies holding
 * it.
 */

import type { BettingAction, Hand } from "@poker/core";
import { act, isHandComplete, legalActions } from "@poker/core";

export type ActionRequest = {
  tableId: string;
  playerId: string;
  action: BettingAction;
  /**
   * The version the client believed it was acting on.
   *
   * Its real job is not concurrency — that is the conditional write — but
   * **double-taps**. Without it, a request that timed out on the phone and was
   * retried folds a hand twice: once for the fold the player meant, and once
   * for the next decision they never saw.
   */
  expectedVersion: number;
};

export type StoredTable = {
  hand: Hand;
  version: number;
};

export type ActionOutcome =
  | { status: "applied"; table: StoredTable; handComplete: boolean }
  | { status: "stale"; currentVersion: number }
  | { status: "rejected"; reason: string };

/**
 * Decide what an action does to a stored table.
 *
 * Split out from the I/O so it can be tested without DynamoDB — and so the
 * rules about *whether* an action is allowed sit next to the rules about what
 * it does, rather than being spread between a handler and a retry loop.
 */
export const applyAction = (
  stored: StoredTable,
  request: ActionRequest,
): ActionOutcome => {
  if (stored.version !== request.expectedVersion) {
    // Either somebody else acted first, or this is a retry of a request that
    // already landed. Both mean: look again before doing anything.
    return { status: "stale", currentVersion: stored.version };
  }

  const legal = legalActions(stored.hand);
  if (!legal) {
    return { status: "rejected", reason: "the hand is already complete" };
  }
  if (legal.playerId !== request.playerId) {
    // Checked here as well as inside the engine, because this is the boundary
    // where the id comes from a token rather than from our own state.
    return {
      status: "rejected",
      reason: `it is ${legal.playerId}'s turn`,
    };
  }

  try {
    const hand = act(stored.hand, request.playerId, request.action);
    return {
      status: "applied",
      table: { hand, version: stored.version + 1 },
      handComplete: isHandComplete(hand),
    };
  } catch (error) {
    // An illegal action is a client that is out of date or wrong, not a server
    // fault: say why and leave the table alone.
    return {
      status: "rejected",
      reason: error instanceof Error ? error.message : "illegal action",
    };
  }
};

/**
 * What everyone at the table is allowed to see of a hand.
 *
 * Built here rather than filtered on the phone: a hand that never leaves the
 * server carrying somebody else's cards cannot leak them, however the client is
 * written.
 *
 * Cards are revealed **only at a showdown**, and only for the players in it.
 * Gating on "the hand is over" instead looks equivalent and is not: a hand
 * everyone folds out of ends with no showdown at all, and the uncontested
 * winner never has to show. An earlier version made exactly that mistake and
 * broadcast their cards — which is worse than a display bug, because it teaches
 * the table how somebody plays the hands they steal.
 */
export const publicView = (hand: Hand): Hand => {
  const shown = new Set((hand.showdown ?? []).map((entry) => entry.playerId));
  return {
    ...hand,
    seats: hand.seats.map((seat) => ({
      ...seat,
      hole: shown.has(seat.playerId) ? seat.hole : [],
    })),
    // The deck is the rest of the game. It never goes anywhere.
    deck: [],
  };
};

export const privateView = (
  hand: Hand,
  playerId: string,
): { playerId: string; hole: Hand["seats"][number]["hole"] } | null => {
  const seat = hand.seats.find((candidate) => candidate.playerId === playerId);
  return seat ? { playerId, hole: seat.hole } : null;
};

/**
 * The Lambda entry point.
 *
 * **Deliberately not wired to DynamoDB or to publishing yet.** Both need a
 * deployment to exercise, and writing them blind would mean shipping the most
 * security-sensitive code in the stack with no way to run it. What exists is
 * the decision-making — {@link applyAction} and the two view functions — which
 * is testable, and is where the rules actually live.
 *
 * It exists at all because the function synthesises with `Handler:
 * index.handler`: without an export, a deploy produces a Lambda that fails
 * every invocation with `Runtime.HandlerNotFound`, which is a far more
 * confusing way to discover this is unfinished than being told so.
 */
export const handler = async (): Promise<never> => {
  throw new Error(
    "The table action handler has no storage or publishing wired up yet. " +
      "See apps/infra/lib/lambda/tableAction.ts.",
  );
};
