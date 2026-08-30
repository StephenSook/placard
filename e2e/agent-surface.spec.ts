/**
 * THE AGENT SURFACE, END TO END, THROUGH THE REAL WebMCP RUNTIME.
 *
 * Everything here was previously verified either by hand in a browser or by a
 * SOURCE-level assertion in the unit suite. Neither catches a wiring failure
 * between React and the runtime: a hook can be perfectly correct and never
 * register, and a source guard reading `enabled: hasManifest && refused` proves
 * only that the string is in the file.
 *
 * This is the layer that proves the tools actually exist, actually execute, and
 * actually refuse.
 */
import { test, expect, type Page } from "@playwright/test";

/** Tool names the page currently offers the agent, sorted. */
async function toolNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const mc = (document as unknown as { modelContext?: { getTools(): Promise<{ name: string }[]> } }).modelContext;
    if (!mc) throw new Error("no WebMCP runtime: launch chromium with --enable-features=WebMCP");
    return (await mc.getTools()).map((t) => t.name).sort();
  });
}

/** Execute a tool the way an agent does, and return the parsed result. */
async function callTool(page: Page, name: string, args: unknown) {
  return page.evaluate(
    async ({ name, args }) => {
      const mc = (document as unknown as {
        modelContext: {
          getTools(): Promise<{ name: string }[]>;
          executeTool(t: unknown, a: string): Promise<unknown>;
        };
      }).modelContext;
      const tool = (await mc.getTools()).find((t) => t.name === name);
      if (!tool) throw new Error(`tool ${name} is not registered`);
      const raw = await mc.executeTool(tool, JSON.stringify(args));
      // The runtime wraps results in MCP content blocks, sometimes twice.
      let text: unknown = raw;
      for (let i = 0; i < 3; i++) {
        if (typeof text === "string") { try { text = JSON.parse(text); } catch { break; } }
        const c = (text as { content?: Array<{ text?: string }> })?.content;
        if (Array.isArray(c) && typeof c[0]?.text === "string") { text = c[0].text; continue; }
        break;
      }
      return text;
    },
    { name, args },
  );
}

/** Wait until the page has settled into a verdict. */
async function settle(page: Page) {
  await page.waitForFunction(() => !!(document as unknown as { modelContext?: unknown }).modelContext);
  await page.waitForTimeout(600);
}

test.describe("the runtime is actually reachable", () => {
  test("registers the two always-on tools on a bare page", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    expect(await toolNames(page)).toEqual(["classify_line_item", "lookup_material"]);
  });
});

test.describe("the toolset is anticorrelated", () => {
  test("a REFUSED load offers propose_load and withholds commit_manifest", async ({ page }) => {
    await page.goto("/?load=UN1830,UN1748&check=1");
    await settle(page);
    const names = await toolNames(page);
    expect(names).toContain("propose_load");
    expect(names).not.toContain("commit_manifest");
  });

  test("a PASSING load offers commit_manifest and withholds propose_load", async ({ page }) => {
    await page.goto("/?load=UN1090&check=1");
    await settle(page);
    const names = await toolNames(page);
    expect(names).toContain("commit_manifest");
    expect(names).not.toContain("propose_load");
  });

  test("an agent that checks an UNCHECKED manifest is never left without a remedy", async ({ page }) => {
    // THE DEAD END. The page's verdict is set by the operator pressing check.
    // An agent calling check_segregation gets its answer but does not move page
    // state, deliberately, so that it cannot talk commit_manifest into
    // existence. When propose_load was gated on `verdict === REFUSED` that
    // withheld the remedy too: the agent was refused and found BOTH gated tools
    // absent. Reproduced before the fix; this is the regression test.
    await page.goto("/?load=UN1830,UN1748"); // note: no &check=1
    await settle(page);
    const before = await toolNames(page);
    expect(before, "the remedy tool must exist on an unchecked manifest").toContain("propose_load");
    expect(before).not.toContain("commit_manifest");

    const r = (await callTool(page, "check_segregation", {
      vehicles: [{ items: ["UN1830", "UN1748"] }],
    })) as { status: string };
    expect(r.status).toBe("REFUSED");

    const after = await toolNames(page);
    expect(after, "the agent was left with no remedy after being refused").toContain("propose_load");
    // And the safety property is untouched: the agent still cannot conjure the export.
    expect(after).not.toContain("commit_manifest");
  });

  test("the two are never present together, on either state", async ({ page }) => {
    for (const url of [
      "/?load=UN1830,UN1748&check=1",
      "/?load=UN1090&check=1",
      "/?load=UN1830,UN1748", // unchecked: exactly one must still be present
    ]) {
      await page.goto(url);
      await settle(page);
      const names = await toolNames(page);
      const both = names.includes("propose_load") && names.includes("commit_manifest");
      const neither = !names.includes("propose_load") && !names.includes("commit_manifest");
      expect(both, `${url} offered both gated tools`).toBe(false);
      expect(neither, `${url} offered neither gated tool`).toBe(false);
    }
  });
});

