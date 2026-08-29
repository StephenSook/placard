/**
 * The proposer's tests.
 *
 * The property that matters most is AGREEMENT: anything the proposer proposes
 * must pass the adjudicator. If those two ever disagree, the page would show a
 * plan it would then refuse to export, which is worse than proposing nothing.
 * It is tested as a property over generated manifests, not on one fixture.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { proposePartition, checkLoad, resolveItem, checkVehicle } from "../src/solver/index.ts";
import type { LineItem } from "../src/solver/types.ts";

const N = "partition-nonce";
// A pool spanning an X cell, an O cell, the Class 8 hard block, a multi-label
// entry, an explosive and an inert-in-the-table Class 9.
const POOL = ["UN1090", "UN1830", "UN1748", "UN1309", "UN0360", "UN1203", "UN1017", "UN1993"];

describe("the proposer", () => {
  it("refuses one vehicle for a load that provably needs two, and names the witness", () => {
    const r = proposePartition([{ id: "UN1830" }, { id: "UN1748" }], { maxVehicles: 1 });
    expect(r.status).toBe("IMPOSSIBLE");
    if (r.status === "IMPOSSIBLE") {
      expect(r.needed).toBeGreaterThan(r.available);
      expect(r.minimalConflictingSet).toHaveLength(2);
      // A witness a human can check by hand, not the string "no solution".
      expect(r.minimalConflictingSet.join(" ")).toMatch(/Sulfuric acid/);
    }
  });

  it("finds the split when a second vehicle is available", () => {
    const r = proposePartition([{ id: "UN1830" }, { id: "UN1748" }], { maxVehicles: 2 });
    expect(r.status).toBe("PROPOSED");
    if (r.status === "PROPOSED") expect(r.vehiclesUsed).toBe(2);
  });

  it("rejects a Forbidden material outright, without searching at all", () => {
    const r = proposePartition([{ id: "UN1090" }, { name: "Ammonium chlorate" }], { maxVehicles: 8 });
    expect(r.status).toBe("IMPOSSIBLE");
    if (r.status === "IMPOSSIBLE") {
      expect(r.searchNodes).toBe(0);
      expect(r.rejected[0]!.violation.code).toBe("FORBIDDEN_MATERIAL");
    }
  });

  it("reports unresolved line items rather than silently dropping them", () => {
    const r = proposePartition([{ id: "UN1090" }, { id: "UN9999" }], { maxVehicles: 2 });
    expect(r.status).toBe("UNRESOLVED");
    if (r.status === "UNRESOLVED") expect(r.errors[0]!.index).toBe(1);
  });

  it("asserting a barrier STRICTLY removes the O-cell conflicts and leaves the hard block", () => {
    // The demo manifest. Acetone against calcium hypochlorite is an O cell and
    // a barrier rescues it. Sulfuric acid against calcium hypochlorite and
    // against aluminium powder are the 177.848(e)(3) hard block and no barrier
    // touches them. So the count must DROP, and what survives must be the
    // hard block. A <= assertion here would pass even if barriers were never
    // passed through to the check at all, which mutation testing proved.
    const items: LineItem[] = [{ id: "UN1090" }, { id: "UN1830" }, { id: "UN1748" }, { id: "UN1309" }];
    const without = proposePartition(items, { maxVehicles: 4 });
    const withB = proposePartition(items, { maxVehicles: 4, barriersPresent: true });
    if (without.status !== "PROPOSED" || withB.status !== "PROPOSED") throw new Error("both should propose");
    expect(withB.conflicts.length).toBeLessThan(without.conflicts.length);
    expect(withB.conflicts.every((c) => /Notwithstanding the methods of separation/.test(c.citations.map((x) => x.text).join(" ")))).toBe(true);
  });

  it("is deterministic: the same input yields the same plan", () => {
    const items: LineItem[] = POOL.slice(0, 5).map((id) => ({ id }));
    const a = proposePartition(items, { maxVehicles: 3 });
    const b = proposePartition(items, { maxVehicles: 3 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("the proposer and the adjudicator never disagree", () => {
  const arbItems = fc.uniqueArray(fc.constantFrom(...POOL), { minLength: 1, maxLength: 5 })
    .map((ids): LineItem[] => ids.map((id) => ({ id })));

  it("every PROPOSED plan passes checkLoad", async () => {
    await fc.assert(fc.asyncProperty(arbItems, fc.integer({ min: 1, max: 5 }), fc.boolean(),
      async (items, maxVehicles, barriersPresent) => {
        const r = proposePartition(items, { maxVehicles, barriersPresent });
        if (r.status !== "PROPOSED") return;
        const v = await checkLoad(r.load, N);
        expect(v.status, JSON.stringify(r.load)).toBe("PASS");
      }), { numRuns: 200 });
  });

  it("an IMPOSSIBLE verdict's conflicting set really is pairwise conflicting", () => {
    fc.assert(fc.property(arbItems, fc.integer({ min: 1, max: 3 }), (items, maxVehicles) => {
      const r = proposePartition(items, { maxVehicles });
      if (r.status !== "IMPOSSIBLE" || r.rejected.length > 0) return;
      const set = r.minimalConflictingSet;
      if (set.length < 2) return;
      // Every pair in the witness must genuinely conflict, or the witness is
      // not a proof and the refusal is unexplained.
      const byName = new Map(items.map((i) => {
        const res = resolveItem(i);
        return ["error" in res ? "" : res.name, i] as const;
      }));
      for (let x = 0; x < set.length; x++) {
        for (let y = x + 1; y < set.length; y++) {
          const ia = byName.get(set[x]!), ib = byName.get(set[y]!);
          if (!ia || !ib) continue;
          const ra = resolveItem(ia), rb = resolveItem(ib);
          if ("error" in ra || "error" in rb) continue;
          const out = checkVehicle([ra, rb], { items: [ia, ib] }, 0);
          expect(out.violations.some((v) => v.items.length === 2), `${set[x]} vs ${set[y]}`).toBe(true);
        }
      }
    }), { numRuns: 150 });
  });

  it("more vehicles never turns a solvable load unsolvable", () => {
    fc.assert(fc.property(arbItems, fc.integer({ min: 1, max: 4 }), (items, v) => {
      const fewer = proposePartition(items, { maxVehicles: v });
      if (fewer.status !== "PROPOSED") return;
      const more = proposePartition(items, { maxVehicles: v + 1 });
      expect(more.status).toBe("PROPOSED");
    }), { numRuns: 200 });
  });

  it("one vehicle per item always succeeds unless something is refused outright", () => {
    fc.assert(fc.property(arbItems, (items) => {
      const r = proposePartition(items, { maxVehicles: items.length });
      expect(r.status).toBe("PROPOSED");
    }), { numRuns: 200 });
  });
});
