// src/theme/layout.ts

/**
 * Width above which a device gets the tablet layout.
 *
 * Deliberately `>` and deliberately 768: an iPad mini in portrait is 744pt and
 * therefore stays on the phone layout. That's long-shipped behaviour on both
 * Timer and Settings — changing this threshold is a product decision, not a
 * refactor (see ROADMAP's cross-device QA notes).
 */
export const TABLET_MIN_WIDTH = 768;

export const isTabletWidth = (width: number): boolean =>
  width > TABLET_MIN_WIDTH;

/** Content width caps for the centred tablet layouts. */
export const TABLET_MAX_WIDTH_SETTINGS = 1000;
export const TABLET_MAX_WIDTH_LIST = 900;
