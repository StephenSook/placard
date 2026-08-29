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
  CHECK_SEGREGATION_SCHEMA, CLASSIFY_LINE_ITEM_SCHEMA, COMMIT_MANIFEST_SCHEMA,
  DESCRIPTIONS, LOOKUP_MATERIAL_SCHEMA, MUTATING, PROPOSE_LOAD_SCHEMA,
  READ_ONLY, READ_ONLY_UNTRUSTED,
} from "./schemas.ts";
import {
  checkSegregation, classifyLineItem, commitManifest, lookupMaterial, proposeLoad,
} from "./executors.ts";

export type Verdict = { status: "PASS" | "REFUSED" } | null;

export type HazmatToolsState = {
  /** Line items currently on the manifest. Drives which tools exist. */
  manifestSize: number;
  /** The current adjudication, or null if nothing has been checked. */
  verdict: Verdict;
  /** Per-session, never leaves the page. Binds an approval token to this session. */
  nonce: string;
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
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  const onCommittedRef = useRef(onCommitted);
  useEffect(() => { onCommittedRef.current = onCommitted; });

  const hasManifest = state.manifestSize > 0;
  const passes = state.verdict?.status === "PASS";

  const execLookup = useCallback((a: { query: string }) => lookupMaterial(a), []);
  const execClassify = useCallback((a: { text: string }) => classifyLineItem(a), []);
  const execPropose = useCallback(
    (a: { items: string[]; maxVehicles: number; barriersPresent?: boolean; singleShipper?: boolean }) => proposeLoad(a),
    []
  );
  const execCheck = useCallback(
    (a: { vehicles: Array<{ items: string[]; barriersPresent?: boolean; singleShipper?: boolean }> }) =>
      checkSegregation(a, stateRef.current.nonce),
    []
  );
  const execCommit = useCallback(
    async (a: { approvalToken: string; vehicles: Array<{ items: string[]; barriersPresent?: boolean; singleShipper?: boolean }> }) => {
      const out = await commitManifest(a, stateRef.current.nonce);
      if (out.status === "COMMITTED") onCommittedRef.current?.(out.shippingPaper);
      return out;
    },
    []
  );

  const lookup = useWebMCP({
    name: "lookup_material",
    description: DESCRIPTIONS.lookup_material,
    inputSchema: LOOKUP_MATERIAL_SCHEMA,
    annotations: READ_ONLY,
    execute: execLookup,
  });

  const classify = useWebMCP({
    name: "classify_line_item",
    description: DESCRIPTIONS.classify_line_item,
    inputSchema: CLASSIFY_LINE_ITEM_SCHEMA,
    // It ingests free text that may have come from a supplier email or a
    // spreadsheet. The hint asks the agent to treat the result as untrusted;
    // it is advisory only, which is exactly why the verdict is computed by a
    // deterministic solver from the CONFIRMED entry and never from this text.
    annotations: READ_ONLY_UNTRUSTED,
    execute: execClassify,
  });

  const propose = useWebMCP({
    name: "propose_load",
    description: DESCRIPTIONS.propose_load,
    inputSchema: PROPOSE_LOAD_SCHEMA,
    annotations: READ_ONLY,
    execute: execPropose,
    enabled: hasManifest,
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

  const registered = useMemo(() => {
    const on: string[] = [];
    if (lookup.registered) on.push("lookup_material");
    if (classify.registered) on.push("classify_line_item");
    if (propose.registered) on.push("propose_load");
    if (check.registered) on.push("check_segregation");
    if (commit.registered) on.push("commit_manifest");
    return on;
  }, [lookup.registered, classify.registered, propose.registered, check.registered, commit.registered]);

  const error = lookup.error ?? classify.error ?? propose.error ?? check.error ?? commit.error;

  return {
    supported: lookup.supported,
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