test.describe("the regulation refuses through the agent surface", () => {
  test("returns REFUSED with 177.848(e)(3) quoted verbatim", async ({ page }) => {
    await page.goto("/?load=UN1830,UN1748&check=1");
    await settle(page);
    const r = (await callTool(page, "check_segregation", {
      vehicles: [{ items: ["UN1830", "UN1748"] }],
    })) as { status: string; violations: Array<{ regulation: Array<{ section: string; text: string }> }> };
    expect(r.status).toBe("REFUSED");
    expect(r.violations[0]!.regulation[0]!.section).toContain("177.848(e)(3)");
    expect(r.violations[0]!.regulation[0]!.text).toContain(
      "Notwithstanding the methods of separation employed",
    );
  });

  test("finds a Forbidden material BY NAME, which has no identification number", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    const r = (await callTool(page, "lookup_material", { query: "Ammonium chlorate" })) as {
      matches: Array<{ name: string; id: string | null; forbidden: boolean }>;
    };
    expect(r.matches[0]!.forbidden).toBe(true);
    expect(r.matches[0]!.id).toBeNull();
  });

  test("REFUSES an attestation sent as a tool argument, by name", async ({ page }) => {
    // The forgery: an agent asserting physical barriers in a truck it cannot see.
    await page.goto("/?load=UN1090&check=1");
    await settle(page);
    const r = (await callTool(page, "check_segregation", {
      vehicles: [{ items: ["UN1090", "UN1479"], barriersPresent: true }],
    })) as { status: string; reason?: string };
    expect(r.status).toBe("REFUSED");
    expect(r.reason).toContain("only the operator at the console can");
  });
});

test.describe("the export gate holds through the runtime", () => {
  test("commit_manifest refuses a token issued for a different load", async ({ page }) => {
    await page.goto("/?load=UN1090&check=1");
    await settle(page);
    const ok = (await callTool(page, "check_segregation", {
      vehicles: [{ items: ["UN1090"] }],
    })) as { status: string; approvalToken: string };
    expect(ok.status).toBe("PASS");

    const bad = (await callTool(page, "commit_manifest", {
      approvalToken: ok.approvalToken,
      vehicles: [{ items: ["UN1830", "UN1748"] }],
    })) as { status: string; reason?: string };
    expect(bad.status).toBe("REFUSED");
    expect(bad).not.toHaveProperty("shippingPaper");
  });

  test("commit_manifest exports for the exact load its token was issued for", async ({ page }) => {
    // Non-vacuity: without this the gate could be "always refuse" and pass above.
    await page.goto("/?load=UN1090&check=1");
    await settle(page);
    const ok = (await callTool(page, "check_segregation", {
      vehicles: [{ items: ["UN1090"] }],
    })) as { status: string; approvalToken: string };
    const good = (await callTool(page, "commit_manifest", {
      approvalToken: ok.approvalToken,
      vehicles: [{ items: ["UN1090"] }],
    })) as { status: string; shippingPaper?: unknown };
    expect(good.status).toBe("COMMITTED");
    expect(good.shippingPaper).toBeTruthy();
  });
});

test.describe("annotations match the spec, read from the live registry", () => {
  test("exposes exactly the two annotations WebMCP defines", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    const anns = await page.evaluate(async () => {
      const mc = (document as unknown as {
        modelContext: { getTools(): Promise<Array<{ name: string; annotations?: Record<string, unknown> }>> };
      }).modelContext;
      return (await mc.getTools()).map((t) => Object.keys(t.annotations ?? {}).sort());
    });
    const allowed = ["readOnlyHint", "untrustedContentHint"];
    for (const keys of anns) {
      for (const k of keys) expect(allowed, `unexpected annotation ${k}`).toContain(k);
    }
  });
});
