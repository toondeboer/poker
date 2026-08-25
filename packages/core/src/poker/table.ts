/**
 * A hand of Texas hold'em, from the shuffle to the chips being pushed.
 *
 * This is the module that joins the other three up: {@link shuffle} deals it,
 * {@link createBettingRound} runs each street, {@link buildPots} and
 * {@link awardPots} settle it, and {@link rankHands} decides the showdown. It
 * owns only what none of them can: the deck, the board, whose turn it is when a
 * street opens, and when the hand is over.
 *
 * Pure, like the rest: `(hand, action) => hand`. Randomness is injected once at
 * the start and the remaining deck is carried in the state, so a whole hand
 * replays exactly from its seed.
 *
 * **No burn cards.** A dealer burns one before each street so that a marked or
 * glimpsed top card can't be read; with a shuffle nobody can see, burning
 * removes a card for no gain. Left out deliberately rather than forgotten.
 */

import { type Card, type RandomSource, createDeck, shuffle } from "./cards";
import {
  type BettingRound,
  type BettingAction,
  type LegalActions,
  type RoundSeat,
  applyAction as applyBettingAction,
  createBettingRound,
  isRoundComplete,
  legalActions as roundLegalActions,
} from "./bettingRound";
import { type Award, type Pot, awardPots, buildPots } from "./pots";
import { type EvaluatedHand, evaluateHand, rankHands } from "./evaluate";

export type Street = "preflop" | "flop" | "turn" | "river" | "complete";

export const HOLE_CARDS = 2;

export type HandSeat = {
  playerId: string;
  /** Chips behind. Never includes anything already in the middle. */
  stack: number;
  /** This player's own two cards. Never send another player's. */
  hole: Card[];
  status: "active" | "folded" | "all-in";
  /** Everything this player has put in **this hand**, across all streets. */
  committed: number;
};

export type Showdown = {
  playerId: string;
  hand: EvaluatedHand;
};

export type Hand = {
  seats: HandSeat[];
  buttonIndex: number;
  smallBlind: number;
  bigBlind: number;
  street: Street;
  board: Card[];
  /** What's left to deal, in order. Carried so a hand replays from its seed. */
  deck: Card[];
  /** The live betting round, or `null` once the hand is over. */
  round: BettingRound | null;
  /** Built when the hand ends; empty while it runs. */
  pots: Pot[];
  awards: Award[];
  /**
   * Who showed what. `null` when the hand ended with everyone folding to one
   * player — nobody has to show a winning hand nobody contested, and revealing
   * it would give away how they play for free.
   */
  showdown: Showdown[] | null;
  /**
   * What each seat had committed *before* the live round opened.
   *
   * Bookkeeping rather than something to render: the betting round counts chips
   * per street, the hand counts them per hand, and this is what lets one be
   * folded into the other without counting the blinds twice. Parallel to
   * `seats`, and meaningless once `round` is `null`.
   */
  roundBaseline: number[];
};

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river", "complete"];
const CARDS_DEALT: Partial<Record<Street, number>> = { flop: 3, turn: 1, river: 1 };

/** Seats still in the hand, whether or not they have chips left. */
const contenders = (seats: readonly HandSeat[]): HandSeat[] =>
  seats.filter((seat) => seat.status !== "folded");

/** Step forward from `index`, wrapping, to the first seat matching. */
const nextIndex = (
  seats: readonly HandSeat[],
  from: number,
  matches: (seat: HandSeat) => boolean,
): number => {
  for (let step = 1; step <= seats.length; step++) {
    const index = (from + step) % seats.length;
    if (matches(seats[index])) return index;
  }
  return -1;
};

/**
 * Deal a hand: shuffle, post the blinds, deal two cards each, open the betting.
 *
 * Seats are given in **seat order** and the button is an index into them. Blinds
 * are posted before the deal in the same order a dealer does it, which matters
 * only because a blind can put a short stack all-in, and a player who is all-in
 * before seeing a card still gets one.
 */
