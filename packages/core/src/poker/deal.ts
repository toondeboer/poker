/**
 * A dealt hand of hold'em, with no chips in it.
 *
 * **This deals cards. It does not run a game.** There are no stacks, no blinds
 * posted into a pot, no bets, no raises and no pots — the players are sitting at
 * a real table with real chips in front of them, and the only thing they were
 * missing is a deck. The app is the deck.
 *
 * That is a deliberate boundary rather than an unfinished one. A previous
 * version of this module ran the whole game: fold/check/call/raise, side pots,
 * all-in-for-less, the lot. Betting chips — even chips worth nothing — is
 * *simulated gambling* under Apple's definition, which forces an 18+ rating and,
 * on an Individual developer account, may prevent submission at all. Dealing
 * cards is not. See the Gambling classification section in `ROADMAP.md`, and the
 * `archive/betting-engine` tag for the engine that was removed.
 *
 * **Do not add a bet here.** If a future version needs one, that is a product
 * decision with a rating attached, not a missing feature to fill in.
 *
 * The order of the streets is the host's to advance: with no betting round to
 * close, nothing else can decide when the flop comes.
 */

import { type Card, type RandomSource, createDeck, shuffle } from "./cards";
import { type EvaluatedHand, evaluateHand } from "./evaluate";

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export const HOLE_CARDS = 2;
/** Flop, turn and river. */
export const BOARD_CARDS = 5;
/**
 * The most players a single deck can deal. Two cards each plus five on the
 * board is `2n + 5 <= 52`, so 23 — well above any real table, but it is the
 * point at which the deck silently runs out rather than a matter of taste, so
 * it is enforced here and any smaller limit belongs to the product.
 */
export const MAX_SEATS = 23;

export type DealtSeat = {
  playerId: string;
  /** This player's own two cards. Never send another player's. */
  hole: Card[];
  /**
   * Out of this hand — folded at the table, with real chips.
   *
   * **Called mucking rather than folding, and that is not only vocabulary.**
   * Folding is a betting action; there is no betting here. What this records is
   * that somebody has thrown their cards in and does not want to be dealt into
   * the showdown, which the app needs to know only so it does not reveal a hand
   * nobody is contesting.
   */
  mucked: boolean;
};

export type Showdown = {
  playerId: string;
  hand: EvaluatedHand;
};

export type Deal = {
  seats: DealtSeat[];
  buttonIndex: number;
  street: Street;
  board: Card[];
  /** What's left to deal, in order. Carried so a hand replays from its seed. */
  deck: Card[];
  /**
   * Who showed what, best first, ties together. `null` until the river is
   * turned over, and `null` for good when everybody but one player mucked —
   * nobody has to show a hand nobody contested, and revealing it gives away how
   * they play for free.
   */
  showdown: Showdown[] | null;
};

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river", "showdown"];
const CARDS_DEALT: Partial<Record<Street, number>> = {
  flop: 3,
  turn: 1,
  river: 1,
};

/** Seats still holding cards. */
const live = (seats: readonly DealtSeat[]): DealtSeat[] =>
  seats.filter((seat) => !seat.mucked);

/**
 * Deal a hand: shuffle, then two cards each in seat order.
 *
 * **No burn cards.** A burn exists to defeat a marked deck at a physical table,
 * and there is no deck to mark here. Dealing them would consume cards for a
 * ritual, which is what pushes the seat cap down for no reason.
 */
export const startDeal = ({
  seats,
  buttonIndex = 0,
  random,
}: {
  seats: readonly string[];
  buttonIndex?: number;
  random: RandomSource;
}): Deal => {
  if (seats.length < 2) {
    throw new Error("a hand needs at least 2 players");
  }
  if (seats.length > MAX_SEATS) {
    throw new Error(`one deck seats at most ${MAX_SEATS} players`);
  }
  if (new Set(seats).size !== seats.length) {
    throw new Error("every seat needs its own id");
  }
  if (
    !Number.isInteger(buttonIndex) ||
    buttonIndex < 0 ||
    buttonIndex >= seats.length
  ) {
    throw new Error("the button is not a seat");
  }

  let deck = shuffle(createDeck(), random);
  const dealt: DealtSeat[] = seats.map((playerId) => ({
    playerId,
    hole: [],
    mucked: false,
  }));
  // A card at a time round the table, as a dealer does it. The result is the
  // same as handing out pairs, and the order the deck is consumed in is not.
  for (let round = 0; round < HOLE_CARDS; round++) {
    for (const seat of dealt) {
      seat.hole.push(deck[0]);
      deck = deck.slice(1);
    }
  }

  return {
    seats: dealt,
    buttonIndex,
    street: "preflop",
    board: [],
    deck,
    showdown: null,
  };
};

/**
 * Turn the next street, or run the showdown at the river.
 *
 * Host-driven: with no betting round to close, nothing in the model knows when
 * the table has finished acting. That is the honest shape — the app is watching
 * a game it is not running.
 */
export const nextStreet = (deal: Deal): Deal => {
  if (deal.street === "showdown") return deal;

  const next = STREET_ORDER[STREET_ORDER.indexOf(deal.street) + 1];
  const take = CARDS_DEALT[next] ?? 0;
  const board = [...deal.board, ...deal.deck.slice(0, take)];
  const deck = deal.deck.slice(take);

  if (next !== "showdown") {
    return { ...deal, street: next, board, deck };
  }

  return {
    ...deal,
    street: "showdown",
    board,
    deck,
    showdown: showdownFor({ ...deal, board }),
  };
};

/**
 * Who showed what, best first.
 *
 * `null` when one player is left holding cards: an uncontested hand is not
 * shown, at a real table or here.
 */
export const showdownFor = (deal: Deal): Showdown[] | null => {
  const contenders = live(deal.seats);
  if (contenders.length < 2) return null;
  if (deal.board.length < BOARD_CARDS) return null;

  // Evaluated then sorted, rather than routed through `rankHands`: the packed
  // value already orders hands totally, and going through an id-keyed tier list
  // meant a lookup that could not fail and a branch for it failing anyway.
  // Equal values are a genuine tie and keep their seat order.
  return contenders
    .map((seat) => ({
      playerId: seat.playerId,
      hand: evaluateHand([...seat.hole, ...deal.board]),
    }))
    .sort((a, b) => b.hand.value - a.hand.value);
};

/** Throw a seat's cards in. Idempotent, and a no-op once the hand is over. */
export const muck = (deal: Deal, playerId: string): Deal =>
  deal.street === "showdown"
    ? deal
    : {
        ...deal,
        seats: deal.seats.map((seat) =>
          seat.playerId === playerId ? { ...seat, mucked: true } : seat,
        ),
      };

/** Take a muck back — for the tap that was somebody else's card. */
export const unmuck = (deal: Deal, playerId: string): Deal =>
  deal.street === "showdown"
    ? deal
    : {
        ...deal,
        seats: deal.seats.map((seat) =>
          seat.playerId === playerId ? { ...seat, mucked: false } : seat,
        ),
      };

export const isDealComplete = (deal: Deal): boolean =>
  deal.street === "showdown";

/**
 * Seats still holding cards. Exported because the screen needs it too — who is
 * left is the one thing a dealer knows that the table might want reminding of.
 */
export const stillIn = (deal: Deal): DealtSeat[] => live(deal.seats);
