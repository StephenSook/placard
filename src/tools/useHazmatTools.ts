/**
 * The WebMCP tool surface.
 *
 * EVERY TOOL IS IMPERATIVE AND ON THE TOP-LEVEL DOCUMENT. That is a
 * requirement, not a preference: ChatGPT's in-app browser does not support the
 * declarative HTML form API and does not discover tools registered inside
 * iframes, same-origin or not. A declarative gate would be invisible to the
 * judge-facing agent.
 *
 * THE GATE HAS THREE LAYERS AND ONLY ONE OF THEM IS THE BOUNDARY.
 *
 *   visible      commit_manifest is absent from the agent's registry while the
 *                current load does not pass. This is the UX and the thing a
 *                judge watches change on screen. It is NOT the security
 *                property: the WebMCP tool map is keyed by tool NAME, so any
 *                same-origin script can register over a name, and the spec
 *                itself flags an unprotected unregister-then-reregister window.
 *
 *   load-bearing commit_manifest's execute re-derives the verdict from a hash
 *                of the exact contents it is about to export and refuses on any
 *                mismatch. A stale load, a mutated load, and a shadow tool of
 *                the same name are then all uncommittable regardless of
 *                registration order or toolchange timing.
 *
 *   structural   a static single-origin site with zero third-party JavaScript
 *                and a strict script-src 'self' policy, so no foreign script
 *                is running to register anything in the first place.
 *
 * State is read through refs inside execute. The hook keeps `execute` in a ref
 * of its own so a changing closure does not churn registration, but the state
 * that closure reads is ours to manage.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWebMCP } from "use-webmcp-tool";
import {
  CHECK_SEGREGATION_SCHEMA, COMMIT_MANIFEST_SCHEMA, DESCRIPTIONS,
  MUTATING, PROPOSE_LOAD_SCHEMA, READ_ONLY,
} from "./schemas.ts";
import { checkSegregation, commitManifest, proposeLoad } from "./executors.ts";
import type { Attestations, PageLoad } from "./executors.ts";
import { registerAlwaysOnTools, unregisterAlwaysOnTools, webmcpSupported } from "./registerEarly.ts";

export type Verdict = { status: "PASS" | "REFUSED" } | null;

export type HazmatToolsState = {
  /** Line items currently on the manifest. Drives which tools exist. */
  manifestSize: number;
  /** The current adjudication, or null if nothing has been checked. */
  verdict: Verdict;
  /** Per-session, never leaves the page. Binds an approval token to this session. */
  nonce: string;
  /**
   * What the operator has ticked, by vehicle. THE AGENT CANNOT SET THIS.
   *
   * barriersPresent, singleShipper and nonReactionAsserted decide whether an O
   * cell passes and whether the 177.848(e)(3) exception is available. They used
   * to be tool arguments, and an agent that sent barriersPresent: true turned a
   * refused load into a committed shipping paper in one call. They now reach the
   * solver only from here, read through a ref inside execute so a tool invoked
   * mid-render sees what is currently ticked rather than what was ticked at
   * registration.
   */
  attestations: Attestations[];
  /**
   * The page's own load, by vehicle, so an attestation can be checked against
   * the vehicle it was actually made about.
   *
   * Moving the attestation fields off the wire stopped an agent ASSERTING a
   * barrier. It did not stop an agent BORROWING one: the merge was positional,
   * so an agent could send any items as "vehicle 1" and inherit whatever the
   * operator had ticked for their own vehicle 1. Reproduced end to end, from
   * REFUSED to a committed paper marked "barriers asserted" for a pairing the
   * operator had never seen.
   */
  pageLoad: PageLoad;
};

export type ToolRegistryView = {
  supported: boolean;
  /** Tool names the agent can currently see, in registration order. */
  registered: string[];
  /** Every tool this page can ever offer, for the UI to render absence. */
  all: string[];
  error: Error | null;
};

const ALL_TOOLS = [
  "lookup_material",
  "classify_line_item",
  "propose_load",
  "check_segregation",
  "commit_manifest",
] as const;

/**
 * Register the five tools and report what the agent can currently see.
 * `onCommitted` receives the shipping paper when a commit succeeds.
 */
