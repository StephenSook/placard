/**
 * THE CLAIM-DRIFT GUARD.
 *
 * Every judge-facing surface makes claims. This asserts each one against the
 * SHIPPED CODE rather than against the design doc, because a plan-tier decision
 * outlives the code meant to implement it and then gets repeated into a README
 * as though it were true.
 *
 * The file set is resolved with `git ls-files --cached --others
 * --exclude-standard`, which includes files that are about to ship but are not
 * yet tracked. A guard scoped to tracked files alone has a blind spot exactly
 * the size of "what I am adding right now", so it passes locally and fails in
 * CI on the first commit of the new file.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseProvenance } from "../scripts/provenance.ts";

const ROOT = join(import.meta.dirname, "..");

function shippedFiles(): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: ROOT, encoding: "utf8" },
  );
  const files = out.split("\n").filter(Boolean);
  // Non-vacuity: an empty or tiny list means the command changed shape and
  // every assertion below would pass having examined nothing.
  if (files.length < 30) throw new Error(`file set looks wrong: ${files.length} files`);
  return files;
}

const FILES = shippedFiles();
const sourceFiles = FILES.filter((f) => /\.(ts|tsx|mts)$/.test(f));
const read = (f: string) => readFileSync(join(ROOT, f), "utf8");
const pkg = JSON.parse(read("package.json")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("the guard itself", () => {
  it("sees untracked files, not only tracked ones", () => {
    // The whole point of --others. If this ever narrows to --cached, a brand
    // new judge-facing file becomes invisible to every assertion below.
    const cmd = read("tests/claims.test.ts");
    expect(cmd).toContain("--others");
    expect(cmd).toContain("--exclude-standard");
  });

  it("examines a non-trivial number of files", () => {
    expect(FILES.length).toBeGreaterThan(50);
    expect(sourceFiles.length).toBeGreaterThan(15);
  });
});

describe("wired or cut", () => {
  it("every runtime dependency has at least one import site in shipped code", () => {
    // This is the assertion that would have caught `gsap` sitting in the
    // manifest naming a motion library the build never used.
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps.length).toBeGreaterThan(0);
    const haystack =
      sourceFiles.map(read).join("\n") +
      FILES.filter((f) => f.endsWith(".css")).map(read).join("\n");

    // Match a real IMPORT SITE, not the bare package name. A substring search
    // is satisfied by a code comment that merely mentions the library, which is
    // how a reintroduced unused dependency survived this assertion once.
    const imported = (d: string): boolean => {
      const q = d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(
        `(?:from|import)\\s+["']${q}(?:/[^"']*)?["']` +
        `|require\\(\\s*["']${q}(?:/[^"']*)?["']` +
        `|@import\\s+["']${q}(?:/[^"']*)?["']`,
      ).test(haystack);
    };
    const unused = deps.filter((d) => !imported(d));
    expect(unused, `declared but never imported: ${unused.join(", ")}`).toEqual([]);
  });
});

describe("citations", () => {
  it("every cite() id exists in the committed corpus", () => {
    const ids = new Set(
      Object.keys((JSON.parse(read("data/clauses.json")) as { clauses: Record<string, unknown> }).clauses),
    );
    expect(ids.size).toBe(24);
    const bad: string[] = [];
    let seen = 0;
    for (const f of sourceFiles) {
      for (const m of read(f).matchAll(/\bcite\(\s*"([^"]+)"/g)) {
        seen++;
        const id = m[1]!;
        // The solver suite deliberately asserts that an unknown id throws.
        if (f.endsWith("solver.test.ts") && id === "no-such-clause") continue;
        if (!ids.has(id)) bad.push(`${f}: ${id}`);
      }
    }
    expect(seen, "found no cite() calls at all, so this checked nothing").toBeGreaterThan(5);
    expect(bad, `cite() ids not in data/clauses.json: ${bad.join(", ")}`).toEqual([]);
  });
});

describe("WebMCP conformance claims", () => {
  it("uses ONLY the two annotations the WebMCP report defines", () => {
    // destructiveHint, idempotentHint and openWorldHint belong to the wider MCP
    // set and appear nowhere in the WebMCP Draft Community Group Report. The
    // README says so; this makes the README checkable.
    const wider = ["destructiveHint", "idempotentHint", "openWorldHint"];
    const offenders: string[] = [];
    for (const f of sourceFiles) {
      const src = read(f);
      for (const w of wider) if (new RegExp(`${w}\\s*:`).test(src)) offenders.push(`${f}: ${w}`);
    }
    expect(offenders).toEqual([]);
  });

  it("registers tools through document.modelContext, as the rules require", () => {
    const hits = sourceFiles.filter((f) => read(f).includes("document.modelContext.registerTool"));
    expect(hits.length, "the literal call must appear in shipped source").toBeGreaterThan(0);
  });
});

describe("provenance cannot drift from the record", () => {
  it("data/provenance.json still matches data/PROVENANCE.md", () => {
    const fromMd = parseProvenance(read("data/PROVENANCE.md"));
    const fromJson = JSON.parse(read("data/provenance.json"));
    expect(fromJson).toEqual(fromMd);
  });

  it("every published date is a real ISO date, never an empty string", () => {
    const p = JSON.parse(read("data/provenance.json")) as Record<string, string>;
    for (const k of ["ecfr_snapshot", "title_49_latest_amended_on", "title_49_up_to_date_as_of"]) {
      expect(p[k], `${k} is empty`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("judge-facing surfaces exist and are reachable", () => {
  it("ships the endpoints the README advertises", () => {
    const readme = read("README.md");
    for (const path of ["/api/measure", "/api/forbidden-audit", "/judge"]) {
      if (!readme.includes(path)) continue;
      const backing =
        FILES.some((f) => f.startsWith("netlify/functions/") && read(f).includes(`path: "${path}"`)) ||
        sourceFiles.some((f) => read(f).includes(`"${path}"`));
      expect(backing, `README advertises ${path} but nothing implements it`).toBe(true);
    }
  });

  it("the eval file the README names actually exists and is non-empty", () => {
    const readme = read("README.md");
    const m = readme.match(/evals\/[\w.-]+\.json/);
    if (!m) return;
    const p = join(ROOT, m[0]);
    expect(existsSync(p), `${m[0]} named in README but absent`).toBe(true);
    const evals = JSON.parse(readFileSync(p, "utf8"));
    expect(Array.isArray(evals) ? evals.length : Object.keys(evals).length).toBeGreaterThan(0);
  });
});

describe("no third-party JavaScript, which the security argument depends on", () => {
  it("index.html loads no cross-origin script", () => {
    const html = read("index.html");
    const external = [...html.matchAll(/<script[^>]*src="(https?:)?\/\//g)];
    expect(external.map((m) => m[0])).toEqual([]);
  });
});
