/**
 * Hazard resolution: from a line item to the set of hazards 177.848(d) keys on.
 *
 * Three subtleties the published table has and a naive implementation misses:
 *
 * 1. THE TABLE IS NARROWER THAN THE HAZARD CLASSES. Its row for Class 8 is
 *    labelled "Corrosive liquids" and its column "8 liquids only", so a Class 8
 *    SOLID is not covered. Its 6.1 row is "Poisonous liquids PG I Zone A", so a
 *    6.1 packing-group II material is not covered either. Class 9 has no row or
 *    column at all. Reporting "no restriction" for those is correct under
 *    (e)(1), but reporting it SILENTLY is not, so each carries a reason.
 * 2. DIVISION 2.3 HAS TWO ROWS, Zone A and Zone B, and which applies is decided
 *    by a column-7 special provision, not by the class. SP 1 is Hazard Zone A,
 *    SP 2 is Zone B (49 CFR 172.102, verbatim in the corpus). Zones C and D
 *    have no row.
 * 3. SEGREGATION FOLLOWS THE SUBSIDIARY HAZARD when it is more restrictive
 *    (177.848(e)(6)), and 717 of 3,293 entries carry more than one label code,
 *    so this fires on roughly 22 percent of materials.
 */
import { lookupByUn, resolveName, cite } from "./corpus.ts";
import type { HmtEntry } from "./corpus.ts";
import type {
  Hazard, LineItem, MatrixKey, PhysicalState, PihZone, ResolvedItem, Citation,
} from "./types.ts";

/** SP 1 through 4 are the poison-inhalation hazard zones (49 CFR 172.102). */
const SP_ZONE: Record<string, PihZone> = { "1": "A", "2": "B", "3": "C", "4": "D" };

/** Column-7 codes that can change class, packing group, subsidiary hazard or PIH status. */
const CLASS_ALTERING_SP = new Set(["128"]);

/**
 * Map a hazard class string to its 177.848(d) key.
 * Returns null plus a reason when the published table does not cover it.
 */
export function matrixKeyFor(
  hazardClass: string,
  opts: { pihZone?: PihZone | null; packingGroup?: string | null; state?: PhysicalState } = {}
): { key: MatrixKey | null; reason?: string; group?: string } {
  const c = hazardClass.trim();
  const { pihZone = null, packingGroup = null, state = "unknown" } = opts;

  // Class 1: the division decides the row, the trailing letter is the
  // compatibility group used by 177.848(f).
  const ex = /^1\.([1-6])([A-S])?$/.exec(c);
  if (ex) {
    const div = ex[1]!;
    const group = ex[2];
    const key: MatrixKey =
      div === "1" || div === "2" ? "1.1 and 1.2"
      : div === "3" ? "1.3" : div === "4" ? "1.4" : div === "5" ? "1.5" : "1.6";
    return group ? { key, group } : { key };
  }

  switch (c) {
    case "2.1": return { key: "2.1" };
    case "2.2": return { key: "2.2" };
    case "2.3":
      if (pihZone === "A") return { key: "2.3 zone A" };
      if (pihZone === "B") return { key: "2.3 zone B" };
      if (pihZone === "C" || pihZone === "D")
        return { key: null, reason: `Division 2.3 Hazard Zone ${pihZone} has no row in the 177.848(d) table, which lists only Zone A and Zone B` };
      // Unknown zone: take the MORE restrictive of the two published rows.
      return { key: "2.3 zone A", reason: "hazard zone not determined from column 7; the more restrictive Zone A row was applied" };
    case "3": return { key: "3" };
    case "4.1": return { key: "4.1" };
    case "4.2": return { key: "4.2" };
    case "4.3": return { key: "4.3" };
    case "5.1": return { key: "5.1" };
    case "5.2": return { key: "5.2" };
    case "7": return { key: "7" };
    case "6.1": {
      if (packingGroup !== "I")
        return { key: null, reason: `the 177.848(d) row covers "Poisonous liquids PG I Zone A"; this material is packing group ${packingGroup ?? "unassigned"}` };
      if (pihZone !== "A" && pihZone !== null)
        return { key: null, reason: `the 177.848(d) row covers Hazard Zone A; this material is Zone ${pihZone}` };
      if (state === "solid")
        return { key: null, reason: `the 177.848(d) row covers poisonous LIQUIDS; this material is a solid` };
      return { key: "6.1 zone A" };
    }
    case "8": {
      if (state === "solid")
        return { key: null, reason: `the 177.848(d) row and column cover Class 8 LIQUIDS only; this material is a solid` };
      return { key: "8" };
    }
    case "9":
      return { key: null, reason: "Class 9 has no row or column in the 177.848(d) table" };
    case "Forbidden":
      return { key: null, reason: "the material is Forbidden and may not be offered for transportation at all" };
    default:
      return { key: null, reason: `hazard class ${c || "(none)"} is not represented in the 177.848(d) table` };
  }
}

/** Infer physical state from the proper shipping name, conservatively. */
function inferState(entry: HmtEntry, supplied?: PhysicalState): { state: PhysicalState; inferred: boolean } {
  if (supplied && supplied !== "unknown") return { state: supplied, inferred: false };
  const n = entry.name.toLowerCase();
  if (/\bsolid\b|\bdry\b|,\s*powder\b|\bgranul/.test(n)) return { state: "solid", inferred: true };
  if (/\bliquid\b|\bsolution\b|\bmolten\b/.test(n)) return { state: "liquid", inferred: true };
  if (/^2\./.test(entry.class)) return { state: "gas", inferred: true };
  // Unknown state on Class 8 or 6.1: being IN the table is stricter than being
  // outside it, so default to liquid. Conservative, and flagged.
  return { state: "liquid", inferred: true };
}

