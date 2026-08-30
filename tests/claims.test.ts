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
import { readFileSync, existsSync, readdirSync } from "node:fs";
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

/**
 * Parse CSS into (selector, body) pairs, with COMMENTS STRIPPED FIRST.
 *
 * Written once and shared because the naive version bit three separate guards
 * in this file: a `/** ... *\/` comment is matched as a selector by
 * `([^{}]+)\{([^{}]*)\}`, and one of them then built a RegExp from it and threw
 * "Nothing to repeat". A checker that crashes is not a checker that passes, but
 * it is not one that works either.
 */
function cssRules(src: string): Array<{ selector: string; body: string }> {
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1]!.trim(),
    body: m[2]!,
  }));
}

/** The BEM block a selector belongs to: `.attack__eyebrow` -> `.attack`. */
const bemBlock = (selector: string) =>
  selector.split(/[\s:>,]/)[0]!.split("__")[0]!.split("--")[0]!;

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

describe("every clause is either ENFORCED or declared reference-only", () => {
  /**
   * THE GUARD THAT SHOULD HAVE EXISTED FROM THE START.
   *
   * The citation gate proves each quoted clause is verbatim. It proves nothing
   * about whether the rule is implemented, and ten of twenty-four were not.
   * Two were live prohibitions: sodium cyanide with sulfuric acid returned PASS
   * and exported, and so did 1.4S fireworks with 1.1G fireworks.
   *
   * A verbatim quote of a rule you do not apply is worse than no quote at all,
   * because it reads as evidence of diligence that is not there.
   */
  /**
   * The source the coverage gate is allowed to count, with UNREACHABLE
   * FUNCTIONS REMOVED.
   *
   * `resolutionCitations` in hazards.ts was the only cite() site for three
   * clause ids and nothing in the repository called it. Those three passed this
   * gate on the strength of a function no user or agent could reach: quoted,
   * verified verbatim, counted in the receipt the README prints, and delivered
   * to nobody. The gate could not see it because it greps source text, and dead
   * code is still text.
   *
   * So every exported function in the scanned files is checked for a caller,
   * and one with none is stripped before the citation scan runs.
   */
  const reachableSrc = (() => {
    const all = FILES.filter((f) => /^src\/.*\.tsx?$/.test(f));
    const whole = all.map(read).join("\n");
    let out = "";
    for (const f of FILES.filter((f) => /^src\/(solver|tools|evidence)\/.*\.ts$/.test(f))) {
      const text = read(f);
      // Split on exported function declarations and drop the uncalled ones.
      const parts = text.split(/(?=^export function )/m);
      for (const part of parts) {
        const m = /^export function (\w+)/.exec(part);
        if (!m) { out += part + "\n"; continue; }
        const name = m[1]!;
        // A caller is any use of the bare name that is not its own declaration.
        const uses = (whole.match(new RegExp(`\\b${name}\\b`, "g")) ?? []).length;
        if (uses > 1) out += part + "\n";
      }
    }
    return out;
  })();

  const solverSrc = FILES
    .filter((f) => /^src\/(solver|tools|evidence)\/.*\.ts$/.test(f))
    .map(read)
    .join("\n");
  const ids = Object.keys(
    (JSON.parse(read("data/clauses.json")) as { clauses: Record<string, unknown> }).clauses,
  );

  it("accounts for every clause in the corpus, with no gaps and no stale entries", () => {
    const refOnly = read("src/solver/coverage.ts");
    const declared = [...refOnly.matchAll(/^\s*"([a-z0-9-]+)":/gim)].map((m) => m[1]!);
    const advisory = [...refOnly.matchAll(/^\s*"([a-z0-9-]+)",\s*$/gim)].map((m) => m[1]!);

    const unaccounted: string[] = [];
    for (const id of ids) {
      const cited = new RegExp(`cite\\("${id}"\\)`).test(reachableSrc);
      if (!cited && !declared.includes(id) && !advisory.includes(id)) unaccounted.push(id);
    }
    expect(ids.length).toBe(37);
    expect(
      unaccounted,
      `clauses shipped and verified verbatim but neither enforced nor declared reference-only:\n${unaccounted.join("\n")}`,
    ).toEqual([]);

    // And no stale declarations: a clause declared reference-only must exist.
    for (const d of [...declared, ...advisory]) {
      expect(ids, `coverage.ts declares ${d}, which is not in the corpus`).toContain(d);
    }
  });

  it("the specific prohibitions that were silently missing are now enforced", () => {
    for (const id of ["c-cyanide-acid", "g5-fireworks", "g6-group-G"]) {
      expect(
        new RegExp(`cite\\("${id}"\\)`).test(solverSrc),
        `${id} is a prohibition and must be enforced by code, not merely quoted`,
      ).toBe(true);
    }
  });
});

