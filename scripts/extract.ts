/**
 * Deterministic 49 CFR corpus extraction, pinned to one eCFR snapshot.
 *
 * Run:  npm run extract
 * Then: npm run verify:data   (re-hashes and checks every quoted clause)
 *
 * WHY THIS SCRIPT EXISTS, and it is not a rewrite for its own sake.
 * The previous extraction keyed the Hazardous Materials Table on a UN number
 * matching /^(UN|NA|ID)\d{4}$/ in column 4. That silently discarded 1,207 of
 * the table's 3,687 rows, in three groups, each of which matters:
 *
 *   256  Column-3 "Forbidden" entries. A forbidden material has NO UN number,
 *        by regulation, precisely because it may not be offered for transport.
 *        So the single most dangerous class of material in the table is exactly
 *        the class an id-keyed index deletes, and a lookup returns nothing,
 *        which a reader or an agent takes to mean "not regulated".
 *   524  Packing-group continuation rows. "Adhesives, containing a flammable
 *        liquid / UN1133 / PG I" is followed by bare rows carrying only PG II
 *        and PG III. They inherit name, class and id from above. Packing group
 *        is load-bearing for segregation: 177.848(d) has distinct columns for
 *        "6.1 liquids PG I zone A" and "8 liquids only".
 *   394+ ", see " pointer rows, which are the table's own synonym index.
 *
 * This script keeps all of them.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { rows, tables, plainText } from "./ecfr.ts";
import { CLAUSES } from "./clauses.ts";

// ── The pin ──────────────────────────────────────────────────────────────────
// Change this date deliberately, never incidentally. Everything downstream
// (SHA256SUMS, PROVENANCE.md, every quoted clause) is bound to it.
const SNAPSHOT = "2026-08-27";
const API = "https://www.ecfr.gov/api/versioner/v1";

const SECTIONS = [
  { part: "172", section: "172.101", slug: "172-101-hmt" },
  { part: "172", section: "172.102", slug: "172-102-special-provisions" },
  { part: "173", section: "173.21", slug: "173-21-forbidden" },
  { part: "177", section: "177.848", slug: "177-848-segregation" },
  { part: "177", section: "177.835", slug: "177-835-explosives" },
] as const;

const ROOT = process.cwd();
const RAW = join(ROOT, "data", "raw");
const DATA = join(ROOT, "data");

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function fetchSection(part: string, section: string, slug: string): Promise<string> {
  const file = join(RAW, `${slug}@${SNAPSHOT}.xml`);
  if (existsSync(file)) {
    process.stdout.write(`  cached  ${slug}\n`);
    return readFileSync(file, "utf8");
  }
  const url = `${API}/full/${SNAPSHOT}/title-49.xml?part=${part}&section=${section}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`eCFR ${section}: HTTP ${res.status} ${res.statusText}`);
  const xml = await res.text();
  // A WAF challenge or an error page is served with HTTP 200 by many hosts.
  // Verify CONTENT, never the status code.
  if (xml.length < 5000 || !xml.includes("<DIV8")) {
    throw new Error(`eCFR ${section}: response is ${xml.length} bytes and lacks <DIV8>; refusing to write it`);
  }
  mkdirSync(RAW, { recursive: true });
  writeFileSync(file, xml);
  process.stdout.write(`  fetched ${slug}  ${(xml.length / 1024) | 0} KB\n`);
  return xml;
}

async function titleProvenance() {
  const res = await fetch(`${API}/titles.json`);
  if (!res.ok) throw new Error(`eCFR titles.json: HTTP ${res.status}`);
  const j = (await res.json()) as { titles: Array<Record<string, unknown>> };
  const t = j.titles.find((t) => t.number === 49);
  if (!t) throw new Error("eCFR titles.json: no title 49");
  return t as { latest_amended_on: string; latest_issue_date: string; up_to_date_as_of: string };
}

// ── 172.101, the Hazardous Materials Table ───────────────────────────────────

/** Column 1 symbols, per 172.101(b). Each changes what the row means. */
function parseSymbols(s: string) {
  const t = new Set(s.replace(/,/g, " ").split(/\s+/).filter(Boolean));
  return {
    raw: s,
    /** Not subject to the HMR except when offered by AIRCRAFT. Outside Part 177. */
    airOnly: t.has("A"),
    /** Not subject to the HMR except when offered by VESSEL. Outside Part 177. */
    vesselOnly: t.has("W"),
    domesticOnly: t.has("D"),
    internationalOnly: t.has("I"),
    /** Proper shipping name must be supplemented with a technical name. */
    technicalNameRequired: t.has("G"),
    /** Class, PG and PSN are fixed and may not be changed. */
    fixedClassification: t.has("+"),
  };
}

