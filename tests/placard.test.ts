/**
 * Placard correctness.
 *
 * These exist because visual review caught a defect that no typecheck and no
 * logic test could: on a SPLIT placard the class number sits in the LOWER
 * field, and Class 8 is white over black, so painting the number in the
 * upper field's ink produced black on black. The placard rendered, the build
 * passed, and the identification was simply invisible.
 *
 * A placard whose number cannot be read is not a placard. That is a
 * correctness property, not a style preference, so it is tested.
 */
import { describe, it, expect } from "vitest";
import { placardFor } from "../src/ui/Placard.tsx";

/**
 * Resolve a token to its real hex, then compute WCAG relative luminance and a
 * contrast ratio. A crude light/dark heuristic is not good enough here: white
 * on the Class 4 red is correct and readable, and a naive test flags it. The
 * question is not "are these both light", it is "can the number be read".
 */
const TOKENS: Record<string, string> = {
  "var(--hz-explosive)": "#f26b21",
  "var(--hz-flammable)": "#d8232a",
  "var(--hz-nonflam)": "#00843d",
  "var(--hz-wet)": "#0057b8",
  "var(--hz-oxidizer)": "#ffd100",
  "var(--hz-toxic)": "#ffffff",
  "var(--hz-radioactive)": "#ffd100",
  "var(--hz-corrosive)": "#101010",
  "var(--paper-deep)": "#ebdfd5",
  "var(--ink-faint)": "#97897c",
};

function hex(colour: string): string {
  const c = colour.trim();
  return TOKENS[c] ?? c;
}

function luminance(colour: string): number {
  const h = hex(colour).replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Every class that appears in the 177.848(d) table, plus 9 and Forbidden. */
const CLASSES = [
  "1.1D", "1.4S", "2.1", "2.2", "2.3", "3", "4.1", "4.2", "4.3",
  "5.1", "5.2", "6.1", "7", "8", "9", "Forbidden",
];

describe("hazard placards", () => {
  it("resolves every hazard class the corpus can produce", () => {
    for (const c of CLASSES) {
      const spec = placardFor(c);
      expect(spec.top, c).toBeTruthy();
      expect(spec.label, c).toBeTruthy();
    }
  });

  it("gives every split placard a number ink readable against its LOWER field", () => {
    // The bug this test exists for. On a split placard the number sits in the
    // bottom half, so its ink must contrast with the bottom, not the top.
    // Class 8 is white over black; painting the number in the upper field's
    // ink produced black on black and the identification vanished.
    for (const c of CLASSES) {
      const spec = placardFor(c);
      if (!spec.bottom) continue;
      expect(spec.numberInk, `class ${c} is split and must declare numberInk`).toBeDefined();
      const ratio = contrast(spec.numberInk!, spec.bottom);
      // 4.5:1 is the WCAG AA threshold for normal text. The placard number is
      // large and bold, so 3:1 would be defensible, but a hazard placard read
      // across a loading dock deserves the stricter bar.
      expect(ratio, `class ${c}: number ${spec.numberInk} on field ${spec.bottom} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the number readable on every SOLID placard too", () => {
    for (const c of CLASSES) {
      const spec = placardFor(c);
      if (spec.bottom || c === "Forbidden") continue;
      const ratio = contrast(spec.numberInk ?? spec.ink, spec.top);
      expect(ratio, `class ${c}: ${spec.numberInk ?? spec.ink} on ${spec.top} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("draws Class 8 as white over black with a white number, per Subpart F", () => {
    const s = placardFor("8");
    expect(s.top).toBe("#ffffff");
    expect(s.bottom).toBe("var(--hz-corrosive)");
    expect(s.numberInk).toBe("#ffffff");
    expect(s.label).toBe("Corrosive");
  });

  it("maps every Class 1 division to the explosive placard and keeps its group", () => {
    for (const c of ["1.1B", "1.1D", "1.2G", "1.3C", "1.4S", "1.5D", "1.6N"]) {
      expect(placardFor(c).top, c).toBe("var(--hz-explosive)");
      expect(placardFor(c).label, c).toBe("Explosive");
    }
  });

  it("gives a Forbidden material no placard, because it has no lawful configuration", () => {
    const s = placardFor("Forbidden");
    expect(s.label).toBe("No placard");
    expect(s.bottom).toBeUndefined();
  });

  it("labels every placard in words, so colour never carries meaning alone", () => {
    // WCAG 1.4.1. The label becomes the accessible name of the SVG.
    const labels = CLASSES.map((c) => placardFor(c).label);
    expect(labels.every((l) => l.length > 3)).toBe(true);
    expect(new Set(labels).size).toBeGreaterThan(8);
  });
});
