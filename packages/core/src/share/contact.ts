/**
 * The address people reach us on, for the website and the app alike.
 *
 * One constant because it was previously written out in two places, and the
 * failure mode of that is silent: change it where you remember and the other
 * surface keeps pointing at an inbox nobody reads. It lives in core rather
 * than in `apps/web` since the app now needs it too (see {@link adReportMailto}).
 */
export const CONTACT_EMAIL = "poker.blinds.buzzer@gmail.com";

/**
 * A `mailto:` link for reporting an ad shown in the app.
 *
 * **Why this exists:** App Review Guideline 2.5.18 says _"Apps that contain ads
 * must also include the ability for users to report any inappropriate or
 * age-inappropriate ads."_ AdMob's own ad-info icon offers that for some ads but
 * not all, and nothing from it ever reaches us. A report that lands in the
 * support inbox is one that can be acted on, by blocking the advertiser in
 * AdMob's blocking controls.
 *
 * **What the body asks for** is what blocking needs: what the ad was for and
 * what was wrong with it. The footer adds the platform and app version, which
 * narrows down the ad unit. Nothing that identifies the person is added; the
 * mail app supplies their address, and that is their choice to send.
 *
 * Encoded with `encodeURIComponent`, which writes spaces as `%20`. RFC 6068
 * requires that for `mailto:`; a `+` would arrive in the subject literally.
 */
export function adReportMailto({
  platform,
  appVersion,
}: {
  platform: string;
  appVersion?: string | null;
}): string {
  const subject = "Report an ad";
  const version = appVersion ? ` ${appVersion}` : "";
  const body = [
    "What was the ad for, and what was wrong with it? A screenshot helps if you have one.",
    "",
    "",
    "---",
    `Poker Blinds Timer & Buzzer${version} on ${platform}`,
  ].join("\n");
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
