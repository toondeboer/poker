// src/contexts/GameContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  canDeal,
  createDealerSession,
  dealNextHand,
  muck,
  nextStreet,
  sitIn,
  sitOut,
  unmuck,
  type DealerSession,
} from "@poker/core";
import { GameStorage } from "@/src/services/GameStorage";
import { logger } from "@/src/utils/logger";

export type GameSetup = {
  /** Player **ids**, in seat order. Ids travel; names are for reading. */
  players: string[];
};

type GameContextValue = {
  /** The table in progress, or `null` when nobody is playing. */
  session: DealerSession | null;
  setup: GameSetup | null;
  /** False until the stored game has been read back. */
  isLoading: boolean;
  /** Whether a hand is being dealt right now. */
  handInProgress: boolean;
  /** Whether another hand can be dealt. */
  canDealNext: boolean;
  startGame: (setup: GameSetup) => void;
  deal: () => void;
  advanceStreet: () => void;
  toggleMuck: (playerId: string, mucked: boolean) => void;
  toggleSittingOut: (playerId: string, sittingOut: boolean) => void;
  endGame: () => void;
};

const GameContext = createContext<GameContextValue | null>(null);

/**
 * The dealt hand, held above the screen so it survives navigation.
 *
 * **The app is a deck, not a game.** It deals, shows the board, hides each
 * player's cards until they ask, and reads the showdown. There are no chips in
 * here — the table has those in front of them — and nothing that looks like a
 * bet. See `packages/core/src/poker/deal.ts` for why that boundary exists and
 * why it should not be crossed.
 *
 * **Randomness is `Math.random` itself, not a seeded PRNG.** Handing the engine
 * `createRandom(seed)` is the tempting shape and the wrong one: that PRNG holds
 * 32 bits of state, so the entire space of shuffles is about four billion and
 * somebody at the table could recover the rest of the deck from their own two
 * cards and the flop. Seeding it from `Math.random` does not help — the weakness
 * is the size of the space, not how the seed was chosen. Passing `Math.random`
 * straight through sidesteps it, at the cost of a hand no longer being
 * replayable. It is still not cryptographic; a real dealer would draw from
 * `crypto.getRandomValues`, and that remains a known gap in `ROADMAP.md`.
 */
export function GameProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, setSession] = useState<DealerSession | null>(null);
  const [setup, setSetup] = useState<GameSetup | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Nothing may be written before the stored game has been read, or an empty
  // initial state persists straight over an evening in progress — the same
  // trap the leaderboard screen guards with its own loading check.
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    GameStorage.loadGame()
      .then((saved) => {
        if (!active || !saved) return;
        setSetup(saved.setup);
        setSession(saved.session);
      })
      .catch((error) => logger.error("Failed to load the game:", error))
      .finally(() => {
        if (!active) return;
        hydrated.current = true;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Persist on every change, once the stored game has been read.
   *
   * **This matters more here than it did when the app held the chips.** The
   * chips are on the table; the app is the only thing that knows the cards, so
   * a phone dying mid-street loses a hand nobody can reconstruct.
   */
  useEffect(() => {
    if (!hydrated.current) return;
    if (!session || !setup) {
      GameStorage.clearGame().catch((error) =>
        logger.error("Failed to clear the game:", error),
      );
      return;
    }
    GameStorage.saveGame({ setup, session }).catch((error) =>
      logger.error("Failed to save the game:", error),
    );
  }, [session, setup]);

  const startGame = useCallback((next: GameSetup) => {
    setSetup(next);
    setSession(createDealerSession({ players: next.players }));
  }, []);

  const endGame = useCallback(() => {
    setSession(null);
    setSetup(null);
  }, []);

  const deal = useCallback(() => {
    setSession((current) => {
      if (!current || !canDeal(current)) return current;
      return dealNextHand(current, { random: Math.random });
    });
  }, []);

  const advanceStreet = useCallback(() => {
    setSession((current) => (current?.deal ? nextStreet(current) : current));
  }, []);

  const toggleMuck = useCallback((playerId: string, mucked: boolean) => {
    setSession((current) =>
      current
        ? mucked
          ? muck(current, playerId)
          : unmuck(current, playerId)
        : current,
    );
  }, []);

  const toggleSittingOut = useCallback(
    (playerId: string, sittingOut: boolean) => {
      setSession((current) =>
        current
          ? sittingOut
            ? sitOut(current, playerId)
            : sitIn(current, playerId)
          : current,
      );
    },
    [],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      session,
      setup,
      isLoading,
      handInProgress: session?.deal != null,
      canDealNext: session ? canDeal(session) : false,
      startGame,
      deal,
      advanceStreet,
      toggleMuck,
      toggleSittingOut,
      endGame,
    }),
    [
      session,
      setup,
      isLoading,
      startGame,
      deal,
      advanceStreet,
      toggleMuck,
      toggleSittingOut,
      endGame,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within a GameProvider");
  return context;
}