type HmtRow = {
  index: number;
  name: string;
  class: string;
  un: string | null;
  pg: string | null;
  labels: string[];
  specialProvisions: string[];
  symbols: ReturnType<typeof parseSymbols>;
  qtyPassengerAircraft: string;
  qtyCargoAircraft: string;
  vesselLocation: string;
  /** True when column 3 reads "Forbidden". These have no UN number by design. */
  forbidden: boolean;
  /** True for a continuation row that inherited name/class/un from above. */
  packingGroupVariant: boolean;
};

function parseHmt(xml: string) {
  const all = rows(xml).filter((r) => r.length === 14);
  const entries: HmtRow[] = [];
  const synonyms: Array<{ alias: string; target: string; kind: "see" | "see also" }> = [];

  // Forward-fill state for packing-group continuation rows.
  let lastName = "", lastClass = "", lastUn: string | null = null, lastSymbols = "";

  all.forEach((r, i) => {
    const at = (n: number): string => r[n] ?? "";
    const sym = at(0), rawName = at(1), cls = at(2), id = at(3), pg = at(4);
    const labels = at(5), sp = at(6), qtyPax = at(10), qtyCargo = at(11), vLoc = at(12);

    // ", see X" with no id and no class is a pointer row: the table's own
    // synonym index. "X see also Y" on a row that HAS an id is a cross
    // reference on a real entry, not a redirect.
    const seeMatch = rawName.match(/^(.*?),\s+see\s+(.+)$/i);
    if (seeMatch && !id.trim() && !cls.trim()) {
      synonyms.push({ alias: (seeMatch[1] ?? "").trim(), target: (seeMatch[2] ?? "").trim(), kind: "see" });
      return;
    }
    const seeAlso = rawName.match(/^(.*?)\s+see also\s+(.+)$/i);
    if (seeAlso) synonyms.push({ alias: (seeAlso[1] ?? "").trim(), target: (seeAlso[2] ?? "").trim(), kind: "see also" });

    const isVariant = !rawName.trim() && !cls.trim() && !id.trim();
    if (!isVariant) {
      lastName = rawName || lastName;
      lastClass = cls || lastClass;
      lastUn = /^(UN|NA|ID)\d{4}$/.test(id.trim()) ? id.trim() : null;
      lastSymbols = sym;
    }

    const name = (seeAlso ? (seeAlso[1] ?? "").trim() : rawName) || lastName;
    if (!name) return; // a genuinely empty row; none observed, guarded anyway

    const hazClass = cls || lastClass;
    entries.push({
      index: i,
      name,
      class: hazClass,
      un: isVariant ? lastUn : /^(UN|NA|ID)\d{4}$/.test(id.trim()) ? id.trim() : null,
      pg: pg.trim() || null,
      labels: labels.split(",").map((s) => s.trim()).filter((s) => s && s !== "None"),
      specialProvisions: sp.split(",").map((s) => s.trim()).filter(Boolean),
      symbols: parseSymbols(isVariant ? lastSymbols : sym),
      qtyPassengerAircraft: qtyPax,
      qtyCargoAircraft: qtyCargo,
      vesselLocation: vLoc,
      forbidden: hazClass.trim() === "Forbidden",
      packingGroupVariant: isVariant,
    });
  });

  return { entries, synonyms, physicalRows: all.length };
}

// ── 177.848, the segregation and compatibility tables ────────────────────────

function parseSegregation(xml: string) {
  const t = tables(xml);
  if (t.length < 2) throw new Error(`177.848: expected 2 tables, found ${t.length}`);

  const seg = rows(t[0] ?? "", { includeTh: true });
  const header = seg[0] ?? [];
  // Header is [ "Class or division", "", "Notes", ...18 class columns ]
  const columns = header.slice(3);
  const body = seg.slice(1);

  const segRows = body.map((r) => {
    const label = r[0] ?? "", division = r[1] ?? "", note = r[2] ?? "";
    // 2.3 appears TWICE, as Zone A and Zone B. Keying on division alone
    // collapses them and silently destroys a row. Key on the label too.
    const zone = /Zone A/i.test(label) ? "A" : /Zone B/i.test(label) ? "B" : null;
    return {
      key: zone ? `${division} zone ${zone}` : division,
      division,
      zone,
      label,           // verbatim regulation text, and the UI label
      note: note || null,
      cells: Object.fromEntries(columns.map((c, i) => [c, r[3 + i] ?? ""])),
    };
  });

  const comp = rows(t[1] ?? "", { includeTh: true });
  const groups = (comp[0] ?? []).slice(1);
  const matrix = Object.fromEntries(
    comp.slice(1).map((r) => [r[0] ?? "", Object.fromEntries(groups.map((g, i) => [g, r[1 + i] ?? ""]))])
  );

  return { columns, segRows, groups, matrix };
}

