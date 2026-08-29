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

/**
 * ORTHOGRAPHIC NORMALISATION, and the reason it exists is not user typos.
 *
 * The 172.101 table is NOT internally consistent about British and American
 * spelling. It contains "Nicotine sulphate, solid" (UN3445), "Titanium
 * disulphide" (UN3174) and "Caesium hydroxide" (UN2682) alongside ninety
 * entries spelled with -sulf- and two spelled Cesium. One row, UN1407, is
 * literally named "Cesium or Caesium".
 *
 * So an index that matches names literally loses real materials in BOTH
 * directions. A US shipper searching "nicotine sulfate" misses UN3445. A
 * European shipper searching "sulphuric acid" misses UN1830. Neither of them
 * typed anything wrong, and an empty result reads as "not regulated", which is
 * the same failure mode as the 256 Forbidden entries that carry no
 * identification number.
 *
 * Every rule here is a pure orthographic variant of the SAME word, never a
 * synonym of a different substance. Deliberately excluded: glycerol to
 * glycerin, because the table carries both as DISTINCT entries, so rewriting
 * one to the other would move a query onto a different material. That is the
 * line: normalise spelling, never meaning.
 *
 * A test asserts this mapping is injective over the corpus, meaning no two
 * distinct entry names collapse to one key. It currently holds at 2,574
 * distinct names to 2,574 distinct keys.
 */
const ORTHOGRAPHY: ReadonlyArray<readonly [RegExp, string]> = [
  [/sulph/g, "sulf"],        // sulphuric, sulphate, sulphide, sulphur
  [/aluminium/g, "aluminum"],
  [/caesium/g, "cesium"],
];

export function normalizeOrthography(s: string): string {
  let t = s.toLowerCase().trim();
  for (const [re, to] of ORTHOGRAPHY) t = t.replace(re, to);
  // Collapse whitespace and strip the punctuation the table uses decoratively,
  // so "Aluminum powder, coated" and "aluminium powder coated" agree.
  return t.replace(/[),.;]/g, " ").replace(/\s+/g, " ").trim();
}

/** Name index keyed on the normalised form, so either spelling resolves. */
const byNormalizedName = new Map<string, HmtEntry>();
for (const e of HMT) {
  const k = normalizeOrthography(e.name);
  if (!byNormalizedName.has(k)) byNormalizedName.set(k, e);
}

/** Every row sharing a UN number. A UN number can carry several packing groups. */
export function lookupByUn(un: string): HmtEntry[] {
  return byUn.get(un.toUpperCase().trim()) ?? [];
}

/**
 * Every entry sharing a proper shipping name, after orthographic normalisation.
 *
 * This exists because a generic "n.o.s." name is NOT a unique identifier.
 * "Articles, explosive, n.o.s." names NINETEEN entries in the 172.101 table,
 * spanning divisions 1.4S, 1.4B, 1.4C, 1.4D, 1.4G, 1.1C, 1.1D, 1.1E, 1.1F,
 * 1.2C, 1.2D, 1.2E, 1.2F, 1.3C, 1.3L, 1.1L, 1.2L, 1.4E and 1.4F.
 */
export function entriesByName(name: string): HmtEntry[] {
  const exact = HMT.filter((e) => e.name.toLowerCase() === name.toLowerCase().trim());
  if (exact.length) return exact;
  const k = normalizeOrthography(name);
  return HMT.filter((e) => normalizeOrthography(e.name) === k);
}

export type NameResolution =
  | { kind: "resolved"; entry: HmtEntry }
  /** The name is real but names several DIFFERENT hazard classes. */
  | { kind: "ambiguous"; candidates: HmtEntry[]; classes: string[] }
  | { kind: "not_found" };

/**
 * Resolve a proper shipping name, REFUSING when the name does not determine a
 * hazard class.
 *
 * THIS IS A SAFETY BOUNDARY, and it was originally missing. The index used to
 * take the first entry whose name matched. For "Articles, explosive, n.o.s."
 * that returned UN0350, division 1.4B, and silently discarded eighteen other
 * entries including 1.1C, 1.1D, 1.1E and 1.1F. Division 1.4 and division 1.1
 * are different rows of the 177.848(d) matrix, so the arbitrary pick produced a
 * verdict that was WRONG IN THE PERMISSIVE DIRECTION: a load cleared as 1.4
 * when the material may have been 1.1.
 *
 * Scope, measured against the committed corpus: 2,121 names resolve to exactly
 * one entry. 354 name entries that differ only by packing group, which share a
 * class and therefore share a segregation verdict, so those still resolve. 88
 * names span more than one hazard class and now refuse. None of the 256
 * Forbidden materials is ambiguous, so the by-name path they depend on, being
 * the only path they have, is untouched.
 */
export function resolveName(name: string, maxHops = 5): NameResolution {
  let key = name.toLowerCase().trim();
  const seen = new Set<string>();
  for (let i = 0; i <= maxHops; i++) {
    const rows = entriesByName(key);
    if (rows.length) {
      const classes = [...new Set(rows.map((e) => e.class))];
      if (classes.length > 1) return { kind: "ambiguous", candidates: rows, classes };
      return { kind: "resolved", entry: rows[0]! };
    }
    const target = synonymIndex.get(key);
    if (!target || seen.has(target)) return { kind: "not_found" };
    seen.add(key);
    key = target;
  }
  return { kind: "not_found" };
}

/**
 * Resolve a name, following the table's own ", see" pointers transitively.
 * Guarded against cycles and capped, because a malformed corpus must fail
 * loudly rather than hang the page.
 *
 * Returns null for an AMBIGUOUS name as well as for an unknown one. Callers
 * that need to tell those apart, and any caller reporting to a human should,
 * must use resolveName.
 */
export function lookupByName(name: string, maxHops = 5): HmtEntry | null {
  const r = resolveName(name, maxHops);
  return r.kind === "resolved" ? r.entry : null;
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
