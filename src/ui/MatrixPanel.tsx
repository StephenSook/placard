/**
 * THE 177.848(d) TABLE, rendered as itself.
 *
 * The headline number of this project is that the table alone clears 792
 * configurations of which the regulation forbids 24. Until now that was a
 * sentence. This is the table it is a sentence about: 18 rows, 18 columns, 324
 * cells, with the divergent ones marked.
 *
 * ACCESSIBILITY IS NOT OPTIONAL IN A MATRIX. A cell means nothing without both
 * its row and its column, so every cell carries `headers` naming both, per WCAG
 * technique H43, and the code is never conveyed by colour alone: X, O and the
 * asterisk are printed as text and each cell has a full text label for assistive
 * technology. The 18 row names are the regulation's own wording.
 */
import { useMemo, useState } from "react";
import { ROW_TO_COLUMN, SEGREGATION, segregationCell } from "../solver/corpus.ts";
import { CATEGORIES, measureDivergence } from "../evidence/divergence.ts";
import type { MatrixKey } from "../solver/types.ts";
import "./matrix.css";

const MEANING: Record<string, string> = {
  X: "may not be loaded, transported or stored together",
  O: "may not be loaded together unless separated",
  "*": "governed by the 177.848(f) compatibility table",
  "": "no restriction applies",
};

export function MatrixPanel({ highlight }: { highlight?: ReadonlyArray<MatrixKey> }) {
  const [focus, setFocus] = useState<{ a: MatrixKey; b: MatrixKey } | null>(null);

  // Computed once. The divergent pairs are the ones the table clears and the
  // full regulation refuses, which is the entire argument of this project.
  const divergentPairs = useMemo(() => {
    // Keyed on MATRIX KEYS, not material names. An earlier version read these
    // out of `examples`, whose a and b are chemical names, so the set never
    // matched a single cell and the panel silently ringed nothing while
    // claiming in its own caption that it did.
    const d = measureDivergence();
    return new Set(d.divergentPairs.map(([a, b]) => `${a}::${b}`));
  }, []);

  const lit = new Set(highlight ?? []);
  const cellFor = (a: MatrixKey, b: MatrixKey) => {
    try { return segregationCell(a, b); } catch { return ""; }
  };

  return (
    <section className="matrix" aria-labelledby="matrix-heading">
      <header className="matrix__head">
        <div>
          <p className="matrix__eyebrow mono">49 CFR 177.848(d)</p>
          <h2 id="matrix-heading" className="matrix__title">The table itself</h2>
        </div>
        <dl className="matrix__legend">
          {(["X", "O", "*", ""] as const).map((c) => (
            <div key={c || "blank"} className="matrix__legendItem">
              <dt className={`mcell mcell--${c === "" ? "blank" : c === "*" ? "star" : c} mono`} aria-hidden="true">
                {c === "" ? " " : c}
              </dt>
              <dd>{MEANING[c]}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="matrix__scroll">
        <table className="matrix__table">
          <caption className="sr-only">
            The 49 CFR 177.848(d) segregation table. 18 rows by 18 columns, 324 cells. Each cell
            gives the restriction between the hazard class in its row and the hazard class in its
            column.
          </caption>
          <thead>
            <tr>
              <td className="matrix__corner" />
              {CATEGORIES.map((c, i) => (
                <th key={c} id={`mc-${i}`} scope="col" className="matrix__colhead">
                  <span className="matrix__colLabel">{ROW_TO_COLUMN[c]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((a, ri) => (
              <tr key={a}>
                <th id={`mr-${ri}`} scope="row" className="matrix__rowhead">
                  {SEGREGATION.rows[ri]?.label ?? a}
                </th>
                {CATEGORIES.map((b, ci) => {
                  const code = cellFor(a, b);
                  const isDivergent = divergentPairs.has(`${a}::${b}`);
                  const isLit = lit.has(a) && lit.has(b);
                  return (
                    <td
                      key={b}
                      headers={`mr-${ri} mc-${ci}`}
                      className={
                        `mcell mcell--${code === "" ? "blank" : code === "*" ? "star" : code}` +
                        (isDivergent ? " mcell--divergent" : "") +
                        (isLit ? " mcell--lit" : "")
                      }
                      onMouseEnter={() => setFocus({ a, b })}
                      onFocus={() => setFocus({ a, b })}
                      tabIndex={0}
                    >
                      <span aria-hidden="true" className="mono">{code === "" ? "" : code}</span>
                      <span className="sr-only">
                        {SEGREGATION.rows[ri]?.label ?? a} with {ROW_TO_COLUMN[b]}: {MEANING[code]}
                        {isDivergent ? ". The table clears this and another clause of the regulation forbids it." : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="matrix__readout mono" role="status">
        {focus
          ? `${SEGREGATION.rows[CATEGORIES.indexOf(focus.a)]?.label ?? focus.a}  /  ${ROW_TO_COLUMN[focus.b]}  =  ${cellFor(focus.a, focus.b) || "blank"}  ${MEANING[cellFor(focus.a, focus.b)]}`
          : "Hover or tab a cell to read it."}
      </p>

      <p className="matrix__note">
        Cells ringed in red are ones the table CLEARS and another clause of the regulation forbids
        anyway, on grounds the table does not express. An agent reading only this page of the
        regulation walks into them.
      </p>
    </section>
  );
}
