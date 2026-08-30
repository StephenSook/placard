/**
 * THE PATHS A JUDGE ACTUALLY WALKS, driven through the real page.
 *
 * The unit suite proves the solver. These prove the product: that the verdict
 * reaches the screen, that the export is really gated, that the refusals a
 * reader is told about are the refusals the page gives, and that the surfaces
 * the writeup advertises answer.
 */
import { test, expect } from "@playwright/test";

test.describe("the signature refusal", () => {
  test("refuses sulfuric acid with calcium hypochlorite and quotes the clause", async ({ page }) => {
    await page.goto("/?load=UN1830,UN1748&check=1");
    await expect(page.locator(".verdict__title")).toHaveText(/^Refused$/i);
    await expect(page.getByText(/Notwithstanding the methods of separation employed/)).toBeVisible();
    await expect(page.locator(".verdict__cite")).toHaveText(/49 CFR 177\.848\(e\)\(3\)/i);
  });

  test("still refuses once the operator asserts a barrier, which is the point", async ({ page }) => {
    await page.goto("/?load=UN1830,UN1748&check=1");
    await page.getByRole("checkbox", { name: /Physical barriers/i }).check();
    await page.getByRole("button", { name: /Check this load/i }).click();
    await expect(page.getByText(/Notwithstanding the methods of separation employed/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Export the shipping paper/i })).toHaveCount(0);
  });
});

test.describe("a Forbidden material has no identification number", () => {
  test("loads by name and refuses under 173.21(a)", async ({ page }) => {
    await page.goto("/?load=Ammonium%20chlorate&check=1");
    await expect(page.getByText("no ID number").first()).toBeVisible();
    await expect(page.getByText(/Materials that are designated "Forbidden"/)).toBeVisible();
  });
});

test.describe("the export gate, from the operator's side", () => {
  test("a passing load exports a shipping paper in the 172.202(a) sequence", async ({ page }) => {
    await page.goto("/?load=UN1090,UN1830&check=1");
    await page.getByRole("button", { name: /Export the shipping paper/i }).click();
    const paper = page.locator(".paper");
    await expect(paper).toBeVisible();
    await expect(paper.getByText("Identification number")).toBeVisible();
    await expect(paper.getByText("Proper shipping name")).toBeVisible();
    await expect(paper.getByText(/Shipper certification, 49 CFR 172\.204/i)).toBeVisible();
    await expect(paper.getByText("UN1090")).toBeVisible();
  });

  test("the paper prints as a document, with the application hidden", async ({ page }) => {
    await page.goto("/?load=UN1090&check=1");
    await page.getByRole("button", { name: /Export the shipping paper/i }).click();
    await expect(page.locator(".paper")).toBeVisible();
    await page.emulateMedia({ media: "print" });
    const vis = await page.evaluate(() => {
      const v = (s: string) => {
        const e = document.querySelector(s);
        return e ? getComputedStyle(e).visibility : "absent";
      };
      return { paper: v(".paper"), matrix: v("[class*=matrix]"), attack: v("[class*=attack]") };
    });
    expect(vis.paper).toBe("visible");
    expect(vis.matrix).toBe("hidden");
    expect(vis.attack).toBe("hidden");
  });
});

test.describe("manual entry refuses rather than substituting", () => {
  test("an ambiguous name adds nothing and names the candidates", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/UN1090/).fill("sulfuric acid");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    // Nothing was added, and the page said why.
    await expect(page.getByText(/matches \d+ entries in the table/)).toBeVisible();
    await expect(page.getByText("UN2584")).toHaveCount(0);
  });

  test("an exact identification number is taken", async ({ page }) => {
    // Non-vacuity: without this the fix could be "refuse everything".
    await page.goto("/");
    await page.getByPlaceholder(/UN1090/).fill("UN1830");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Sulfuric acid with more than 51 percent acid").first()).toBeVisible();
  });
});

test.describe("a link that names materials the table does not contain", () => {
  test("blocks the export until a person acknowledges what was dropped", async ({ page }) => {
    await page.goto("/?load=UN1090,UN9999zzz&check=1");
    await expect(page.getByText(/did not\s+resolve/i).first()).toBeVisible();
    await expect(page.getByText(/cannot be exported until you acknowledge/i)).toBeVisible();
  });
});

test.describe("the surfaces the writeup advertises", () => {
  for (const path of ["/judge", "/states"]) {
    test(`${path} renders rather than 404ing`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });
  }

  // A missing asset must answer a real 404 rather than the application shell
  // under 200. That is a VERCEL ROUTING RULE, not application behaviour, so it
  // is meaningless against `vite preview`, which serves 200 for everything.
  // Measured: the local preview really does return 200 here. The rule is
  // asserted against the deployed origin by scripts/deploy.sh on every deploy,
  // and by this test when E2E_BASE_URL points at a real deployment.
  test("a missing asset answers a real 404, not the shell under 200", async ({ page }) => {
    test.skip(
      !process.env.E2E_BASE_URL?.startsWith("https://"),
      "routing rule: only meaningful against a deployed origin",
    );
    const res = await page.goto("/assets/definitely-not-here.js");
    expect(res?.status()).toBe(404);
  });
});
