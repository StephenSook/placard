/**
 * THE SUBSTITUTION THAT WAS IN THE PAGE'S OWN INPUT BOX.
 *
 * Manual entry took the first lookup match and added it. Typing "sulfuric
 * acid", the material in this project's own headline demonstration, put UN2584
 * Alkyl sulfonic acids on the manifest: a different material in a different
 * hazard class, with no signal of any kind. Typing something the table does not
 * contain did nothing at all, which reads to a person as accepted.
 *
 * The whole argument of this project is that an index which silently returns
 * the wrong entry is worse than one that returns nothing, and the page was
 * doing exactly that to its own operator.
 */
import { describe, it, expect } from "vitest";
import { chooseMaterial } from "../src/tools/executors.ts";

describe("manual entry never substitutes one material for another", () => {
  it("refuses the query that used to add the wrong material", () => {
    // Reproduced before the fix: this returned UN2584, Alkyl sulfonic acids.
    const c = chooseMaterial("sulfuric acid");
    expect(c.kind).toBe("ambiguous");
    if (c.kind !== "ambiguous") return;
    expect(c.candidates.length).toBeGreaterThan(1);
    // And the refusal has to be usable: the entry the operator actually wanted
    // must be among the candidates it names, or refusing is just a dead end.
    expect(c.candidates.some((m) => m.id === "UN1830")).toBe(true);
  });

  it("takes an identification number, which names exactly one entry", () => {
    const c = chooseMaterial("UN1830");
    expect(c.kind).toBe("one");
    if (c.kind !== "one") return;
    expect(c.match.id).toBe("UN1830");
    expect(c.exact).toBe(true);
  });

  it("takes an exact proper shipping name even when it is a prefix of others", () => {
    // "Acetone" matches eight entries by substring, including Acetone oils and
    // Acetone cyanohydrin. The exact name has to win, or the fix would make the
    // page unusable for its own demonstration manifest.
    const c = chooseMaterial("Acetone");
    expect(c.kind).toBe("one");
    if (c.kind !== "one") return;
    expect(c.match.id).toBe("UN1090");
    expect(c.exact).toBe(true);
  });

  it("takes a Forbidden material by name, which has no identification number", () => {
    // The one case where a name is the ONLY way in. If refusing on ambiguity
    // had swept these up, the fix would have re-created the defect the whole
    // project exists to expose.
    const c = chooseMaterial("Ammonium chlorate");
    expect(c.kind).toBe("one");
    if (c.kind !== "one") return;
    expect(c.match.id).toBeNull();
    expect(c.match.forbidden).toBe(true);
  });

  it("is case and whitespace insensitive on the exact match", () => {
    for (const q of ["  ammonium   chlorate ", "AMMONIUM CHLORATE", "un1830", "UN 1830"]) {
      const c = chooseMaterial(q);
      expect(c.kind, q).toBe("one");
    }
  });

  it("says nothing matched rather than doing nothing", () => {
    expect(chooseMaterial("xyzzy").kind).toBe("none");
    expect(chooseMaterial("   ").kind).toBe("none");
  });
});
