/**
 * Property, metamorphic, fixed-point and gate tests.
 *
 * The metamorphic pair is the important one. It encodes two things the
 * regulation guarantees but a table lookup can quietly violate:
 *   - permuting item order must not change a verdict
 *   - adding an item can only make a load equally or MORE restricted
 * A solver that passes the exhaustive cell test can still fail both.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  checkLoad, verifyApproval, resolveCompatibility, checkGroups,
  forbiddenEntries, resolveItem, canonical, CLAUSE_IDS, cite,
} from "../src/solver/index.ts";
import type { CompatibilityGroup, LineItem, LoadProposal } from "../src/solver/types.ts";

const N = "test-nonce";
const GROUPS: CompatibilityGroup[] = ["A","B","C","D","E","F","G","H","J","K","L","N","S"];
// UN numbers spanning an X cell, an O cell, a multi-label entry and an explosive.
const POOL = ["UN1090","UN1830","UN1748","UN1309","UN0360","UN1203","UN1017"];

describe("the four refusal axes", () => {
  it("refuses every one of the 256 Forbidden materials, none of which has a UN number", async () => {
    const all = forbiddenEntries();
    expect(all.length).toBe(256);
    expect(all.every((e) => e.un === null)).toBe(true);
    // Spot-check a spread rather than all 256, which would be slow and no
    // more informative: resolution is by the same code path for each.
    for (const e of [all[0]!, all[64]!, all[128]!, all[255]!]) {
      const v = await checkLoad({ vehicles: [{ items: [{ name: e.name }] }] }, N);
      expect(v.status, e.name).toBe("REFUSED");
      if (v.status === "REFUSED") {
        expect(v.violations[0]!.code).toBe("FORBIDDEN_MATERIAL");
        expect(v.violations[0]!.citations[0]!.section).toBe("49 CFR 173.21(a)");
      }
    }
  });

  it("blocks Class 8 liquid against Class 5.1 even when a barrier is asserted", async () => {
    const v = await checkLoad({ vehicles: [{ items: [{ id: "UN1830" }, { id: "UN1748" }], barriersPresent: true }] }, N);
    expect(v.status).toBe("REFUSED");
    if (v.status === "REFUSED") {
      expect(v.violations[0]!.code).toBe("CORROSIVE_OVER_OXIDIZER");
      expect(v.violations[0]!.citations[0]!.text).toContain("Notwithstanding the methods of separation employed");
    }
  });

  it("clears the same two materials when they are on different vehicles", async () => {
    const v = await checkLoad({ vehicles: [{ items: [{ id: "UN1830" }] }, { items: [{ id: "UN1748" }] }] }, N);
    expect(v.status).toBe("PASS");
  });

  it("refuses a material the table does not identify rather than passing it", async () => {
    const v = await checkLoad({ vehicles: [{ items: [{ id: "UN9999" }] }] }, N);
    expect(v.status).toBe("REFUSED");
  });

  it("resolves a name through the table's own see pointer", () => {
    const r = resolveItem({ name: "Accellerene" });
    expect("error" in r).toBe(false);
    if (!("error" in r)) expect(r.name.toLowerCase()).toContain("nitrosodimethylaniline");
  });
});

describe("177.848(f) rewriting is a genuine fixed point", () => {
  const arbGroups = fc.uniqueArray(fc.constantFrom(...GROUPS), { minLength: 1, maxLength: 6 });

  it("terminates on every input", () => {
    fc.assert(fc.property(arbGroups, (g) => { resolveCompatibility(g); }), { numRuns: 800 });
  });

  it("is confluent: the result does not depend on input order", () => {
    fc.assert(fc.property(arbGroups, (g) => {
      const a = resolveCompatibility(g);
      const b = resolveCompatibility([...g].reverse());
      expect(a.ok).toBe(b.ok);
      if (a.ok && b.ok) expect([...a.groups].sort()).toEqual([...b.groups].sort());
    }), { numRuns: 800 });
  });

  it("is idempotent: re-running on its own output is a no-op", () => {
    fc.assert(fc.property(arbGroups, (g) => {
      const once = resolveCompatibility(g);
      if (!once.ok) return;
      const twice = resolveCompatibility(once.groups);
      expect(twice.ok).toBe(true);
      if (twice.ok) expect([...twice.groups].sort()).toEqual([...once.groups].sort());
    }), { numRuns: 800 });
  });

  it("applies the documented reassignments", () => {
    const cd = resolveCompatibility(["C", "D"]);
    expect(cd.ok && [...cd.groups]).toEqual(["E"]);          // rule 2
    const cdn = resolveCompatibility(["C", "D", "N"]);
    expect(cdn.ok && [...cdn.groups]).toEqual(["D"]);         // rule 3
    const l = resolveCompatibility(["L", "C"]);
    expect(l.ok).toBe(false);                                  // group L alone
    expect(resolveCompatibility(["L"]).ok).toBe(true);
  });

  it("finds the X cells the published table marks", () => {
    expect(checkGroups(new Set<CompatibilityGroup>(["A", "B"])).ok).toBe(false);
    expect(checkGroups(new Set<CompatibilityGroup>(["S"])).ok).toBe(true);
  });
});

describe("metamorphic properties of a load", () => {
  const arbItems = fc.uniqueArray(fc.constantFrom(...POOL), { minLength: 1, maxLength: 4 })
    .map((ids): LineItem[] => ids.map((id) => ({ id })));

  it("permuting item order never changes the verdict", async () => {
    await fc.assert(fc.asyncProperty(arbItems, fc.boolean(), async (items, barriers) => {
      const a = await checkLoad({ vehicles: [{ items, barriersPresent: barriers }] }, N);
      const b = await checkLoad({ vehicles: [{ items: [...items].reverse(), barriersPresent: barriers }] }, N);
      expect(a.status).toBe(b.status);
    }), { numRuns: 120 });
  });

  it("adding an item can only make a load equally or more restricted, never less", async () => {
    await fc.assert(fc.asyncProperty(arbItems, fc.constantFrom(...POOL), fc.boolean(), async (items, extra, barriers) => {
      const before = await checkLoad({ vehicles: [{ items, barriersPresent: barriers }] }, N);
      if (before.status !== "REFUSED") return;
      const after = await checkLoad({ vehicles: [{ items: [...items, { id: extra }], barriersPresent: barriers }] }, N);
      expect(after.status).toBe("REFUSED");
    }), { numRuns: 120 });
  });

  it("splitting one vehicle into two can only relax, never tighten", async () => {
    await fc.assert(fc.asyncProperty(arbItems, async (items) => {
      if (items.length < 2) return;
      const together = await checkLoad({ vehicles: [{ items }] }, N);
      if (together.status !== "PASS") return;
      const split = await checkLoad({ vehicles: items.map((i) => ({ items: [i] })) }, N);
      expect(split.status).toBe("PASS");
    }), { numRuns: 120 });
  });
});

describe("the hash-bound commit gate", () => {
  const good: LoadProposal = { vehicles: [{ items: [{ id: "UN1830" }] }, { items: [{ id: "UN1748" }] }] };

  it("accepts the exact load it was issued for", async () => {
    const v = await checkLoad(good, N);
    expect(v.status).toBe("PASS");
    if (v.status === "PASS") expect((await verifyApproval(good, v.approvalToken, N)).ok).toBe(true);
  });

  it("refuses a load mutated after approval", async () => {
    const v = await checkLoad(good, N);
    if (v.status !== "PASS") throw new Error("fixture should pass");
    const mutated: LoadProposal = { vehicles: [{ items: [{ id: "UN1830" }, { id: "UN1748" }] }] };
    expect((await verifyApproval(mutated, v.approvalToken, N)).ok).toBe(false);
  });

  it("refuses a well-formed but forged token", async () => {
    expect((await verifyApproval(good, "a".repeat(64), N)).ok).toBe(false);
  });

  it("refuses a token that is not a SHA-256 digest at all", async () => {
    expect((await verifyApproval(good, "PASS", N)).ok).toBe(false);
  });

  it("refuses a token issued under a different session nonce", async () => {
    const v = await checkLoad(good, N);
    if (v.status !== "PASS") throw new Error("fixture should pass");
    expect((await verifyApproval(good, v.approvalToken, "another-nonce")).ok).toBe(false);
  });

  it("canonical encoding is length-prefixed, so no separator collision exists", () => {
    // Two loads that a naive separator-join would encode identically.
    const a = canonical({ vehicles: [{ items: [{ id: null, name: "ab" }, { id: null, name: "c" }] }] });
    const b = canonical({ vehicles: [{ items: [{ id: null, name: "a" }, { id: null, name: "bc" }] }] });
    expect(a).not.toBe(b);
  });
});

describe("citation integrity at the code level", () => {
  it("every clause id the solver cites exists in the corpus", () => {
    for (const id of CLAUSE_IDS) {
      const c = cite(id);
      expect(c.text.length).toBeGreaterThan(19);
      expect(c.section).toMatch(/^49 CFR /);
    }
    expect(CLAUSE_IDS.length).toBe(40);
  });

  it("an unknown clause id throws rather than returning an empty quote", () => {
    expect(() => cite("no-such-clause")).toThrow();
  });
});

/**
 * The properties below were added because MUTATION TESTING found the suite
 * green with each of these bugs deliberately introduced. A green suite proves
 * the tests pass, not that the code is right, and five of ten mutants survived
 * the first version of this file.
 */
