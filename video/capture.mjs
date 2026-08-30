/**
 * Capture the REAL product for the demo film.
 *
 * THE EXECUTION TAKE IS ONE CONTINUOUS, UNCUT RECORDING. Beats 5 to 8 of the
 * narration are a single Playwright video with no cut, no dissolve and no
 * speed-up inside it: a real manifest goes in, the page visibly adjudicates it,
 * and a real shipping paper comes out. If the solver takes time, the viewer
 * watches it take time.
 *
 * The take PACES ITSELF TO THE NARRATION rather than being cut to fit
 * afterwards. `HOLDS` carries each beat's window, measured from the actual
 * ElevenLabs clip durations, and the script waits until a stage's window opens
 * before performing it. The result is a take whose rhythm matches the film by
 * construction, which is what lets "unedited live execution" and "scored,
 * captioned production" coexist.
 *
 * WebMCP is enabled with --enable-features=WebMCP so the tool registry strip is
 * live and the anticorrelated gate is visible on camera. That flag is a
 * different mechanism from the origin trial and does not prove the token works;
 * that is verified separately against the deployed origin.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const URL_BASE = process.env.CAPTURE_URL ?? "https://segregation-console.vercel.app";
const OUT = "video/captures";
mkdirSync(OUT, { recursive: true });
mkdirSync(`${OUT}/stills`, { recursive: true });

/** Beat windows relative to the START OF THE TAKE, from the narration clips. */
const TAKE_START = 67.75; // 05_propose begins here in the film
const HOLDS = {
  propose: 0.0,   // 05: establish the agent's view of the page
  refuse: 11.87,  // 06: check, and be refused with the clause
  barrier: 27.36, // 07: tick the barrier, still refused
  split: 40.17,   // 08: split, pass, export
};

const marks = [];
const t0 = () => Date.now();
let started;
const elapsed = () => (Date.now() - started) / 1000;

/** Hold until this stage's narration window opens, then record the mark. */
async function holdUntil(page, name) {
  const target = HOLDS[name];
  while (elapsed() < target) await page.waitForTimeout(120);
  const at = elapsed();
  marks.push({ stage: name, at: Number(at.toFixed(3)), film: Number((TAKE_START + at).toFixed(3)) });
  console.log(`  [${at.toFixed(2)}s] ${name}`);
}

const browser = await chromium.launch({ args: ["--enable-features=WebMCP"] });

// ---------------------------------------------------------------- THE TAKE
{
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    recordVideo: { dir: `${OUT}/take`, size: { width: 1600, height: 1000 } },
  });
  const page = await ctx.newPage();
  await page.goto(`${URL_BASE}/?load=UN1830,UN1748,UN1090`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!document.modelContext, { timeout: 15000 });
  await page.waitForTimeout(800);

  started = t0();
  console.log("TAKE (continuous, uncut):");

  // 05 propose: the agent's own view of the page, read from the live registry.
  await holdUntil(page, "propose");
  await page.getByRole("button", { name: /Show what the agent sees/i }).click();
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

  // 06 refuse: check the load. This is the adjudication, uncut.
  await holdUntil(page, "refuse");
  await page.getByRole("button", { name: /Check this load/i }).click();
  await page.waitForFunction(
    () => /refused/i.test(document.querySelector(".verdict__title")?.textContent ?? ""),
    { timeout: 15000 },
  );
  await page.waitForTimeout(1500);

  // 07 barrier: the operator asserts a real physical barrier. Still refused.
  await holdUntil(page, "barrier");
  await page.getByRole("checkbox", { name: /Physical barriers/i }).check();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Check this load/i }).click();
  await page.waitForFunction(
    () => /refused/i.test(document.querySelector(".verdict__title")?.textContent ?? ""),
    { timeout: 15000 },
  );
  await page.waitForTimeout(1200);

  // 08 split, pass, export: the toolset flips on camera.
  await holdUntil(page, "split");
  await page.getByRole("button", { name: /Propose a legal split/i }).click();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: /Check this load/i }).click();
  await page.waitForFunction(
    () => /cleared|pass/i.test(document.querySelector(".verdict__title")?.textContent ?? ""),
    { timeout: 15000 },
  );
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: /Export the shipping paper/i }).click();
  await page.waitForSelector(".paper", { timeout: 10000 });
  await page.evaluate(() => document.querySelector(".paper")?.scrollIntoView({ block: "center", behavior: "smooth" }));
  await page.waitForTimeout(1400);

  // Hold the finished document until beat 8's narration window closes, so the
  // take covers its whole beat and the film never has to freeze or cut early.
  while (elapsed() < 56.4) await page.waitForTimeout(120);

  const took = elapsed();
  await ctx.close();
  console.log(`  take length: ${took.toFixed(2)}s`);
  writeFileSync(`${OUT}/marks.json`, JSON.stringify({ takeStart: TAKE_START, length: took, marks }, null, 1));
}

// ------------------------------------------------- STILLS for the built beats
// High-res stills (deviceScaleFactor 2) stay crisp under a Ken Burns push at 4K,
// which Playwright's CSS-pixel video does not.
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const shot = async (name, url, prep) => {
    await page.goto(`${URL_BASE}${url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1400);
    if (prep) await prep(page);
    await page.screenshot({ path: `${OUT}/stills/${name}.png` });
    console.log(`  still ${name}`);
  };
  console.log("STILLS:");
  await shot("refusal", "/?load=UN1830,UN1748&check=1");
  await shot("forbidden", "/?load=Ammonium%20chlorate,UN1090&check=1");
  await shot("matrix", "/", async (p) => {
    await p.evaluate(() => document.querySelector("[class*=matrix]")?.scrollIntoView({ block: "center" }));
    await p.waitForTimeout(900);
  });
  await shot("judge", "/judge");
  await shot("registry_refused", "/?load=UN1830,UN1748&check=1", async (p) => {
    await p.evaluate(() => document.querySelector("[class*=registry]")?.scrollIntoView({ block: "center" }));
    await p.waitForTimeout(700);
  });
  await shot("registry_pass", "/?load=UN1090&check=1", async (p) => {
    await p.evaluate(() => document.querySelector("[class*=registry]")?.scrollIntoView({ block: "center" }));
    await p.waitForTimeout(700);
  });
  await ctx.close();
}

await browser.close();
console.log("done");
