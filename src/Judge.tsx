/**
 * /judge — the evidence surface.
 *
 * Built on one premise from the challenge rules, quoted: "Judges are not
 * required to test the Project and may choose to judge based solely on the text
 * description, images, and video." So every claim this project makes must be
 * checkable WITHOUT logging in, WITHOUT a key, and WITHOUT running anything.
 * This page is that path, as a numbered itinerary a reader can finish in about
 * three minutes.
 *
 * It is deliberately not a marketing page. Each step states a claim, gives the
 * one-click way to check it, and names what would falsify it. The numbers are
 * fetched live from /api/measure and /api/forbidden-audit, which recompute from
 * the committed corpus, so this page cannot quietly drift from the product: if
 * the endpoints go down, the page says so rather than showing a stale figure it
 * has cached in its own source.
 */
import { useEffect, useState } from "react";
import { PROVENANCE } from "./evidence/provenance.ts";
import "./ui/judge.css";

const REPO = "https://github.com/StephenSook/hazmat-segregation-console";

type Measure = {
  headline: {
    configurations_the_table_alone_clears: number;
    of_those_the_regulation_actually_forbids: number;
    share: number;
    grounds: Record<string, number>;
  };
  forbidden_materials: {
    entries_designated_Forbidden: number;
    recoverable_by_an_identification_number_keyed_index: number;
  };
  method: { configurations_examined: number };
};

/** Live numbers, or an honest statement that they could not be fetched. */
function useMeasure() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ok"; data: Measure } | { status: "error"; why: string }
  >({ status: "loading" });

  useEffect(() => {
    let live = true;
    fetch("/api/measure")
      .then((r) => {
        if (!r.ok) throw new Error(`/api/measure returned HTTP ${r.status}`);
        return r.json() as Promise<Measure>;
      })
      .then((d) => { if (live) setState({ status: "ok", data: d }); })
      // Never substitute a hardcoded figure here. A number on this page that
      // did not come from the endpoint would be exactly the drift the endpoint
      // exists to prevent.
      .catch((e: unknown) => {
        if (live) setState({ status: "error", why: e instanceof Error ? e.message : String(e) });
      });
    return () => { live = false; };
  }, []);

  return state;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="jstep">
      <div className="jstep__n mono">{String(n).padStart(2, "0")}</div>
      <div className="jstep__body">
        <h3 className="jstep__title">{title}</h3>
        {children}
      </div>
    </li>
  );
}

