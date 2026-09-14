// Counts the result cells in RELEASE_TESTING.md, per section and in total.
//
// The file used to carry these numbers as prose, and they were wrong every time
// somebody added a row without re-counting. Run `npm run testing:status` instead
// of writing a count down.
//
// A result row is a table row whose last two cells both start with a status
// icon — the platform columns. Anything after the icon ("⬜ **never verified**",
// "🚫 [see below]") is ignored.
import { readFileSync } from "node:fs";

const ICONS = ["✅", "➖", "🟡", "❌", "🔧", "⬜", "🚫"];
const lines = readFileSync(
  new URL("../RELEASE_TESTING.md", import.meta.url),
  "utf8",
).split("\n");

const statusOf = (cell) => ICONS.find((icon) => cell.trim().startsWith(icon));

const sections = [];
let current = { name: "(preamble)", rows: 0, cells: {} };
for (const line of lines) {
  const heading = line.match(/^#{2,3} (\d+[a-z]?)\. /);
  if (heading) {
    current = { name: `§${heading[1]}`, rows: 0, cells: {} };
    sections.push(current);
    continue;
  }
  if (!line.startsWith("|")) continue;
  const fields = line.split("|").slice(1, -1);
  if (fields.length < 3) continue;
  const results = fields.slice(-2).map(statusOf);
  if (results.some((icon) => icon === undefined)) continue;
  current.rows += 1;
  for (const icon of results) {
    current.cells[icon] = (current.cells[icon] ?? 0) + 1;
  }
}

const format = (cells) =>
  ICONS.filter((icon) => cells[icon])
    .map((icon) => `${icon} ${cells[icon]}`)
    .join("  ");

const total = { rows: 0, cells: {} };
for (const section of sections.filter((s) => s.rows > 0)) {
  console.log(
    `${section.name.padEnd(5)} ${String(section.rows).padStart(3)} rows  ${format(section.cells)}`,
  );
  total.rows += section.rows;
  for (const [icon, n] of Object.entries(section.cells)) {
    total.cells[icon] = (total.cells[icon] ?? 0) + n;
  }
}
console.log(
  `\nTotal ${total.rows} rows, ${total.rows * 2} cells  ${format(total.cells)}`,
);
