/**
 * Derives data/provenance.json from data/PROVENANCE.md.
 *
 * WHY THIS EXISTS. The snapshot and amendment dates go on judge-facing surfaces
 * and into a public API response, so they are exactly the class of figure that
 * must never be typed into a constant from memory. PROVENANCE.md is the record
 * `npm run extract` writes; this turns it into something both Vite and the
 * Netlify function bundler can import, without either of them needing a
 * Vite-only `?raw` import or a second copy of the truth.
 *
 * A test asserts the JSON still matches the markdown, so the two cannot drift.
 * Run with `npm run provenance`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

export function parseProvenance(md: string) {
  const field = (label: string): string => {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`\\|\\s*${esc}\\s*\\|\\s*\`([^\`]+)\``).exec(md);
    if (!m || !m[1]) {
      // Loud rather than empty. An undefined here would publish a blank date.
      throw new Error(`PROVENANCE.md has no row for "${label}"`);
    }
    return m[1];
  };
  return {
    ecfr_snapshot: field("eCFR snapshot requested"),
    title_49_latest_amended_on: field("Title 49 `latest_amended_on`"),
    title_49_up_to_date_as_of: field("Title 49 `up_to_date_as_of`"),
    endpoint: field("Endpoint"),
  };
}

// NOT `import.meta.url === \`file://${process.argv[1]}\``: this workspace path
// contains spaces, so import.meta.url percent-encodes them and that comparison
// silently never matches, leaving the script a no-op that exits 0.
if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const md = readFileSync(join(DATA, "PROVENANCE.md"), "utf8");
  const out = parseProvenance(md);
  writeFileSync(join(DATA, "provenance.json"), JSON.stringify(out, null, 2) + "\n");
  process.stdout.write(`provenance.json written: ${JSON.stringify(out)}\n`);
}
