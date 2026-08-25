/**
 * A whole game: hand after hand until one player has all the chips.
 *
 * The layer above {@link Hand}. It owns what a single hand cannot — who is
 * still in, where the button is, and the order people went out in — and it
 * exists mainly so that finishing a game produces a leaderboard entry by
 * itself, instead of the host tapping everyone's finishing position in
 * afterwards from memory.
 *
 * Pure like the rest: randomness and the clock are the caller's, and blinds are
 * passed in per hand rather than owned here, because they come from the
 * tournament timer that already exists.
 */

import type { RandomSource } from "./cards";
import type { BettingAction } from "./bettingRound";
import { type Hand, act as actOnHand, isHandComplete, startHand } from "./table";
import { createGameResult, type GameResult, type Placing } from "../leaderboard/gameResult";

export type SessionSeat = {
  playerId: string;
  /** Chips in front of them between hands. Zero means they are out. */
  stack: number;
};

export type GameSession = {
  seats: SessionSeat[];
  /** Index into `seats`. Moves to the next player still in before each hand. */
  buttonIndex: number;
  /** The hand in progress, or `null` between hands and once the game is over. */
  hand: Hand | null;
  /** How many hands have been dealt, for display. */
  handsPlayed: number;
  /**
   * Who has been knocked out, in the order it happened — so the last name here
   * finished highest of the busted players.
   *
   * Kept rather than derived because it cannot be reconstructed afterwards:
   * once someone is on zero, nothing about the final chip counts says whether
   * they went out first or fifth.
   */
  bustOrder: string[];
};

/** Everyone who can still be dealt in. */
const survivors = (seats: readonly SessionSeat[]): SessionSeat[] =>
  seats.filter((seat) => seat.stack > 0);

export const isSessionComplete = (session: GameSession): boolean =>
  session.hand === null && survivors(session.seats).length < 2;

export const createSession = ({
  players,
  startingStack,
  buttonIndex = 0,
}: {
  players: readonly string[];
  startingStack: number;
  buttonIndex?: number;
}): GameSession => {
  if (players.length < 2) {
    throw new Error(`a game needs at least 2 players, got ${players.length}`);
  }
  if (new Set(players).size !== players.length) {
    throw new Error("every player needs their own id");
  }
  if (!Number.isInteger(startingStack) || startingStack <= 0) {
    throw new Error(
      `startingStack must be a positive whole number, got ${startingStack}`,
    );
  }
  if (
    !Number.isInteger(buttonIndex) ||
    buttonIndex < 0 ||
    buttonIndex >= players.length
  ) {
    throw new Error(
      `buttonIndex ${buttonIndex} is not a seat at a table of ${players.length}`,
    );
  }

  return {
    seats: players.map((playerId) => ({ playerId, stack: startingStack })),
    buttonIndex,
    hand: null,
    handsPlayed: 0,
    bustOrder: [],
  };
};

/**
 * The next seat clockwise that still has chips.
 *
 * The fallback is unreachable from `startNextHand`, which refuses to deal
 * unless two players are still in — but a function that walks a table has to
 * return something, and staying put is the harmless answer. Kept rather than
 * thrown so that a caller who has not checked gets a stale button instead of a
 * crash mid-game.
 */
const nextLiveIndex = (seats: readonly SessionSeat[], from: number): number => {
  for (let step = 1; step <= seats.length; step++) {
    const index = (from + step) % seats.length;
    if (seats[index].stack > 0) return index;
  }
  return from;
};

/**
 * Deal the next hand.
 *
 * Blinds are passed in because they belong to the tournament clock, not to the
 * game — the same schedule the timer is already counting down.
 *
 * Only players with chips are dealt in, and the button moves to the next of
 * them, so a knocked-out seat is skipped rather than being dealt a dead hand.
 */
