// src/theme/colors.ts
// The app's de-facto palette, named. Every value here is lifted verbatim from
// the hardcoded hex that PokerSettings/PokerTimer already used, so adopting
// these tokens causes no visual change on its own.
export const colors = {
  /** Screen background. */
  bg: "#0f172a",

  /** Card surface + its border. */
  surface: "rgba(30, 41, 59, 0.5)",
  surfaceSolid: "#1e293b",
  border: "#374151",

  /** Inner surfaces sitting on top of a card (rows, inputs). */
  surfaceAlt: "rgba(71, 85, 105, 0.3)",
  surfaceInput: "rgba(71, 85, 105, 0.5)",
  surfaceInputCompact: "rgba(75, 85, 99, 0.5)",
  borderSubtle: "rgba(75, 85, 99, 0.5)",
  borderInput: "#4b5563",
  borderInputCompact: "#6b7280",

  /** Text. */
  text: "#ffffff",
  textLabel: "#cbd5e1",
  textMuted: "#94a3b8",
  textOnAccent: "#ffffff",
  textOnPro: "#1f2937",

  /** Actions. */
  accent: "#3b82f6",
  success: "#10b981",
  neutral: "#4b5563",
  pro: "#f59e0b",
  proSurface: "rgba(245, 158, 11, 0.15)",
  proSurfaceSoft: "rgba(245, 158, 11, 0.1)",
  danger: "#ef4444",
  dangerSurface: "rgba(239, 68, 68, 0.1)",

  /** Badges + overlays. */
  // Playing cards. A real deck is white with red and black pips, and it has to
  // stay that way in a dark theme — a card tinted to match the app stops
  // reading as a card.
  cardFace: "#f8fafc",
  cardRed: "#dc2626",
  cardBlack: "#0f172a",

  badge: "rgba(71, 85, 105, 0.5)",
  iconTint: "rgba(59, 130, 246, 0.2)",
  overlay: "rgba(0, 0, 0, 0.6)",
  shadow: "#000",
} as const;
