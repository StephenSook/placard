/**
 * Tests for the published headline number.
 *
 * The danger with a number that goes on a judge-facing page is not that it is
 * wrong by a little. It is that the computation quietly becomes VACUOUS, keeps
 * returning a plausible integer, and nobody notices. So these tests assert the
 * work actually happened, not merely that the output has the right shape.
 */
import { describe, it, expect } from "vitest";
import {
  CATEGORIES, measureDivergence, measureForbidden, representatives, tableAloneClears,
} from "../src/evidence/divergence.ts";
import { HMT, SEGREGATION, segregationCell } from "../src/solver/corpus.ts";
import { resolveItem } from "../src/solver/hazards.ts";
import type { MatrixKey, ResolvedItem } from "../src/solver/types.ts";

describe("the naive reading of the table", () => {
  it("is the GENEROUS one, so the published gap is not inflated", () => {
    // X refuses outright.
    expect(tableAloneClears("X", false)).toBe(false);
    expect(tableAloneClears("X", true)).toBe(false);
    // O is "separate them", so a barrier clears it and its absence does not.
    expect(tableAloneClears("O", true)).toBe(true);
    expect(tableAloneClears("O", false)).toBe(false);
    // A blank imposes nothing and * routes elsewhere: both clear.
    expect(tableAloneClears("", false)).toBe(true);
    expect(tableAloneClears("*", false)).toBe(true);
  });
});

describe("representatives", () => {
  it("is in the REGULATION'S row order, not JavaScript's key order", () => {
    // Object.keys hoists integer-like keys, so deriving CATEGORIES from
    // ROW_TO_COLUMN put classes 3, 7 and 8 in front of division 1.1 and
    // transposed the rendered table against its own row labels. All 18 rows
    // were captioned with one hazard class and filled with another's data.
    expect(CATEGORIES).toEqual(SEGREGATION.rows.map((r) => r.key));
    expect(CATEGORIES[0]).toBe("1.1 and 1.2");
    expect(CATEGORIES).toHaveLength(18);
  });

  it("covers every one of the 18 categories", () => {
    const reps = representatives();
    expect(CATEGORIES).toHaveLength(18);
    expect(reps.size).toBe(18);
  });

  it("draws only REAL entries from the committed table, never a constructed one", () => {
    const byUn = new Map(HMT.filter((e) => e.un).map((e) => [e.un, e]));
    for (const [, entry] of representatives()) {
      expect(byUn.get(entry.un)).toBeDefined();
      expect(entry.forbidden).toBe(false);
    }
  });

  it("picks single-category entries, so each pair is a clean category comparison", () => {
    // A representative resolving to TWO categories would make worstCell do
    // hidden work under (e)(6), and the pair would no longer measure the two
    // categories it claims to measure. Mutation testing found this unasserted.
    for (const [key, entry] of representatives()) {
      const r = resolveItem({ id: entry.un, name: entry.name });
      expect(r, `${entry.name} failed to resolve`).not.toHaveProperty("error");
      const keys = (r as ResolvedItem).hazards
        .map((h) => h.matrixKey)
        .filter((k): k is MatrixKey => k !== null);
      expect(keys).toEqual([key]);
    }
  });

  it("is deterministic across runs, since the number is published", () => {
    const a = [...representatives()].map(([k, e]) => `${k}=${e.un}`).sort();
    const b = [...representatives()].map(([k, e]) => `${k}=${e.un}`).sort();
    expect(a).toEqual(b);
  });
});

describe("measureDivergence", () => {
  const d = measureDivergence();

  it("examines every ordered pair in every configuration, with nothing skipped", () => {
    // 18 categories, ordered pairs, times barrier and shipper states.
    expect(d.configurationsExamined).toBe(18 * 18 * 2 * 2);
    expect(d.unrepresented).toEqual([]);
  });

  it("is NOT vacuous: the naive arm both clears and refuses real configurations", () => {
    // A measure where the naive arm cleared everything, or nothing, would be
    // broken while still reporting a number. Both arms must do real work.
    expect(d.tableAloneClears).toBeGreaterThan(0);
    expect(d.tableAloneClears).toBeLessThan(d.configurationsExamined);
    expect(d.regulationRefuses).toBeGreaterThan(0);
    expect(d.regulationRefuses).toBeLessThan(d.configurationsExamined);
  });

  it("finds a gap, and attributes every divergent case to a named ground", () => {
    expect(d.divergent).toBeGreaterThan(0);
    const summed = Object.values(d.byGround).reduce((a, b) => a + b, 0);
    expect(summed).toBe(d.divergent);
  });

  it("never reports a divergence the naive arm did not actually clear", () => {
    expect(d.divergent).toBeLessThanOrEqual(d.tableAloneClears);
    for (const e of d.examples) {
      expect(tableAloneClears(e.cell === "(blank)" ? "" : e.cell, e.barriersPresent)).toBe(true);
    }
  });

  it("exposes divergent pairs as MATRIX KEYS a renderer can actually match", () => {
    // The matrix panel rings these cells. It originally derived them from
    // `examples`, whose a and b are chemical NAMES, so it matched nothing and
    // ringed nothing while its own caption claimed otherwise. Keys, not names.
    expect(d.divergentPairs.length).toBeGreaterThan(0);
    for (const [a, b] of d.divergentPairs) {
      expect(CATEGORIES, `${a} is not a matrix key`).toContain(a);
      expect(CATEGORIES, `${b} is not a matrix key`).toContain(b);
      // Each named pair must really be one the table clears.
      const cell = segregationCell(a, b);
      expect(["", "O", "*"], `${a}/${b} is cell ${cell}, which the table does not clear`).toContain(cell);
    }
  });

  it("cites a real clause on every example, never an empty string", () => {
    expect(d.examples.length).toBeGreaterThan(0);
    for (const e of d.examples) expect(e.clause).toMatch(/^49 CFR 177\.848/);
  });

  it("keeps the (e)(3) hard block in the gap, since a barrier does not rescue it", () => {
    // The signature case: the table clears the pair, a barrier is asserted, and
    // the regulation still refuses. Asserted against byGround, which counts
    // EVERY divergent configuration, rather than against `examples`, which is
    // capped at twelve. The capped version broke the moment the iteration order
    // changed, which made it a test of the sample rather than of the property.
    expect(d.byGround["CORROSIVE_OVER_OXIDIZER"] ?? 0).toBeGreaterThan(0);
    // And the pair really is one the table itself clears.
    const pair = d.divergentPairs.find(([a, b]) => a === "8" || b === "8");
    expect(pair, "no Class 8 pair among the divergent set").toBeDefined();
    expect(["", "O", "*"]).toContain(segregationCell(pair![0], pair![1]));
  });
});

describe("measureForbidden", () => {
  const f = measureForbidden();

  it("reports the 256, and that an id-keyed index recovers NONE of them", () => {
    expect(f.forbiddenEntries).toBe(256);
    expect(f.forbiddenCarryingAnIdentificationNumber).toBe(0);
    expect(f.recoverableByIdKeyedLookup).toBe(0);
    expect(f.recoverableByThisIndex).toBe(256);
  });

  it("names real materials rather than an empty sample", () => {
    expect(f.sample.length).toBeGreaterThan(0);
    for (const n of f.sample) expect(n.length).toBeGreaterThan(3);
  });
});
