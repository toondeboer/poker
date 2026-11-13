// Composes the captioned store screenshots from raw device captures.
// Run from repo root: node store-assets/generate-screenshots.js
//
// Raw captures live in store-assets/raw/<set>/<NN>-<slug>.png, one folder per
// device class (see SETS). Output goes to store-assets/<store>/screenshots/<set>/
// under the same file name. Edit SHOTS to change a caption and re-run; the raw
// captures are only re-taken when the app's screens change.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const REPO = path.join(__dirname, "..");
// Caption typeface. A system font on purpose: sharp's prebuilt text renderer
// on macOS only sees installed fonts (both an @font-face embedded in SVG and
// its own `fontfile` option were tried and silently fell back), so naming one
// that ships with macOS is what keeps the output the same on every run here.
// Regenerating on another OS needs a font it has.
const CAPTION_FONT = "Helvetica Neue Bold";

// Same palette as android/generate-feature-graphic.js, sampled from icon.png,
// so the screenshots and the feature graphic read as one listing.
const BG = "#0D3827";
const CREAM = "#FFEEDB";

/** One entry per screenshot, in store order. `slug` matches the raw file name. */
const SHOTS = [
  {
    slug: "01-timer",
    caption: ["The blinds clock", "the whole table can read"],
  },
  { slug: "02-blinds", caption: ["Your structure,", "your round lengths"] },
  { slug: "03-payouts", caption: ["Payouts worked out", "for you"] },
  { slug: "04-leaderboard", caption: ["A leaderboard", "for your group"] },
  { slug: "05-deal", caption: ["No deck?", "It deals."] },
];

/**
 * Output canvas per device class. Sizes are what each console asks for:
 * Play takes 9:16 phone shots and 16:10-ish tablet shots; App Store Connect
 * wants exactly 1320x2868 (iPhone 6.9") and 2064x2752 (iPad 13").
 */
const SETS = {
  "android-phone": { store: "android", width: 1080, height: 1920 },
  "android-tablet": { store: "android", width: 1600, height: 2560 },
  "ios-iphone-6.9": { store: "ios", width: 1320, height: 2868 },
  "ios-ipad-13": { store: "ios", width: 2064, height: 2752 },
};

async function compose(rawPath, outPath, { width, height }, caption) {
  // Everything scales off the canvas width so one layout serves all four sizes.
  const u = width / 1080;
  const fontSize = Math.round(66 * u);
  const lineHeight = Math.round(fontSize * 1.25);
  const captionTop = Math.round(110 * u);
  const captionBottom = captionTop + lineHeight * caption.length;
  const gap = Math.round(70 * u);
  const sideMargin = Math.round(90 * u);
  const radius = Math.round(44 * u);

  // The capture is bled off the bottom edge on purpose: it reads as a phone
  // rising into frame, and it keeps the caption large without shrinking the
  // screen to fit all of it.
  const shotWidth = width - sideMargin * 2;
  const raw = sharp(rawPath);
  const meta = await raw.metadata();
  const shotHeight = Math.round((meta.height / meta.width) * shotWidth);
  const shotTop = captionBottom + gap;
  const visibleHeight = Math.min(shotHeight, height - shotTop);

  const mask = Buffer.from(
    `<svg width="${shotWidth}" height="${shotHeight}"><rect width="${shotWidth}" height="${shotHeight}" rx="${radius}" ry="${radius}"/></svg>`,
  );
  const shot = await raw
    .resize(shotWidth, shotHeight)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  const cropped = await sharp(shot)
    .extract({ left: 0, top: 0, width: shotWidth, height: visibleHeight })
    .toBuffer();

  const captionImage = await sharp({
    text: {
      text: `<span foreground="${CREAM}">${caption.map(escapeXml).join("\n")}</span>`,
      font: `${CAPTION_FONT} ${fontSize}`,
      // 72 dpi makes one point one pixel, so `fontSize` is in canvas pixels.
      dpi: 72,
      align: "centre",
      spacing: Math.round(fontSize * 0.25),
      rgba: true,
    },
  })
    .png()
    .toBuffer();
  const captionMeta = await sharp(captionImage).metadata();

  const background = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="18%" r="95%">
      <stop offset="0%" stop-color="#134430"/>
      <stop offset="55%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="#071F16"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
</svg>`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp(background)
    .composite([
      { input: cropped, left: sideMargin, top: shotTop },
      {
        input: captionImage,
        left: Math.round((width - captionMeta.width) / 2),
        // Centred in the band above the capture, whatever height the text
        // actually rendered at.
        top: Math.round(
          captionTop + (captionBottom - captionTop - captionMeta.height) / 2,
        ),
      },
    ])
    // Both consoles reject alpha in screenshots.
    .flatten({ background: BG })
    .removeAlpha()
    .png()
    .toFile(outPath);
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  let written = 0;
  for (const [set, spec] of Object.entries(SETS)) {
    for (const { slug, caption } of SHOTS) {
      const rawPath = path.join(__dirname, "raw", set, `${slug}.png`);
      if (!fs.existsSync(rawPath)) continue;
      const outPath = path.join(
        __dirname,
        spec.store,
        "screenshots",
        set,
        `${slug}.png`,
      );
      await compose(rawPath, outPath, spec, caption);
      console.log(path.relative(REPO, outPath));
      written++;
    }
  }
  if (written === 0) {
    console.log("No raw captures found under store-assets/raw/<set>/.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
