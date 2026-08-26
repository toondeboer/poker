// src/components/game/useGameSession.ts
import { useCallback, useMemo, useState } from "react";
import {
  actOnSession,
  createRandom,
  createSession,
  finishingOrder,
  isSessionComplete,
  legalActions,
  startNextHand,
  type BettingAction,
  type GameSession,
  type LegalActions,
} from "@poker/core";

/**
 * Drives a game of hold'em from `@poker/core`.
 *
 * All this owns is React state and a seed. Every rule — who acts, what is
 * legal, who wins, where the chips go — is the engine's, which is the point:
 * the same functions run on the server when online play arrives, so there is
 * no second implementation of the rules living in a screen.
 *
 * **The seed is generated here** because `@poker/core` deliberately has no
 * randomness of its own. This is `Math.random`, which is fine for a table
 * everyone is sitting at and passing one phone around; a real deal against
 * opponents in another room needs a cryptographic source on the server, and
 * `createRandom`'s own documentation says so at length.
 */
export type GameState = {
  session: GameSession;
  /** Whose turn, and what they may do. `null` between hands. */
  legal: LegalActions | null;
  /** True once one player has all the chips. */
  complete: boolean;
  /** Winner first. During a game, the players still in ranked by stack. */
  order: string[];
  handInProgress: boolean;
};

export const useGameSession = (params: {
  players: string[];
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
}) => {
  const [session, setSession] = useState<GameSession>(() =>
    createSession({
      players: params.players,
      startingStack: params.startingStack,
    }),
  );

  const deal = useCallback(() => {
    setSession((current) =>
      isSessionComplete(current) || current.hand
        ? current
        : startNextHand(current, {
            smallBlind: params.smallBlind,
            bigBlind: params.bigBlind,
            // A fresh seed per hand. Deriving it from the hand number instead
            // would make every game with the same players deal identically.
            random: createRandom(Math.floor(Math.random() * 0xffffffff)),
          }),
    );
  }, [params.smallBlind, params.bigBlind]);

  const act = useCallback((playerId: string, action: BettingAction) => {
    setSession((current) =>
      current.hand ? actOnSession(current, playerId, action) : current,
    );
  }, []);

  const state = useMemo<GameState>(
    () => ({
      session,
      legal: session.hand ? legalActions(session.hand) : null,
      complete: isSessionComplete(session),
      order: finishingOrder(session),
      handInProgress: session.hand !== null,
    }),
    [session],
  );

  return { ...state, deal, act };
};
