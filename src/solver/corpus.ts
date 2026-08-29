/**
 * Corpus access. Pure lookups over the vendored 49 CFR data, no I/O at call time.
 *
 * Everything here is derived from data/ at build time by scripts/extract.ts and
 * is hash-manifested in data/SHA256SUMS. `npm run verify:data` proves the files
 * on disk are the files that were hashed and that every clause quoted anywhere
 * is a verbatim substring of the pinned eCFR source.
 */
import hmtJson from "../../data/hmt.json" with { type: "json" };
import segJson from "../../data/segregation_table.json" with { type: "json" };
import compJson from "../../data/compatibility_table.json" with { type: "json" };
import clauseJson from "../../data/clauses.json" with { type: "json" };
import synJson from "../../data/synonyms.json" with { type: "json" };
import type { Citation, MatrixKey } from "./types.ts";

export type HmtEntry = {
  index: number;
  name: string;
  class: string;
  un: string | null;
  pg: string | null;
  labels: string[];
  specialProvisions: string[];
  symbols: {
    raw: string; airOnly: boolean; vesselOnly: boolean; domesticOnly: boolean;
    internationalOnly: boolean; technicalNameRequired: boolean; fixedClassification: boolean;
  };
  qtyPassengerAircraft: string;
  qtyCargoAircraft: string;
  vesselLocation: string;
  forbidden: boolean;
  packingGroupVariant: boolean;
};

export const HMT = hmtJson.entries as HmtEntry[];
export const SEGREGATION = segJson as {
  source: string;
  columns: string[];
  rows: Array<{ key: string; division: string; zone: string | null; label: string; note: string | null; cells: Record<string, string> }>;
  census: Record<string, number>;
};
export const COMPATIBILITY = compJson as {
  source: string; groups: string[]; matrix: Record<string, Record<string, string>>;
};
const CLAUSE_MAP = (clauseJson as { clauses: Record<string, { section: string; text: string }> }).clauses;
export const SYNONYMS = (synJson as { synonyms: Array<{ alias: string; target: string; kind: string }> }).synonyms;

/**
 * A verbatim clause by id. Throws on an unknown id rather than returning a
 * placeholder, so a typo in a citation reference is a build-time crash and
 * never a quietly empty quote shown to a human.
 */
export function cite(id: string): Citation {
  const c = CLAUSE_MAP[id];
  if (!c) throw new Error(`unknown clause id: ${id}`);
  return { section: c.section, text: c.text };
}

export const CLAUSE_IDS: readonly string[] = Object.keys(CLAUSE_MAP);

// ── indexes, built once ──────────────────────────────────────────────────────

const byUn = new Map<string, HmtEntry[]>();
const byName = new Map<string, HmtEntry>();
for (const e of HMT) {
  if (e.un) {
    const list = byUn.get(e.un);
    if (list) list.push(e); else byUn.set(e.un, [e]);
  }
  // First writer wins so the base entry, not a packing-group variant, is canonical.
  if (!byName.has(e.name.toLowerCase())) byName.set(e.name.toLowerCase(), e);
}

const synonymIndex = new Map<string, string>();
for (const s of SYNONYMS) synonymIndex.set(s.alias.toLowerCase(), s.target.toLowerCase());

/** Every row sharing a UN number. A UN number can carry several packing groups. */
export function lookupByUn(un: string): HmtEntry[] {
  return byUn.get(un.toUpperCase().trim()) ?? [];
}

/**
 * Resolve a name, following the table's own ", see" pointers transitively.
 * Guarded against cycles and capped, because a malformed corpus must fail
 * loudly rather than hang the page.
 */
export function lookupByName(name: string, maxHops = 5): HmtEntry | null {
  let key = name.toLowerCase().trim();
  const seen = new Set<string>();
  for (let i = 0; i <= maxHops; i++) {
    const direct = byName.get(key);
    if (direct) return direct;
    const target = synonymIndex.get(key);
    if (!target || seen.has(target)) return null;
    seen.add(key);
    key = target;
  }
  return null;
}

/** Every material the regulation forbids outright. 256 of them, none with a UN number. */
export function forbiddenEntries(): HmtEntry[] {
  return HMT.filter((e) => e.forbidden);
}

// ── the matrix ───────────────────────────────────────────────────────────────

/**
 * Row keys and COLUMN keys use different vocabularies in the published table:
 * the row reads "8" with the label "Corrosive liquids" while the column reads
 * "8 liquids only". This map is the bridge, and a test asserts it is total and
 * that the resulting matrix is symmetric.
 */
export const ROW_TO_COLUMN: Record<MatrixKey, string> = {
  "1.1 and 1.2": "1.1 1.2",
  "1.3": "1.3",
  "1.4": "1.4",
  "1.5": "1.5",
  "1.6": "1.6",
  "2.1": "2.1",
  "2.2": "2.2",
  "2.3 zone A": "2.3 gas zone A",
  "2.3 zone B": "2.3 gas Zone B",
  "3": "3",
  "4.1": "4.1",
  "4.2": "4.2",
  "4.3": "4.3",
  "5.1": "5.1",
  "5.2": "5.2",
  "6.1 zone A": "6.1 liquids PG I zone A",
  "7": "7",
  "8": "8 liquids only",
};

const rowByKey = new Map(SEGREGATION.rows.map((r) => [r.key, r]));

/** The published cell for an ordered pair. Throws rather than defaulting. */
export function segregationCell(a: MatrixKey, b: MatrixKey): string {
  const row = rowByKey.get(a);
  if (!row) throw new Error(`no segregation row: ${a}`);
  const col = ROW_TO_COLUMN[b];
  const v = row.cells[col];
  if (v === undefined) throw new Error(`no cell: row ${a}, column ${col}`);
  return v;
}

/** Note "A" rows carry the ammonium nitrate carve-out of 177.848(e)(5). */
export function rowNote(a: MatrixKey): string | null {
  return rowByKey.get(a)?.note ?? null;
}

/** The verbatim regulation label for a hazard row, used as the UI label. */
export function rowLabel(a: MatrixKey): string {
  const r = rowByKey.get(a);
  if (!r) throw new Error(`no segregation row: ${a}`);
  return r.label;
}

/** The published cell for a pair of explosive compatibility groups. */
export function compatibilityCell(a: string, b: string): string {
  const row = COMPATIBILITY.matrix[a];
  if (!row) throw new Error(`no compatibility row: ${a}`);
  const v = row[b];
  if (v === undefined) throw new Error(`no compatibility cell: ${a} x ${b}`);
  return v;
}
