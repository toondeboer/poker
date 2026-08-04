// src/theme/spacing.ts
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 16,
  xl: 24,
  pill: 20,
} as const;

/** Horizontal gutter used by both screens' scroll content. */
export const SCREEN_GUTTER = space.lg;
