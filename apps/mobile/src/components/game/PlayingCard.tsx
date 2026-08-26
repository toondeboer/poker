// src/components/game/PlayingCard.tsx
import { StyleSheet, Text, View } from "react-native";
import type { Card as CardType } from "@poker/core";
import { colors, radius, space } from "@/src/theme";

/** Red for hearts and diamonds, near-black for clubs and spades — the way a
 * real deck is, so a glance is enough. */
const SUIT = {
  c: { glyph: "♣", red: false },
  d: { glyph: "♦", red: true },
  h: { glyph: "♥", red: true },
  s: { glyph: "♠", red: false },
} as const;

const RANK_LABEL: Record<number, string> = {
  14: "A",
  13: "K",
  12: "Q",
  11: "J",
  10: "10",
};

/**
 * One playing card, or its back.
 *
 * Deliberately drawn rather than an image: fifty-two assets to ship, scale and
 * keep in step with the theme, for something two glyphs express exactly.
 */
export function PlayingCard({
  card,
  faceDown = false,
  size = "md",
}: {
  card?: CardType;
  faceDown?: boolean;
  size?: "sm" | "md";
}) {
  const small = size === "sm";
  const box = [styles.card, small && styles.cardSmall];

  if (faceDown || !card) {
    return (
      <View style={[...box, styles.back]} accessibilityLabel="Face-down card">
        <Text style={styles.backMark}>♠</Text>
      </View>
    );
  }

  const suit = SUIT[card.suit];
  const rank = RANK_LABEL[card.rank] ?? String(card.rank);
  return (
    <View
      style={box}
      accessibilityLabel={`${rank} of ${
        { c: "clubs", d: "diamonds", h: "hearts", s: "spades" }[card.suit]
      }`}
    >
      <Text
        style={[
          small ? styles.rankSmall : styles.rank,
          suit.red ? styles.red : styles.black,
        ]}
      >
        {rank}
      </Text>
      <Text
        style={[
          small ? styles.suitSmall : styles.suit,
          suit.red ? styles.red : styles.black,
        ]}
      >
        {suit.glyph}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 46,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.xs,
  },
  cardSmall: { width: 34, height: 48 },
  back: { backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border },
  backMark: { color: colors.textMuted, fontSize: 20 },
  rank: { fontSize: 20, fontWeight: "700", lineHeight: 22 },
  rankSmall: { fontSize: 15, fontWeight: "700", lineHeight: 17 },
  suit: { fontSize: 18, lineHeight: 20 },
  suitSmall: { fontSize: 13, lineHeight: 15 },
  red: { color: "#dc2626" },
  black: { color: "#0f172a" },
});
