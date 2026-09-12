// src/hooks/useEndOfGamePrompt.ts
import { useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useLeaderboard } from "@/src/contexts/LeaderboardContext";

/**
 * Offers to record a result when a game looks like it just ended.
 *
 * **There is no real "tournament ended" signal in this app, so this is a
 * heuristic.** The timer's reset button resets the *round*, deliberately
 * leaving the blind level alone — nothing anywhere means "the game is over".
 * The closest honest proxy is resetting after the blinds have actually climbed:
 * that combination is someone starting fresh, which almost always means the
 * last game finished. Resetting on level 1 is a mis-tap or a false start and is
 * left alone.
 *
 * Three conditions keep it from nagging. It only fires when the blinds
 * progressed, when Pro is unlocked (the leaderboard is a Pro feature, and
 * advertising it here would be a prompt with nowhere to go), and when there is
 * at least one player on the roster — otherwise the sheet it opens can only say
 * "add some players first", which is a worse first impression than staying
 * quiet.
 */
export function useEndOfGamePrompt() {
  const router = useRouter();
  const { isPremium } = usePremium();
  const { players } = useLeaderboard();

  return useCallback(
    (blindsProgressed: boolean) => {
      if (!blindsProgressed || !isPremium || players.length === 0) return;
      Alert.alert(
        "Record this game?",
        "Add the result to your leaderboard while everyone is still at the table.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Record",
            onPress: () => router.navigate("/leaderboard?record=1"),
          },
        ],
      );
    },
    [isPremium, players.length, router],
  );
}
