/**
 * THE HAZARD RAIL.
 *
 * The reference site carries a persistent left rail of numbered cards, each a
 * different saturated colour. Here that rail is the 49 CFR 172 Subpart F
 * placard colour code, with a live count of what is currently on the manifest
 * in each family. So the one piece of the layout that is pure decoration on
 * the reference is, here, both the legend a newcomer needs and the tally an
 * operator needs. Colour is doing work rather than being applied.
 *
 * The labels are the regulation's own words, taken from the 177.848(d) row
 * headings in the committed corpus, not paraphrased.
 */
import { useMemo } from "react";
import type { ResolvedItem } from "../solver/types.ts";
import "./rail.css";

type Family = {
  n: string;
  /** The regulation's own label. */
  label: string;
  /** Which hazard classes fall in this placard family. */
  test: (cls: string) => boolean;
  swatch: string;
  /** Ink that reads on the swatch. Checked by a contrast test. */
  ink: string;
};

/**
 * Eight placard families. Not eighteen: the 177.848(d) table has eighteen rows
 * but only eight placard colour schemes, and the rail is a colour legend.
 */
export const FAMILIES: Family[] = [
  { n: "01", label: "Explosives", test: (c) => /^1\./.test(c), swatch: "var(--hz-explosive)", ink: "#101010" },
  { n: "02", label: "Flammable", test: (c) => ["2.1", "3", "4.1", "4.2"].includes(c), swatch: "var(--hz-flammable)", ink: "#ffffff" },
  { n: "03", label: "Non-flammable gases", test: (c) => c === "2.2", swatch: "var(--hz-nonflam)", ink: "#ffffff" },
  { n: "04", label: "Dangerous when wet", test: (c) => c === "4.3", swatch: "var(--hz-wet)", ink: "#ffffff" },
  { n: "05", label: "Oxidizers", test: (c) => ["5.1", "5.2"].includes(c), swatch: "var(--hz-oxidizer)", ink: "#101010" },
  { n: "06", label: "Poisons", test: (c) => ["2.3", "6.1"].includes(c), swatch: "var(--hz-toxic)", ink: "#101010" },
  { n: "07", label: "Radioactive", test: (c) => c === "7", swatch: "var(--hz-radioactive)", ink: "#101010" },
  { n: "08", label: "Corrosive liquids", test: (c) => c === "8", swatch: "var(--hz-corrosive)", ink: "#ffffff" },
];

export function HazardRail({ items }: { items: ResolvedItem[] }) {
  const counts = useMemo(() => {
    const c = FAMILIES.map(() => 0);
    let forbidden = 0;
    for (const it of items) {
      if (it.forbidden) { forbidden++; continue; }
      // Count every hazard the material presents, primary and subsidiary,
      // because both drive segregation under 177.848(e)(6).
      const seen = new Set<number>();
      for (const h of it.hazards) {
        FAMILIES.forEach((f, i) => { if (f.test(h.raw) && !seen.has(i)) { seen.add(i); c[i] = (c[i] ?? 0) + 1; } });
      }
    }
    return { c, forbidden };
  }, [items]);

  return (
    <nav className="rail" aria-label="Hazard classes on this manifest">
      <p className="rail__title mono">Placard colours</p>

      <ul className="rail__list">
        {FAMILIES.map((f, i) => {
          const n = counts.c[i] ?? 0;
          return (
            <li key={f.n} className={"rail__card" + (n > 0 ? " is-present" : "")}>
              <span
                className="rail__swatch"
                data-swatch={f.n}
                aria-hidden="true"
              />
              <span className="rail__n mono">{f.n}</span>
              <span className="rail__label">{f.label}</span>
              <span className="rail__count mono">
                {n}
                {/* The number alone is ambiguous to a screen reader here. */}
                <span className="sr-only"> {n === 1 ? "item" : "items"} on the manifest</span>
              </span>
            </li>
          );
        })}
      </ul>

      {counts.forbidden > 0 && (
        <p className="rail__forbidden">
          <strong>{counts.forbidden}</strong> forbidden{" "}
          {counts.forbidden === 1 ? "material" : "materials"}. No placard exists for these: they may
          not be offered for transportation at all.
        </p>
      )}
    </nav>
  );
}
