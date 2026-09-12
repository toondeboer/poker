/** Canonical web app URL — the landing page there links out to both app stores. */
export const SITE_URL = "https://poker-timer.toondeboer.com";

/**
 * Prefaces the site link when a user shares the app from a running timer screen.
 *
 * **The store title, not the marketing name.** This is read by somebody who
 * does not have the app; "Poker Blinds Buzzer" is neither what the stores list
 * it as nor what the home screen calls it ("Poker Timer"), so it names nothing
 * they could search for. Less critical than the invite message because the site
 * link is right there — but the same reasoning, and no reason to differ.
 */
export const SHARE_MESSAGE =
  "Running blinds with Poker Blinds Timer & Buzzer, a free poker tournament timer:";
