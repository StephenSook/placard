/**
 * Component states preview.
 *
 * Not the product. This renders every state of the two signature components
 * side by side so they can be reviewed, screenshotted and compared as a set,
 * which is the only way to catch a state that reads wrong only next to its
 * siblings. The real console replaces this.
 *
 * Every fixture below is resolved from the committed 49 CFR corpus rather than
 * hand-written, so a preview can never show a verdict the solver would not
 * actually produce.
 */
import { useEffect, useState } from "react";
import { VerdictCard, VerdictAnnouncer } from "./ui/VerdictCard.tsx";
import { ToolRegistryStrip } from "./ui/ToolRegistryStrip.tsx";
import { checkLoad, resolveItem } from "./solver/index.ts";
import type { Violation } from "./solver/types.ts";
import "./ui/preview.css";

const ALL_TOOLS = ["lookup_material", "classify_line_item", "propose_load", "check_segregation", "commit_manifest"];

type Scene = {
  id: string;
  caption: string;
  status: "PASS" | "REFUSED" | "IDLE";
  violation?: Violation;
  pair?: [string, string];
  names?: [string, string];
  pairsChecked: number;
  registered: string[];
};

/** Resolve a display name and class straight from the corpus. */
function look(id: string): { name: string; cls: string } {
  const r = resolveItem({ id });
  if ("error" in r) return { name: id, cls: "Forbidden" };
  return { name: r.name, cls: r.hazardClass };
}

export function App() {
  const [scenes, setScenes] = useState<Scene[]>([]);

  useEffect(() => {
    (async () => {
      const built: Scene[] = [];

      built.push({
        id: "idle",
        caption: "Nothing checked yet. Two read-only tools are already live, so an agent can look a material up on arrival.",
        status: "IDLE",
        pairsChecked: 0,
        registered: ["lookup_material", "classify_line_item"],
      });

      // The money shot. The cell is O and a barrier is asserted, and it still
      // refuses, because 177.848(e)(3) blocks it notwithstanding separation.
      const hard = await checkLoad(
        { vehicles: [{ items: [{ id: "UN1830" }, { id: "UN1748" }], barriersPresent: true }] },
        "preview"
      );
      if (hard.status === "REFUSED") {
        const a = look("UN1830"), b = look("UN1748");
        built.push({
          id: "hard-block",
          caption: "The cell is O and the operator has asserted a barrier. It still refuses: 177.848(e)(3) blocks Class 8 liquids above or adjacent to Class 4 or 5 notwithstanding any separation. An agent reading only the matrix clears this load.",
          status: "REFUSED",
          violation: hard.violations[0]!,
          pair: [a.cls, b.cls],
          names: [a.name, b.name],
          pairsChecked: hard.checked,
          registered: ["lookup_material", "classify_line_item", "propose_load", "check_segregation"],
        });
      }

      // The Forbidden axis. No UN number exists for this material at all.
      const forbidden = await checkLoad({ vehicles: [{ items: [{ name: "Ammonium chlorate" }] }] }, "preview");
      if (forbidden.status === "REFUSED") {
        built.push({
          id: "forbidden",
          caption: "Ammonium chlorate has no identification number, because under 172.101(d)(1) it may not be offered for transportation at all. Any index keyed on UN numbers returns nothing for it, and nothing reads as not regulated.",
          status: "REFUSED",
          violation: forbidden.violations[0]!,
          pair: ["Forbidden", "Forbidden"],
          names: ["Ammonium chlorate", "no lawful configuration"],
          pairsChecked: forbidden.checked,
          registered: ["lookup_material", "classify_line_item", "propose_load", "check_segregation"],
        });
      }

      // The pass, and the moment commit_manifest arrives in the registry.
      const pass = await checkLoad(
        { vehicles: [{ items: [{ id: "UN1830" }] }, { items: [{ id: "UN1748" }] }] },
        "preview"
      );
      if (pass.status === "PASS") {
        const a = look("UN1830"), b = look("UN1748");
        built.push({
          id: "pass",
          caption: "The same two materials on separate vehicles. The load passes, and commit_manifest arrives in the agent's registry. That is the frame the demo is built around.",
          status: "PASS",
          pair: [a.cls, b.cls],
          names: [a.name, b.name],
          pairsChecked: pass.checked,
          registered: ALL_TOOLS,
        });
      }

      setScenes(built);
    })().catch(() => setScenes([]));
  }, []);

  return (
    <main className="preview">
      <header className="preview__head">
        <p className="preview__eyebrow mono">Component states</p>
        <h1 className="preview__title">Verdict card and tool registry</h1>
        <p className="preview__lead">
          Every fixture below is resolved from the committed 49 CFR corpus, so this preview cannot
          show a verdict the solver would not actually produce.
        </p>
      </header>

      {scenes.length === 0 && <p className="preview__loading mono">resolving fixtures from the corpus</p>}

      {scenes.map((s) => (
        <section key={s.id} className="preview__scene rise">
          <p className="preview__caption">{s.caption}</p>
          <div className="preview__pair">
            <VerdictCard
              status={s.status}
              violation={s.violation}
              pair={s.pair}
              names={s.names}
              pairsChecked={s.pairsChecked}
            />
            <ToolRegistryStrip registered={s.registered} all={ALL_TOOLS} supported />
          </div>
        </section>
      ))}

      {/* Rendered once, always present, never conditionally mounted. */}
      <VerdictAnnouncer message="" />
    </main>
  );
}
