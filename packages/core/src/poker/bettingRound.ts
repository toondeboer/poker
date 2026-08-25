/**
 * One betting round: whose turn it is, what they may legally do, and when the
 * round is over.
 *
 * This is the fiddliest part of poker's rules and the part players get wrong at
 * the table, so it is modelled on its own rather than tangled into dealing and
 * streets. Three rules carry almost all of the difficulty:
 *
 * - **A raise has a minimum size** — at least as much again as the last raise.
 * - **Going all-in for less than a full raise does not reopen the betting.**
 *   The bet everyone must match goes up, but players who have already acted may
 *   only call or fold; they don't get to raise again. This is the rule nobody
 *   remembers, and the reason a seat records *what the bet was when it last
 *   acted* rather than a plain "has acted" flag.
 * - **A player can always put their last chip in**, even when that is less than
 *   a legal raise.
 *
 * Pure: `(round, action) => round`, no clock, no randomness, no I/O.
 */

export type SeatStatus = "active" | "folded" | "all-in";

export type RoundSeat = {
  playerId: string;
  /** Chips still behind — not yet pushed into the middle. */
  stack: number;
  /** Chips committed *in this round*. The hand total lives outside. */
  committed: number;
  status: SeatStatus;
  /**
   * What the bet stood at when this player last acted this round, or `null` if
   * they have not acted yet.
   *
   * A plain boolean cannot express the all-in-for-less rule. Comparing this to
   * the current bet says both "must you act again?" (the bet moved) and "may
   * you raise?" (it moved by a full raise) — which are different questions with
   * different answers exactly when someone is all-in for a short raise.
   */
  lastActedBet: number | null;
};

export type BettingRound = {
  /** Seat order, fixed for the hand. Index is position, not identity. */
  seats: RoundSeat[];
  /** Whose turn, or `null` once the round has closed. */
  toActIndex: number | null;
  /** The most anyone has committed this round; what others must match. */
  currentBet: number;
  /**
   * The size of the last full raise, which is the minimum size of the next one.
   * Preflop this starts at the big blind, so the first raise must be to at
   * least twice it.
   */
  lastFullRaiseSize: number;
};

export type BettingAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  /** `to` is the player's **total** committed after raising, not the increment
   * — the number a player says out loud ("raise to sixty"), and the one that
   * can't be misread when a partial call is already in front of them. */
  | { type: "raise"; to: number };

export type LegalActions = {
  playerId: string;
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  /** Chips needed to call — capped at the stack, so this is what an all-in
   * call actually costs rather than a figure they cannot pay. */
  callAmount: number;
  canRaise: boolean;
  /** Smallest legal total to raise to. Equals `maxRaiseTo` when the only raise
   * available is going all-in for less than a full raise. */
  minRaiseTo: number;
  /** The most they can put in: everything they have. */
  maxRaiseTo: number;
};

const assertChipCount = (value: number, label: string): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a whole number of chips, got ${value}`);
  }
};

/**
 * Open a betting round.
 *
 * `currentBet` and `lastFullRaiseSize` are supplied rather than derived because
 * preflop starts mid-flight: the blinds are already in, so the bet is the big
 * blind and the next raise must be at least another big blind on top. On later
 * streets both start at zero and the big blind is passed as the minimum.
 */
export const createBettingRound = ({
  seats,
  firstToActIndex,
  currentBet = 0,
  minimumRaiseSize,
}: {
  seats: readonly RoundSeat[];
  firstToActIndex: number;
  currentBet?: number;
  minimumRaiseSize: number;
}): BettingRound => {
  assertChipCount(currentBet, "currentBet");
  assertChipCount(minimumRaiseSize, "minimumRaiseSize");
  for (const seat of seats) {
    assertChipCount(seat.stack, `${seat.playerId}'s stack`);
    assertChipCount(seat.committed, `${seat.playerId}'s committed`);
  }

  const round: BettingRound = {
    seats: seats.map((seat) => ({ ...seat })),
    toActIndex: firstToActIndex,
    currentBet,
    lastFullRaiseSize: minimumRaiseSize,
  };

  // The opener may already be unable to act — everyone else all-in, say — so
  // the same settling logic that follows an action runs here too.
  return settle(round, firstToActIndex);
};

/** Can this seat be asked to do anything at all? */
const canAct = (seat: RoundSeat): boolean =>
  seat.status === "active" && seat.stack > 0;

/**
 * Does this seat still owe the round an action?
 *
 * Either it has never acted — which is how the big blind gets its option even
 * though it has already matched the bet — or the bet has moved past what it
 * committed.
 */
const owesAction = (seat: RoundSeat, currentBet: number): boolean =>
  canAct(seat) && (seat.lastActedBet === null || seat.committed < currentBet);

/**
 * May this seat raise, as opposed to only calling?
 *
 * Yes if it has not acted since the last full raise. Otherwise only if the bet
 * has climbed by at least a full raise since it last acted — which is exactly
 * what a short all-in fails to do.
 */
const mayRaise = (seat: RoundSeat, round: BettingRound): boolean => {
  if (!canAct(seat)) return false;
  if (seat.lastActedBet === null) return true;
  return round.currentBet - seat.lastActedBet >= round.lastFullRaiseSize;
};