describe("citations", () => {
  it("every cite() id exists in the committed corpus", () => {
    const ids = new Set(
      Object.keys((JSON.parse(read("data/clauses.json")) as { clauses: Record<string, unknown> }).clauses),
    );
    expect(ids.size).toBe(37);
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
  it("states a test-file count the repository actually has", () => {
    // The line this guards used to read "89 tests" while the suite ran 213.
    // Nothing checked it, so it drifted for the life of the project, and a
    // judge running npm test would have seen a number the README contradicts.
    //
    // The raw test count is deliberately NOT claimed any more. Some files
    // generate cases in loops, so no static count can be right, and a figure
    // no guard can check is a figure that drifts. The FILE count can be
    // checked exactly, and the exhaustive cell counts are checked by the
    // 324-cell and 169-cell suites themselves.
    const readme = read("README.md");
    const m = /npm test\s+# (\d+) test files/.exec(readme);
    expect(m, "README no longer states a test-file count in the npm test block").toBeTruthy();
    const actual = readdirSync(join(process.cwd(), "tests"))
      .filter((f) => f.endsWith(".test.ts")).length;
    expect(actual).toBeGreaterThan(0);
    expect(
      Number(m![1]),
      `README says ${m![1]} test files, the repository has ${actual}`,
    ).toBe(actual);
  });

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

describe("the built output really is free of inline script and style", () => {
  it("has no inline <script>, no <style> block and no style= attribute", () => {
    // SECURITY.md tells a reader that the only CSP refusals on the live site
    // come from the host's injected HUD, never from us. That is only true while
    // this holds, so it is asserted rather than promised.
    const built = join(ROOT, "dist", "index.html");
    if (!existsSync(built)) return; // dist is a build artifact, absent on a fresh clone
    const html = readFileSync(built, "utf8");
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<style[\s>]/);
    expect(html).not.toMatch(/\sstyle="/);
  });
});

describe("the well-known files the SPA catch-all used to swallow", () => {
  // /robots.txt, /llms.txt and /sitemap.xml all returned the application shell
  // until real files existed, because the catch-all rewrite answered them.
  // Lighthouse read the HTML as markdown and failed both robots-txt and
  // llms-txt. Static files win over redirects, so shipping them is the fix.
  it("ships an llms.txt with the H1 and links the audit requires", () => {
    const f = join(ROOT, "public", "llms.txt");
    expect(existsSync(f)).toBe(true);
    const t = readFileSync(f, "utf8");
    expect(t).toMatch(/^# .+/m);                    // at least one H1
    expect(t.match(/\]\(https?:\/\//g)?.length ?? 0).toBeGreaterThan(2);
    expect(t).not.toMatch(/<!doctype html>/i);      // never the app shell
  });

  it("ships a robots.txt and a sitemap.xml", () => {
    const r = readFileSync(join(ROOT, "public", "robots.txt"), "utf8");
    expect(r).toMatch(/^User-agent:/m);
    expect(r).toMatch(/^Allow:|^Disallow:/m);
    expect(r).not.toMatch(/<!doctype html>/i);
    const s = readFileSync(join(ROOT, "public", "sitemap.xml"), "utf8");
    expect(s).toMatch(/<urlset/);
  });
});

describe("colour tokens meet WCAG 1.4.3", () => {
  // A Lighthouse run found --ink-faint at 2.84:1 on paper. Captions, rail
  // labels and unit text all used it. Asserted here so the token cannot drift
  // back light without a test going red.
  const relLum = (hex: string) => {
    const n = hex.replace("#", "");
    const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(ch[0]!) + 0.7152 * f(ch[1]!) + 0.0722 * f(ch[2]!);
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p) as [number, number];
    return (x + 0.05) / (y + 0.05);
  };
  const tokens = readFileSync(join(ROOT, "src", "ui", "tokens.css"), "utf8");
  const tok = (name: string): string => {
    const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens);
    if (!m) throw new Error(`token --${name} not found, so this checked nothing`);
    return m[1]!;
  };

  it("body-text tokens clear 4.5:1 on both paper grounds", () => {
    for (const ink of ["ink", "ink-soft", "ink-faint"]) {
      for (const ground of ["paper", "paper-deep"]) {
        const r = ratio(tok(ink), tok(ground));
        expect(r, `--${ink} on --${ground} is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("deck-text tokens clear 4.5:1 on both deck grounds", () => {
    for (const ink of ["deck-ink", "deck-ink-soft"]) {
      for (const ground of ["deck", "deck-raised"]) {
        const r = ratio(tok(ink), tok(ground));
        expect(r, `--${ink} on --${ground} is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("a deck-ink element must carry its own deck ground", () => {
  /**
   * A colour token is only safe against the ground it was MEASURED on. The
   * agent-view toggle used --deck-ink-soft, which is correct on the dark deck
   * and measured 2.57:1 when the mobile layout collapsed that panel onto paper.
   * The token was fine. The ground moved underneath it, and no amount of
   * checking token pairs can see that.
   *
   * So: any rule that sets a deck ink colour must also set a background, or
   * live inside a block that does.
   */
  it("every rule using a deck ink token supplies a background", () => {
    const offenders: string[] = [];
    let checked = 0;
    for (const f of FILES.filter((x) => x.endsWith(".css"))) {
      const src = read(f);
      const rules = cssRules(src);
      for (const { selector, body } of rules) {
        if (!/color:\s*var\(--deck-ink/.test(body)) continue;
        checked++;
        // `background: transparent` is NOT a ground, and treating it as one is
        // how the first version of this guard survived deleting the exact fix
        // it was written to protect.
        const hasGround = (b: string) =>
          /background(-color)?:\s*(?!transparent|none|inherit|initial)\S/.test(b);
        if (hasGround(body)) continue;
        // Or the BEM BLOCK this element belongs to sets one. `.attack__eyebrow`
        // is grounded by `.attack`, which is the normal and correct pattern;
        // only an element whose whole block is transparent is at risk.
        const block = bemBlock(selector);
        // The BLOCK ROOT specifically, not any rule in the block. A SIBLING
        // element having a background does not ground this one, and accepting
        // that is how this guard survived two separate attempts to break it.
        const grounded = rules.some(
          (r) => r.selector.split(/[\s:>,]/)[0] === block && hasGround(r.body),
        );
        if (!grounded) offenders.push(`${f}: ${selector.slice(0, 60)} (block ${block})`);
      }
    }
    expect(checked, "found no deck-ink rules, so this checked nothing").toBeGreaterThan(3);
    expect(offenders, `deck ink on an unknown ground:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("opacity is never applied to type", () => {
  // THE TOKEN TEST ABOVE PASSED WHILE THE PAGE FAILED. Token values were fine;
  // the rendered colours were not, because a rule dimmed a whole card and the
  // text inside it came along. --deck-ink-soft is 5.08:1 on the deck and
  // renders at 3.50:1 under opacity 0.75. A check that reads tokens is
  // structurally blind to that, so this checks the mechanism instead.
  //
  // Opacity on a swatch, a dot, a rule or a keyframe is fine. Opacity on a rule
  // that also sets a font or colour is what broke WCAG here.
  const cssFiles = FILES.filter((f) => f.endsWith(".css"));

  it("finds CSS to check", () => {
    expect(cssFiles.length).toBeGreaterThan(5);
  });

  it("no rule sets both a text property and a fractional opacity", () => {
    const offenders: string[] = [];
    for (const f of cssFiles) {
      const src = read(f);
      for (const { selector, body } of cssRules(src)) {
        if (/^\s*(from|to|\d+%)\s*$/.test(selector)) continue;   // keyframe steps
        const op = /(?:^|[\s;])opacity:\s*([0-9.]+)/.exec(body);
        if (!op || Number(op[1]) >= 1) continue;
        const setsType = /(?:^|[\s;])(color|font-size|font-weight|font-family):/.test(body);
        if (!setsType) continue;
        // An entry state that animates or transitions INTO view is not a
        // permanently dimmed piece of text. `.verdict__glyph` sits at opacity 0
        // and transitions to 1; that is motion, not a contrast decision.
        const animatesIn = /transition:[^;]*opacity|animation:/.test(body);
        if (animatesIn) continue;
        offenders.push(`${f}: ${selector.slice(0, 60)} (opacity ${op[1]})`);
      }
    }
    expect(offenders, `opacity on a rule that also styles text:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("placard fills are never used as small type", () => {
  it("state text uses the -text variants, not the placard fill tokens", () => {
    // 49 CFR 172 subpart F picks these to be read as a large coloured field.
    // As 11px type on the dark deck they measure 3.25:1 and 3.12:1.
    for (const { selector, body } of cssRules(read("src/ui/registry.css"))) {
      if (!/color:\s*var\(--(cleared|refused|caution)\)/.test(body)) continue;
      expect.fail(`${selector} uses a placard FILL as text; use --*-text`);
    }
  });
});

describe("landmarks", () => {
  it("every routed surface renders a <main>", () => {
    for (const f of ["src/Console.tsx", "src/Judge.tsx", "src/StatesPreview.tsx"]) {
      expect(read(f), `${f} has no <main> landmark`).toMatch(/<main[\s>]/);
    }
  });
});

describe("published figures must match the fact sheet", () => {
  /**
   * THE GUARD THAT WAS MISSING, and its absence is how a headline number went
   * stale in three files at once.
   *
   * Fixing the 177.848(e)(3) exception made the solver stricter, so the count of
   * divergent configurations moved from 24 to 32. FACTS.md regenerates from the
   * corpus and was correct immediately. The README, the Devpost draft and a
   * source comment all still said 24, and nothing failed, because no test ever
   * compared prose against the fact sheet.
   *
   * The live endpoints were right the whole time, which is the argument for
   * computing a number rather than typing it. This closes the gap for the
   * places that cannot be computed.
   */
  const facts = read("FACTS.md");
  const factValue = (label: string): string => {
    const m = new RegExp(`\\|\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\|\\s*([0-9,]+)\\s*\\|`).exec(facts);
    if (!m) throw new Error(`FACTS.md has no row "${label}", so this checked nothing`);
    return m[1]!.replace(/,/g, "");
  };

  it("finds the divergence rows in FACTS.md", () => {
    expect(factValue("Configurations examined (ordered pairs x barrier x truckload carve-out)")).toMatch(/^\d+$/);
    expect(factValue("Of those, configurations the full regulation forbids")).toMatch(/^\d+$/);
  });

  it("every prose surface states the SAME divergence figures as FACTS.md", () => {
    const examined = factValue("Configurations examined (ordered pairs x barrier x truckload carve-out)");
    const cleared = factValue("Configurations the 177.848(d) table alone clears");
    const forbids = factValue("Of those, configurations the full regulation forbids");
    const num = (raw: string | undefined) => (raw ?? "").replace(/[,*\s]/g, "");

    // Parse the CLAIM ITSELF rather than asking whether the right digits appear
    // anywhere in the file. The first version of this test did the latter and
    // survived putting the stale figure back, because the correct one happened
    // to occur elsewhere in the document.
    // EVERY tracked prose surface, not a hand-listed two. The stale 24 survived
    // the 24-to-32 correction on `video/script.md` and `submission/fields.md`
    // precisely because this list named only the two files I happened to think
    // of, while both of those are git-tracked and public. A guard that picks
    // its own scope by hand has a blind spot exactly the size of what it omits.
    const surfaces = FILES.filter(
      (f) => /\.(md|txt)$/.test(f) && !f.startsWith("node_modules") && !/CHANGELOG/i.test(f),
    );
    let asserted = 0;

    for (const f of surfaces) {
      const text = read(f);
      const mExamined = /\*{0,2}([\d,]+)\*{0,2}\s*\n?\s*configurations\*{0,2} were examined/.exec(text);
      const mCleared = /table alone clears \*{0,2}([\d,]+)\*{0,2} of them/.exec(text);
      const mForbids = /regulation forbids \*{0,2}([\d,]+)\*{0,2}/.exec(text);
      if (!mExamined && !mCleared && !mForbids) continue;

      if (mExamined) { asserted++; expect(num(mExamined[1]), `${f} examined`).toBe(examined); }
      if (mCleared) { asserted++; expect(num(mCleared[1]), `${f} cleared`).toBe(cleared); }
      if (mForbids) { asserted++; expect(num(mForbids[1]), `${f} forbids`).toBe(forbids); }
    }

    // Non-vacuity: if the sentences are reworded so none of the patterns match,
    // this test would otherwise pass having compared nothing at all.
    expect(asserted, "no divergence claim was parsed from any prose surface").toBeGreaterThanOrEqual(4);

    // THE FORMS THE REGEXES ABOVE CANNOT SEE. The stale 24 survived the
    // correction on two tracked files because one carried it in a table row
    // ("| 1,296 / 792 / 24 |") and the other spelled it in words ("forbids
    // twenty four"). Neither matches a prose regex looking for digits after a
    // phrase. So: any line that mentions the cleared count must not carry a
    // divergence figure other than the current one, in digits or in words.
    // ONLY figures that have genuinely BEEN the divergence headline. Seeding
    // this with arbitrary candidates made it fire on a storyboard row whose "16"
    // was a beat duration in seconds, which is how a guard earns a reputation
    // for crying wolf and then gets deleted. 24 and 32 are the two historical
    // values this project published before the sweep was corrected.
    const WORDS: Record<number, string> = {
      24: "twenty four", 32: "thirty two", 56: "fifty six",
    };
    let lineChecks = 0;
    for (const f of surfaces) {
      for (const line of read(f).split("\n")) {
        if (!line.includes(String(cleared))) continue;
        lineChecks++;
        for (const [n, word] of Object.entries(WORDS)) {
          if (Number(n) === Number(forbids)) continue;
          expect(
            new RegExp(`\\b${n}\\b`).test(line) || line.toLowerCase().includes(word),
            `${f} carries a stale divergence figure (${n}) beside ${cleared}: ${line.trim()}`,
          ).toBe(false);
        }
      }
    }
    expect(lineChecks, "no surface mentions the cleared count at all").toBeGreaterThan(0);

    // A SPELLED-OUT figure on a line that never mentions 792. The video script
    // narrates "the full regulation forbids thirty two", and narration is where
    // a stale number does the most damage, because a rendered video cannot be
    // corrected. So every "forbids <word>" is checked against the fact sheet in
    // words, independently of what else is on the line.
    let spoken = 0;
    for (const f of surfaces) {
      for (const m of read(f).matchAll(/regulation forbids ([a-z]+(?: [a-z]+)?)\b/gi)) {
        const said = m[1]!.toLowerCase().trim();
        if (/^\d+$/.test(said)) continue; // digits are covered above
        spoken++;
        expect(
          said,
          `${f} narrates "forbids ${said}" but the fact sheet says ${forbids}`,
        ).toBe(WORDS[Number(forbids)]);
      }
    }
    expect(spoken, "no surface spells the divergence figure in words").toBeGreaterThan(0);

  });
});

describe("the judge itinerary covers what actually ships", () => {
  // It was written with six steps before the attack panel, the matrix and the
  // agent view existed, so the strongest work on the page had no signpost
  // anywhere a judge would look. A surface with no route to it is a surface a
  // judge does not see.
  const judge = read("src/Judge.tsx");

  it("mentions every major surface by name", () => {
    for (const surface of ["defeat the gate", "Prompt injection", "324 cells", "getTools"]) {
      expect(judge, `the itinerary never mentions ${surface}`).toContain(surface);
    }
  });

  it("numbers its steps consecutively from 1", () => {
    const ns = [...judge.matchAll(/<Step n=\{(\d+)\}/g)].map((m) => Number(m[1]));
    expect(ns.length).toBeGreaterThan(6);
    expect(ns).toEqual(ns.map((_, i) => i + 1));
  });

  it("opens on a permalink rather than an instruction to press something", () => {
    // Step one used to say "press Load the demonstration manifest". A judge
    // should not have to operate the product to see the thing it is famous for.
    expect(judge).toMatch(/load=UN1830,UN1748&check=1/);
  });

  it("does not offer a link that claims to assert what only a person can", () => {
    // These parameters used to work. A link carrying &barriers=1 attested, on
    // the operator's behalf, that physical barriers were installed in a truck
    // it had never seen, and that turned a refused load into a passing one.
    // The parameters are refused now, so a link still carrying one would be
    // promising an effect it cannot have, which is its own kind of lie.
    for (const p of ["barriers=1", "shipper=1", "nonreaction=1"]) {
      expect(judge, `/judge still links with ${p}`).not.toContain(p);
    }
    // And NOT just this page. The PWA manifest's shortcut carried barriers=1
    // long after the parameter was retired, promising "with a barrier" while
    // the page it opened had the box unticked. Any tracked file that builds a
    // link is a surface, so check them all.
    // Look for a LINK carrying the parameter, not for any mention of it. Several
    // surfaces legitimately DESCRIBE the removal in prose, and a guard that
    // cannot tell a description from a link would either fail on the honest
    // writeup or be deleted for crying wolf. A link here always starts "/?".
    const linkWithRetired = /\/\?[^"'\s)`]*(?:barriers|shipper|nonreaction)=1/;
    for (const f of FILES.filter((x) => /\.(tsx?|json|webmanifest|html)$/.test(x))) {
      const m = linkWithRetired.exec(read(f));
      expect(m?.[0], `${f} builds a link with a retired parameter: ${m?.[0]}`).toBeUndefined();
    }
    // Non-vacuity: the page really does carry permalinks.
    expect(judge).toContain("load=UN1830,UN1748");
  });
});

describe("the app is installable and its manifest is honest", () => {
  // Installable on purpose and WITHOUT a service worker on purpose. A stale
  // cache serving a judge an old build of the scored URL is a worse outcome
  // than having no offline shell.
  const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
    name: string; start_url: string; icons: Array<{ src: string; sizes: string }>;
    shortcuts?: Array<{ url: string }>;
  };

  it("every icon the manifest names actually exists", () => {
    expect(manifest.icons.length).toBeGreaterThan(1);
    for (const i of manifest.icons) {
      const f = join(ROOT, "public", i.src.replace(/^\//, ""));
      expect(existsSync(f), `manifest names ${i.src} which is not in public/`).toBe(true);
    }
  });

  it("index.html links the manifest and the iOS icon", () => {
    const html = read("index.html");
    expect(html).toMatch(/rel="manifest"/);
    expect(html).toMatch(/rel="apple-touch-icon"/);
  });

  it("ships NO service worker, which is a decision rather than an omission", () => {
    const sw = FILES.filter((f) => /service-?worker|\bsw\.[jt]s$/.test(f));
    expect(sw, `a service worker appeared: ${sw.join(", ")}`).toEqual([]);
    expect(read("index.html")).not.toMatch(/serviceWorker\.register/);
  });

  it("its shortcut URLs are real routes this app answers", () => {
    for (const sc of manifest.shortcuts ?? []) {
      const path = sc.url.split("?")[0]!;
      expect(["/", "/judge", "/states"], `shortcut points at ${path}`).toContain(path);
    }
  });
});

describe("the published eval command is the one that actually passes", () => {
  /**
   * I published a command in three places and had never run it. It needed
   * Chrome Canary, which was not installed, so it failed before it started; and
   * once it ran it scored 2 of 6, because smoke mode opens a fresh page per
   * case and three of the five tools only exist once the page holds state.
   *
   * The working command carries that state in the URL. This asserts every
   * surface publishes THAT one, so the instruction cannot drift back to the
   * bare URL that silently scores 2 of 6.
   */
  const surfaces = ["README.md", "submission/devpost-description.md", "src/Judge.tsx"]
    .filter((f) => FILES.includes(f));

  it("checks every surface that publishes it", () => {
    expect(surfaces.length).toBe(3);
  });

  for (const f of surfaces) {
    it(`${f} carries the state-bearing URL INSIDE the command, not just nearby`, () => {
      const text = read(f);
      if (!text.includes("webmcp-evals smoke")) return;

      // Extract the command itself. Checking the whole file would pass on the
      // prose that EXPLAINS the URL, which is exactly how the first version of
      // this test survived reverting the command to the bare form.
      const i = text.indexOf("webmcp-evals smoke");
      const cmd = text.slice(i, i + 220);

      expect(cmd, `${f} publishes a bare URL that scores 2 of 6:\n${cmd}`)
        .toMatch(/load=UN1090&(amp;)?check=1/);
      // The Canary requirement may live in the surrounding prose, since it is a
      // prerequisite rather than part of the command.
      expect(text.toLowerCase(), `${f} does not mention the Canary requirement`).toContain("canary");
    });
  }
});

describe("the demo manifest in the code matches the one in FACTS.md", () => {
  it("lists the same materials, so the fact sheet cannot drift from the product", () => {
    // These two disagreed: FACTS.md documented six entries including UN0360
    // while Console.tsx had five and no explosive, so the compatibility-table
    // axis was never exercised on any surface a reader could see.
    const facts = read("FACTS.md");
    const demoLine = /const DEMO = \[([^\]]*)\]/.exec(read("src/Console.tsx"));
    expect(demoLine, "DEMO array not found in Console.tsx").not.toBeNull();
    const ids = [...demoLine![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(4);
    for (const id of ids) {
      expect(facts, `FACTS.md does not list demo item ${id}`).toContain(id);
    }
  });
});