function census(segRows: ReturnType<typeof parseSegregation>["segRows"], columns: string[]) {
  const c: Record<string, number> = { X: 0, O: 0, "*": 0, blank: 0 };
  for (const r of segRows) for (const col of columns) {
    const v: string | undefined = r.cells[col];
    if (v === undefined) throw new Error(`missing cell: row ${r.key}, column ${col}`);
    c[v === "" ? "blank" : v] = (c[v === "" ? "blank" : v] ?? 0) + 1;
  }
  return c;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(DATA, { recursive: true });
  mkdirSync(RAW, { recursive: true });

  process.stdout.write(`eCFR snapshot ${SNAPSHOT}\n`);
  const xml: Record<string, string> = {};
  for (const s of SECTIONS) xml[s.slug] = await fetchSection(s.part, s.section, s.slug);
  const prov = await titleProvenance();

  // Fail closed: a missing section is a broken extraction, not a default.
  const must = (slug: string): string => {
    const x = xml[slug];
    if (!x) throw new Error(`section ${slug} was never fetched`);
    return x;
  };

  // 172.101
  const hmt = parseHmt(must("172-101-hmt"));
  const forbidden = hmt.entries.filter((e) => e.forbidden);
  const variants = hmt.entries.filter((e) => e.packingGroupVariant);
  const withUn = hmt.entries.filter((e) => e.un);
  const multiLabel = hmt.entries.filter((e) => e.labels.length > 1);
  const modeExcluded = hmt.entries.filter((e) => e.symbols.airOnly || e.symbols.vesselOnly);

  // 177.848
  const seg = parseSegregation(must("177-848-segregation"));
  const cen = census(seg.segRows, seg.columns);
  const total = Object.values(cen).reduce((a, b) => a + b, 0);

  // ── The blocking gate. Structural, derived, not a remembered number. ──────
  // These assert the SHAPE the regulation actually has. The census values
  // themselves are recorded in PROVENANCE.md and re-derived by the test suite
  // straight from this same XML, so no figure here was typed from memory.
  const fail: string[] = [];
  if (seg.segRows.length !== 18) fail.push(`segregation rows: ${seg.segRows.length}, expected 18`);
  if (seg.columns.length !== 18) fail.push(`segregation columns: ${seg.columns.length}, expected 18`);
  if (total !== 324) fail.push(`segregation cells: ${total}, expected 18 x 18 = 324`);
  if (new Set(seg.segRows.map((r) => r.key)).size !== 18) fail.push(`duplicate row key: 2.3 Zone A and Zone B must not collide`);
  if (seg.groups.length !== 13) fail.push(`compatibility groups: ${seg.groups.length}, expected 13`);
  if (forbidden.length === 0) fail.push(`zero Forbidden entries recovered; the parser is dropping them again`);
  if (forbidden.some((e) => e.un)) fail.push(`a Forbidden entry carries a UN number, which the regulation does not do`);
  if (hmt.entries.length + hmt.synonyms.filter((s) => s.kind === "see").length !== hmt.physicalRows)
    fail.push(`row accounting: ${hmt.entries.length} entries + ${hmt.synonyms.filter(s => s.kind === "see").length} pointers != ${hmt.physicalRows} physical rows`);
  if (fail.length) {
    process.stderr.write("\nEXTRACTION GATE FAILED\n" + fail.map((f) => `  - ${f}\n`).join(""));
    process.exit(1);
  }

  // ── verbatim clauses ─────────────────────────────────────────────────────
  // Each anchor must match EXACTLY ONCE. Zero means the snapshot moved and the
  // quote no longer exists; two means the anchor is ambiguous and could slice
  // the wrong sentence. Both fail the build rather than shipping a bad quote.
  const plain: Record<string, string> = {};
  for (const sec of SECTIONS) plain[sec.slug] = plainText(must(sec.slug));

  const clauses: Record<string, { section: string; text: string }> = {};
  const clauseFail: string[] = [];
  for (const c of CLAUSES) {
    const hay = plain[c.slug];
    if (!hay) { clauseFail.push(`${c.id}: section ${c.slug} not pinned`); continue; }
    const starts = [...hay.matchAll(new RegExp(escapeRe(c.from), "g"))];
    if (starts.length !== 1) { clauseFail.push(`${c.id}: "from" anchor matched ${starts.length} times, need exactly 1`); continue; }
    const s0 = starts[0]!.index!;
    const ends = [...hay.slice(s0).matchAll(new RegExp(escapeRe(c.to), "g"))];
    if (ends.length < 1) { clauseFail.push(`${c.id}: "to" anchor not found after "from"`); continue; }
    const text = hay.slice(s0, s0 + ends[0]!.index! + c.to.length).trim();
    if (text.length < 20) { clauseFail.push(`${c.id}: extracted ${text.length} chars, implausibly short`); continue; }
    clauses[c.id] = { section: c.section, text };
  }
  if (clauseFail.length) {
    process.stderr.write("\nCLAUSE EXTRACTION FAILED\n" + clauseFail.map((f) => `  - ${f}\n`).join(""));
    process.exit(1);
  }

  // ── emit ─────────────────────────────────────────────────────────────────
  const write = (name: string, obj: unknown) => {
    const body = JSON.stringify(obj, null, 2) + "\n";
    writeFileSync(join(DATA, name), body);
    return { name, sha256: sha256(body), bytes: Buffer.byteLength(body) };
  };

  const manifest: Array<{ name: string; sha256: string; bytes: number }> = [
    write("hmt.json", { source: `49 CFR 172.101, eCFR ${SNAPSHOT}`, count: hmt.entries.length, entries: hmt.entries }),
    write("synonyms.json", { source: `49 CFR 172.101 pointer rows, eCFR ${SNAPSHOT}`, count: hmt.synonyms.length, synonyms: hmt.synonyms }),
    write("segregation_table.json", {
      source: `49 CFR 177.848(d), eCFR ${SNAPSHOT}`,
      columns: seg.columns, rows: seg.segRows, census: cen,
    }),
    write("clauses.json", { source: `verbatim slices of the pinned eCFR sections`, count: Object.keys(clauses).length, clauses }),
    write("compatibility_table.json", {
      source: `49 CFR 177.848(f), eCFR ${SNAPSHOT}`,
      groups: seg.groups, matrix: seg.matrix,
    }),
  ];

  // Hash the raw source too, so a stranger can confirm the inputs as well as
  // the outputs. The XML itself is gitignored (2.9 MB, re-fetchable, pinned).
  for (const s of SECTIONS) {
    const p = join(RAW, `${s.slug}@${SNAPSHOT}.xml`);
    manifest.unshift({ name: `raw/${s.slug}@${SNAPSHOT}.xml`, sha256: sha256(readFileSync(p)), bytes: readFileSync(p).length });
  }

  writeFileSync(join(DATA, "SHA256SUMS"), manifest.map((m) => `${m.sha256}  ${m.name}\n`).join(""));

  const stats = {
    physicalRows: hmt.physicalRows,
    entries: hmt.entries.length,
    forbidden: forbidden.length,
    packingGroupVariants: variants.length,
    withUnNumber: withUn.length,
    synonymPointers: hmt.synonyms.filter((s) => s.kind === "see").length,
    seeAlso: hmt.synonyms.filter((s) => s.kind === "see also").length,
    multiLabel: multiLabel.length,
    modeExcludedFromPart177: modeExcluded.length,
    census: cen,
  };
  writeFileSync(join(DATA, "stats.json"), JSON.stringify(stats, null, 2) + "\n");

  process.stdout.write(`
172.101  ${hmt.physicalRows} physical rows
         ${hmt.entries.length} entries after resolving continuations
         ${forbidden.length} Forbidden (column 3), all with un === null
         ${variants.length} packing-group variants recovered
         ${withUn.length} carry a UN/NA/ID number
         ${stats.synonymPointers} synonym pointers, ${stats.seeAlso} see-also
         ${multiLabel.length} multi-label (subsidiary hazard fires)
         ${modeExcluded.length} air-only or vessel-only, outside Part 177

177.848  ${seg.segRows.length} x ${seg.columns.length} = ${total} cells
         X ${cen.X}   O ${cen.O}   * ${cen["*"]}   blank ${cen.blank}
         compatibility ${seg.groups.length} x ${seg.groups.length} = ${seg.groups.length ** 2}

provenance  latest_amended_on ${prov.latest_amended_on}
            up_to_date_as_of  ${prov.up_to_date_as_of}
`);

  writeFileSync(join(DATA, "PROVENANCE.md"), provenanceDoc(prov, stats, manifest));
  process.stdout.write(`\nwrote ${manifest.length} hashed artifacts to data/\n`);
}

