/**
 * Direct imperative registration of the state-independent tools, at mount,
 * outside React's lifecycle.
 *
 * WHY THESE TWO ARE NOT IN THE REACT HOOK. `lookup_material` and
 * `classify_line_item` depend on nothing but the vendored corpus. They have no
 * lifecycle, so binding them to a component's mount and unmount buys nothing
 * and costs two things that matter here:
 *
 *   1. TIMING. Lighthouse's agentic-browsing audit snapshots the registered
 *      tool set, and Chrome's guidance is to register core read-only tools
 *      early because registration timing affects whether they are captured.
 *   2. AVAILABILITY. An agent that opens the page can look a material up
 *      immediately, including the 256 Forbidden entries, without waiting for
 *      React to hydrate.
 *
 * The three STATE-DEPENDENT tools stay in the hook, where lifecycle is exactly
 * what you want: `propose_load` and `check_segregation` appear once there is a
 * manifest, and `commit_manifest` appears only while the load passes.
 *
 * Unregistration is AbortSignal driven. There is no `unregisterTool`: it was
 * removed from the spec in April 2026 in favour of aborting the signal passed
 * to `registerTool`.
 */
import {
  CLASSIFY_LINE_ITEM_SCHEMA, DESCRIPTIONS, LOOKUP_MATERIAL_SCHEMA,
  READ_ONLY, READ_ONLY_UNTRUSTED,
} from "./schemas.ts";
import { classifyLineItem, lookupMaterial } from "./executors.ts";

/** Minimal shape of the imperative API, per the WebMCP Draft Community Group
 *  Report of 26 August 2026. Declared locally so this module has no dependency
 *  on a runtime that may not be present. */
export type WebMCPTool = {
  name: string;
  description: string;
  inputSchema?: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (args: never) => Promise<WebMCPResult> | WebMCPResult;
};
export type WebMCPResult = { content: Array<{ type: string; text?: string }>; isError?: boolean };
export type ModelContext = {
  registerTool: (tool: WebMCPTool, options?: { signal?: AbortSignal }) => Promise<void> | void;
  getTools?: () => Promise<unknown[]>;
};

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

const asText = (value: unknown): WebMCPResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});

/** The two descriptors, defined once so both entry points register identical
 *  tools and a test cannot pass against a different surface than ships. */
export const ALWAYS_ON_TOOLS: readonly WebMCPTool[] = Object.freeze([
  Object.freeze({
    name: "lookup_material",
    description: DESCRIPTIONS.lookup_material,
    inputSchema: LOOKUP_MATERIAL_SCHEMA,
    annotations: READ_ONLY,
    execute: async (args: never) => asText(lookupMaterial(args as { query: string })),
  }),
  Object.freeze({
    name: "classify_line_item",
    description: DESCRIPTIONS.classify_line_item,
    inputSchema: CLASSIFY_LINE_ITEM_SCHEMA,
    // It ingests free text that may have come from a supplier email or a
    // spreadsheet. The hint asks the agent to treat the result as untrusted.
    // It is advisory, which is why nothing in that text can reach a verdict:
    // the solver computes from confirmed corpus entries alone.
    annotations: READ_ONLY_UNTRUSTED,
    execute: async (args: never) => asText(classifyLineItem(args as { text: string })),
  }),
]);

let controller: AbortController | null = null;

/**
 * Register the always-on tools on the live document.
 *
 * Idempotent: it aborts the previous registration first, because the WebMCP
 * tool map is keyed by name and a second registration under the same name
 * would silently overwrite rather than stack.
 *
 * Returns the names registered, or an empty array where the API is absent.
 * WebMCP is a progressive enhancement here: with no runtime, the human
 * workflow on the page is unchanged.
 */
export function registerAlwaysOnTools(): string[] {
  if (typeof document === "undefined" || !document.modelContext) return [];

  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  // The imperative registration call, on the top-level document. ChatGPT's
  // in-app browser does not discover tools inside iframes and does not support
  // the declarative form API, so this is the only surface that reaches it.
  document.modelContext.registerTool(ALWAYS_ON_TOOLS[0]!, { signal });
  document.modelContext.registerTool(ALWAYS_ON_TOOLS[1]!, { signal });

  return ALWAYS_ON_TOOLS.map((t) => t.name);
}

/**
 * The same registration against an injected context. Used by the tests so the
 * whole path is provable in Node, and by any host that exposes the API
 * somewhere other than the global document.
 */
export function registerAlwaysOnToolsInto(ctx: ModelContext, signal?: AbortSignal): string[] {
  for (const tool of ALWAYS_ON_TOOLS) {
    ctx.registerTool(tool, signal ? { signal } : undefined);
  }
  return ALWAYS_ON_TOOLS.map((t) => t.name);
}

/** Tear down the always-on tools by aborting their signal. */
export function unregisterAlwaysOnTools(): void {
  controller?.abort();
  controller = null;
}

/** Whether a WebMCP runtime is present at all. */
export function webmcpSupported(): boolean {
  return typeof document !== "undefined" && Boolean(document.modelContext);
}
