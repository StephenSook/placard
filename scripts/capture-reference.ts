/**
 * Design-reference capture harness.
 *
 * Studies a reference site's composition, motion stack and measured tokens so
 * the design decisions here are grounded in something real rather than in
 * recollection. Captures are written to reference/captures/, which is
 * gitignored: they are third-party material, studied, never redistributed.
 *
 * Run: npm run capture:reference
 *      npm run capture:reference -- --url <url> --slug <name>
 *
 * What it produces:
 *   <slug>-<viewport>-<scroll>.jpg   the composition at each scroll depth
 *   <slug>-tokens.json               measured type scale, palette, weights,
 *                                    motion libraries, section rhythm
 *
 * It measures rather than eyeballs, because "warm off-white" is a guess and
 * rgb(244, 233, 225) is a fact.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const arg = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};

const URL = arg("--url", "https://units.gr/en/homepage/");
const SLUG = arg("--slug", "units-gr");
const OUT = join(process.cwd(), "reference", "captures");

const VIEWPORTS = [
  { name: "desktop", width: 1512, height: 950 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

/** Fractions of the scrollable height to capture. */
const DEPTHS = [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let tokens: unknown = null;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      // Respect the site: identify honestly rather than spoofing.
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    });
    const page = await ctx.newPage();
    process.stdout.write(`\n${vp.name} ${vp.width}x${vp.height}\n`);

    // Capture the entry animation before the site settles. The reference's
    // preloader is part of what makes it feel considered, and it is invisible
    // if you only screenshot the settled page.
    await page.goto(URL, { waitUntil: "commit" });
    for (const ms of [250, 700, 1400]) {
      await page.waitForTimeout(ms === 250 ? 250 : 450);
      await page.screenshot({ path: join(OUT, `${SLUG}-${vp.name}-load-${ms}ms.jpg`), type: "jpeg", quality: 82 });
      process.stdout.write(`  load ${ms}ms\n`);
    }

    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(900);

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (const d of DEPTHS) {
      const y = Math.round((height - vp.height) * d);
      await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" as ScrollBehavior }), y);
      // Let scroll-triggered reveals actually play before the shutter.
      await page.waitForTimeout(850);
      const label = `${Math.round(d * 100)}pct`;
      await page.screenshot({ path: join(OUT, `${SLUG}-${vp.name}-${label}.jpg`), type: "jpeg", quality: 82 });
      process.stdout.write(`  scroll ${label} (y=${y})\n`);
    }

    if (vp.name === "desktop") tokens = await measure(page);
    await ctx.close();
  }

  writeFileSync(join(OUT, `${SLUG}-tokens.json`), JSON.stringify(tokens, null, 2) + "\n");
  process.stdout.write(`\nwrote captures and ${SLUG}-tokens.json to reference/captures/\n`);
  await browser.close();
}

/** Measured design tokens. Facts, not impressions. */
async function measure(page: import("playwright").Page) {
  return page.evaluate(() => {
    const seen = { fonts: new Set<string>(), sizes: new Set<string>(), colours: new Map<string, number>(), weights: new Set<string>(), radii: new Set<string>() };
    const nodes = [...document.querySelectorAll("h1,h2,h3,h4,p,a,span,button,li,div")].slice(0, 2500);
    for (const el of nodes) {
      const text = (el.textContent ?? "").trim();
      const c = getComputedStyle(el);
      if (text.length > 1) {
        seen.fonts.add(c.fontFamily.split(",")[0]!.replace(/["']/g, ""));
        seen.sizes.add(c.fontSize);
        seen.weights.add(c.fontWeight);
        seen.colours.set(c.color, (seen.colours.get(c.color) ?? 0) + 1);
      }
      const bg = c.backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)") seen.colours.set(bg, (seen.colours.get(bg) ?? 0) + 1);
      if (c.borderRadius && c.borderRadius !== "0px") seen.radii.add(c.borderRadius);
    }
    const body = getComputedStyle(document.body);
    const w = window as unknown as Record<string, { version?: string } | undefined>;
    return {
      url: location.href,
      capturedAt: new Date().toISOString(),
      ground: body.backgroundColor,
      bodyFont: body.fontFamily,
      typeScale: [...seen.sizes].sort((a, b) => parseFloat(b) - parseFloat(a)).slice(0, 16),
      fonts: [...seen.fonts].slice(0, 10),
      weights: [...seen.weights].sort(),
      radii: [...seen.radii].slice(0, 12),
      palette: [...seen.colours.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([c, n]) => ({ colour: c, uses: n })),
      motion: ["gsap", "ScrollTrigger", "SplitText", "Flip", "Lenis", "barba", "Swiper", "lottie", "THREE"].filter((k) => w[k] !== undefined),
      gsapVersion: w["gsap"]?.version ?? null,
      sections: document.querySelectorAll("section").length,
      documentHeight: document.documentElement.scrollHeight,
      images: document.querySelectorAll("img").length,
      canvases: document.querySelectorAll("canvas").length,
    };
  });
}

main().catch((e) => {
  process.stderr.write(`capture failed: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
