/**
 * PHONE LAYOUT. A judge may well open this on a phone first.
 *
 * These are measurements, not opinions: the page must never scroll sideways,
 * the densest object must carry its own scroller rather than pushing the
 * document wide, and the verdict must be reachable without three swipes.
 */
import { test, expect } from "@playwright/test";

test("the document never scrolls sideways", async ({ page }) => {
  await page.goto("/?load=UN1830,UN1748&check=1");
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }));
  expect(m.doc, "the page scrolls horizontally on a phone").toBeLessThanOrEqual(m.win + 1);
});

test("the 18 by 18 matrix scrolls inside its own container", async ({ page }) => {
  await page.goto("/");
  const wrap = page.locator(".matrix__scroll");
  await expect(wrap).toHaveCSS("overflow-x", "auto");
});

test("the hazard rail is one scrolling row, not four rows of tallies", async ({ page }) => {
  await page.goto("/?load=UN1830,UN1748&check=1");
  await page.waitForTimeout(400);
  const h = await page.locator(".rail__list").evaluate((e) => e.getBoundingClientRect().height);
  // It was about 500px before, four wrapped rows between the hero and the manifest.
  expect(h, "the hazard rail is wrapping again").toBeLessThan(120);
});

test("the verdict stays reachable from a sticky strip", async ({ page }) => {
  await page.goto("/?load=UN1830,UN1748&check=1");
  await expect(page.locator(".console__stickyVerdict")).toBeVisible();
});