function provenanceDoc(
  prov: { latest_amended_on: string; latest_issue_date: string; up_to_date_as_of: string },
  stats: Record<string, unknown>,
  manifest: Array<{ name: string; sha256: string; bytes: number }>
) {
  return `# Corpus provenance

Generated by \`npm run extract\`. Verify with \`npm run verify:data\`, which needs
no account, no API key and no network.

## The pin

| Field | Value |
|---|---|
| eCFR snapshot requested | \`${SNAPSHOT}\` |
| Title 49 \`latest_amended_on\` | \`${prov.latest_amended_on}\` |
| Title 49 \`latest_issue_date\` | \`${prov.latest_issue_date}\` |
| Title 49 \`up_to_date_as_of\` | \`${prov.up_to_date_as_of}\` |
| Endpoint | \`${API}/full/${SNAPSHOT}/title-49.xml?part=&section=\` |
| Authentication | none required |

Sections pulled: ${SECTIONS.map((s) => `\`${s.section}\``).join(", ")}.

## Legal status

49 CFR text and tables are works of the United States Government and are not
subject to copyright under 17 U.S.C. 105, so they are redistributable in this
public repository. Per the GPO eCFR XML User Guide: "In general, there are no
restrictions on re-use of information in the e-CFR documents because U.S.
Government works are not subject to copyright."

