/**
 * Exhaustive enumeration of both published tables.
 *
 * These do not test a remembered number. Every expected value is re-derived
 * from the committed corpus inside the test, and the shape assertions
 * (18x18, 13x13, symmetry, totality of the row-to-column map) are properties
 * the REGULATION has, which is what makes them worth asserting.
 */
import { describe, it, expect } from "vitest";
import { SEGREGATION, COMPATIBILITY, ROW_TO_COLUMN, segregationCell } from "../src/solver/index.ts";
import type { MatrixKey } from "../src/solver/types.ts";

const KEYS = Object.keys(ROW_TO_COLUMN) as MatrixKey[];

describe("177.848(d) segregation table", () => {
  it("is 18 rows by 18 columns", () => {
    expect(SEGREGATION.rows).toHaveLength(18);
    expect(SEGREGATION.columns).toHaveLength(18);
  });

  it("keeps Division 2.3 Zone A and Zone B as separate rows", () => {
    const twoThree = SEGREGATION.rows.filter((r) => r.division === "2.3");
    expect(twoThree).toHaveLength(2);
    expect(new Set(twoThree.map((r) => r.key)).size).toBe(2);
    expect(twoThree.map((r) => r.label).sort()).toEqual(["Poisonous gas Zone A", "Poisonous gas Zone B"]);
  });

  it("has a total row-to-column map, and every mapped column exists", () => {
    expect(KEYS).toHaveLength(18);
    for (const k of KEYS) {
      expect(SEGREGATION.rows.some((r) => r.key === k), `row ${k}`).toBe(true);
      expect(SEGREGATION.columns).toContain(ROW_TO_COLUMN[k]);
    }
  });

  it("enumerates all 324 cells with no undefined", () => {
    let n = 0;
    for (const a of KEYS) for (const b of KEYS) { expect(typeof segregationCell(a, b)).toBe("string"); n++; }
    expect(n).toBe(324);
  });

  it("is symmetric, which the regulation requires and a bad parse would break", () => {
    const asym: string[] = [];
    for (const a of KEYS) for (const b of KEYS) {
      if (segregationCell(a, b) !== segregationCell(b, a)) asym.push(`${a} x ${b}`);
    }
    expect(asym).toEqual([]);
  });

  it("censuses to the values derived from the pinned snapshot", () => {
    const c: Record<string, number> = { X: 0, O: 0, "*": 0, blank: 0 };
    for (const r of SEGREGATION.rows) for (const col of SEGREGATION.columns) {
      const v = r.cells[col]!;
      c[v === "" ? "blank" : v] = (c[v === "" ? "blank" : v] ?? 0) + 1;
    }
    // Cross-checked against the census the extractor recorded, so the two
    // must agree or one of them drifted.
    expect(c).toEqual({ X: SEGREGATION.census.X, O: SEGREGATION.census.O, "*": SEGREGATION.census["*"], blank: SEGREGATION.census.blank });
    expect(c.X! + c.O! + c["*"]! + c.blank!).toBe(324);
  });

  it("has a blank diagonal except Class 1, which routes to the compatibility table", () => {
    for (const k of KEYS) {
      const self = segregationCell(k, k);
      expect(self, `${k} against itself`).toBe(k.startsWith("1.") ? "*" : "");
    }
  });
});

describe("177.848(f) compatibility table", () => {
  it("is 13 by 13 with 169 cells", () => {
    expect(COMPATIBILITY.groups).toHaveLength(13);
    let n = 0;
    for (const a of COMPATIBILITY.groups) for (const b of COMPATIBILITY.groups) {
      expect(COMPATIBILITY.matrix[a]?.[b], `${a} x ${b}`).toBeDefined();
      n++;
    }
    expect(n).toBe(169);
  });

  it("preserves the compound cell codes X(4) and 4/5", () => {
    const codes = new Set(COMPATIBILITY.groups.flatMap((a) => COMPATIBILITY.groups.map((b) => COMPATIBILITY.matrix[a]![b]!)));
    expect(codes.has("X(4)")).toBe(true);
    expect(codes.has("4/5")).toBe(true);
  });
});
