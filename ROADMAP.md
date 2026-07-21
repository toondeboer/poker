# Roadmap

Growth + feature tracker for Poker Blinds Buzzer, picking up after the v1.1 launch and
monetization push. See [ROADMAP_ARCHIVE.md](./ROADMAP_ARCHIVE.md) for that history (App Store +
Play Store launch, ads, Pro IAP, ASO, the first SEO/table-side-virality pass) and
[ARCHITECTURE.md](./ARCHITECTURE.md) + [CLAUDE.md](./CLAUDE.md) for how the app is built.

**Where things stand:** iOS live at v1.1.2, Android live (approved 2026-07). **v1.1.3** (Sound
Pack Pro + Android fixes + the SEO/share work) is mid-flight: `release/1.1.3` → `main` PR #55 is
open, and PR #56 (SEO content + table-side share) still needs to merge into `release/1.1.3` before
the release gets cut. AdMob + Pro/Remove-Ads IAP are live on both platforms. Web AdSense is built
but blocked on Google's "Low value content" rejection — see P1 below.

**Legend:** ✅ done · 🚧 in progress · ⏳ waiting on an external process · ⬜ not started · ❌ chosen not to do for now.

## P1 — SEO & organic growth (unblocks the AdSense resubmission)
PR #56 added the technical/on-page baseline (metadata, sitemap, robots.txt, JSON-LD, and real copy
on `/timer`) — necessary, but not close to enough on its own to rank or to guarantee AdSense
approval. What's actually needed next:
- ⬜ **Google Search Console** — verify the `poker-timer.toondeboer.com` property and submit
  `sitemap.xml`. Confirms indexing and gives real impression/click data instead of guessing.
- ⬜ **More content pages** — the `/timer` FAQ is a start but thin by competitive standards.
  Genuinely useful guide pages (e.g. "how to run a home poker tournament," a blind-structure
  explainer), not keyword-stuffed filler.
- ⬜ **Backlinks** — the dominant ranking factor for a term like "poker timer," and untouched so
  far. Product Hunt launch, r/poker, poker forums, app-directory listings.
- ⏳ **AdSense resubmission** — re-submit for review once the above gives Google enough to judge
  the site as more than "low value content." Gated on real progress above, not a fixed date.

## 🔁 Ongoing — Monitor
- ⬜ AdMob fill/revenue, RevenueCat conversions, AdSense (post-approval), `app-ads.txt`/`ads.txt` verification, ratings & reviews