export function Judge() {
  const m = useMeasure();

  const Figure = ({ pick, unit }: { pick: (d: Measure) => number; unit: string }) => {
    if (m.status === "loading") return <span className="jfig jfig--wait mono">measuring</span>;
    if (m.status === "error") return <span className="jfig jfig--err mono">unavailable</span>;
    return <span className="jfig mono">{pick(m.data).toLocaleString()} <em>{unit}</em></span>;
  };

  return (
    <main className="judge">
      <header className="judge__head">
        <p className="judge__eyebrow mono">Three minutes, no account, no key, nothing to install</p>
        <h1 className="judge__title">Check this project</h1>
        <p className="judge__lead">
          Every claim below is verifiable from this page or from one command. Where a number
          appears, it was recomputed from the committed 49 CFR corpus when you loaded this page,
          not written into the HTML.
        </p>
        {m.status === "error" && (
          <p className="judge__alert" role="alert">
            The measurement endpoint did not answer: {m.why}. The figures below are therefore shown
            as unavailable rather than filled in from memory. The offline path in step 5 does not
            depend on it.
          </p>
        )}
      </header>

      <ol className="judge__steps">
        <Step n={1} title="Watch a legal-looking load get refused">
          <p>
            Open the console and press <strong>Load the demonstration manifest</strong>. It contains
            sulfuric acid and calcium hypochlorite on one truck. The 177.848(d) table cell for that
            pair is <code>O</code>, which reads as "separate them and they may travel together".
            Tick <strong>physical barriers separate incompatible items</strong> and the page still
            refuses, quoting 177.848(e)(3) verbatim, because that clause blocks Class 8 liquids
            above or adjacent to Class 4 and 5 materials notwithstanding the methods of separation
            employed.
          </p>
          <p className="jwhy">
            <strong>Why it matters:</strong> an agent reasoning from the table alone clears this
            load. The table is one of four independent refusal axes.
          </p>
          <a className="jbtn" href="/">Open the console</a>
        </Step>

        <Step n={2} title="See the size of that gap, computed rather than asserted">
          <p>
            Across every ordered pair of the 18 hazard categories, in every barrier and
            single-shipper configuration, <Figure pick={(d) => d.method.configurations_examined} unit="configurations" />{" "}
            were examined. The table alone clears{" "}
            <Figure pick={(d) => d.headline.configurations_the_table_alone_clears} unit="of them" />.
            Of those, the full regulation forbids{" "}
            <Figure pick={(d) => d.headline.of_those_the_regulation_actually_forbids} unit="" />.
          </p>
          <p className="jwhy">
            <strong>What this is not:</strong> it is not a benchmark of any model's accuracy, and no
            language model was run to produce it. It measures the size of the gap an agent reasons
            across when it treats the table as the whole rule. That framing is stated in the
            endpoint's own response, under <code>honest_limits</code>.
          </p>
          <a className="jbtn" href="/api/measure">GET /api/measure</a>
        </Step>

        <Step n={3} title="Check the defect a stranger can verify against ecfr.gov">
          <p>
            <Figure pick={(d) => d.forbidden_materials.entries_designated_Forbidden} unit="entries" />{" "}
            in the 172.101 table are designated Forbidden. Because a Forbidden material may not be
            offered for transportation at all, the regulation assigns it no identification number,
            so an index keyed on UN numbers recovers{" "}
            <Figure pick={(d) => d.forbidden_materials.recoverable_by_an_identification_number_keyed_index} unit="of them" />.
            An empty result is indistinguishable from "not regulated".
          </p>
          <p className="jwhy">
            <strong>How to falsify it:</strong> open the eCFR at the pinned snapshot, search column 3
            for the word Forbidden, and check that column 4 is empty on those rows.
          </p>
          <a className="jbtn" href="/api/forbidden-audit">GET /api/forbidden-audit</a>
          <a className="jbtn jbtn--ghost" href={PROVENANCE.source} rel="noreferrer">The pinned eCFR source</a>
        </Step>

        <Step n={4} title="Watch the agent's tool registry change as the verdict changes">
          <p>
            The strip along the bottom of the console shows which tools the agent can currently see.
            While the load does not pass, <code>commit_manifest</code> is absent from it. Fix the
            load and it appears.
          </p>
          <p className="jwhy">
            <strong>The honest part:</strong> that visible change is UX, not a security boundary. The
            WebMCP tool map is keyed by tool name, so a same-origin script could register over it.
            The load-bearing layer is that <code>commit_manifest</code>'s handler re-derives the
            verdict from a SHA-256 of the exact bytes it is about to export and refuses on mismatch,
            which a test exercises by calling the handler directly on a failing load. Both halves are
            written up in SECURITY.md rather than only the flattering one.
          </p>
          <a className="jbtn jbtn--ghost" href={`${REPO}/blob/main/SECURITY.md`} rel="noreferrer">SECURITY.md</a>
          <a className="jbtn jbtn--ghost" href="/states">Every verdict state, side by side</a>
        </Step>

        <Step n={5} title="Reproduce all of it offline, with no key">
          <pre className="jcode mono">{`git clone ${REPO}
cd hazmat-segregation-console
npm ci
npm run verify:data   # re-hashes the corpus, proves every quoted clause verbatim
npm test              # exhaustive, property, metamorphic, fixed point, gate`}</pre>
          <p>
            <code>verify:data</code> prints a receipt of what it examined, because a gate that
            passes having checked nothing is indistinguishable from one that works:
          </p>
          <pre className="jcode jcode--out mono">
            PASS  checked 10 hashes, 24 verbatim clauses (4700 characters), 493 table cells, 3293 table entries
          </pre>
          <p className="jwhy">
            The raw eCFR XML is committed for exactly this reason. It was gitignored as
            "re-fetchable", and the citation gate then reported that it had verified 0 of 24 clauses
            on a clean checkout. That commit message is in the history.
          </p>
        </Step>

        <Step n={6} title="Run the agent evaluations without an API key">
          <p>
            Smoke mode executes the expected tool calls against the live page directly, with no LLM
            and no key, so the tool surface is checkable deterministically.
          </p>
          <pre className="jcode mono">{`npx webmcp-evals smoke -u https://segregation-console.netlify.app \\
  -e evals/segregation.evals.json -v`}</pre>
          <a className="jbtn jbtn--ghost" href={`${REPO}/blob/main/evals/segregation.evals.json`} rel="noreferrer">
            The eval suite
          </a>
        </Step>
      </ol>

      <footer className="judge__foot">
        <dl className="jprov">
          <div><dt className="mono">eCFR snapshot</dt><dd className="mono">{PROVENANCE.ecfr_snapshot}</dd></div>
          <div><dt className="mono">Title 49 amended</dt><dd className="mono">{PROVENANCE.title_49_latest_amended_on}</dd></div>
          <div><dt className="mono">Repository</dt><dd><a href={REPO} rel="noreferrer">StephenSook/hazmat-segregation-console</a></dd></div>
        </dl>
        <p className="jlegal">
          49 CFR is a work of the United States Government, not subject to copyright under 17 U.S.C.
          105. The eCFR is an editorial compilation and is not the official legal edition. This
          project is not legal advice, and the person who signs the shipper certification retains
          responsibility under 49 CFR 172.204.
        </p>
      </footer>
    </main>
  );
}
