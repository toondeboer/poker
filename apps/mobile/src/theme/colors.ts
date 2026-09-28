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
  textOnClub: "#1f2937",

  /** Actions. */
  accent: "#3b82f6",
  success: "#10b981",
  /** Tinted success, for a "you already have this" panel rather than a control. */
  successSurface: "rgba(16, 185, 129, 0.15)",
  successText: "#34d399",
  neutral: "#4b5563",
  pro: "#f59e0b",
  proSurface: "rgba(245, 158, 11, 0.15)",
  proSurfaceSoft: "rgba(245, 158, 11, 0.1)",
  /**
   * Club — **a different colour from Pro, deliberately.**
   *
   * The two are different purchases with different shapes: Pro is paid once and
   * everything it unlocks runs on this phone; Club renews, and pays for a row on
   * a server other people poll. They were sold in one amber sheet under one
   * "Unlock Pro" heading, which is how somebody ends up subscribing when they
   * meant to buy the one-time unlock. Colour is the cheapest way to say "this is
   * the other one" on every screen at once.
   *
   * Violet because the four colours already spoken for here mean something:
   * `accent` blue is an ordinary action, `success` green is a live state,
   * `danger` red is destructive, and `pro` amber is the one-time unlock. Violet
   * collides with none of them, and `textOnClub` mirrors `textOnPro` so a filled
   * Club control reads the same way a filled Pro one does.
   */
  club: "#a78bfa",
  clubSurface: "rgba(167, 139, 250, 0.15)",
  clubSurfaceSoft: "rgba(167, 139, 250, 0.1)",
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