export function useHazmatTools(
  state: HazmatToolsState,
  onCommitted?: (paper: unknown) => void
): ToolRegistryView {
  // Every executor reads state through this ref, so a tool invoked mid-render
  // sees current values rather than the values captured when it registered.
  //
  // ASSIGNED DURING RENDER, NOT IN AN EFFECT, and the difference is a real
  // window rather than a style preference. A passive effect runs after paint,
  // so between the operator editing a load and that effect firing, an executor
  // called by the agent would read the PREVIOUS state: the old nonce and, worse,
  // the old attestations. An operator who unticks "barriers" and an agent that
  // commits in the same frame would otherwise have the export hashed and
  // adjudicated against a barrier nobody is asserting any more.
  //
  // Assigning in the render body closes the window: the ref is current before
  // any handler this render can reach. It is safe here because the value is
  // derived state, not a subscription, and nothing reads the ref during render.
  const stateRef = useRef(state);
  stateRef.current = state;

  const onCommittedRef = useRef(onCommitted);
  onCommittedRef.current = onCommitted;

  const hasManifest = state.manifestSize > 0;
  const passes = state.verdict?.status === "PASS";
  // THE TOOLSET IS ANTICORRELATED, and that is the whole demonstration.
  //
  // commit_manifest exists only while the load PASSES. propose_load exists
  // exactly when it does not. They are EXACT COMPLEMENTS, so with a manifest on
  // the page precisely one of them is registered at any moment: the page hands
  // the agent the capability the regulation currently permits and takes away
  // the other in the same instant, in opposite directions.
  //
  // NOT `verdict === "REFUSED"`, which is what this said first and which was a
  // dead end. The page's verdict is set by the OPERATOR pressing check; an
  // agent calling check_segregation gets its answer back but does not move page
  // state, deliberately, because that is what stops an agent talking
  // commit_manifest into existence for a load nobody adjudicated. Gating on
  // REFUSED inherited that: an agent with an unchecked manifest called
  // check_segregation, was refused, and found BOTH gated tools absent, with no
  // remedy tool to reach for. Reproduced before this was changed.
  //
  // `!passes` has no such hole. Unchecked or refused, the remedy exists;
  // passing, the export exists. Never both, never neither. And it costs nothing
  // in safety, because propose_load is readOnlyHint and produces a suggestion,
  // not a document. The tool an agent must not be able to conjure is
  // commit_manifest, and its gate is untouched.
  const notPassing = !passes;

  // No attestation is threaded in. See proposeLoad: an arrangement that does
  // not exist yet cannot have been walked out to and looked at.
  const execPropose = useCallback((a: { items: string[]; maxVehicles: number }) => proposeLoad(a), []);
  const execCheck = useCallback(
    (a: { vehicles: Array<{ items: string[] }> }) =>
      checkSegregation(a, stateRef.current.nonce, stateRef.current.attestations, stateRef.current.pageLoad),
    []
  );
  const execCommit = useCallback(
    async (a: { approvalToken: string; vehicles: Array<{ items: string[] }> }) => {
      const out = await commitManifest(a, stateRef.current.nonce, stateRef.current.attestations, stateRef.current.pageLoad);
      if (out.status === "COMMITTED") onCommittedRef.current?.(out.shippingPaper);
      return out;
    },
    []
  );

  const propose = useWebMCP({
    name: "propose_load",
    description: DESCRIPTIONS.propose_load,
    inputSchema: PROPOSE_LOAD_SCHEMA,
    annotations: READ_ONLY,
    execute: execPropose,
    // The exact complement of commit_manifest's gate. See the note above.
    enabled: hasManifest && notPassing,
  });

  const check = useWebMCP({
    name: "check_segregation",
    description: DESCRIPTIONS.check_segregation,
    inputSchema: CHECK_SEGREGATION_SCHEMA,
    annotations: READ_ONLY,
    execute: execCheck,
    enabled: hasManifest,
  });

  const commit = useWebMCP({
    name: "commit_manifest",
    description: DESCRIPTIONS.commit_manifest,
    inputSchema: COMMIT_MANIFEST_SCHEMA,
    annotations: MUTATING,
    execute: execCommit,
    // The visible layer. When this flips false the hook aborts the tool's
    // controller, which is how WebMCP unregisters, and the tool leaves the
    // agent's registry. Watchable on screen and in the DevTools WebMCP panel.
    enabled: passes,
  });

  // The two always-on tools register directly at mount, outside React's
  // lifecycle, because they depend on nothing but the vendored corpus.
  const [alwaysOn, setAlwaysOn] = useState<string[]>([]);
  useEffect(() => {
    setAlwaysOn(registerAlwaysOnTools());
    return () => unregisterAlwaysOnTools();
  }, []);

  const registered = useMemo(() => {
    const on: string[] = [...alwaysOn];
    if (propose.registered) on.push("propose_load");
    if (check.registered) on.push("check_segregation");
    if (commit.registered) on.push("commit_manifest");
    return on;
  }, [alwaysOn, propose.registered, check.registered, commit.registered]);

  const error = propose.error ?? check.error ?? commit.error;

  return {
    supported: propose.supported || webmcpSupported(),
    registered,
    all: [...ALL_TOOLS],
    error,
  };
}

/**
 * A per-session nonce. Generated in the page, never transmitted, never stored.
 * It binds an approval token to this session so a token cannot be replayed
 * from anywhere that has not seen a genuine pass here.
 */
export function useSessionNonce(): string {
  const [nonce] = useState(() => {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  });
  return nonce;
}