export const startNextHand = (
  session: GameSession,
  {
    smallBlind,
    bigBlind,
    random,
  }: { smallBlind: number; bigBlind: number; random: RandomSource },
): GameSession => {
  if (session.hand !== null) {
    throw new Error("finish the current hand before dealing another");
  }
  if (isSessionComplete(session)) {
    throw new Error("the game is over");
  }

  const buttonIndex = nextLiveIndex(session.seats, session.buttonIndex);
  const live = survivors(session.seats);

  // The hand deals its own seats, so the button has to be re-expressed as an
  // index into the players who are actually in it.
  const buttonPlayerId = session.seats[buttonIndex].playerId;
  const handButtonIndex = live.findIndex(
    (seat) => seat.playerId === buttonPlayerId,
  );

  const hand = startHand({
    seats: live.map((seat) => ({ playerId: seat.playerId, stack: seat.stack })),
    buttonIndex: handButtonIndex,
    smallBlind,
    bigBlind,
    random,
  });

  return settle({
    ...session,
    buttonIndex,
    handsPlayed: session.handsPlayed + 1,
    hand,
  });
};

/** Apply one player's action to the hand in progress. */
export const act = (
  session: GameSession,
  playerId: string,
  action: BettingAction,
): GameSession => {
  if (!session.hand) {
    throw new Error("there is no hand in progress");
  }
  return settle({ ...session, hand: actOnHand(session.hand, playerId, action) });
};

/**
 * Fold a finished hand back into the game: stacks come home, anyone on zero is
 * knocked out, and the hand slot is cleared for the next deal.
 *
 * **Two players busting in the same hand are ordered by the stack they started
 * it with**, the bigger one finishing higher. That is the table rule, and it is
 * the only information left: after the hand both are on zero, so nothing about
 * the final counts can separate them.
 */
const settle = (session: GameSession): GameSession => {
  const hand = session.hand;
  if (!hand || !isHandComplete(hand)) return session;

  const finalStacks = new Map(hand.seats.map((seat) => [seat.playerId, seat.stack]));
  const startingStacks = new Map(
    session.seats.map((seat) => [seat.playerId, seat.stack]),
  );

  const seats = session.seats.map((seat) => ({
    ...seat,
    stack: finalStacks.get(seat.playerId) ?? seat.stack,
  }));

  const bustedThisHand = seats
    .filter(
      (seat) =>
        seat.stack === 0 && (startingStacks.get(seat.playerId) ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        (startingStacks.get(a.playerId) ?? 0) -
        (startingStacks.get(b.playerId) ?? 0),
    )
    .map((seat) => seat.playerId);

  return {
    ...session,
    seats,
    hand: null,
    bustOrder: [...session.bustOrder, ...bustedThisHand],
  };
};

/**
 * Everyone in finishing order, winner first.
 *
 * Whoever still has chips comes first — during a game that is several people,
 * ordered by stack, which is what a "current standings" view wants. Everyone
 * else is the bust order reversed, because the last person knocked out
 * finished highest.
 */
export const finishingOrder = (session: GameSession): string[] => {
  const stillIn = survivors(session.seats)
    .slice()
    .sort((a, b) => b.stack - a.stack)
    .map((seat) => seat.playerId);
  return [...stillIn, ...[...session.bustOrder].reverse()];
};

/**
 * Turn a finished game into a leaderboard entry.
 *
 * This is the point of the session existing. Recording a game by hand is two
 * taps per player and relies on somebody remembering who went out fourth; a
 * game the app dealt already knows.
 *
 * `winningsByPlace` is indexed from first place, and comes from the payout
 * structure the table agreed before the game — passed in rather than computed
 * here, so this stays independent of buy-ins, rebuys and bounties.
 */
export const toGameResult = (
  session: GameSession,
  params: {
    id: string;
    now: number;
    buyIn: number;
    bounty: number;
    winningsByPlace: readonly number[];
  },
): GameResult => {
  if (!isSessionComplete(session)) {
    throw new Error("the game is not over yet");
  }

  const order = finishingOrder(session);
  const placings: Placing[] = [];
  order.forEach((playerId, index) => {
    const winnings = params.winningsByPlace[index] ?? 0;
    // Only paid places are recorded, which is what the leaderboard expects —
    // and what keeps a nine-handed game from listing six zero-value finishes.
    if (winnings > 0) {
      placings.push({ playerId, place: index + 1, winnings });
    }
  });

  return createGameResult({
    id: params.id,
    playerIds: session.seats.map((seat) => seat.playerId),
    placings,
    buyIn: params.buyIn,
    bounty: params.bounty,
    now: params.now,
  });
};