/**
 * Find the next seat that owes an action, or close the round.
 *
 * `startAt` is **inclusive** — the first seat considered. Opening a round
 * passes the seat that should act; applying an action passes the one after it.
 * Making that boundary explicit rather than "the one after `from`" is
 * deliberate: the other way round, opening a round silently skipped its own
 * opener and the action began one seat too far along.
 */
const settle = (round: BettingRound, startAt: number): BettingRound => {
  const stillIn = round.seats.filter((seat) => seat.status !== "folded");
  const actors = round.seats.filter(canAct);

  // Everyone folded to one player: there is no round left to play.
  if (stillIn.length < 2) {
    return { ...round, toActIndex: null };
  }

  // Nobody has chips left to bet with — everyone still in is all-in.
  if (actors.length === 0) {
    return { ...round, toActIndex: null };
  }

  // Exactly one player can still bet, and they have already matched the bet.
  // There is nobody to bet against, so asking them to check is noise. They are
  // only asked to act when the bet is above them and they must call or fold.
  if (actors.length === 1 && actors[0].committed >= round.currentBet) {
    return { ...round, toActIndex: null };
  }

  for (let step = 0; step < round.seats.length; step++) {
    const index = (startAt + step) % round.seats.length;
    if (owesAction(round.seats[index], round.currentBet)) {
      return { ...round, toActIndex: index };
    }
  }

  return { ...round, toActIndex: null };
};

/** True once nobody else owes an action. */
export const isRoundComplete = (round: BettingRound): boolean =>
  round.toActIndex === null;

/** What the player to act may legally do. `null` once the round has closed. */
export const legalActions = (round: BettingRound): LegalActions | null => {
  if (round.toActIndex === null) return null;
  const seat = round.seats[round.toActIndex];

  const owed = round.currentBet - seat.committed;
  const callAmount = Math.min(owed, seat.stack);
  const maxRaiseTo = seat.committed + seat.stack;

  // A full raise, unless they cannot cover it — in which case their only raise
  // is all-in, which is always allowed however short it falls.
  const fullRaiseTo = round.currentBet + round.lastFullRaiseSize;
  const minRaiseTo = Math.min(fullRaiseTo, maxRaiseTo);

  return {
    playerId: seat.playerId,
    canFold: true,
    canCheck: owed === 0,
    canCall: owed > 0,
    callAmount,
    // Raising needs chips beyond a call, and the right to reopen.
    canRaise: mayRaise(seat, round) && maxRaiseTo > round.currentBet,
    minRaiseTo,
    maxRaiseTo,
  };
};

/**
 * Apply one action and hand back the next state.
 *
 * `playerId` is required and checked against whose turn it actually is. The
 * alternative — trusting the caller to act for the right seat — is a bug that
 * only shows up as somebody else's chips moving.
 */
export const applyAction = (
  round: BettingRound,
  playerId: string,
  action: BettingAction,
): BettingRound => {
  const legal = legalActions(round);
  if (!legal || round.toActIndex === null) {
    throw new Error("the betting round is already complete");
  }
  if (legal.playerId !== playerId) {
    throw new Error(`it is ${legal.playerId}'s turn, not ${playerId}'s`);
  }

  const index = round.toActIndex;
  const seats = round.seats.map((seat) => ({ ...seat }));
  const seat = seats[index];
  let { currentBet, lastFullRaiseSize } = round;

  switch (action.type) {
    case "fold": {
      seat.status = "folded";
      seat.lastActedBet = currentBet;
      break;
    }

    case "check": {
      if (!legal.canCheck) {
        throw new Error(
          `${playerId} cannot check facing a bet of ${currentBet}`,
        );
      }
      seat.lastActedBet = currentBet;
      break;
    }

    case "call": {
      if (!legal.canCall) {
        throw new Error(`${playerId} has nothing to call`);
      }
      seat.stack -= legal.callAmount;
      seat.committed += legal.callAmount;
      seat.lastActedBet = currentBet;
      if (seat.stack === 0) seat.status = "all-in";
      break;
    }

    case "raise": {
      if (!legal.canRaise) {
        throw new Error(`${playerId} may not raise`);
      }
      assertChipCount(action.to, "raise target");
      if (action.to > legal.maxRaiseTo) {
        throw new Error(
          `${playerId} cannot raise to ${action.to} with ${legal.maxRaiseTo} available`,
        );
      }
      if (action.to < legal.minRaiseTo) {
        throw new Error(
          `${playerId} must raise to at least ${legal.minRaiseTo}, not ${action.to}`,
        );
      }

      const raiseSize = action.to - currentBet;
      const added = action.to - seat.committed;
      seat.stack -= added;
      seat.committed = action.to;
      if (seat.stack === 0) seat.status = "all-in";

      // The bet everyone must match always goes up. Whether the *action*
      // reopens depends on whether this was a full raise — and that is decided
      // here, by leaving `lastFullRaiseSize` alone when it wasn't.
      currentBet = action.to;
      if (raiseSize >= lastFullRaiseSize) {
        lastFullRaiseSize = raiseSize;
      }
      seat.lastActedBet = currentBet;
      break;
    }
  }

  return settle(
    { ...round, seats, currentBet, lastFullRaiseSize },
    index + 1,
  );
};
