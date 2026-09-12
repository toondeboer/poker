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
/**
 * Cap for a sheet, which is deliberately much narrower than the two above.
 *
 * Those cap a *screen*, so they only have to stop a line of text running the
 * full width of an iPad. A sheet is a form floating over that screen, and
 * reads as a dialog rather than a page — iOS's own `formSheet` presentation is
 * 540pt wide for the same reason. 640 keeps the generator's four-across
 * "smallest chip" row comfortable while staying clearly narrower than the
 * content behind it.
 *
 * It must also stay under the narrowest tablet width this applies to: an 11"
 * iPad is 834pt, so a cap of 900 (what `TABLET_MAX_WIDTH_LIST` would have
 * given) is *wider than the device* and does nothing at all.
 */
export const TABLET_MAX_WIDTH_SHEET = 640;