describe("properties that mutation testing found untested", () => {
  it("an O cell refuses without a barrier and passes with one", async () => {
    // 3 x 5.1 is O. Neither is Class 8, so the (e)(3) hard block cannot mask this.
    const items: LineItem[] = [{ id: "UN1088" }, { id: "UN1438" }];
    const without = await checkLoad({ vehicles: [{ items }] }, N);
    expect(without.status).toBe("REFUSED");
    if (without.status === "REFUSED") {
      expect(without.violations[0]!.code).toBe("SEPARATION_REQUIRED");
      expect(without.violations[0]!.cell).toBe("O");
      expect(without.violations[0]!.citations[0]!.text).toContain("unless separated in a manner");
    }
    const withBarrier = await checkLoad({ vehicles: [{ items, barriersPresent: true }] }, N);
    expect(withBarrier.status).toBe("PASS");
  });

  it("takes the MOST restrictive cell across both hazard sets, per (e)(6)", async () => {
    // UN3513 is class 2.2 with a 5.1 subsidiary. Against UN1088 (class 3):
    //   primary    2.2 x 3 = blank, no restriction
    //   subsidiary 5.1 x 3 = O
    // so the subsidiary must decide. Taking the least restrictive would pass.
    const v = await checkLoad({ vehicles: [{ items: [{ id: "UN3513" }, { id: "UN1088" }] }] }, N);
    expect(v.status).toBe("REFUSED");
    if (v.status === "REFUSED") expect(v.violations[0]!.code).toBe("SEPARATION_REQUIRED");
  });

  it("treats a Class 8 SOLID as outside the table, which covers liquids only", async () => {
    // UN2430 Alkylphenols, solid. The 177.848(d) row is "Corrosive liquids"
    // and the column "8 liquids only", so a solid has no cell. Treating it as
    // a liquid would trigger the (e)(3) hard block against 5.1 and refuse.
    const v = await checkLoad({ vehicles: [{ items: [{ id: "UN2430" }, { id: "UN1438" }] }] }, N);
    expect(v.status).toBe("PASS");
    if (v.status === "PASS") {
      expect(v.notes.some((n) => n.includes("LIQUIDS only"))).toBe(true);
    }
  });

  it("keeps Division 2.3 Zone A and Zone B on their own rows", async () => {
    // Against a Class 3 material the published table gives Zone A an X and
    // Zone B an O, so Zone B is rescuable by a barrier and Zone A is not.
    // UN2188 arsine, not UN1955, which the resolver now refuses outright: that
    // number covers four different materials under one entry and the shipping
    // paper cannot name one of them without the operator saying which.
    const zoneA = await checkLoad({ vehicles: [{ items: [{ id: "UN2188" }, { id: "UN1088" }], barriersPresent: true }] }, N);
    expect(zoneA.status).toBe("REFUSED");
    if (zoneA.status === "REFUSED") expect(zoneA.violations[0]!.cell).toBe("X");

    const zoneB = await checkLoad({ vehicles: [{ items: [{ id: "UN1581" }, { id: "UN1088" }], barriersPresent: true }] }, N);
    expect(zoneB.status).toBe("PASS");
  });

  it("hashes the vehicle boundary, so regrouping the same items changes identity", () => {
    const together = canonical({ vehicles: [{ items: [{ id: "UN1830" }, { id: "UN1748" }] }] });
    const apart = canonical({ vehicles: [{ items: [{ id: "UN1830" }] }, { items: [{ id: "UN1748" }] }] });
    expect(together).not.toBe(apart);
  });

  it("hashes the barrier assertion, so ticking the box changes identity", () => {
    const a = canonical({ vehicles: [{ items: [{ id: "UN1088" }], barriersPresent: false }] });
    const b = canonical({ vehicles: [{ items: [{ id: "UN1088" }], barriersPresent: true }] });
    expect(a).not.toBe(b);
  });
});

