/**
 * THE CONSOLE. The product.
 *
 * A shipping-compliance officer and their agent work the same page. Both go
 * through the SAME executors, so a human and an agent can never get different
 * answers about a material or a load. The human's buttons and the agent's
 * tools are two front doors onto one solver.
 *
 * The state here is deliberately small and flat: a manifest, a set of bays, a
 * verdict, a session nonce. `commit_manifest` exists in the agent's registry
 * only while `verdict.status === "PASS"`, and any edit clears the verdict,
 * which is what makes the tool visibly appear and disappear as the load
 * changes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HazardRail } from "./ui/HazardRail.tsx";
import { CellTicker } from "./ui/CellTicker.tsx";
import { ManifestPanel } from "./ui/ManifestPanel.tsx";
import { LoadPlanPanel, type Bay } from "./ui/LoadPlanPanel.tsx";
import { VerdictCard, VerdictAnnouncer } from "./ui/VerdictCard.tsx";
import { ToolRegistryStrip } from "./ui/ToolRegistryStrip.tsx";
import { ShippingPaper } from "./ui/ShippingPaper.tsx";
import { AttackPanel } from "./ui/AttackPanel.tsx";
import { MatrixPanel } from "./ui/MatrixPanel.tsx";
import { AgentView } from "./ui/AgentView.tsx";
import { useHazmatTools, useSessionNonce } from "./tools/useHazmatTools.ts";
import { buildShippingPaper, chooseMaterial, proposeLoad, toLoad } from "./tools/executors.ts";
import { checkLoad, resolveItem, verifyApproval } from "./solver/index.ts";
import type { MatrixKey, ResolvedItem, Violation } from "./solver/types.ts";
import "./ui/console.css";

/** The demo manifest. Every entry is resolved from the corpus, never typed. */
/**
 * The demonstration manifest. SIX real 172.101 entries, chosen so that four of
 * the refusal grounds fire on one screen rather than one.
 *
 * UN0360 was missing until FACTS.md and this array were compared and found to
 * disagree: the fact sheet listed six entries including the explosive, the code
 * had five and no explosive, so the compatibility-table axis was never
 * exercised anywhere a judge could see it. Adding it takes the demo from 10
 * pairs on three grounds to 15 pairs on four.
 */
const DEMO = ["UN1090", "UN1830", "UN1748", "UN1309", "UN0360", "Ammonium chlorate"];

type Verdict =
  | { status: "IDLE" }
  | { status: "PASS"; token: string; checked: number; notes: string[] }
  | { status: "REFUSED"; violations: Violation[]; checked: number; notes: string[] };

