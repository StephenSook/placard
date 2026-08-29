/**
 * THE VERDICT CARD. The signature of this interface and the opening frame of
 * the demo.
 *
 * Two real hazard placards, the 177.848(d) cell code struck between them, and
 * the governing clause stamped underneath on paper. The whole product in one
 * frame: a person can see what conflicts, why, and read the exact federal
 * sentence that decides it, without knowing anything about the app.
 *
 * THE ONE ORCHESTRATED MOTION IN THIS APP LIVES HERE. On a refusal the two
 * placards slide toward each other and the clause stamps across once, at
 * 240ms, with a slight overshoot. Everything else in the interface is quiet.
 * Spending the entire motion budget in one place is the point: a judge
 * watching a five-minute demo remembers one moment, so there should be one.
 *
 * ACCESSIBILITY IS NOT DECORATION HERE. The cell code is never carried by
 * colour alone (WCAG 1.4.1): every state ships a text token, PROHIBITED,
 * SEPARATE or SEE 177.848(f). The refusal is announced in a live region that
 * exists in the initial HTML rather than being injected, so assistive
 * technology has registered it before the first verdict lands.
 */
import { useEffect, useRef, useState } from "react";
import { Placard } from "./Placard.tsx";
import type { Citation, Violation } from "../solver/types.ts";
import "./verdict.css";

export type VerdictCardProps = {
  status: "PASS" | "REFUSED" | "IDLE";
  /** The violation to feature. The first one is the one that decided it. */
  violation?: Violation | undefined;
  /** Hazard classes of the two conflicting items, for the placards. */
  pair?: [string, string] | undefined;
  /** Names of the two conflicting items. */
  names?: [string, string] | undefined;
  /** How many pairwise comparisons the solver actually ran. */
  pairsChecked?: number;
};

/** The text token for a cell code. Colour never carries this alone. */
function cellToken(cell: string | undefined, code: string): { glyph: string; token: string } {
  if (code === "FORBIDDEN_MATERIAL") return { glyph: "!", token: "FORBIDDEN" };
  if (code === "CORROSIVE_OVER_OXIDIZER") return { glyph: "X", token: "NO SEPARATION SUFFICES" };
  switch (cell) {
    case "X": return { glyph: "X", token: "PROHIBITED" };
    case "O": return { glyph: "O", token: "SEPARATE" };
    case "*": return { glyph: "*", token: "SEE 177.848(f)" };
    default: return { glyph: "X", token: "PROHIBITED" };
  }
}

export function VerdictCard({ status, violation, pair, names, pairsChecked = 0 }: VerdictCardProps) {
  const [stamped, setStamped] = useState(false);
  const key = `${status}:${violation?.code ?? ""}:${violation?.items.join("-") ?? ""}`;
  // Seeded empty, NOT with the first key. Seeding it with the first key made
  // the effect early-return on mount, so the very first verdict never stamped
  // and the cell glyph stayed at opacity 0. The one animation in the app did
  // not play the one time it matters most.
  const prev = useRef<string | null>(null);

  // Replay the stamp whenever the verdict actually changes, including the
  // first time it arrives, but not on every unrelated re-render.
  useEffect(() => {
    if (prev.current === key) return;
    prev.current = key;
    setStamped(false);
    const t = window.setTimeout(() => setStamped(true), 20);
    return () => window.clearTimeout(t);
  }, [key]);

  const refused = status === "REFUSED";
  const { glyph, token } = cellToken(violation?.cell, violation?.code ?? "");
  const citation: Citation | undefined = violation?.citations[0];

  return (
    <section
      className={`verdict verdict--${status.toLowerCase()}${stamped ? " is-stamped" : ""}`}
      aria-labelledby="verdict-heading"
    >
      <header className="verdict__head">
        <h2 id="verdict-heading" className="verdict__title">
          {status === "IDLE" ? "No load checked" : refused ? "Refused" : "Cleared"}
        </h2>
        <span className="verdict__meta mono">
          {status === "IDLE" ? "49 CFR 177.848" : `${pairsChecked} pair${pairsChecked === 1 ? "" : "s"} checked`}
        </span>
      </header>

      {status === "IDLE" ? (
        <p className="verdict__idle">
          Add materials to the manifest, then check the load. Every decision on this page quotes the
          governing regulation word for word.
        </p>
      ) : (
        <>
          <div className="verdict__theatre">
            <div className="verdict__slot verdict__slot--left">
              <Placard hazardClass={pair?.[0] ?? "Forbidden"} size={104} />
              {names?.[0] && <span className="verdict__name">{names[0]}</span>}
            </div>

            <div className="verdict__cell" aria-hidden="true">
              <span className="verdict__glyph">{refused ? glyph : "OK"}</span>
            </div>

            <div className="verdict__slot verdict__slot--right">
              <Placard hazardClass={pair?.[1] ?? "Forbidden"} size={104} />
              {names?.[1] && <span className="verdict__name">{names[1]}</span>}
            </div>
          </div>

          {/* The text token. This is what carries the meaning when colour
              cannot: colourblindness, greyscale printing, a screen reader. */}
          <p className="verdict__token mono">{refused ? token : "NO RESTRICTION APPLIES"}</p>

          {citation && (
            <figure className="verdict__stamp">
              <figcaption className="verdict__cite mono">{citation.section}</figcaption>
              <blockquote className="verdict__quote">{citation.text}</blockquote>
            </figure>
          )}

          {violation && <p className="verdict__because">{violation.message}</p>}
        </>
      )}
    </section>
  );
}

/**
 * The live region. Rendered EMPTY in the initial HTML and never conditionally
 * mounted, because assistive technology must have registered the region before
 * the first announcement or the announcement is silently dropped.
 *
 * role="alert" is justified here rather than role="status": acting on a load
 * that federal law forbids is a safety error, not a status update.
 */
export function VerdictAnnouncer({ message }: { message: string }) {
  return (
    <div role="alert" aria-live="assertive" className="sr-only">
      {message}
    </div>
  );
}
