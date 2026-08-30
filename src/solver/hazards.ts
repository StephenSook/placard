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
import { lookupByUn, resolveName } from "./corpus.ts";
import type { HmtEntry } from "./corpus.ts";
import type {
  Hazard, LineItem, MatrixKey, PhysicalState, PihZone, ResolvedItem,
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
): { key: MatrixKey | null; reason?: string; group?: string; unparsed?: boolean } {
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
    // Classes the table genuinely does not cover. Naming them explicitly is
    // what lets the default below mean "I could not parse this".
    case "6.2":
      return { key: null, reason: "Division 6.2 has no row or column in the 177.848(d) table" };
    case "Comb liq":
      return { key: null, reason: "combustible liquids have no row or column in the 177.848(d) table" };
    default:
      // AN UNPARSED LABEL IS NOT A CLEARED ONE. This branch used to report the
      // same "not represented in the table" reason for a class with no row and
      // for a string the parser did not recognise, and the solver turned both
      // into a note citing 177.848(e)(1). A corrupt label therefore read as a
      // clean bill of health.
      return {
        key: null,
        unparsed: true,
        reason: `the hazard label ${JSON.stringify(c)} could not be interpreted as a 49 CFR hazard class or division, so no row of the 177.848(d) table can be selected for it and this tool cannot clear it`,
      };
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

/**
 * Of several 172.101 rows that a caller's reference could mean, the one whose
 * verdict is hardest: lowest packing group first, then the row bearing the most
 * hazard labels, ties keeping table order.
 *
 * Only ever applied to rows that are still genuinely ambiguous. A packing group
 * the caller supplied narrows the set BEFORE this runs, because overruling a
 * stated identity with a severity heuristic is a false refusal, not caution.
 */
const PG_RANK: Record<string, number> = { I: 0, II: 1, III: 2 };
const mostSevere = (rows: HmtEntry[]): HmtEntry =>
  [...rows].sort((x, y) => {
    const px = PG_RANK[x.pg ?? ""] ?? 3, py = PG_RANK[y.pg ?? ""] ?? 3;
    return px - py || (y.labels?.length ?? 0) - (x.labels?.length ?? 0);
  })[0]!;

/** Resolve one line item against the corpus into every hazard it presents. */
export function resolveItem(item: LineItem): ResolvedItem | { error: string } {
  let entry: HmtEntry | null = null;
  if (item.id) {
    // NORMALISE THE IDENTIFICATION NUMBER HERE TOO. The tool path strips
    // whitespace and upper-cases before lookup; this path did not, so "UN 1090"
    // resolved through an agent and failed from a link or the input box, even
    // though that is exactly how 49 CFR prints it. Two spellings of the same
    // number reaching two different answers is the shape of defect this project
    // exists to expose, and it was in the resolver.
    const id = item.id.trim().replace(/\s+/g, "").toUpperCase();
    const all = lookupByUn(id);
    if (all.length === 0) return { error: `${id} is not in the 49 CFR 172.101 table` };

    // A SUPPLIED PACKING GROUP IS IDENTITY, NOT A HINT, AND DISCARDING IT IS A
    // FALSE REFUSAL. The conservative row sort below reaches for the lowest
    // packing group on the reasoning that the most severe row is the safe
    // choice when the caller has not said which row they mean. When the caller
    // HAS said, that reasoning does not apply and the sort silently overrules
    // them. Reproduced: UN2810 has PG I, II and III rows, all Division 6.1;
    // asking for PG II selected the PG I row, and PG I Division 6.1 zone A has
    // its own row in the 177.848(d) table, so a legal PG II load came back
    // PROHIBITED_TOGETHER and the shipping paper would have named a material
    // the operator had not described.
    //
    // Narrow to the supplied packing group first, refuse an impossible one
    // rather than falling back to a different material, and let the sort run
    // only among rows that are still genuinely ambiguous.
    let rows = all;
    if (item.packingGroup) {
      rows = all.filter((r) => r.pg === item.packingGroup);
      if (rows.length === 0) {
        const offered = [...new Set(all.map((r) => r.pg ?? "none"))].join(", ");
        return {
          error:
            `${id} has no packing group ${item.packingGroup} entry in the 49 CFR 172.101 table. ` +
            `That identification number is listed with packing group ${offered}.`,
        };
      }
    }

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
      const pgMatch = item.packingGroup ? rows : [];
      const pgClasses = [...new Set(pgMatch.map((r) => r.class))];
      if (pgMatch.length === 0 || pgClasses.length > 1) {
        return {
          error:
            `${id} covers ${rows.length} entries in the 172.101 table spanning hazard classes ` +
            `${classes.join(", ")}, and the segregation verdict depends on which one it is. ` +
            `Give the proper shipping name, or a packing group that selects one: ` +
            `${rows.map((r) => `${r.class}${r.pg ? ` PG ${r.pg}` : ""} ${r.name}`).slice(0, 4).join("; ")}` +
            (rows.length > 4 ? "; and others" : ""),
        };
      }
      entry = mostSevere(pgMatch);
    } else {
      // One class across every row, so the verdict cannot turn on which row is
      // chosen for the CLASS. It can still turn on the SUBSIDIARY hazards, and
      // it always determines what the shipping paper prints.
      //
      // This used to take rows[0] on the reasoning that the first row is the
      // lowest packing group and therefore the most severe. The corpus
      // falsifies that: UN2031's rows run II, II, II, I and NA1760's run II, I,
      // II, III, I, II, III, II. Worse, UN1831 has two PG I rows, one labelled
      // ["8"] and one ["8","6.1"] carrying special provision 2, and rows[0] is
      // the one WITHOUT the poison-by-inhalation subsidiary. A 6.1 PG I zone A
      // liquid has its own row in the 177.848(d) table, so dropping it drops a
      // restriction, and the exported paper named a material the operator had
      // not described.
      //
      // Choose the genuinely most severe: lowest packing group first, then the
      // row bearing the most hazard labels. Ties keep table order.
      entry = mostSevere(rows);
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
    ...(primary.unparsed ? { unparsed: true } : {}),
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
      ...(m.unparsed ? { unparsed: true } : {}),
      ...(m.reason ? { notCoveredReason: m.reason } : {}),
      compatibilityGroup: (m.group ?? null) as Hazard["compatibilityGroup"],
      subsidiary: true,
    });
  }

  return {
    // The identification number AS THE REGULATION WRITES IT, not as the user
    // typed it. This is what reaches the shipping paper's basic description
    // under 172.202(a), and "un 1090" is not a form the 172.101 table uses.
    // A Forbidden material has none, and keeps its null.
    item: { ...item, ...(entry.un ? { id: entry.un } : {}) },
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

/*
 * `resolutionCitations` used to live here and NOTHING CALLED IT. It was the
 * only cite() site for e6-subsidiary, sp1-zone-A and sp128-reclass, so those
 * three clauses passed the coverage gate in tests/claims.test.ts on the
 * strength of a function no user or agent could ever reach: quoted, verified
 * verbatim, counted in the receipt, and delivered to nobody.
 *
 * That is precisely the failure src/solver/coverage.ts exists to prevent,
 * recurring one level up, and the gate could not see it because it greps the
 * source for a citation call, and dead code contains text just fine.
 *
 * The three citations now sit in segregation.ts, attached to the notes that
 * fire when those conditions actually hold, and the coverage gate now rejects
 * a citation whose only home is an unreferenced function.
 */
