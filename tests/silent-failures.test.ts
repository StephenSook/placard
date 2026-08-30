/**
 * REGRESSIONS FOR THE SILENT FAILURES, one test per defect, each reproducing
 * the exact load or state that used to clear.
 *
 * Every one of these was found by an adversarial review pass rather than by the
 * suite, and every one is in the permissive direction: the tool said PASS and
 * exported a shipping paper. That is the only direction that matters here. A
 * refusal that should have been a pass is an annoyance; a pass that should have
 * been a refusal is the thing this project exists to prevent.
 */
import { describe, it, expect } from "vitest";
import { checkSegregation, toLoad, proposeLoad } from "../src/tools/executors.ts";
import { checkLoad } from "../src/solver/index.ts";
import { resolveItem } from "../src/solver/hazards.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const N = "silent-failure-regression";

async function clears(vehicles: Parameters<typeof toLoad>[0]) {
  const v = await checkLoad(toLoad(vehicles), N);
  return v.status === "PASS";
}

describe("an unparsed hazard label is unknown, not harmless", () => {
  /**
   * matrixKeyFor's default branch conflated "this class has no row in
   * 177.848(d)" with "I could not parse this string", and the solver turned
   * both into a note citing 177.848(e)(1): no restriction arises. A corrupt
   * column-6 value therefore read as a clean bill of health.
   */
  it("refuses UN3535, whose label carries a stray period", async () => {
    // Column 6 reads "6.1. 4.1". The 4.1 subsidiary was discarded and the
    // primary 6.1 correctly excluded as a solid, leaving NO matrix keys at all,
    // so it passed against a Division 1.1 explosive that 4.1 is X against.
    expect(await clears([{ items: ["UN3535", "UN0004"] }])).toBe(false);
    expect(await clears([{ items: ["UN3535", "UN1830"] }])).toBe(false);
  });

  it("refuses UN3101, whose explosive label has no division", async () => {
    // Column 6 reads ["5.2","1"]. A bare "1" fails the division regex.
    expect(await clears([{ items: ["UN3101", "UN1090"] }])).toBe(false);
  });

  it("still only NOTES a class the table genuinely does not cover", async () => {
    // Non-vacuity. If this failed, the fix would be "refuse anything without a
    // matrix key", which would refuse every Class 9 and 6.2 material.
    const v = await checkLoad(toLoad([{ items: ["UN1090", "UN3291"] }]), N);
    const unresolved = v.status === "REFUSED"
      ? v.violations.filter((x) => x.code === "UNRESOLVED_MATERIAL")
      : [];
    expect(unresolved, "a class with no row must not be treated as unparsed").toEqual([]);
  });
});

describe("a load carrying nothing is not a passing load", () => {
  it("refuses a vehicle with no items and issues no token", async () => {
    const v = await checkSegregation({ vehicles: [{ items: [] }] }, N);
    expect(v.status).toBe("REFUSED");
    expect(v).not.toHaveProperty("approvalToken");
  });

  it("refuses every vehicle being empty, however many there are", async () => {
    const v = await checkSegregation({ vehicles: [{ items: [] }, { items: [] }] }, N);
    expect(v.status).toBe("REFUSED");
  });

  it("still allows one empty vehicle beside a loaded one", async () => {
    // Non-vacuity: adding a second truck before filling it is ordinary.
    const v = await checkSegregation({ vehicles: [{ items: ["UN1090"] }, { items: [] }] }, N);
    expect(v.status).toBe("PASS");
  });
});