Three constraints follow from the same guide and are honoured here:

1. **The eCFR is the editorial compilation, not the official legal edition.**
   Only the PDF and text versions on GPO's own service have legal status. This
   corpus is a dated snapshot of the editorial compilation and is labelled as
   such everywhere it is quoted.
2. **No NARA seal and no stylized CFR logo** appears anywhere in this project
   (36 CFR part 1200).
3. **No claim of official status.** This is not the CFR and it is not legal
   advice. The person who signs the shipper certification retains full
   responsibility under 49 CFR 172.204.

Nothing from the IMO IMDG Code, or from any standard incorporated by reference
under 49 CFR 171.7, is vendored here. Scope is highway transport under Part 177.

## What the corpus contains

\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\`

### Why the row counts are what they are

The 172.101 table has **${stats.physicalRows}** physical rows. An extraction that
keys on a UN number in column 4 keeps only **${stats.withUnNumber}** of them and
silently discards the rest, in three groups:

- **${stats.forbidden} Forbidden entries.** Column 3 reads \`Forbidden\` and there
  is no UN number, because under 172.101(d)(1) the material "may not be offered
  for transportation or transported" at all. An id-keyed index therefore deletes
  precisely the most dangerous rows in the table, and a lookup for any of them
  returns nothing, which reads as "not regulated".
- **${stats.packingGroupVariants} packing-group continuation rows**, which carry
  only a packing group and inherit name, class and identification number from
  the entry above. Packing group is load-bearing for segregation: 177.848(d)
  has distinct columns for "6.1 liquids PG I zone A" and "8 liquids only".
- **${stats.synonymPointers} pointer rows** of the form "X, see Y", which are the
  table's own synonym index and are kept here as \`synonyms.json\`.

### The segregation matrix

177.848(d) is **18 rows by 18 columns**. Division 2.3 appears as **two** rows,
Poisonous gas Zone A and Poisonous gas Zone B, with materially different
contents. Keying rows on the division alone collapses them and destroys a row,
so rows here are keyed on division plus zone.

## Hashes

Recompute with \`npm run verify:data\`, or by hand:

\`\`\`
shasum -a 256 -c data/SHA256SUMS
\`\`\`

| Artifact | Bytes | SHA-256 |
|---|---:|---|
${manifest.map((m) => `| \`${m.name}\` | ${m.bytes.toLocaleString("en-US")} | \`${m.sha256}\` |`).join("\n")}

The raw eCFR XML is hashed here but not committed: it is large and it is
re-fetchable from the pinned URL above. \`npm run extract\` re-downloads it and
\`npm run verify:data\` fails if the bytes differ from these hashes.
`;
}

main().catch((e) => {
  process.stderr.write(`\nEXTRACTION FAILED: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