export const startHand = ({
  seats,
  buttonIndex,
  smallBlind,
  bigBlind,
  random,
}: {
  seats: readonly { playerId: string; stack: number }[];
  buttonIndex: number;
  smallBlind: number;
  bigBlind: number;
  random: RandomSource;
}): Hand => {
  if (seats.length < 2) {
    throw new Error(`a hand needs at least 2 players, got ${seats.length}`);
  }
  if (!Number.isInteger(buttonIndex) || buttonIndex < 0 || buttonIndex >= seats.length) {
    throw new Error(
      `buttonIndex ${buttonIndex} is not a seat at a table of ${seats.length}`,
    );
  }
  if (!Number.isInteger(smallBlind) || smallBlind <= 0) {
    throw new Error(`smallBlind must be a positive whole number, got ${smallBlind}`);
  }
  if (!Number.isInteger(bigBlind) || bigBlind <= smallBlind) {
    throw new Error(
      `bigBlind must be a whole number above the small blind, got ${bigBlind}`,
    );
  }
  for (const seat of seats) {
    if (!Number.isInteger(seat.stack) || seat.stack <= 0) {
      throw new Error(
        `${seat.playerId} needs a positive whole stack to be dealt in, got ${seat.stack}`,
      );
    }
  }

  const handSeats: HandSeat[] = seats.map((seat) => ({
    playerId: seat.playerId,
    stack: seat.stack,
    hole: [],
    status: "active",
    committed: 0,
  }));

  // Heads-up is the exception everyone forgets: the button posts the small
  // blind and acts first before the flop, then acts *last* on every street
  // after it. At three or more it is the two seats to the button's left.
  const headsUp = handSeats.length === 2;
  const smallBlindIndex = headsUp
    ? buttonIndex
    : nextIndex(handSeats, buttonIndex, () => true);
  const bigBlindIndex = nextIndex(handSeats, smallBlindIndex, () => true);

  post(handSeats[smallBlindIndex], smallBlind);
  post(handSeats[bigBlindIndex], bigBlind);

  let deck = shuffle(createDeck(), random);
  for (let card = 0; card < HOLE_CARDS; card++) {
    for (const seat of handSeats) {
      seat.hole.push(deck[0]);
      deck = deck.slice(1);
    }
  }

  const hand: Hand = {
    seats: handSeats,
    buttonIndex,
    smallBlind,
    bigBlind,
    street: "preflop",
    board: [],
    deck,
    round: null,
    pots: [],
    awards: [],
    showdown: null,
    roundBaseline: handSeats.map(() => 0),
  };

  // Preflop the action starts left of the big blind — which heads-up wraps
  // straight back to the button.
  return openRound(hand, nextIndex(handSeats, bigBlindIndex, () => true));
};

/** Put chips in, capped at the stack, marking all-in when it empties. */
const post = (seat: HandSeat, amount: number): void => {
  const paid = Math.min(amount, seat.stack);
  seat.stack -= paid;
  seat.committed += paid;
  if (seat.stack === 0) seat.status = "all-in";
};

/** How much of each seat's `committed` belongs to the round now opening. */
const toRoundSeats = (hand: Hand, roundCommitted: number[]): RoundSeat[] =>
  hand.seats.map((seat, i) => ({
    playerId: seat.playerId,
    stack: seat.stack,
    committed: roundCommitted[i],
    status: seat.status,
    lastActedBet: null,
  }));

/**
 * Open a betting round on the current street, or settle the hand if there is
 * nothing left to bet.
 */
const openRound = (hand: Hand, firstToActIndex: number): Hand => {
  // Preflop the blinds are already in front of people and count towards this
  // round; on later streets everyone starts from nothing.
  const roundCommitted =
    hand.street === "preflop"
      ? hand.seats.map((seat) => seat.committed)
      : hand.seats.map(() => 0);
  const currentBet = Math.max(0, ...roundCommitted);

  const round = createBettingRound({
    seats: toRoundSeats(hand, roundCommitted),
    firstToActIndex,
    currentBet,
    minimumRaiseSize: hand.bigBlind,
  });

  const opened: Hand = {
    ...hand,
    round,
    roundBaseline: baselineFor(hand, roundCommitted),
  };

  // The round can be closed before anyone acts — everyone already all-in, or
  // folded to one player — in which case fall straight through.
  return isRoundComplete(round) ? closeRound(opened) : opened;
};

/**
 * What each seat had committed *before* this round, so a live round's chips can
 * be folded back into the hand total without double-counting the blinds.
 */
const baselineFor = (hand: Hand, roundCommitted: readonly number[]): number[] =>
  hand.seats.map((seat, i) => seat.committed - roundCommitted[i]);

/** Whose turn it is and what they may do, or `null` when the hand is over. */
export const legalActions = (hand: Hand): LegalActions | null =>
  hand.round ? roundLegalActions(hand.round) : null;

/**
 * Apply one player's action, carrying the hand forward as far as it will go —
 * through street changes, the run-out when everyone is all-in, and the
 * showdown — so the caller only ever sees a state that is waiting on somebody.
 */
