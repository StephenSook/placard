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
import { cite, entriesByName, lookupByUn, resolveName } from "./corpus.ts";
import type { HmtEntry } from "./corpus.ts";
import type {
  Hazard, LineItem, MatrixKey, PhysicalState, PihZone, ResolvedItem,
} from "./types.ts";

/** SP 1 through 4 are the poison-inhalation hazard zones (49 CFR 172.102). */
const SP_ZONE: Record<string, PihZone> = { "1": "A", "2": "B", "3": "C", "4": "D" };

/** Column-7 codes that can change class, packing group, subsidiary hazard or PIH status. */
const CLASS_ALTERING_SP = new Set(["5", "6", "38", "53", "128"]);

/**
 * Column-7 codes whose effect this corpus CANNOT determine, so a load carrying
 * one is refused rather than adjudicated, each with the clause that proves it.
 *
 * SP53: the type B self-reactives (UN3221, UN3222, UN3231, UN3232) are listed
 * Class 4.1 with column-6 labels showing only 4.1, and SP53 adds an EXPLOSIVE
 * subsidiary risk label whose class and division come from an approval that is
 * not in the 172.101 table. Several Class 1 rows against Class 3 are X in the
 * 177.848(d) table, so that missing division decides the verdict. Reproduced:
 * UN3221 with UN1090 returned PASS, minted a token, and committed a paper
 * showing only 4.1 and 3.
 *
 * SP38 (round sixteen): its violent-effect branch ACTIVATES SP53's explosive
 * subsidiary on a heating-under-confinement laboratory fact no column carries.
 * Reproduced: UN3242 with UN1090 passed and exported as plain 4.1.
 *
 * SP5 (round sixteen): if the material as shipped meets the 171.8 PIH
 * definition, a DIFFERENT shipping name in Division 2.3 or 6.1 must be
 * selected, whose segregation rows are stricter than the listed class. That
 * determination is about the specific shipment and is not in any column.
 * Reproduced: NA1911 with UN1090 passed and exported as plain 2.1.
 *
 * An unevaluable condition is not a satisfied one. This is the same shape as
 * 177.848(g)(vi) and 177.848(e)(5) note A, and it fails closed for the same
 * reason: the tool cannot show the permission applies. The line drawn here:
 * provisions that conditionally direct a STRONGER hazard communication on a
 * fact outside the corpus fail closed; provisions that merely define an
 * entry's scope (SP78, SP138, SP176 and kin) are the shipper's certification
 * under 172.204, which the paper already prints verbatim.
 */
