/**
 * npm run verify:data
 *
 * Offline, keyless, no account. Proves three things a judge would otherwise
 * have to take on trust:
 *
 *   1. INTEGRITY   every vendored file still hashes to what SHA256SUMS records
 *   2. CITATION    every clause the app quotes is a VERBATIM substring of the
 *                  pinned eCFR source, not a paraphrase and not a typo
 *   3. SHAPE       the corpus still has the shape the regulation has
 *
 * It prints a NON-VACUITY RECEIPT: the count of things actually checked. A
 * gate that passes because it examined nothing is indistinguishable from one
 * that works, unless it tells you how much it looked at.
 *
 * Exits non-zero on any failure.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { plainText } from "./ecfr.ts";

const ROOT = process.cwd();
const DATA = join(ROOT, "data");
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

let failures = 0;
const fail = (m: string) => { failures++; process.stdout.write(`  FAIL  ${m}\n`); };
const ok = (m: string) => process.stdout.write(`  ok    ${m}\n`);

// ── 1. integrity ─────────────────────────────────────────────────────────────
process.stdout.write("\n1. HASH INTEGRITY\n");
const sums = readFileSync(join(DATA, "SHA256SUMS"), "utf8").trim().split("\n");
let hashed = 0, skippedRaw = 0;
for (const line of sums) {
  const m = /^([a-f0-9]{64})\s+(.+)$/.exec(line.trim());
  if (!m) { fail(`unparseable SHA256SUMS line: ${line}`); continue; }
  const [, want, name] = m as unknown as [string, string, string];
  const path = join(DATA, name);
  if (!existsSync(path)) {
    // The raw eCFR XML is gitignored: large, and re-fetchable from the pinned
    // URL. Its absence is expected in a fresh clone; a WRONG hash is not.
    if (name.startsWith("raw/")) { skippedRaw++; continue; }
    fail(`missing: ${name}`); continue;
  }
  const got = sha256(readFileSync(path));
  if (got !== want) fail(`hash mismatch: ${name}`);
  else hashed++;
}
ok(`${hashed} committed artifacts hash exactly as recorded`);
if (skippedRaw) ok(`${skippedRaw} raw eCFR sources not present locally (gitignored, re-fetch with npm run extract)`);

// ── 2. citation integrity ────────────────────────────────────────────────────
process.stdout.write("\n2. CITATION INTEGRITY\n");
const clauses = JSON.parse(readFileSync(join(DATA, "clauses.json"), "utf8")) as {
  count: number; clauses: Record<string, { section: string; text: string }>;
};
const SLUG_FOR = (section: string): string =>
  section.includes("177.848") ? "177-848-segregation"
  : section.includes("173.21") ? "173-21-forbidden"
  : section.includes("172.102") ? "172-102-special-provisions"
  : section.includes("172.101") ? "172-101-hmt"
  : "";
const SNAPSHOT = /eCFR snapshot requested \| `([\d-]+)`/.exec(readFileSync(join(DATA, "PROVENANCE.md"), "utf8"))?.[1] ?? "";

const sources = new Map<string, string>();
let verified = 0, unverifiable = 0, chars = 0;
for (const [id, c] of Object.entries(clauses.clauses)) {
  const slug = SLUG_FOR(c.section);
  if (!slug) { fail(`${id}: cannot map section "${c.section}" to a pinned source`); continue; }
  const raw = join(DATA, "raw", `${slug}@${SNAPSHOT}.xml`);
  if (!existsSync(raw)) { unverifiable++; continue; }
  let hay = sources.get(slug);
  if (hay === undefined) { hay = plainText(readFileSync(raw, "utf8")); sources.set(slug, hay); }
  const hits = hay.split(c.text).length - 1;
  if (hits === 0) fail(`${id} (${c.section}) is NOT a verbatim substring of the pinned source`);
  else { verified++; chars += c.text.length; }
}
if (clauses.count !== Object.keys(clauses.clauses).length) fail("clauses.json count disagrees with its own contents");
if (verified > 0) ok(`${verified} clauses verified verbatim, ${chars} characters of regulation text matched byte for byte`);
if (unverifiable > 0) {
  // Fail closed. An unverifiable claim is not a verified one, and the whole
  // premise of this project is that it does not guess.
  fail(`${unverifiable} clauses could NOT be verified because their pinned source is absent. Run npm run extract first.`);
}
if (verified === 0 && unverifiable === 0) fail("citation check examined nothing, which is not a pass");

// ── 3. shape ─────────────────────────────────────────────────────────────────
process.stdout.write("\n3. CORPUS SHAPE\n");
const seg = JSON.parse(readFileSync(join(DATA, "segregation_table.json"), "utf8")) as {
  columns: string[]; rows: Array<{ key: string; division: string; cells: Record<string, string> }>; census: Record<string, number>;
};
const comp = JSON.parse(readFileSync(join(DATA, "compatibility_table.json"), "utf8")) as { groups: string[]; matrix: Record<string, Record<string, string>> };
const hmt = JSON.parse(readFileSync(join(DATA, "hmt.json"), "utf8")) as { entries: Array<{ forbidden: boolean; un: string | null }> };

const segBefore = failures;
const cen: Record<string, number> = { X: 0, O: 0, "*": 0, blank: 0 };
let cells = 0;
for (const r of seg.rows) for (const col of seg.columns) {
  const v = r.cells[col];
  if (v === undefined) { fail(`missing cell: row ${r.key}, column ${col}`); continue; }
  cen[v === "" ? "blank" : v] = (cen[v === "" ? "blank" : v] ?? 0) + 1;
  cells++;
}
if (seg.rows.length !== 18) fail(`segregation rows: ${seg.rows.length}, the regulation has 18`);
if (seg.columns.length !== 18) fail(`segregation columns: ${seg.columns.length}, the regulation has 18`);
if (cells !== 324) fail(`segregation cells: ${cells}, expected 324`);
if (new Set(seg.rows.map((r) => r.key)).size !== 18) fail("duplicate row key: Division 2.3 Zone A and Zone B must not collide");
for (const k of ["X", "O", "*", "blank"]) {
  if (cen[k] !== seg.census[k]) fail(`census drift on ${k}: recomputed ${cen[k]}, recorded ${seg.census[k]}`);
}
if (failures === segBefore) {
  ok(`segregation ${seg.rows.length} by ${seg.columns.length} = ${cells} cells, census X ${cen.X} / O ${cen.O} / * ${cen["*"]} / blank ${cen.blank}`);
}

let compCells = 0;
for (const a of comp.groups) for (const b of comp.groups) {
  if (comp.matrix[a]?.[b] === undefined) fail(`missing compatibility cell ${a} x ${b}`); else compCells++;
}
if (comp.groups.length !== 13) fail(`compatibility groups: ${comp.groups.length}, expected 13`);
ok(`compatibility ${comp.groups.length} by ${comp.groups.length} = ${compCells} cells`);

const forbidden = hmt.entries.filter((e) => e.forbidden);
const before = failures;
if (forbidden.length === 0) fail("zero Forbidden entries: the parser is dropping them again");
if (forbidden.some((e) => e.un)) fail("a Forbidden entry carries a UN number, which the regulation does not do");
// Only claim ok when this section actually added no failures. Printing an
// "ok" line under a "FAIL" line in the same section is the mixed signal that
// gets read as green.
if (failures === before) {
  ok(`${hmt.entries.length} HMT entries, ${forbidden.length} Forbidden, none carrying an identification number`);
}

// ── receipt ──────────────────────────────────────────────────────────────────
process.stdout.write(
  `\n${failures === 0 ? "PASS" : "FAIL"}  checked ${hashed} hashes, ${verified} verbatim clauses ` +
  `(${chars} characters), ${cells + compCells} table cells, ${hmt.entries.length} table entries\n`
);
if (failures > 0) {
  process.stdout.write(`${failures} failure${failures === 1 ? "" : "s"}\n`);
  process.exit(1);
}
