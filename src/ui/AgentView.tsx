/**
 * WHAT THE AGENT ACTUALLY SEES.
 *
 * The tool registry strip says which tools exist. This says it in the agent's
 * own words: the literal result of `document.modelContext.getTools()`, re-read
 * whenever the page's verdict changes.
 *
 * It exists because "the tool is not registered" is a claim about a data
 * structure the reader cannot see. Here it is. When the verdict flips, watch
 * the array change length.
 *
 * It reads from the LIVE registry rather than from this app's own state, so if
 * the two ever disagree, this panel shows the truth and the strip shows the
 * lie. That is deliberate: a mirror of our own state would be incapable of
 * revealing a bug.
 */
import { useCallback, useEffect, useState } from "react";
import type { RegisteredTool } from "../tools/registerEarly.ts";
import "./agentview.css";

export function AgentView({ revision }: { revision: number }) {
  const [tools, setTools] = useState<RegisteredTool[] | null>(null);
  const [open, setOpen] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const read = useCallback(async () => {
    const ctx = typeof document === "undefined" ? undefined : document.modelContext;
    if (!ctx || typeof ctx.getTools !== "function") { setUnsupported(true); return; }
    try { setTools(await ctx.getTools()); } catch { setTools([]); }
  }, []);

  // Re-read on every verdict change, and also on the spec's own toolchange
  // event, which fires when ANY script touches the registry, including one we
  // did not write.
  useEffect(() => {
    void read();
    const ctx = typeof document === "undefined" ? undefined : document.modelContext;
    const target = ctx as unknown as EventTarget | undefined;
    if (!target?.addEventListener) return;
    const onChange = () => void read();
    target.addEventListener("toolchange", onChange);
    return () => target.removeEventListener("toolchange", onChange);
  }, [read, revision]);

  if (unsupported) {
    return (
      <p className="agentview agentview--none mono">
        document.modelContext is not present on this client, so there is no registry to show.
      </p>
    );
  }

  const shaped = (tools ?? []).map((t) => ({
    name: t.name,
    annotations: t.annotations ?? {},
  }));

  return (
    <div className="agentview">
      <button
        type="button"
        className="agentview__toggle mono"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide" : "Show"} what the agent sees
        <span className="agentview__count">{shaped.length}</span>
      </button>

      {open && (
        <pre className="agentview__json mono" aria-live="polite">
{`await document.modelContext.getTools()

${JSON.stringify(shaped, null, 2)}`}
        </pre>
      )}
    </div>
  );
}
