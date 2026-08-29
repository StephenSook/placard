/**
 * THE MANIFEST PANEL. Paper, because a manifest is a document.
 *
 * Follows the reference site's card pattern exactly: a heading, a subhead, and
 * a list of rows each separated by a hairline. That pattern happens to be what
 * a shipping paper looks like, which is why it was worth borrowing.
 *
 * The add field accepts what an operator actually has: an identification
 * number, a proper shipping name, or one of the table's own synonyms. It
 * resolves through the SAME executor the agent's lookup_material tool uses, so
 * a human and an agent can never get different answers about a material.
 */
import { useState } from "react";
import { Placard } from "./Placard.tsx";
import { lookupMaterial } from "../tools/executors.ts";
import type { ResolvedItem } from "../solver/types.ts";
import "./manifest.css";

export type ManifestPanelProps = {
  items: ResolvedItem[];
  onAdd: (query: string) => void;
  onRemove: (index: number) => void;
  onLoadDemo: () => void;
};

export function ManifestPanel({ items, onAdd, onRemove, onLoadDemo }: ManifestPanelProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const suggestions =
    query.trim().length >= 3 ? lookupMaterial({ query }).matches.slice(0, 5) : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const r = lookupMaterial({ query: q });
    if (r.matches.length === 0) {
      // Never let a miss read as "not regulated". Same rule as the tool.
      setError(r.note ?? "No entry matched.");
      return;
    }
    setError(null);
    onAdd(q);
    setQuery("");
  }

  return (
    <section className="manifest" aria-labelledby="manifest-heading">
      <header className="manifest__head">
        <div>
          <h2 id="manifest-heading" className="manifest__title">Manifest</h2>
          <p className="manifest__sub">
            {items.length === 0
              ? "Nothing loaded"
              : `${items.length} line ${items.length === 1 ? "item" : "items"}`}
          </p>
        </div>
        {items.length === 0 && (
          <button type="button" className="pill" onClick={onLoadDemo}>
            Load a sample lab pack <span aria-hidden="true">&#8599;</span>
          </button>
        )}
      </header>

      <form className="manifest__add" onSubmit={submit}>
        <label className="sr-only" htmlFor="manifest-query">
          Add a material by identification number, proper shipping name, or synonym
        </label>
        <input
          id="manifest-query"
          className="manifest__input mono"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(null); }}
          placeholder="UN1090, or acetone, or a synonym"
          autoComplete="off"
          spellCheck={false}
          maxLength={200}
        />
        <button type="submit" className="pill pill--solid">Add</button>
      </form>

      {error && (
        <p className="manifest__error" role="alert">{error}</p>
      )}

      {suggestions.length > 0 && (
        <ul className="manifest__suggest">
          {suggestions.map((m) => (
            <li key={`${m.id ?? m.name}`}>
              <button
                type="button"
                className="manifest__suggestion"
                onClick={() => { onAdd(m.id ?? m.name); setQuery(""); setError(null); }}
              >
                <span className="manifest__sname">{m.name}</span>
                <span className="mono manifest__smeta">
                  {m.id ?? "no ID number"} &middot; {m.forbidden ? "FORBIDDEN" : `class ${m.hazardClass}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ul className="manifest__list">
        {items.map((it, i) => (
          <li key={`${it.item.id ?? it.name}-${i}`} className="manifest__row">
            <Placard hazardClass={it.forbidden ? "Forbidden" : it.hazardClass} size={34} />
            <span className="manifest__name">
              {it.name}
              {it.hazards.some((h) => h.subsidiary) && (
                <span className="manifest__tag mono">
                  subsidiary {it.hazards.filter((h) => h.subsidiary).map((h) => h.raw).join(", ")}
                </span>
              )}
            </span>
            <span className="manifest__id mono">
              {it.item.id ?? <span className="manifest__noid">no ID number</span>}
              {it.packingGroup && <span className="manifest__pg"> PG {it.packingGroup}</span>}
            </span>
            <button
              type="button"
              className="manifest__remove"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${it.name} from the manifest`}
            >
              &times;
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
