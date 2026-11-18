// Composes the App Store "universal" creative asset: one image Apple crops for
// both the product page header and the search results card (iOS 27 and later).
// Run from repo root: node store-assets/ios/generate-creative-asset.js
//
// Specs (App Store Connect Help → Creative assets specifications, checked
// 2026-11-18): 16:9, exactly 5244 x 2950, PNG, no alpha. Key artwork must sit
// inside the art safe area, 1402 x 962 at (1921, 660); everything outside it
// can be cropped on some device, so it is decoration only.
//
// Apple's guidance it follows: one clear idea, the app's purpose obvious at a
// glance, the real interface shown, at most a short phrase, and no prices,
// URLs, other platforms' logos or awards.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const W = 5244;
const H = 2950;
const SAFE = { x: 1921, y: 660, w: 1402, h: 962 };

// Same palette as the screenshots and the Play feature graphic.
const BG = "#0D3827";
const CREAM = "#FFEEDB";
const CAPTION_FONT = "Helvetica Neue Bold";

const RAW = path.join(__dirname, "..", "raw", "ios-iphone-6.9");
const OUT = path.join(__dirname, "creative", "universal.png");

/** A capture inside a dark rounded bezel, with a soft shadow under it. */
async function phone(file, height, opacity = 1) {
  const meta = await sharp(file).metadata();
  const screenH = Math.round(height * 0.965);
  const screenW = Math.round((meta.width / meta.height) * screenH);
  const bezel = Math.round((height - screenH) / 2);
  const w = screenW + bezel * 2;
  const radius = Math.round(w * 0.13);
  const screenRadius = radius - bezel;

  const screen = await sharp(file)
    .resize(screenW, screenH)
    .composite([
      {
        input: Buffer.from(
          `<svg width="${screenW}" height="${screenH}"><rect width="${screenW}" height="${screenH}" rx="${screenRadius}" ry="${screenRadius}"/></svg>`,
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  const pad = Math.round(height * 0.08);
  const canvasW = w + pad * 2;
  const canvasH = height + pad * 2;
  const frame = Buffer.from(`
<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="${Math.round(height * 0.025)}" stdDeviation="${Math.round(height * 0.03)}" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <rect x="${pad}" y="${pad}" width="${w}" height="${height}" rx="${radius}" ry="${radius}" fill="#111" filter="url(#s)"/>
</svg>`);

  let out = await sharp(frame)
    .composite([{ input: screen, left: pad + bezel, top: pad + bezel }])
    .png()
    .toBuffer();
  if (opacity < 1) {
    out = await sharp(out)
      .ensureAlpha()
      .composite([
        {
          input: Buffer.from(
            `<svg width="${canvasW}" height="${canvasH}"><rect width="${canvasW}" height="${canvasH}" fill="#fff" fill-opacity="${opacity}"/></svg>`,
          ),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();
  }
  return { buffer: out, width: canvasW, height: canvasH, pad };
}

async function caption(lines, maxWidth, maxHeight) {
  // Largest size that fits the room beside the phone.
  for (let size = 150; size >= 60; size -= 4) {
    const buffer = await sharp({
      text: {
        text: `<span foreground="${CREAM}">${lines.join("\n")}</span>`,
        font: `${CAPTION_FONT} ${size}`,
        dpi: 72,
        align: "left",
        spacing: Math.round(size * 0.22),
        rgba: true,
      },
    })
      .png()
      .toBuffer();
    const meta = await sharp(buffer).metadata();
    if (meta.width <= maxWidth && meta.height <= maxHeight) {
      return { buffer, width: meta.width, height: meta.height };
    }
  }
  throw new Error("Caption does not fit the safe area.");
}

async function main() {
  const background = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#16503A"/>
      <stop offset="55%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="#061A12"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
</svg>`);

  // The key art: the timer, filling the safe area's height, at its left.
  const hero = await phone(path.join(RAW, "01-timer.png"), SAFE.h);
  const heroLeft = SAFE.x - hero.pad;
  const heroTop = SAFE.y - hero.pad;
  const heroScreenW = hero.width - hero.pad * 2;

  // The phrase, in the rest of the safe area.
  const gap = Math.round(SAFE.w * 0.07);
  const room = SAFE.w - heroScreenW - gap;
  const text = await caption(
    ["The blinds clock", "for poker night"],
    room,
    SAFE.h,
  );
  const textLeft = SAFE.x + heroScreenW + gap;
  const textTop = SAFE.y + Math.round((SAFE.h - text.height) / 2);

  // Decoration outside the safe area, dimmed so the timer stays the one idea:
  // seen on wide screens, cropped away on narrow ones, and lost to nothing.
  const sideH = Math.round(SAFE.h * 0.86);
  const left = await phone(path.join(RAW, "02-blinds.png"), sideH, 0.55);
  const right = await phone(path.join(RAW, "04-leaderboard.png"), sideH, 0.55);
  const sideTop = SAFE.y + Math.round((SAFE.h - sideH) / 2) - left.pad;
  const sideGap = Math.round(SAFE.w * 0.12);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await sharp(background)
    .composite([
      {
        input: left.buffer,
        left: SAFE.x - sideGap - (left.width - left.pad),
        top: sideTop,
      },
      {
        input: right.buffer,
        left: SAFE.x + SAFE.w + sideGap - right.pad,
        top: sideTop,
      },
      { input: hero.buffer, left: heroLeft, top: heroTop },
      { input: text.buffer, left: textLeft, top: textTop },
    ])
    // Apple rejects alpha channels in these assets.
    .flatten({ background: BG })
    .removeAlpha()
    .png()
    .toFile(OUT);
  console.log(path.relative(path.join(__dirname, "..", ".."), OUT));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