export const act = (
  hand: Hand,
  playerId: string,
  action: BettingAction,
): Hand => {
  if (!hand.round) {
    throw new Error("the hand is already complete");
  }

  const round = applyBettingAction(hand.round, playerId, action);
  const next = syncSeats({ ...hand, round });

  return isRoundComplete(round) ? closeRound(next) : next;
};

/** Copy the live round's chip movements back onto the hand's seats. */
const syncSeats = (hand: Hand): Hand => {
  const round = hand.round;
  if (!round) return hand;
  const baseline = hand.roundBaseline;
  return {
    ...hand,
    seats: hand.seats.map((seat, i) => ({
      ...seat,
      stack: round.seats[i].stack,
      status: round.seats[i].status,
      committed: baseline[i] + round.seats[i].committed,
    })),
  };
};

/** Finish the current street and decide what happens next. */
const closeRound = (hand: Hand): Hand => {
  const settled = syncSeats(hand);
  const stillIn = contenders(settled.seats);

  // Everyone folded to one player. They take it without showing.
  if (stillIn.length < 2) {
    return settleHand({ ...settled, round: null }, null);
  }

  // Nobody has chips left to bet: run the rest of the board out and show down.
  const canStillBet = stillIn.filter((seat) => seat.status === "active").length;
  if (canStillBet < 2 && settled.street !== "river") {
    return runOut({ ...settled, round: null });
  }

  if (settled.street === "river") {
    return settleHand({ ...settled, round: null }, showdownFor(settled));
  }

  return advanceStreet({ ...settled, round: null });
};

/** Deal the next street and open its betting. */
const advanceStreet = (hand: Hand): Hand => {
  const street = STREET_ORDER[STREET_ORDER.indexOf(hand.street) + 1];
  const count = CARDS_DEALT[street] ?? 0;
  const dealt: Hand = {
    ...hand,
    street,
    board: [...hand.board, ...hand.deck.slice(0, count)],
    deck: hand.deck.slice(count),
  };

  // After the flop the action starts left of the button, whatever happened
  // before — including heads-up, where the button now acts last.
  const first = nextIndex(
    dealt.seats,
    dealt.buttonIndex,
    (seat) => seat.status === "active",
  );
  // Nobody left who can act: nothing to open, run the rest out.
  if (first === -1) return runOut(dealt);

  return openRound(dealt, first);
};

/** Deal every remaining street with no betting, then show down. */
const runOut = (hand: Hand): Hand => {
  let current = hand;
  while (current.street !== "river") {
    const street = STREET_ORDER[STREET_ORDER.indexOf(current.street) + 1];
    const count = CARDS_DEALT[street] ?? 0;
    current = {
      ...current,
      street,
      board: [...current.board, ...current.deck.slice(0, count)],
      deck: current.deck.slice(count),
    };
  }
  return settleHand(current, showdownFor(current));
};

const showdownFor = (hand: Hand): Showdown[] =>
  contenders(hand.seats).map((seat) => ({
    playerId: seat.playerId,
    hand: evaluateHand([...seat.hole, ...hand.board]),
  }));

/**
 * Build the pots, decide who wins each, and push the chips.
 *
 * With no showdown — everyone folded to one player — that player is the whole
 * ranking, which lets the same path pay both endings.
 */
const settleHand = (hand: Hand, showdown: Showdown[] | null): Hand => {
  const pots = buildPots(
    hand.seats.map((seat) => ({
      playerId: seat.playerId,
      contributed: seat.committed,
      folded: seat.status === "folded",
    })),
  );

  const ranking = showdown
    ? rankHands(
        contenders(hand.seats).map((seat) => ({
          id: seat.playerId,
          cards: [...seat.hole, ...hand.board],
        })),
      )
    : contenders(hand.seats).map((seat) => ({ ids: [seat.playerId] }));

  // Odd chips go to the seat nearest the button's left, which is where the
  // seating order has to come from rather than from any list of winners.
  const oddChipOrder: string[] = [];
  for (let step = 1; step <= hand.seats.length; step++) {
    oddChipOrder.push(
      hand.seats[(hand.buttonIndex + step) % hand.seats.length].playerId,
    );
  }

  const awards = awardPots(pots, ranking, oddChipOrder);
  const byPlayer = new Map(awards.map((award) => [award.playerId, award.amount]));

  return {
    ...hand,
    street: "complete",
    round: null,
    pots,
    awards,
    showdown,
    seats: hand.seats.map((seat) => ({
      ...seat,
      stack: seat.stack + (byPlayer.get(seat.playerId) ?? 0),
    })),
  };
};

/** True once the chips have been pushed. */
export const isHandComplete = (hand: Hand): boolean => hand.street === "complete";
