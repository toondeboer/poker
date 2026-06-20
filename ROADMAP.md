# Roadmap

Monetization is live on **iOS** (AdMob banner + Pro / Remove-Ads IAP via RevenueCat).
This tracks what's next. See [ARCHITECTURE.md](./ARCHITECTURE.md) for design.

## In progress

- **Android launch** — publish to Google Play with ads + Pro parity. Needs: Play Console app,
  RevenueCat Android (Google SDK key + Play service account), Play `pro_lifetime` product,
  data-safety form, and the real Play Store link in the landing page.
- **Web AdSense** — site verified on the apex `toondeboer.com`; awaiting AdSense approval, after
  which ads serve on `poker-timer.toondeboer.com` (env vars set in Vercel).

## Growth (the real revenue lever — installs/traffic, not more channels)

- **ASO (App Store Optimization)** — optimize the iOS (then Android) listing for discovery +
  conversion: title + subtitle + keyword field; screenshots leading with Live Activities /
  Dynamic Island; an in-app review prompt after a completed game. Highest-leverage next step.
- **SEO funnel** — rank the free web `/timer` for "poker timer / blinds timer / tournament clock"
  and funnel visitors to the app.
- **Brandable apex domain** — move the web app off the `poker-timer.toondeboer.com` subdomain to a
  memorable apex (better word-of-mouth, ASO, ads.txt-at-root, trust).
- **Table-side virality** — subtle on-screen brand + URL and a share affordance so each poker
  night seeds installs from the watchers.

## Premium features (re-add to the Pro paywall once built)

- Saved tournament presets / multiple blind structures, extra blind levels, sound packs.
  The paywall currently lists only "remove ads" + "support the dev" — keep it honest until these ship.

## Done

- Shared `shouldShowAds` / entitlement seam in `@poker/core`.
- Web: Ko-fi tip jar, consent-gated AdSense components, `app-ads.txt` / `ads.txt`.
- iOS: AdMob banner, RevenueCat Pro IAP, from-source EAS build, universal device family (1.1.x).
