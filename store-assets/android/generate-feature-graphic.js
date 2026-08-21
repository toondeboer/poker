// Regenerates feature-graphic.png (Play Console feature graphic, 1024x500, no alpha).
// Run from repo root: node store-assets/android/generate-feature-graphic.js
// Edit the copy/colors below and re-run to update the PNG.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const REPO = path.join(__dirname, "..", "..");
const iconB64 = fs
  .readFileSync(path.join(REPO, "apps/mobile/src/assets/images/icon.png"))
  .toString("base64");
const fontB64 = fs
  .readFileSync(path.join(REPO, "apps/mobile/src/assets/fonts/SpaceMono-Regular.ttf"))
  .toString("base64");

const W = 1024;
const H = 500;

// Colors sampled directly from icon.png so the graphic reads as the same brand.
const BG = "#0D3827";
const RED = "#D53A2D";
const CREAM = "#FFEEDB";

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'SpaceMono';
        src: url(data:font/ttf;base64,${fontB64}) format('truetype');
      }
    </style>
    <radialGradient id="bg" cx="32%" cy="40%" r="85%">
      <stop offset="0%" stop-color="#134430"/>
      <stop offset="55%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="#071F16"/>
    </radialGradient>
    <clipPath id="iconClip">
      <rect x="0" y="0" width="340" height="340" rx="78" ry="78"/>
    </clipPath>
    <filter id="iconShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- faint poker-chip confetti texture, background right side -->
  <g fill="${CREAM}">
    <circle cx="955" cy="60" r="16" opacity="0.09"/>
    <circle cx="1000" cy="130" r="9" opacity="0.08"/>
    <circle cx="905" cy="45" r="7" opacity="0.07"/>
    <circle cx="985" cy="330" r="13" opacity="0.08"/>
    <circle cx="945" cy="410" r="8" opacity="0.07"/>
    <circle cx="1005" cy="440" r="18" opacity="0.06"/>
  </g>

  <!-- icon -->
  <g filter="url(#iconShadow)">
    <g transform="translate(80, 80)" clip-path="url(#iconClip)">
      <image href="data:image/png;base64,${iconB64}" width="340" height="340"/>
    </g>
  </g>

  <!-- text block -->
  <g>
    <text x="470" y="178" font-family="SpaceMono, monospace" font-size="26" letter-spacing="6" fill="${RED}" font-weight="bold">TOURNAMENT CLOCK</text>

    <text x="466" y="260" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="76" font-weight="800" fill="${CREAM}">Poker Blinds</text>
    <text x="466" y="342" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="76" font-weight="800" fill="${RED}">Buzzer</text>

    <text x="468" y="400" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="27" font-weight="400" fill="#C9D9CF">Blind timer &amp; buzzer for home poker night</text>
  </g>
</svg>
`;

const outFile = path.join(__dirname, "feature-graphic.png");

sharp(Buffer.from(svg))
  .resize(W, H)
  .flatten({ background: BG })
  .png()
  .toFile(outFile)
  .then(() => console.log(`Wrote ${outFile}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
