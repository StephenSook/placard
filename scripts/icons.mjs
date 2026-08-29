/**
 * Renders the app icons from one source of truth.
 *
 * The mark is a hazard placard drawn to the regulation's own proportions: a
 * square on point, which is what 49 CFR 172 subpart F specifies. It is split
 * black over white like a Class 8 corrosive placard, because that is the class
 * in the demonstration refusal, and because a split placard is instantly
 * legible at 32px where a numbered one is not.
 *
 * Regenerate with `npm run icons`. Sizes are the ones that actually get used:
 * 192 and 512 for the web manifest, 180 for the iOS home screen.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const SIZES = [
  { file: "icon-192.png", px: 192 },
  { file: "icon-512.png", px: 512 },
  { file: "apple-touch-icon.png", px: 180 },
];

const html = (px) => {
  // Drawn as SVG rather than a rotated div: rotating a div rotates its
  // gradient too, which produced a DIAGONAL split. A Class 8 placard splits
  // HORIZONTALLY, white over black, and getting that wrong on an icon for a
  // project about reading the regulation exactly would be its own small joke.
  const c = px / 2;
  const r = px * 0.40;          // half-diagonal of the placard
  const pts = `${c},${c - r} ${c + r},${c} ${c},${c + r} ${c - r},${c}`;
  const stroke = Math.max(2, px * 0.018);
  return `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;width:${px}px;height:${px}px;background:#1b1916}</style>
<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="d"><polygon points="${pts}"/></clipPath>
  </defs>
  <rect width="${px}" height="${px}" fill="#1b1916"/>
  <g clip-path="url(#d)">
    <rect x="0" y="0" width="${px}" height="${c}" fill="#f4e9e1"/>
    <rect x="0" y="${c}" width="${px}" height="${c}" fill="#101010"/>
  </g>
  <polygon points="${pts}" fill="none" stroke="#f4e9e1" stroke-width="${stroke}" stroke-linejoin="round"/>
</svg>`;
};

mkdirSync("public", { recursive: true });
const b = await chromium.launch();
for (const { file, px } of SIZES) {
  const p = await b.newPage({ viewport: { width: px, height: px }, deviceScaleFactor: 1 });
  await p.setContent(html(px));
  await p.screenshot({ path: `public/${file}`, omitBackground: false });
  await p.close();
  process.stdout.write(`  public/${file}  ${px}x${px}\n`);
}
await b.close();
