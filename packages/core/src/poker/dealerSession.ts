/**
 * An evening of dealt hands, with the button moving round.
 *
 * All this adds to {@link Deal} is what survives between hands: who is at the
 * table, who is sitting out, where the button is, and how many have been dealt.
 *
 * **It cannot say who finished where, and must not pretend to.** Busting is a
 * chip event, and there are no chips — the players have those in front of them.
 * A host-entered "sitting out" flag is a statement of intent, not an observed
 * elimination, and ordering a leaderboard by it would present a guess as a fact.
 * So a night is recorded by hand through the record-a-game sheet, the same way
 * it always was for a game the app did not deal. See the Gambling classification
 * section in `ROADMAP.md` for why the chips went.
 */

import type { RandomSource } from "./cards";
import {
  type Deal,
  MAX_SEATS,
  isDealComplete,
  muck as muckDeal,
  nextStreet as nextStreetOfDeal,
  startDeal,
  unmuck as unmuckDeal,
} from "./deal";

export type DealerSeat = {
  playerId: string;
  /**
   * Out for now — busted at the table, or gone to get a drink.
   *
   * The app has no way to know which, and does not try. All this does is keep
   * them out of the next deal until somebody says otherwise.
   */
  sittingOut: boolean;
};

export type DealerSession = {
  seats: DealerSeat[];
  buttonIndex: number;
  /** The hand being dealt, or `null` between hands. */
  deal: Deal | null;
  /**
   * The hand that just finished, kept so the showdown stays on screen.
   *
   * Without this, the action that turns the river returns a table with nothing
   * on it — and the showdown is the one hand everybody wants to look at.
   */
  lastDeal: Deal | null;
  handsPlayed: number;
};

/** Everyone who can be dealt in. */
const playing = (seats: readonly DealerSeat[]): DealerSeat[] =>
  seats.filter((seat) => !seat.sittingOut);

export const createDealerSession = ({
  players,
  buttonIndex = 0,
}: {
  players: readonly string[];
  buttonIndex?: number;
}): DealerSession => {
  if (players.length < 2) {
    throw new Error("a table needs at least 2 players");
  }
  if (players.length > MAX_SEATS) {
    throw new Error(`one deck seats at most ${MAX_SEATS} players`);
  }
  if (new Set(players).size !== players.length) {
    throw new Error("every seat needs its own id");
  }
  if (
    !Number.isInteger(buttonIndex) ||
    buttonIndex < 0 ||
    buttonIndex >= players.length
  ) {
    throw new Error("the button is not a seat");
  }
  return {
    seats: players.map((playerId) => ({ playerId, sittingOut: false })),
    buttonIndex,
    deal: null,
    lastDeal: null,
    handsPlayed: 0,
  };
};

/**
 * Deal the next hand.
 *
 * The button moves **between** hands rather than before the first, so "this
 * seat deals first" is expressible rather than only sayable as the seat before
 * it. A seat sitting out is skipped.
 */
export const dealNextHand = (
  session: DealerSession,
  { random }: { random: RandomSource },
): DealerSession => {
  if (session.deal && !isDealComplete(session.deal)) {
    throw new Error("finish the current hand first");
  }
  const dealt = playing(session.seats);
  if (dealt.length < 2) {
    throw new Error("not enough players are in to deal");
  }

  /**
   * Where the button lands, worked out among the seats **being dealt**.
   *
   * Every one of those is playing by construction, so there is no "skip the
   * seat that is out" search to get wrong — sitting out simply removes a seat
   * from the ring. The previous button may be one of the removed ones, in which
   * case `-1` steps to seat 0, which is the seat after it in the new ring.
   */
  const previous = dealt.findIndex(
    (seat) => seat.playerId === session.seats[session.buttonIndex].playerId,
  );
  const dealtButton =
    session.handsPlayed === 0 && previous >= 0
      ? previous
      : (previous + 1) % dealt.length;

  // Back to an index into the whole table, so it survives somebody sitting in.
  const buttonIndex = session.seats.findIndex(
    (seat) => seat.playerId === dealt[dealtButton].playerId,
  );

  return {
    ...session,
    buttonIndex,
    deal: startDeal({
      seats: dealt.map((seat) => seat.playerId),
      buttonIndex: dealtButton,
      random,
    }),
    handsPlayed: session.handsPlayed + 1,
  };
};

/** Turn the next street of the hand in progress. */
export const nextStreet = (session: DealerSession): DealerSession => {
  if (!session.deal) throw new Error("no hand in progress");
  const deal = nextStreetOfDeal(session.deal);
  return isDealComplete(deal)
    ? { ...session, deal: null, lastDeal: deal }
    : { ...session, deal };
};

export const muck = (
  session: DealerSession,
  playerId: string,
): DealerSession =>
  session.deal
    ? { ...session, deal: muckDeal(session.deal, playerId) }
    : session;

export const unmuck = (
  session: DealerSession,
  playerId: string,
): DealerSession =>
  session.deal
    ? { ...session, deal: unmuckDeal(session.deal, playerId) }
    : session;

const setSittingOut = (
  session: DealerSession,
  playerId: string,
  sittingOut: boolean,
): DealerSession => ({
  ...session,
  seats: session.seats.map((seat) =>
    seat.playerId === playerId ? { ...seat, sittingOut } : seat,
  ),
});

/** Leave somebody out of the next deal. Takes effect on the next hand. */
export const sitOut = (
  session: DealerSession,
  playerId: string,
): DealerSession => setSittingOut(session, playerId, true);

/** Bring somebody back in. */
export const sitIn = (
  session: DealerSession,
  playerId: string,
): DealerSession => setSittingOut(session, playerId, false);

/** Whether there are still enough players to deal another hand. */
export const canDeal = (session: DealerSession): boolean =>
  playing(session.seats).length >= 2 &&
  (session.deal === null || isDealComplete(session.deal));
