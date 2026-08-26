// src/contexts/GameContext.tsx
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  actOnSession,
  createSession,
  finishingOrder,
  isSessionComplete,
  legalActions,
  startNextHand,
  type BettingAction,
  type GameSession,
  type LegalActions,
} from "@poker/core";

export type GameSetup = {
  /** Player **ids**, in seat order. Ids travel; names are for reading. */
  players: string[];
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  /**
   * The leaderboard group these seats came from.
   *
   * Captured when the game starts, not read when it is saved: switching group
   * mid-game would otherwise file the night on a board whose members are
   * different people, with ids nobody there recognises and nothing to notice
   * it.
   */
  groupId: string | null;
};

type GameContextValue = {
  /** The game in progress, or `null` when nobody is playing. */
  session: GameSession | null;
  setup: GameSetup | null;
  /** Whose turn, and what they may do. `null` between hands. */
  legal: LegalActions | null;
  complete: boolean;
  /** Winner first. During a game, the players still in ranked by stack. */
  order: string[];
  handInProgress: boolean;
  /**
   * Whether this game has already been put on the leaderboard.
   *
   * Lives here rather than in the screen because the screen is pushed and the
   * game deliberately outlives it — a flag held there would reset on a
   * back-press and let the same night be recorded twice, once per tap, with no
   * deduplication anywhere downstream.
   */
  recorded: boolean;
  markRecorded: () => void;
  startGame: (setup: GameSetup) => void;
  deal: () => void;
  act: (playerId: string, action: BettingAction) => void;
  endGame: () => void;
};

const GameContext = createContext<GameContextValue | null>(null);

/**
 * A game of hold'em dealt by this phone.
 *
 * **A context rather than screen state, because the screen is pushed.** Tapping
 * back to glance at the tournament clock unmounts it, and a game held in
 * `useState` there would go with it — an evening's stacks gone to a
 * back-press, with no warning and nothing to restore. Held here it survives
 * navigation, for the same reason the payout and leaderboard state is.
 *
 * It does **not** survive the app being killed. That wants persistence and a
 * schema, and is written up in ROADMAP.md rather than half-done here.
 *
 * Every rule is `@poker/core`'s. Nothing in this file decides who acts, what is
 * legal, or where the chips go — which is what lets the same functions become
 * the server's authority when online play arrives.
 *
 * **Randomness is `Math.random` itself, not a seeded PRNG.** Handing the engine
 * `createRandom(seed)` is the tempting shape and the wrong one: that PRNG holds
 * 32 bits of state, so the entire space of shuffles is about four billion and
 * somebody at the table could recover the rest of the deck from their own two
 * cards and the flop. Seeding it from `Math.random` does not help — the
 * weakness is the size of the space, not how the seed was chosen. Passing
 * `Math.random` straight through sidesteps it, at the cost of a hand no longer
 * being replayable, which nothing here wants. It is still not cryptographic;
 * online play deals on the server for exactly that reason.
 */
export function GameProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [setup, setSetup] = useState<GameSetup | null>(null);
  const [recorded, setRecorded] = useState(false);

  const startGame = useCallback((next: GameSetup) => {
    setSetup(next);
    setRecorded(false);
    setSession(
      createSession({
        players: next.players,
        startingStack: next.startingStack,
      }),
    );
  }, []);

  const endGame = useCallback(() => {
    setSession(null);
    setSetup(null);
    setRecorded(false);
  }, []);

  const markRecorded = useCallback(() => setRecorded(true), []);

  const deal = useCallback(() => {
    setSession((current) => {
      if (!current || !setup) return current;
      if (current.hand || isSessionComplete(current)) return current;
      return startNextHand(current, {
        smallBlind: setup.smallBlind,
        bigBlind: setup.bigBlind,
        random: Math.random,
      });
    });
  }, [setup]);

  const act = useCallback((playerId: string, action: BettingAction) => {
    setSession((current) => {
      if (!current?.hand) return current;
      // Ignore anything that is not the current player's move. Two presses
      // landing before a re-render would otherwise send the second with a
      // stale player: the engine throws from inside this updater, and there is
      // no error boundary to catch it — or the timing works out and it quietly
      // folds the next player's hand.
      const turn = legalActions(current.hand);
      if (!turn || turn.playerId !== playerId) return current;
      return actOnSession(current, playerId, action);
    });
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      session,
      setup,
      legal: session?.hand ? legalActions(session.hand) : null,
      complete: session ? isSessionComplete(session) : false,
      order: session ? finishingOrder(session) : [],
      handInProgress: session?.hand != null,
      recorded,
      markRecorded,
      startGame,
      deal,
      act,
      endGame,
    }),
    [session, setup, recorded, markRecorded, startGame, deal, act, endGame],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
