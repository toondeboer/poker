/**
 * Monetization config, sourced from public env vars so nothing is hardcoded.
 * Set these in `.env.local` (local) and the Vercel project (production); see
 * `.env.example`. Each value is optional — when unset, the related UI (tip jar,
 * ad slots) simply renders nothing, so the site works unchanged until configured.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` references at build time, so these
 * literal reads are statically replaced even though they live in a shared module.
 */

/** AdSense publisher id, e.g. "ca-pub-1234567890123456". */
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

/** Ad unit slot id for the landing page. */
export const ADSENSE_SLOT_LANDING = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LANDING;

/** Ad unit slot id for the web timer side panel. */
export const ADSENSE_SLOT_TIMER = process.env.NEXT_PUBLIC_ADSENSE_SLOT_TIMER;

/** Tip-jar destination, e.g. a Ko-fi or Buy Me a Coffee profile URL. */
export const TIP_JAR_URL = process.env.NEXT_PUBLIC_TIP_JAR_URL;

/**
 * Ko-fi username, derived from {@link TIP_JAR_URL} (the segment after
 * `ko-fi.com/`). Powers the floating Ko-fi overlay widget; undefined when the
 * tip-jar URL is unset or isn't a Ko-fi link.
 */
export const KOFI_USERNAME = TIP_JAR_URL?.match(
  /ko-fi\.com\/([^/?#]+)/i,
)?.[1];
