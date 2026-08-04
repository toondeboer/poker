// src/theme/typography.ts
import { TextStyle } from "react-native";
import { colors } from "./colors";

export const text = {
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  body: {
    fontSize: 14,
    color: colors.textLabel,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textLabel,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  /** Numeric inputs and blind values — monospace so digits don't jitter. */
  mono: {
    fontSize: 18,
    fontFamily: "monospace",
    color: colors.text,
  },
  monoCompact: {
    fontSize: 16,
    fontFamily: "monospace",
    color: colors.text,
  },
} satisfies Record<string, TextStyle>;