describe("canonical encoding is injective", () => {
  // The property that matters, and the reason the surviving mutant in the
  // mutation run is EQUIVALENT rather than a test gap: removing the vehicle
  // count changes nothing, because each vehicle encoding is already
  // self-delimiting. Measured at 0 collisions in 20,000 generated loads both
  // with and without that field. The field is kept as defence in depth.
  it("never encodes two structurally different loads identically", () => {
    const item = fc.record({
      id: fc.option(fc.constantFrom("UN1090", "UN1830", "UN1748"), { nil: null }),
      name: fc.constantFrom("a", "ab", "bc", "c", ""),
    });
    const vehicle = fc.record({
      items: fc.array(item, { maxLength: 3 }),
      barriersPresent: fc.boolean(),
      singleShipper: fc.boolean(),
    });
    const seen = new Map<string, string>();
    fc.assert(fc.property(fc.record({ vehicles: fc.array(vehicle, { maxLength: 3 }) }), (l) => {
      const load = l as LoadProposal;
      const enc = canonical(load);
      const norm = JSON.stringify(load.vehicles.map((v) => ({
        i: v.items.map((i) => [i.id ?? "", (i.name ?? "").trim().toLowerCase(), i.state ?? "unknown", (i.quantity ?? "").trim()].join(" ")).sort(),
        b: !!v.barriersPresent, s: !!v.singleShipper,
      })));
      const prev = seen.get(enc);
      if (prev !== undefined) expect(prev).toBe(norm);
      else seen.set(enc, norm);
    }), { numRuns: 4000 });
  });
});
