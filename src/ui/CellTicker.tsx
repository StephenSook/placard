/**
 * THE CELL TICKER.
 *
 * The reference site runs a saturated marquee ribbon of short phrases with
 * glyph separators. Here that ribbon carries the actual instructions for
 * reading the segregation table, taken VERBATIM from 49 CFR 177.848(e) in the
 * committed corpus.
 *
 * So the most decorative element in the layout is also the only place a
 * newcomer learns what X, O and the asterisk mean, which is the vocabulary
 * every other surface on the page assumes. Ornament that teaches.
 *
 * MOTION IS NOT DECORATION HERE EITHER, AND IT IS OPTIONAL. The marquee is
 * CSS-only, pauses on hover and on focus, and stops entirely under
 * prefers-reduced-motion, where the strip becomes a static, scrollable list.
 * A compliance tool must never require motion to be readable.
 */
import { useMemo } from "react";
import { cite } from "../solver/index.ts";
import "./ticker.css";

/** The four cell codes, each paired with the clause that defines it. */
const CODES = [
  { glyph: "X", id: "e2-X" },
  { glyph: "O", id: "e3-O" },
  { glyph: "*", id: "e4-asterisk" },
  { glyph: "blank", id: "e1-blank" },
] as const;

/** Trim a clause to its operative phrase for a strip, without paraphrasing. */
function shorten(text: string, max = 128): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf(" "));
  // An ellipsis makes the truncation visible, so nobody reads a clipped clause
  // as the whole clause.
  return `${cut.slice(0, stop > 40 ? stop : max)}...`;
}

export function CellTicker() {
  const entries = useMemo(
    () =>
      CODES.map(({ glyph, id }) => {
        const c = cite(id);
        return { glyph, section: c.section, text: shorten(c.text) };
      }),
    []
  );

  const strip = (
    <ul className="ticker__strip">
      {entries.map((e) => (
        <li key={e.glyph} className="ticker__item">
          <span className="ticker__glyph mono" aria-hidden="true">
            {e.glyph}
          </span>
          <span className="ticker__text">
            <span className="sr-only">Cell code {e.glyph}. </span>
            {e.text}
          </span>
          <span className="ticker__cite mono">{e.section}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <aside className="ticker" aria-label="How to read the 49 CFR 177.848 segregation table">
      <div className="ticker__track">
        {strip}
        {/* A duplicate for the seamless loop. Hidden from assistive tech so the
            same four clauses are not announced twice. */}
        <div aria-hidden="true">{strip}</div>
      </div>
    </aside>
  );
}
