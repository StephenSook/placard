/**
 * THE SHIPPING PAPER. The deliverable, and the only thing on this page that
 * leaves it.
 *
 * Rendered on paper at full width because it IS the document: this is the
 * artifact the officer signs, and the one that cannot be produced until the
 * load provably passes. It carries the basic description sequence 49 CFR
 * 172.202(a) requires, in the order the regulation requires it: identification
 * number, proper shipping name, hazard class or division, packing group.
 *
 * It also carries the certification the signer is actually taking on, QUOTED
 * from the pinned corpus rather than paraphrased. That text is on screen rather
 * than buried because 172.204 makes signing a regulated act, and a paraphrase
 * of what someone is certifying, printed on the document they certify, is the
 * one place a paraphrase is least excusable.
 *
 * AND IT PRINTS. That sounds minor and is not: this document's whole purpose is
 * to be signed and to ride in the cab, and until the print rules in paper.css
 * existed, printing produced the entire application, hazard rail and attack
 * panel and all, in screen colours. The print sheet drops everything else, sets
 * black on white, and adds a signature block that exists only on paper, because
 * 172.204 wants a signature and a screen cannot take one.
 */
import "./paper.css";
import { buildShippingPaper, shipperCertification } from "../tools/executors.ts";

/**
 * DERIVED FROM THE EXECUTOR'S OUTPUT, not narrowed by hand. Hand-narrowing is
 * how the renderer came to silently drop nonReactionAsserted: the field existed
 * on the document buildShippingPaper produces, the local type simply did not
 * mention it, and nothing anywhere said a field was being discarded.
 */
type Vehicle = ReturnType<typeof buildShippingPaper>[number];

export function ShippingPaper({ paper, onClose }: { paper: unknown; onClose: () => void }) {
  const cert = shipperCertification();
  const vehicles = (Array.isArray(paper) ? paper : []) as Vehicle[];

  return (
    <section className="paper" aria-labelledby="paper-heading">
      <header className="paper__head">
        <div>
          <p className="paper__eyebrow mono">Exported</p>
          <h2 id="paper-heading" className="paper__title">Shipping paper</h2>
        </div>
        <div className="paper__actions">
          <button type="button" className="pill" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="pill" onClick={onClose}>Close</button>
        </div>
      </header>

      {vehicles.map((v) => (
        <article key={v.vehicle} className="paper__vehicle">
          <h3 className="paper__vn mono">
            Vehicle {v.vehicle}
            {v.barriersPresent && <span className="paper__flag">barriers asserted</span>}
            {v.singleShipper && <span className="paper__flag">single shipper</span>}
            {/*
              THE PAPER RECORDS EVERY CONDITION THE APPROVAL RESTED ON, and this
              one was missing. buildShippingPaper has carried
              nonReactionAsserted since the day the 177.848(e)(6) carve-out was
              implemented, with a comment reading "A shipping paper that was
              permitted by that assertion and does not record it is missing the
              reason it exists". The renderer then dropped it, so a load that
              passed only because the shipper asserted the mixture would not
              react produced a document that did not say so.
            */}
            {v.nonReactionAsserted && (
              <span className="paper__flag">no dangerous reaction asserted</span>
            )}
          </h3>

          <table className="paper__table">
            <caption className="sr-only">
              Basic description for vehicle {v.vehicle}, in the sequence required by 49 CFR 172.202(a)
            </caption>
            <thead>
              <tr>
                <th scope="col">Identification number</th>
                <th scope="col">Proper shipping name</th>
                <th scope="col">Hazard class or division</th>
                <th scope="col">Packing group</th>
              </tr>
            </thead>
            <tbody>
              {v.lines.map((l, i) =>
                l.error ? (
                  <tr key={i}><td colSpan={4} className="paper__err">{l.error}</td></tr>
                ) : (
                  <tr key={i}>
                    <td className="mono">{l.identificationNumber ?? "none"}</td>
                    <td>{l.properShippingName}</td>
                    <td className="mono">
                      {l.hazardDescription ?? l.hazardClass}
                      {/* 172.203(m): immediately following the shipping description. */}
                      {l.inhalationHazard && (
                        <span className="paper__pih"> {l.inhalationHazard}</span>
                      )}
                    </td>
                    <td className="mono">{l.packingGroup ?? "n/a"}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </article>
      ))}

      <footer className="paper__cert">
        <p className="paper__certTitle mono">{cert.heading}</p>
        <blockquote className="paper__quote">{cert.quote.text}</blockquote>
        <p className="paper__certSource mono">{cert.obligation.section}</p>
        <p>{cert.disclaimer}</p>
        {/*
          WHAT THIS DOCUMENT DOES NOT CARRY, said on the document.
          It implements the 172.202(a) basic description sequence, the
          172.202(a)(3) subsidiary entry and the 172.203(m) inhalation-hazard
          entry. 172.203 has other additional-description requirements this
          tool does not generate, and 172.102 special provisions can require
          further entries. Naming that here is the difference between a
          demonstration and a document someone might file believing it
          complete.
        */}
        <p className="paper__scope mono">{cert.scope}</p>
      </footer>
    </section>
  );
}