describe("propose_load's echo must round-trip through the manifest", () => {
  /**
   * The Console keyed its lookup on the RAW reference while proposeLoad echoes
   * a canonicalised identification number. `?load=UN1090,un1830,un1748` then
   * silently emptied two of three bays, the manifest panel still showed three
   * items, and the check passed because nothing was left to object to. The two
   * it dropped were this project's own headline refusal pair.
   */
  const canon = (x: string) => x.trim().replace(/\s+/g, "").toUpperCase();

  it("matches every echoed reference back regardless of the casing typed", () => {
    for (const refs of [
      ["UN1090", "un1830", "un1748"],
      ["un1090", "un1830", "un1748"],
      ["UN1090", "UN1830", "UN1748"],
      ["un 1090", "UN1830", "un1748"],
    ]) {
      const manifest = refs
        .map((x) => resolveItem(/^(un|na|id)\s?\d{4}$/i.test(x.trim()) ? { id: x } : { name: x }))
        .filter((m): m is Exclude<typeof m, { error: string }> => !("error" in m));
      const byRef = new Map(manifest.map((m) => [canon(m.item.id ?? m.name), m] as const));
      const p = proposeLoad({ items: refs, maxVehicles: 2 });
      if (p.status !== "PROPOSED") throw new Error(`expected a proposal, got ${p.status}`);
      const placed = p.vehicles.flatMap((v) => v.items).filter((r) => byRef.has(canon(r)));
      expect(placed.length, `refs ${JSON.stringify(refs)} lost items on the round trip`)
        .toBe(refs.length);
    }
  });

  it("keys the Console's own map on the canonical form", () => {
    // The mechanism, not just the outcome: a future edit that reverts the key
    // would fail here even if the test above happened to use uppercase refs.
    const src = readFileSync(join(process.cwd(), "src/Console.tsx"), "utf8");
    expect(src).toMatch(/const canon = \(x: string\) =>/);
    expect(src).toMatch(/byRef = new Map\(manifest\.map\(\(m\) => \[canon\(/);
    expect(src).not.toMatch(/byRef = new Map\(manifest\.map\(\(m\) => \[m\.item\.id \?\? m\.name/);
  });
});

describe("an operator's attestation cannot be rebound to different cargo", () => {
  /**
   * Moving the attestation fields off the wire stopped an agent ASSERTING a
   * barrier. It did not stop an agent BORROWING one: the merge was positional,
   * so an agent could send any items as vehicle 1 and inherit whatever the
   * operator had ticked for their own vehicle 1. Reproduced from REFUSED to a
   * committed paper marked "barriers asserted" for cargo never on the page.
   */
  const attest = [{ barriersPresent: true, singleShipper: false, nonReactionAsserted: false }];
  const pageLoad = [{ items: ["UN1090", "UN1830"] }];
  const OTHER = ["UN1090", "UN1479"];

  it("drops the attestation when the cargo is not what was attested about", async () => {
    const r = await checkSegregation({ vehicles: [{ items: OTHER }] }, N, attest, pageLoad);
    expect(r.status).toBe("REFUSED");
    expect((r as { attestationsNotApplied?: number[] }).attestationsNotApplied).toEqual([1]);
  });

  it("says so, rather than silently returning a stricter answer", async () => {
    const r = await checkSegregation({ vehicles: [{ items: OTHER }] }, N, attest, pageLoad);
    expect((r as { note: string }).note).toContain("not the contents they attested about");
  });

  it("still applies the attestation to the operator's own vehicle", async () => {
    // Non-vacuity: without this the fix could be "never apply attestations".
    const r = await checkSegregation({ vehicles: [{ items: ["UN1090", "UN1830"] }] }, N, attest, pageLoad);
    expect(r.status).toBe("PASS");
  });

  it("compares contents as a set, so item order does not revoke it", async () => {
    const r = await checkSegregation({ vehicles: [{ items: ["UN1830", "UN1090"] }] }, N, attest, pageLoad);
    expect(r.status).toBe("PASS");
  });
});

describe("footnote 4 fails closed, because 177.835(g) is outside this corpus", () => {
  it("refuses UN0500 with UN0462 rather than clearing on a caveat", async () => {
    // It used to push a note reading "this pairing is NOT cleared by this tool"
    // and then return ok, so the tool contradicted itself and exported.
    const v = await checkSegregation({ vehicles: [{ items: ["UN0500", "UN0462"] }] }, N);
    expect(v.status).toBe("REFUSED");
    expect(v).not.toHaveProperty("approvalToken");
  });

  it("names the section a person has to read", async () => {
    const v = await checkLoad(toLoad([{ items: ["UN0500", "UN0462"] }]), N);
    if (v.status !== "REFUSED") throw new Error("expected REFUSED");
    expect(v.violations.map((x) => x.message).join(" ")).toContain("177.835(g)");
  });
});

describe("footnote 6 has two conditions and a vehicle scope", () => {
  /**
   * 177.848(g)(vi): explosive articles in compatibility group G, OTHER THAN
   * FIREWORKS and those requiring special handling, may be loaded with groups
   * C, D and E, PROVIDED THAT explosive substances are not carried in the same
   * transport VEHICLE.
   *
   * The first version checked the proviso only, using a name-prefix test that
   * matched 14 of the 388 Class 1 entries, and evaluated it pairwise.
   */
  it("excludes fireworks, which the quoted clause excludes in as many words", async () => {
    expect(await clears([{ items: ["UN0336", "UN0351"] }])).toBe(false);
  });

  it("catches a substance the name test could not see", async () => {
    // Black powder is an explosive substance and is not named "Substances, ...".
    expect(await clears([{ items: ["UN0353", "UN0027"] }])).toBe(false);
  });

  it("evaluates the proviso across the VEHICLE, not just the pair", async () => {
    // The G/C pair used to clear each other while a substance sat in the same
    // truck, because the G/S and C/S pairs land on cells that never run it.
    expect(await clears([{ items: ["UN0353", "UN0351", "UN0481"] }])).toBe(false);
  });

  it("does not simply refuse every explosive pair", async () => {
    // Non-vacuity. Two ordinary explosives of the same compatibility group must
    // still be able to travel together, or the fix is a blunt refusal.
    const v = await checkLoad(toLoad([{ items: ["UN0333", "UN0334"] }]), N);
    expect(["PASS", "REFUSED"]).toContain(v.status);
    const msgs = v.status === "REFUSED" ? v.violations.map((x) => x.message).join(" ") : "";
    expect(msgs).not.toContain("footnote 6");
  });
});

describe("a UN number spanning several rows resolves to the most severe", () => {
  /**
   * The resolver took rows[0] on the reasoning that the first row is the lowest
   * packing group and therefore the most severe. The corpus falsifies that:
   * UN2031's rows run II, II, II, I and NA1760's run II, I, II, III, I, II,
   * III, II. UN1831 has TWO PG I rows, one labelled ["8"] and one ["8","6.1"]
   * carrying special provision 2, and rows[0] was the one without the
   * poison-by-inhalation subsidiary.
   *
   * Severity ordering was the fix, and it was only ever right for rows that
   * differ by PACKING GROUP. A later round found it also being applied to rows
   * that differ by NAME and LABELS, where there is no "stricter" among
   * different materials and picking one prints a proper shipping name the
   * operator never described. Those numbers now refuse; the packing-group case
   * still resolves, and both are asserted below.
   */
  it("refuses UN1831, whose two PG I rows are different materials", () => {
    const r = resolveItem({ id: "UN1831" });
    expect("error" in r).toBe(true);
    const e = (r as { error: string }).error;
    expect(e).toMatch(/2 different materials/);
    expect(e).toContain("free sulfur trioxide");
  });

  it("refuses UN2031 and NA1760, which span nitric acid strengths under one number", () => {
    for (const id of ["UN2031", "NA1760"]) {
      const r = resolveItem({ id });
      expect("error" in r, `${id} resolved to one row when it covers several materials`).toBe(true);
      expect((r as { error: string }).error).toMatch(/different materials/);
    }
  });

  it("still orders by packing group when that is the only thing that differs", () => {
    // UN2810 is one material, "Toxic, liquids, organic, n.o.s.", listed at PG I,
    // II and III. There the lowest group genuinely is the strictest read of an
    // under-specified reference, so the sort still runs.
    const r = resolveItem({ id: "UN2810" });
    if ("error" in r) throw new Error(r.error);
    expect(r.packingGroup).toBe("I");
    expect(r.name).toBe("Toxic, liquids, organic, n.o.s.");
  });

  it("resolves UN2031 once the operator names the strength", () => {
    // The refusal is not a dead end: it lists the names and one of them works.
    const r = resolveItem({
      id: "UN2031",
      name: "Nitric acid other than red fuming, with more than 70 percent nitric acid",
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.packingGroup).toBe("I");
    expect(r.hazards.map((h) => h.raw)).toContain("5.1");
  });

  it("that subsidiary changes a verdict, which is why it matters", async () => {
    // Nitric acid at more than 70 percent carries a 5.1 subsidiary. Class 8
    // against Class 3 carries no restriction, so dropping it cleared this pair.
    const v = await checkLoad({
      vehicles: [{
        items: [
          { id: "UN2031", name: "Nitric acid other than red fuming, with more than 70 percent nitric acid" },
          { id: "UN1090" },
        ],
      }],
    }, "subsidiary-regression");
    expect(v.status).toBe("REFUSED");
  });

  it("still resolves a single-row identification number unchanged", () => {
    // Non-vacuity: the sort must not disturb the ordinary case.
    const r = resolveItem({ id: "UN1090" });
    if ("error" in r) throw new Error(r.error);
    expect(r.name).toBe("Acetone");
  });
});
