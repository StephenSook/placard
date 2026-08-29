/**
 * THE TOOL REGISTRY STRIP.
 *
 * This is not decoration and it is not a status bar. It shows a judge, live,
 * exactly which tools the agent can currently see, and it renders ABSENCE as
 * loudly as presence. When the verdict flips to PASS, commit_manifest appears
 * in it. That single frame is the entire WebMCP Leverage argument rendered as
 * interface, and it is the moment the demo video is built around.
 *
 * Rendering absence is the whole design problem. A registry that only lists
 * what exists says nothing; the reader has to already know what is missing.
 * So every tool the page can ever offer is always drawn, and the ones the
 * agent cannot see are struck through and dimmed with the word ABSENT beside
 * them.
 *
 * A screen-reader user must get this too. Registry changes are announced in a
 * POLITE live region, not an assertive one: a tool appearing is a status
 * change, not a safety alert, and interrupting someone mid-sentence for it
 * would be wrong. The refusal alert in VerdictCard is the assertive one.
 */
import { useEffect, useRef, useState } from "react";
import "./registry.css";

export type ToolRegistryStripProps = {
  /** Names the agent can currently see. */
  registered: string[];
  /** Every tool this page can ever offer. */
  all: string[];
  /** Whether a WebMCP runtime is present at all. */
  supported: boolean;
};

/** Which tool is the gated one. Drawn differently because it is the point. */
const GATED = "commit_manifest";

export function ToolRegistryStrip({ registered, all, supported }: ToolRegistryStripProps) {
  const live = new Set(registered);
  const [announcement, setAnnouncement] = useState("");
  const previous = useRef<string[]>([]);

  useEffect(() => {
    const before = new Set(previous.current);
    const added = registered.filter((t) => !before.has(t));
    const removed = previous.current.filter((t) => !live.has(t));
    previous.current = registered;
    if (!added.length && !removed.length) return;
    const parts: string[] = [];
    if (added.length) parts.push(`${added.join(", ")} ${added.length === 1 ? "is" : "are"} now available to the agent`);
    if (removed.length) parts.push(`${removed.join(", ")} ${removed.length === 1 ? "is" : "are"} no longer available`);
    setAnnouncement(parts.join(". ") + ".");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registered.join("|")]);

  return (
    <section className="registry" aria-labelledby="registry-heading">
      <div className="registry__lead">
        <h2 id="registry-heading" className="registry__heading">
          Tool registry
        </h2>
        <span className="registry__count mono">
          {registered.length} of {all.length} visible to the agent
        </span>
      </div>

      <ul className="registry__list">
        {all.map((name) => {
          const on = live.has(name);
          const gated = name === GATED;
          return (
            <li
              key={name}
              className={
                "registry__item" +
                (on ? " is-live" : " is-absent") +
                (gated ? " is-gated" : "")
              }
            >
              <span className="registry__dot" aria-hidden="true" />
              <span className="registry__name mono">{name}</span>
              {/* The word, not just the styling. Colour and strike-through
                  alone would fail WCAG 1.4.1 and would fail a printout. */}
              <span className="registry__state mono">{on ? "REGISTERED" : "ABSENT"}</span>
            </li>
          );
        })}
      </ul>

      <p className="registry__note">
        {supported ? (
          <>
            <strong>{GATED}</strong> is absent from the agent&rsquo;s registry until the load passes.
            That is the visible layer. The boundary is that its handler re-derives the verdict from a
            hash of the exact contents it is about to export, so a stale load, a mutated load and a
            same-named shadow tool are all uncommittable regardless of registration order.
          </>
        ) : (
          <>
            No WebMCP runtime detected, so no tools are registered. Everything on this page still
            works: WebMCP is a progressive enhancement here, not a dependency. Open in ChatGPT&rsquo;s
            in-app browser, or Chrome 149+ with <span className="mono">#enable-webmcp-testing</span>.
          </>
        )}
      </p>

      {/* Polite: a tool appearing is a status change, not a safety alert. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </section>
  );
}