const UNEVALUABLE_SP: Record<string, string> = {
  "53": "The explosive subsidiary that provision requires is not in the 172.101 label column, and its class and division come from an approval this corpus does not contain.",
  "38": "Whether its violent-effect branch applies, and with it special provision 53's explosive subsidiary, turns on heating-under-confinement laboratory results this corpus does not contain.",
  "5": "Whether the material as shipped meets the poison-by-inhalation definition in 49 CFR 171.8 is a determination about the specific shipment, not a column in the table, and if it does, a different Division 2.3 or 6.1 description with stricter segregation rows is required.",
};

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
  /**
   * The packing groups the caller's reference could have meant, captured at
   * row-selection time. Severity ordering settles the VERDICT axis; whether
   * the caller actually asserted a packing group decides what a shipping
   * paper may PRINT, and those are different questions (round sixteen).
   */
  let pgCandidates: Array<string | null> | null = null;
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

    // NARROW BY EVERY IDENTITY FIELD THE CALLER SUPPLIED, THEN REFUSE IF WHAT
    // IS LEFT IS STILL MORE THAN ONE MATERIAL.
    //
    // An identification number is not always an identifier. Several rows share
    // a UN number: usually one per packing group, which is harmless because
    // they share a class and a name, but some span CLASSES and some span
    // NAMES. UN1950 runs across Division 2.1 and 2.2, so taking the first row
    // picked a 2.2 aerosol and UN1950 with UN2910 and no barrier returned PASS
    // and exported, while the 2.1 row is an O cell against Class 7. NA1993 PG I
    // holds a cleaning liquid and a tree-killing liquid under one number and
    // one packing group. UN2031 PG II runs three nitric-acid strengths, one of
    // them carrying a 5.1 subsidiary the others do not.
    //
    // Severity ordering is the right answer for rows that differ ONLY by
    // packing group, because the lowest group is genuinely the strictest read
    // of an under-specified reference. It is the wrong answer for rows that
    // differ by name, class or hazard labels, because there is no "stricter"
    // among different materials: picking one prints a proper shipping name the
    // operator never described, on a document they sign.
    let rows = all;
    if (item.packingGroup) {
      rows = rows.filter((r) => r.pg === item.packingGroup);
      if (rows.length === 0) {
        const offered = [...new Set(all.map((r) => r.pg ?? "none"))].join(", ");
        return {
          error:
            `${id} has no packing group ${item.packingGroup} entry in the 49 CFR 172.101 table. ` +
            `That identification number is listed with packing group ${offered}.`,
        };
      }
    }
    if (item.name) {
      const wanted = item.name.trim().toLowerCase();
      const byName = rows.filter((r) => r.name.toLowerCase() === wanted);
      if (byName.length === 0) {
        return {
          error:
            `${id} has no entry named ${JSON.stringify(item.name)} in the 49 CFR 172.101 table` +
            (item.packingGroup ? ` at packing group ${item.packingGroup}` : "") +
            `. That number is listed as: ${[...new Set(rows.map((r) => r.name))].slice(0, 4).join("; ")}` +
            (new Set(rows.map((r) => r.name)).size > 4 ? "; and others" : "") + ".",
        };
      }
      rows = byName;
    }

    // A supplied zone SELECTS among rows that list zones, and SUPPLEMENTS a
    // row that lists none (the SP6 rows, whose zone comes from an approval).
    // Filtering unconditionally turned the supplement into a lookup failure:
    // { id: "UN3168", pihZone: "A" } found zero rows because no row lists a
    // zone to match, which is precisely the case the field exists for.
    if (item.pihZone && rows.some((r) => zoneFor(r) !== null)) {
      const byZone = rows.filter((r) => zoneFor(r) === item.pihZone);
      if (byZone.length === 0) {
        const offered = [...new Set(rows.map((r) => zoneFor(r) ?? "none"))].join(", ");
        return {
          error:
            `${id} has no Hazard Zone ${item.pihZone} entry in the 49 CFR 172.101 table` +
            (item.packingGroup ? ` at packing group ${item.packingGroup}` : "") +
            `. That number is listed with hazard zone ${offered}.`,
        };
      }
      rows = byZone;
    }

    // What makes two rows the SAME material for every purpose downstream: the
    // name printed on the paper, the class the matrix is indexed by, the labels
    // that raise subsidiary hazards, the inhalation hazard zone, and any
    // column-7 code that can alter the class. Packing group is deliberately not
    // in the key, because that is the one axis severity ordering can settle.
    //
    // THE ZONE IS IN THE KEY BECAUSE IT DECIDES THE VERDICT. UN1744 has two
    // rows both named "Bromine solutions", both Class 8 PG I, both labelled
    // ["8","6.1"], differing only in special provision 1 against 2, which is
    // Hazard Zone A against Zone B. 6.1 PG I Zone A has its own row in the
    // 177.848(d) table and Zone B does not, so a key that ignored the zone
    // collapsed them, severity ordering picked whichever came first in the
    // table, and Bromine solutions with acetone came back PROHIBITED_TOGETHER
    // on a coin toss. That turned an ambiguity the tool used to at least be
    // uncertain about into a confident and possibly wrong refusal.
    const identityOf = (r: HmtEntry) =>
      [
        r.name.toLowerCase(),
        r.class,
        [...(r.labels ?? [])].sort().join(","),
        zoneFor(r) ?? "",
        r.specialProvisions.filter((sp) => CLASS_ALTERING_SP.has(sp.trim())).sort().join(","),
      ].join("|");
    const distinct = [...new Set(rows.map(identityOf))];
    if (distinct.length > 1) {
      const shown = [...new Map(rows.map((r) => [identityOf(r), r])).values()];
      return {
        error:
          `${id} covers ${distinct.length} different materials in the 172.101 table` +
          (item.packingGroup ? ` at packing group ${item.packingGroup}` : "") +
          `, and the verdict and the shipping paper both depend on which one it is. ` +
          `Give the proper shipping name, or the inhalation hazard zone where that is the ` +
          `only difference: ` +
          `${shown.map((r) => `${r.class}${r.pg ? ` PG ${r.pg}` : ""}${zoneFor(r) ? ` Zone ${zoneFor(r)}` : ""} ${r.name}`).slice(0, 4).join("; ")}` +
          (shown.length > 4 ? "; and others" : "") + ".",
      };
    }

    // One material, possibly several packing groups. Take the strictest: lowest
    // packing group first, then the row bearing the most hazard labels, ties
    // keeping table order. UN1831 has two PG I rows, one labelled ["8"] and one
    // ["8","6.1"] carrying special provision 2, and the first is the one
    // WITHOUT the poison-by-inhalation subsidiary; a 6.1 PG I zone A liquid has
    // its own row in the 177.848(d) table, so taking it drops a restriction.
    pgCandidates = rows.map((r) => r.pg ?? null);
    entry = mostSevere(rows);
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

    // NARROW BY THE IDENTITY FIELDS THE CALLER ACTUALLY SENT.
    //
    // This branch took whatever resolveName settled on and ignored packingGroup
    // and pihZone entirely, although both are published wire fields and the id
    // branch above narrows on both. Reproduced: a caller sending
    // { name: "Adhesives, containing a flammable liquid", packingGroup: "III" }
    // was adjudicated and EXPORTED as packing group I, so the shipping paper
    // named a row the caller had explicitly not asked for. Same defect round
    // eight fixed for the token's canonical encoding, one layer earlier and on
    // the branch nobody had narrowed.
    if (item.packingGroup || item.pihZone) {
      let rows = entriesByName(entry.name);
      if (rows.length === 0) rows = [entry];
      if (item.packingGroup) {
        const byPg = rows.filter((r2) => (r2.pg ?? null) === item.packingGroup);
        if (byPg.length === 0) {
          const offered = [...new Set(rows.map((r2) => r2.pg ?? "none"))].join(", ");
          return {
            error:
              `"${entry.name}" has no packing group ${item.packingGroup} entry in the ` +
              `49 CFR 172.101 table. That name is listed at packing group ${offered}.`,
          };
        }
        rows = byPg;
      }
      // Same selection-or-supplement rule as the id branch: a zone narrows
      // only where some row lists one to narrow BY.
      if (item.pihZone && rows.some((r2) => zoneFor(r2) !== null)) {
        const byZone = rows.filter((r2) => zoneFor(r2) === item.pihZone);
        if (byZone.length === 0) {
          const offered = [...new Set(rows.map((r2) => zoneFor(r2) ?? "none"))].join(", ");
          return {
            error:
              `"${entry.name}" has no Hazard Zone ${item.pihZone} entry in the ` +
              `49 CFR 172.101 table. That name is listed with hazard zone ${offered}.`,
          };
        }
        rows = byZone;
      }
      pgCandidates = rows.map((r2) => r2.pg ?? null);
      entry = mostSevere(rows);
    }

    // AND THE NAME MUST STILL LAND ON ONE ROW IDENTITY.
    //
    // resolveName settles on a single hazard class and returns the first row,
    // which is not enough for a shipping paper. "Bromine solutions" has two
    // Class 8 PG I rows differing only by Hazard Zone A against B, and a
    // name-only call committed Zone A although no zone was sent. "Diesel fuel"
    // committed NA1993 although the same proper name also identifies UN1202.
    // The identification NUMBER is part of the identity here in a way it is
    // not on the id branch, because there it is given and here it is printed.
    // Packing group stays out of the key: severity ordering settles that axis,
    // which is what keeps a plain name with several packing groups working.
    const named = entriesByName(entry.name);
    if (named.length > 1) {
      const nameIdentity = (r2: HmtEntry) =>
        [
          r2.un ?? "",
          r2.class,
          [...(r2.labels ?? [])].sort().join(","),
          zoneFor(r2) ?? "",
          r2.specialProvisions.filter((sp) => CLASS_ALTERING_SP.has(sp.trim())).sort().join(","),
        ].join("|");
      const shown = [...new Map(named.map((r2) => [nameIdentity(r2), r2])).values()];
      if (shown.length > 1) {
        return {
          error:
            `"${item.name}" names ${shown.length} different materials in the 172.101 table, and ` +
            `the verdict and the shipping paper both depend on which one it is. Give the ` +
            `identification number, or the inhalation hazard zone where that is the only ` +
            `difference: ` +
            `${shown.map((r2) => `${r2.un ?? "no ID number"} ${r2.class}${r2.pg ? ` PG ${r2.pg}` : ""}${zoneFor(r2) ? ` Zone ${zoneFor(r2)}` : ""}`).slice(0, 4).join("; ")}` +
            (shown.length > 4 ? "; and others" : "") + ".",
        };
      }
      // One identity across several rows: severity settles the verdict row,
      // and the packing-group spread is recorded so export can insist the
      // caller assert one before it is printed on a signed document.
      if (!item.packingGroup && !item.pihZone) {
        pgCandidates = named.map((r2) => r2.pg ?? null);
        entry = mostSevere(named);
      }
    }
  } else {
    return { error: "a line item needs an identification number or a proper shipping name" };
  }

  // FAIL CLOSED ON A CLASSIFICATION THE CORPUS CANNOT EVALUATE. The cite ids
  // are written out literally because the reachability gate greps source for
  // literal id strings, and a dynamic id would leave the clause verified,
  // shipped, and invisible to the gate that proves it is enforced (finding 33).
  const unevaluable = entry.specialProvisions.map((sp) => sp.trim()).filter((sp) => sp in UNEVALUABLE_SP);
  if (unevaluable.length > 0) {
    const sp0 = unevaluable[0]!;
    const c =
      sp0 === "53" ? cite("sp53-explosive-subsidiary")
      : sp0 === "38" ? cite("sp38-conditional-sp53")
      : cite("sp5-conditional-pih");
    return {
      error:
        `${entry.name} carries special provision ${unevaluable.join(", ")}, and this tool cannot ` +
        `adjudicate a load containing it. ${c.section}: "${c.text}" ${UNEVALUABLE_SP[sp0]!} ` +
        `This is a stated gap in coverage, not a judgement about the material.`,
    };
  }

  // THE WIRE ZONE SELECTS AMONG LISTED ROWS; IT NEVER SUPPLEMENTS AN UNLISTED
  // ONE (round seventeen, and the hole was round sixteen's own fix). For a few
  // hours this fell back to `item.pihZone` where no column listed a zone, so an
  // agent could declare Zone C for an SP6 material, and Zones C and D have no
  // row in the 177.848(d) table at all: the declaration walked the material out
  // of the conservative Zone A row and a pairing the bare reference refuses
  // returned PASS and committed a paper printing the invented zone. An SP6
  // zone comes from an approval this corpus does not contain, so a wire field
  // carrying one is a claim about the physical world, refused by name exactly
  // like a barrier or a physical state. A listed zone still narrows rows above
  // and still refuses on conflict here.
  const listedZone = zoneFor(entry);
  if (item.pihZone && listedZone && item.pihZone !== listedZone) {
    return {
      error:
        `${entry.name} is listed with Hazard Zone ${listedZone} in column 7 of the 172.101 ` +
        `table, and the caller sent Zone ${item.pihZone}. A listed zone cannot be overridden.`,
    };
  }
  if (item.pihZone && !listedZone) {
    return {
      error:
        `pihZone selects among 172.101 rows whose column 7 lists a hazard zone, and no row for ` +
        `${entry.name} lists one: its zone comes from an approval this corpus does not contain. ` +
        `A zone this tool cannot verify is a claim about the material, not a lookup key, so the ` +
        `field is refused rather than trusted.`,
    };
  }
  const pihZone = listedZone;
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

  // SP128 (round sixteen): "The presence of a Class 8 hazard must be
  // communicated as required by this part for subsidiary hazards." The aluminum
  // smelting by-product rows are classed 4.3 by this provision's own
  // permission, premised on the material meeting the definition of Class 8, and
  // the label column does not print the 8. Unconditional, so the hazard is
  // added here rather than refused: UN3170 with UN1309 passed and exported as
  // plain 4.3 and 4.1 until it was.
  const sps = entry.specialProvisions.map((sp) => sp.trim());
  if (sps.includes("128") && primaryRaw !== "8" && !hazards.some((h) => h.raw === "8")) {
    const m = matrixKeyFor("8", { pihZone, packingGroup: entry.pg, state });
    hazards.push({
      raw: "8",
      matrixKey: m.key,
      ...(m.reason ? { notCoveredReason: m.reason } : {}),
      compatibilityGroup: null,
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
    ...(!item.packingGroup && new Set((pgCandidates ?? [entry.pg]).map((p) => p ?? "")).size > 1
      ? { packingGroupAssumed: true }
      : {}),
    ...(sps.includes("6") && !pihZone ? { pihMandatedNoZone: true } : {}),
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