function zoneFor(entry: HmtEntry): PihZone | null {
  for (const sp of entry.specialProvisions) {
    const z = SP_ZONE[sp.trim()];
    if (z) return z;
  }
  return null;
}

/** Resolve one line item against the corpus into every hazard it presents. */
export function resolveItem(item: LineItem): ResolvedItem | { error: string } {
  let entry: HmtEntry | null = null;
  if (item.id) {
    const rows = lookupByUn(item.id);
    if (rows.length === 0) return { error: `${item.id} is not in the 49 CFR 172.101 table` };

    // AN IDENTIFICATION NUMBER IS NOT ALWAYS AN IDENTIFIER EITHER, and this is
    // the same defect that was fixed for proper shipping names and left in
    // place here, which is worse, because a number LOOKS authoritative.
    //
    // Several rows share a UN number, usually one per packing group, and those
    // share a hazard class so they share a segregation verdict. But some span
    // CLASSES. UN1950 has five rows across Division 2.1 and Division 2.2, and
    // taking rows[0] picked a 2.2 aerosol. Verified: UN1950 with UN2910 and no
    // barrier returned PASS and exported, while the 2.1 row is an O cell
    // against Class 7 and needs separation. The shipping paper also carried the
    // wrong proper shipping name, so the document named a material the operator
    // had not described.
    const classes = [...new Set(rows.map((r) => r.class))];
    if (classes.length > 1) {
      const pgMatch = item.packingGroup
        ? rows.filter((r) => r.pg === item.packingGroup)
        : [];
      const pgClasses = [...new Set(pgMatch.map((r) => r.class))];
      if (pgMatch.length === 0 || pgClasses.length > 1) {
        return {
          error:
            `${item.id} covers ${rows.length} entries in the 172.101 table spanning hazard classes ` +
            `${classes.join(", ")}, and the segregation verdict depends on which one it is. ` +
            `Give the proper shipping name, or a packing group that selects one: ` +
            `${rows.map((r) => `${r.class}${r.pg ? ` PG ${r.pg}` : ""} ${r.name}`).slice(0, 4).join("; ")}` +
            (rows.length > 4 ? "; and others" : ""),
        };
      }
      entry = pgMatch[0]!;
    } else {
      // One class across every row: packing groups differ but the verdict does
      // not, so the first row, which is the lowest packing group and therefore
      // the most severe, is safe to take.
      entry = rows[0]!;
    }
  } else if (item.name) {
    const r = resolveName(item.name);
    if (r.kind === "ambiguous") {
      // Never pick one. A generic n.o.s. name can span nineteen divisions, and
      // choosing among them silently produces a verdict for a material the
      // operator did not describe. Ask for the identification number instead.
      return {
        error:
          `"${item.name}" names ${r.candidates.length} entries in the 172.101 table spanning ` +
          `hazard classes ${r.classes.join(", ")}. A proper shipping name of this kind does not ` +
          `determine a hazard class, and the segregation verdict depends on which one it is. ` +
          `Give the identification number instead: ` +
          `${[...new Set(r.candidates.map((c) => c.un).filter(Boolean))].slice(0, 8).join(", ")}` +
          (r.candidates.length > 8 ? ", and others" : ""),
      };
    }
    if (r.kind === "not_found") return { error: `"${item.name}" did not resolve to a 172.101 entry, directly or through a "see" pointer` };
    entry = r.entry;
  } else {
    return { error: "a line item needs an identification number or a proper shipping name" };
  }

  const pihZone = zoneFor(entry);
  const { state } = inferState(entry, item.state);
  const primaryRaw = entry.class;

  const primary = matrixKeyFor(primaryRaw, { pihZone, packingGroup: entry.pg, state });
  const hazards: Hazard[] = [{
    raw: primaryRaw,
    matrixKey: primary.key,
    ...(primary.reason ? { notCoveredReason: primary.reason } : {}),
    compatibilityGroup: (primary.group ?? null) as Hazard["compatibilityGroup"],
    subsidiary: false,
  }];

  // 177.848(e)(6): apply the subsidiary hazard's segregation when it is more
  // restrictive. Label codes in column 6 beyond the primary are subsidiaries.
  for (const label of entry.labels) {
    if (label === primaryRaw) continue;
    const m = matrixKeyFor(label, { pihZone, packingGroup: entry.pg, state });
    if (hazards.some((h) => h.raw === label)) continue;
    hazards.push({
      raw: label,
      matrixKey: m.key,
      ...(m.reason ? { notCoveredReason: m.reason } : {}),
      compatibilityGroup: (m.group ?? null) as Hazard["compatibilityGroup"],
      subsidiary: true,
    });
  }

  return {
    item,
    name: entry.name,
    hazardClass: primaryRaw,
    packingGroup: entry.pg,
    hazards,
    specialProvisions: entry.specialProvisions,
    pihZone,
    state,
    forbidden: entry.forbidden,
    outsidePart177: entry.symbols.airOnly || entry.symbols.vesselOnly,
    specialProvisionReview: entry.specialProvisions.filter((sp) => CLASS_ALTERING_SP.has(sp.trim())),
  };
}

/** The citations that explain how a resolution was reached. */
export function resolutionCitations(r: ResolvedItem): Citation[] {
  const out: Citation[] = [];
  if (r.forbidden) out.push(cite("17321-a-forbidden"));
  if (r.hazards.some((h) => h.subsidiary)) out.push(cite("e6-subsidiary"));
  if (r.pihZone === "A") out.push(cite("sp1-zone-A"));
  if (r.specialProvisionReview.includes("128")) out.push(cite("sp128-reclass"));
  return out;
}