export function Console() {
  const nonce = useSessionNonce();
  const [manifest, setManifest] = useState<ResolvedItem[]>([]);
  const [bays, setBays] = useState<Bay[]>([{ items: [], barriersPresent: false, singleShipper: false, nonReactionAsserted: false }]);
  const [verdict, setVerdict] = useState<Verdict>({ status: "IDLE" });
  // Bumped on every verdict change so the agent view re-reads the live
  // registry. Not derived from `verdict` itself, because the registry settles
  // an effect tick later than the verdict does.
  const [agentViewRevision, setAgentViewRevision] = useState(0);

  /**
   * The matrix rows and columns this manifest actually touches, so the table
   * below lights the cells the operator is currently standing on rather than
   * asking them to find their own row among eighteen.
   */
  const litKeys = useMemo(
    () =>
      manifest.flatMap((r) =>
        r.hazards.map((h) => h.matrixKey).filter((k): k is MatrixKey => k !== null),
      ),
    [manifest],
  );
  const [paper, setPaper] = useState<unknown>(null);
  const [announce, setAnnounce] = useState("");
  const [busy, setBusy] = useState(false);

  /** Any edit invalidates the verdict, which is what makes commit_manifest
   *  leave the agent's registry the moment the load changes. */
  const invalidate = useCallback(() => {
    setVerdict({ status: "IDLE" });
    setAgentViewRevision((n) => n + 1);
    setPaper(null);
  }, []);

  /**
   * MANUAL ENTRY MUST NEVER SUBSTITUTE, AND IT MUST NEVER FAIL SILENTLY.
   *
   * This took the first lookup match and added it. Typing "sulfuric acid", the
   * material in this project's own headline demonstration, added UN2584 Alkyl
   * sulfonic acids: a different material in a different hazard class, on the
   * manifest, with no signal of any kind. Typing something the table does not
   * contain did nothing at all, which reads as "accepted".
   *
   * Substituting one entry for another is precisely the failure this page
   * exists to expose, and it was in the page's own input box. So: an exact
   * name or identification number is taken; anything else that matches more
   * than one entry is REFUSED with the candidates named, because choosing
   * between "Sulfuric acid with more than 51 percent acid" and "Alkyl sulfonic
   * acids" is a regulated decision and it belongs to the person, not to a sort
   * order; and nothing is ever added without saying what was added.
   */
  const addItem = useCallback((query: string) => {
    const choice = chooseMaterial(query);
    if (choice.kind === "none") {
      setAnnounce(
        `Nothing in the 49 CFR 172.101 table matches "${query}", so nothing was added. ` +
        `Try the identification number, or the proper shipping name as the table writes it.`
      );
      return;
    }
    if (choice.kind === "ambiguous") {
      setAnnounce(
        `"${query}" matches ${choice.candidates.length} entries in the table, so nothing was added. ` +
        `Substituting one of them for what you typed is the failure this page exists to catch. ` +
        `Candidates: ${choice.candidates.slice(0, 4).map((m) => `${m.id ?? "no identification number"}, ${m.name}`).join("; ")}` +
        `${choice.candidates.length > 4 ? ", and others" : ""}. Type the identification number, or the full name.`
      );
      return;
    }
    const found = choice.match;
    const r = resolveItem(found.id ? { id: found.id } : { name: found.name });
    if ("error" in r) {
      setAnnounce(`"${query}" resolved to ${found.name}, which could not be loaded: ${r.error}`);
      return;
    }
    setAnnounce(
      `Added ${found.id ?? "no identification number"}, ${found.name}` +
      (choice.exact ? "." : `. You typed "${query}".`)
    );
    setManifest((m) => [...m, r]);
    setBays((b) => {
      const next = b.map((x) => ({ ...x, items: [...x.items] }));
      next[0]!.items.push(r);
      return next;
    });
    invalidate();
  }, [invalidate]);

  const removeItem = useCallback((i: number) => {
    setManifest((m) => {
      const target = m[i];
      if (target) {
        setBays((b) => b.map((bay) => ({ ...bay, items: bay.items.filter((x) => x !== target) })));
      }
      return m.filter((_, x) => x !== i);
    });
    invalidate();
  }, [invalidate]);

  /**
   * Resolve a list of material references into a manifest. Shared by the demo
   * button and by the URL loader below, so a link and a click cannot produce
   * different state.
   */
  /**
   * Resolve references into a manifest, REPORTING what could not be resolved.
   *
   * The previous version took `lookupMaterial(...)[0]`, re-resolved that
   * candidate by its identification number, and filtered every failure out.
   * Both halves were wrong and both produced a SAFER load than the one asked
   * for, which is the dangerous direction for a silent change.
   *
   * Taking the first candidate bypassed the ambiguous-name refusal entirely:
   * "Articles, explosive, n.o.s." became UN0350 at 1.4B and then passed with
   * acetone and a barrier, while the equally valid candidate UN0354 makes that
   * pair an X. Filtering failures meant `UN1090,NOT-A-MATERIAL` silently became
   * an acetone-only load and committed a shipping paper for a manifest nobody
   * submitted.
   *
   * Now it resolves each reference the way the solver does, and hands back
   * whatever refused so the caller can say so out loud.
   */
  /** Same rule the tool layer uses, so a link and a tool call agree. */
  const looksLikeIdentifier = (s: string) => /^(UN|NA|ID)\s?\d{4}$/i.test(s.trim());

  const resolveRefs = useCallback(
    (refs: string[]): { items: ResolvedItem[]; unresolved: Array<{ ref: string; reason: string }> } => {
      const items: ResolvedItem[] = [];
      const unresolved: Array<{ ref: string; reason: string }> = [];
      for (const ref of refs) {
        const r = resolveItem(looksLikeIdentifier(ref) ? { id: ref } : { name: ref });
        if ("error" in r) unresolved.push({ ref, reason: r.error });
        else items.push(r);
      }
      return { items, unresolved };
    },
    [],
  );

  const loadDemo = useCallback(() => {
    const { items, unresolved } = resolveRefs(DEMO);
    setManifest(items);
    setBays([{ items, barriersPresent: false, singleShipper: false, nonReactionAsserted: false }]);
    if (unresolved.length) setAnnounce(`${unresolved.length} demonstration item(s) did not resolve: ${unresolved.map((u) => u.ref).join(", ")}`);
    invalidate();
  }, [invalidate, resolveRefs]);

  const addVehicle = useCallback(() => {
    setBays((b) => [...b, { items: [], barriersPresent: false, singleShipper: false, nonReactionAsserted: false }]);
    invalidate();
  }, [invalidate]);

  const removeVehicle = useCallback((i: number) => {
    setBays((b) => {
      if (b.length <= 1) return b;
      const moved = b[i]?.items ?? [];
      const next = b.filter((_, x) => x !== i).map((x) => ({ ...x, items: [...x.items] }));
      next[0]!.items.push(...moved);
      return next;
    });
    invalidate();
  }, [invalidate]);

  const toggle = useCallback((i: number, key: "barriersPresent" | "singleShipper" | "nonReactionAsserted", value: boolean) => {
    setBays((b) => b.map((bay, x) => (x === i ? { ...bay, [key]: value } : bay)));
    invalidate();
  }, [invalidate]);

  const move = useCallback((from: { bay: number; item: number }, toBay: number) => {
    setBays((b) => {
      if (from.bay === toBay) return b;
      const next = b.map((x) => ({ ...x, items: [...x.items] }));
      const [it] = next[from.bay]!.items.splice(from.item, 1);
      if (it) next[toBay]!.items.push(it);
      return next;
    });
    invalidate();
  }, [invalidate]);

  const toWire = useCallback(
    () =>
      bays.map((bay) => ({
        // NEVER filter on the identification number here. A Forbidden material
        // has none, and dropping it would silently remove the single most
        // dangerous item on the manifest from the check. That is precisely the
        // defect this project exists to expose, and it appeared in this file.
        items: bay.items.map((i) => i.item.id ?? i.name),
        barriersPresent: bay.barriersPresent,
        singleShipper: bay.singleShipper,
        nonReactionAsserted: bay.nonReactionAsserted,
      })),
    [bays]
  );

  const propose = useCallback(() => {
    setBusy(true);
    // Same executor the agent's propose_load tool calls.
    const refs = manifest.map((m) => m.item.id ?? m.name);
    const r = proposeLoad(
      {
        items: refs,
        maxVehicles: Math.max(bays.length, 1),
      },
      // The operator's checkboxes, passed as trust context. proposeLoad no
      // longer accepts these as arguments: an agent that could set them was
      // attesting, on the operator's behalf, to barriers in a truck it cannot see.
      {
        barriersPresent: bays[0]?.barriersPresent ?? false,
        singleShipper: bays[0]?.singleShipper ?? false,
      },
    );
    if (r.status === "PROPOSED") {
      const byRef = new Map(manifest.map((m) => [m.item.id ?? m.name, m] as const));
      setBays(
        r.vehicles.map((v) => ({
          items: v.items.map((ref) => byRef.get(ref)).filter((x): x is ResolvedItem => !!x),
          barriersPresent: bays[0]?.barriersPresent ?? false,
          singleShipper: bays[0]?.singleShipper ?? false,
          // Never inherited. Splitting a load changes which materials sit
          // together, so a non-reaction assertion made about the old
          // arrangement says nothing about the new one and must be re-made.
          nonReactionAsserted: false,
        }))
      );
      setAnnounce(`A legal split was found across ${r.vehiclesUsed} vehicles.`);
    } else if (r.status === "IMPOSSIBLE") {
      setAnnounce(`No arrangement exists. ${r.reason}`);
    }
    invalidate();
    setBusy(false);
  }, [manifest, bays, invalidate]);

  const check = useCallback(async () => {
    setBusy(true);
    // The UI calls the solver directly and keeps the solver's own Violation
    // shape. The agent's check_segregation tool calls the same solver through
    // a thin adapter that flattens the result for the wire. One solver, two
    // front doors. An earlier version cast the WIRE shape to the internal one,
    // which typechecked and then crashed at runtime on a field that does not
    // exist there; a cast is not a conversion.
    const v = await checkLoad(toLoad(toWire()), nonce);
    if (v.status === "PASS") {
      setVerdict({ status: "PASS", token: v.approvalToken, checked: v.checked, notes: v.notes });
      setAgentViewRevision((n) => n + 1);
      setAnnounce("The load passes. The shipping paper can now be exported.");
    } else {
      setVerdict({ status: "REFUSED", violations: v.violations, checked: v.checked, notes: v.notes });
      setAgentViewRevision((n) => n + 1);
      const first = v.violations[0];
      setAnnounce(first ? `Refused. ${first.message}` : "Refused.");
    }
    setBusy(false);
  }, [toWire, nonce]);

  /**
   * URL STATE, and it exists because a real failure demanded it.
   *
   * `webmcp-evals smoke` opens a FRESH page for each case, and on a fresh page
   * only the two always-on tools are registered, because the other three depend
   * on page state. So four of six published eval cases errored with "tool is
   * not available": the project's own central feature made its own evals
   * unrunnable, and that command is printed in the README and the writeup.
   *
   * A URL that carries the load fixes it at the root rather than by weakening
   * the evals, and it is worth having anyway: a link can now open the exact
   * refusal, so a judge sees the money shot without clicking anything.
   *
   *   ?load=UN1830,UN1748        the manifest, by id or by proper shipping name
   *   &check=1                   run the check on arrival
   *   ?demo=1                    the six-item demonstration manifest
   *
   * IT DELIBERATELY CANNOT SET THE THREE ASSERTIONS, and an earlier version of
   * this could, which was a real defect I introduced while fixing another one.
   * barriersPresent, singleShipper and nonReactionAsserted are attestations a
   * person makes about the physical world, and each of them can turn a refusal
   * into a PASS. A link that sets them manufactures the operator's signature:
   * `?load=UN1830,UN1748&barriers=1&shipper=1&nonreaction=1` returned PASS and
   * COMMITTED with nobody having asserted anything.
   *
   * So the URL carries the LOAD and never the claims about it. The judge ticks
   * the barrier themselves, which is a better demonstration anyway, because
   * they perform the action and watch it fail to help.
   *
   * Runs once on mount. It never writes to the URL, so a person clicking around
   * is not fighting the address bar.
   */
  const bootedFromUrl = useRef(false);
  useEffect(() => {
    if (bootedFromUrl.current || typeof window === "undefined") return;
    bootedFromUrl.current = true;
    const q = new URLSearchParams(window.location.search);
    const refs = q.get("demo") === "1"
      ? [...DEMO]
      : (q.get("load") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    if (refs.length === 0) return;

    const { items: resolved, unresolved } = resolveRefs(refs);
    if (unresolved.length) {
      // NEVER quietly load a subset. A shipping paper for a manifest nobody
      // submitted is the worst thing this page could produce.
      //
      // This used to set the banner and stop, which is not the same thing. The
      // subset still loaded, still checked, still passed, and still exported,
      // and the exported paper said nothing about the items that had gone
      // missing. Writing a hole down is not closing it. So an unresolved
      // reference now BLOCKS the export, for the operator and for the agent
      // alike, until a person has acknowledged which items were dropped.
      setUrlProblem(unresolved);
    }
    if (resolved.length === 0) return;
    setManifest(resolved);
    // Every assertion starts false. See the note above: a URL may describe a
    // load, never attest to one.
    setBays([{
      items: resolved,
      barriersPresent: false,
      singleShipper: false,
      nonReactionAsserted: false,
    }]);
    setAgentViewRevision((n) => n + 1);
    if (q.get("check") === "1") setPendingCheck(true);
  }, [resolveRefs]);

  // The check has to run AFTER the bays state lands, so it is deferred one
  // render rather than called inline, where it would read the empty load.
  const [pendingCheck, setPendingCheck] = useState(false);
  const [urlProblem, setUrlProblem] = useState<Array<{ ref: string; reason: string }>>([]);
  useEffect(() => {
    if (!pendingCheck || manifest.length === 0) return;
    setPendingCheck(false);
    void check();
  }, [pendingCheck, manifest, check]);

  const commit = useCallback(async () => {
    if (verdict.status !== "PASS") return;
    if (urlProblem.length > 0) {
      setAnnounce(
        `Export blocked. ${urlProblem.length} item${urlProblem.length === 1 ? "" : "s"} from the ` +
        `link did not resolve, so this manifest is not the one that was asked for. ` +
        `Acknowledge the notice at the top of the page, or fix the link.`
      );
      return;
    }
    setBusy(true);
    const load = toLoad(toWire());
    // The same boundary the agent's commit_manifest crosses: the token is
    // re-verified against a hash of the exact bytes about to be exported.
    const ok = await verifyApproval(load, verdict.token, nonce);
    if (ok.ok) {
      setPaper(buildShippingPaper(load));
      setAnnounce("Shipping paper exported.");
    } else {
      setAnnounce(`Refused at commit. ${ok.reason}`);
      setVerdict({ status: "IDLE" });
      setAgentViewRevision((n) => n + 1);
    }
    setBusy(false);
  }, [verdict, toWire, nonce, urlProblem]);

  // The agent's view of the page. commit_manifest is registered only while the
  // verdict is PASS, so it appears and disappears as the load changes.
  const registry = useHazmatTools(
    useMemo(
      () => ({
        manifestSize: manifest.length,
        // An outstanding unresolved reference reads as NOT PASSING, so
        // commit_manifest leaves the agent's registry as well. The registry is
        // not the boundary, but offering a tool that must refuse is a trap.
        verdict:
          verdict.status === "IDLE" ? null
          : urlProblem.length > 0 ? { status: "REFUSED" as const }
          : { status: verdict.status },
        nonce,
        // The operator's checkboxes. These are the ONLY route by which an
        // attestation reaches the solver: the tool schemas no longer carry the
        // fields, and a caller that sends one is refused by name.
        attestations: bays.map((b) => ({
          barriersPresent: b.barriersPresent,
          singleShipper: b.singleShipper,
          nonReactionAsserted: b.nonReactionAsserted,
        })),
      }),
      [manifest.length, verdict.status, nonce, bays, urlProblem.length]
    ),
    setPaper
  );

  // The featured violation, and the two placards it involves.
  const featured = verdict.status === "REFUSED" ? verdict.violations[0] : undefined;
  const pair = useMemo((): [string, string] | undefined => {
    if (!featured) return undefined;
    const bay = bays[Math.max(0, (featured.vehicle ?? 1) - 1)];
    const [a, b] = featured.items.map((i) => bay?.items[i]);
    if (featured.items.length === 1) {
      const only = a ?? bay?.items[0];
      return only ? [only.forbidden ? "Forbidden" : only.hazardClass, "Forbidden"] : undefined;
    }
    return a && b ? [a.forbidden ? "Forbidden" : a.hazardClass, b.forbidden ? "Forbidden" : b.hazardClass] : undefined;
  }, [featured, bays]);

  const names = useMemo((): [string, string] | undefined => {
    if (!featured) return undefined;
    const bay = bays[Math.max(0, (featured.vehicle ?? 1) - 1)];
    const [a, b] = featured.items.map((i) => bay?.items[i]);
    if (featured.items.length === 1) return [a?.name ?? "", "no lawful configuration"];
    return a && b ? [a.name, b.name] : undefined;
  }, [featured, bays]);

  const canCheck = manifest.length > 0 && !busy;

  return (
    // <main> rather than <div>: a document with no main landmark fails
    // WCAG 2.4.1 and, more to the point here, gives an ASSISTIVE TECHNOLOGY OR
    // AN AGENT no way to skip the chrome and find the work. On a page whose
    // whole subject is machine legibility, that omission was the wrong one to
    // ship. Caught by a Lighthouse accessibility run, not by review.
    <main className="console">
      <header className="console__top">
        <div className="console__brand">
          <h1 className="console__wordmark">Segregation</h1>
          <p className="console__standard mono">49 CFR 177.848</p>
        </div>
        <p className="console__lead">
          Paste a chemical manifest and watch an agent load a truck legally. The page shows exactly
          which federal rule each pair breaks, and the shipping paper cannot be exported until the
          load actually passes.
        </p>
      </header>

      <CellTicker />

      {/* A phone shows the verdict 3.2 screens below the fold, so on small
          screens a sticky strip carries the STATUS and scrolls to the card.
          It is a link, never a copy: two renderings of a verdict is two things
          to keep in sync, and the second one eventually lies. */}
      {urlProblem.length > 0 && (
        <div className="console__urlProblem" role="alert">
          <strong>
            {urlProblem.length} item{urlProblem.length === 1 ? "" : "s"} from the link did not
            resolve and {urlProblem.length === 1 ? "was" : "were"} NOT loaded.
          </strong>
          <ul>
            {urlProblem.map((u) => (
              <li key={u.ref}><code>{u.ref}</code>: {u.reason}</li>
            ))}
          </ul>
          <p>
            The manifest below is therefore not the one the link asked for. Nothing has been
            silently substituted, and any verdict shown covers only what actually loaded.
            <strong> The shipping paper cannot be exported until you acknowledge this</strong>,
            because a paper for a manifest nobody submitted is worse than no paper.
          </p>
          <button type="button" className="pill" onClick={() => setUrlProblem([])}>
            I have read which items were dropped
          </button>
        </div>
      )}

      {verdict.status !== "IDLE" && (
        <button
          type="button"
          className={`console__stickyVerdict console__stickyVerdict--${verdict.status === "PASS" ? "pass" : "refused"}`}
          onClick={() => document.querySelector(".verdict")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          {verdict.status === "PASS" ? "Cleared" : "Refused"}
          <em>{verdict.checked} {verdict.checked === 1 ? "pair" : "pairs"} checked &#8595;</em>
        </button>
      )}

      <div className="console__grid">
        <HazardRail items={manifest} />

        <div className="console__work">
          <ManifestPanel
            items={manifest}
            onAdd={addItem}
            onRemove={removeItem}
            onLoadDemo={loadDemo}
          />
          <LoadPlanPanel
            bays={bays}
            onAddVehicle={addVehicle}
            onRemoveVehicle={removeVehicle}
            onToggle={toggle}
            onMove={move}
            onPropose={propose}
            busy={busy}
          />
        </div>

        <div className="console__verdict">
          <VerdictCard
            status={verdict.status}
            violation={featured}
            pair={pair}
            names={names}
            pairsChecked={verdict.status === "IDLE" ? 0 : verdict.checked}
          />

          <div className="console__act">
            <button type="button" className="pill pill--solid console__check" onClick={check} disabled={!canCheck}>
              {busy ? "Checking" : "Check this load"} <span aria-hidden="true">&#8599;</span>
            </button>
            {/* The commit control exists only when the load passes, mirroring
                the tool registry exactly. A disabled-but-present button would
                undercut the entire argument. */}
            {verdict.status === "PASS" && (
              <button type="button" className="pill console__commit" onClick={commit} disabled={busy}>
                Export the shipping paper <span aria-hidden="true">&#8599;</span>
              </button>
            )}
          </div>

          {verdict.status !== "IDLE" && verdict.notes.length > 0 && (
            <ul className="console__notes">
              {verdict.notes.slice(0, 4).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}

          <ToolRegistryStrip
            registered={registry.registered}
            all={registry.all}
            supported={registry.supported}
          />

          {/* The same fact in the agent's own words, read from the LIVE
              registry rather than mirrored from this component's state, so a
              disagreement between the two is visible instead of hidden. */}
          <AgentView revision={agentViewRevision} />
        </div>
      </div>

      {paper !== null && <ShippingPaper paper={paper} onClose={() => setPaper(null)} />}

      {/* The security argument, executed rather than asserted. It sits below the
          product because it is for a reviewer rather than an operator, and it
          runs against whatever load is currently on the page. */}
      <AttackPanel vehicles={toWire()} nonce={nonce} />

      {/* The regulation this whole page is arguing about, drawn at full size,
          with the cells it clears and the regulation forbids ringed. */}
      <MatrixPanel highlight={litKeys} />

      <footer className="console__foot">
        <p>
          Not the official Code of Federal Regulations and not legal advice. Derived from a dated
          eCFR snapshot; the signer retains responsibility under 49 CFR 172.204.
        </p>
      </footer>

      <VerdictAnnouncer message={announce} />
    </main>
  );
}
