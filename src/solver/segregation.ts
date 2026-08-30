/**
 * The 177.848 check for one vehicle.
 *
 * FOUR independent refusal axes, applied in this order. Only the second is the
 * table, and an agent reasoning from the table alone clears loads that the
 * other three forbid:
 *
 *   1. 173.21(a)   the material is Forbidden outright and has no UN number
 *   2. 177.848(d)  the 18x18 matrix, most restrictive across both hazard sets
 *   3. 177.848(c)  narrative prohibitions STRICTER than the matrix
 *   4. 177.848(e)(3) the corrosive-over-oxidizer block that no barrier rescues
 */
import { segregationCell, rowNote, rowLabel, cite } from "./corpus.ts";
import { resolveCompatibility, checkGroups } from "./explosives.ts";
import type {
  CompatibilityGroup, MatrixKey, ResolvedItem, VehicleProposal, Violation,
} from "./types.ts";

const RANK: Record<string, number> = { "": 0, "*": 1, O: 2, X: 3 };

/** Ammonium nitrate, the subject of the note A carve-out in 177.848(e)(5). */
const AMMONIUM_NITRATE = new Set(["UN1942", "NA1942"]);

/** Classes the (e)(3) hard block names: "Class 4 or Class 5 materials". */
const CLASS_4_OR_5 = new Set<MatrixKey>(["4.1", "4.2", "4.3", "5.1", "5.2"]);

/**
 * 177.848(c): cyanides may not travel with acids where the mixture would
 * generate hydrogen cyanide.
 *
 * The regulation's condition is a chemistry judgement no table decides, so this
 * refuses on the pairing and states the condition rather than pretending to
 * evaluate it. That over-refuses in one direction: Class 8 includes bases as
 * well as acids, and a cyanide with caustic soda is not the hazard the clause
 * is about. Over-refusal is the safe error here and it is named in the message
 * so an operator can see exactly what was assumed.
 *
 * This clause was extracted, verified verbatim and SHIPPED for the life of the
 * project with no code enforcing it. Sodium cyanide with sulfuric acid returned
 * PASS and exported a shipping paper.
 */
const isCyanide = (r: ResolvedItem) => /\bcyanide/i.test(r.name);
const isAcidNamed = (r: ResolvedItem) => /\bacid/i.test(r.name);

/** The classes 177.848(c) bars from travelling with 6.1 PG I Zone A. */
const BARRED_WITH_61_PGI_A = new Set<MatrixKey>(["3", "4.1", "4.2", "4.3", "5.1", "5.2", "8"]);

const keysOf = (r: ResolvedItem): MatrixKey[] =>
  r.hazards.map((h) => h.matrixKey).filter((k): k is MatrixKey => k !== null);

const groupsOf = (r: ResolvedItem): CompatibilityGroup[] =>
  r.hazards.map((h) => h.compatibilityGroup).filter((g): g is CompatibilityGroup => g !== null);

const isClass8Liquid = (r: ResolvedItem) =>
  keysOf(r).includes("8") && r.state !== "solid";

/**
 * The most restrictive published cell across every combination of two items'
 * hazard sets, per 177.848(e)(6).
 */
export function worstCell(a: ResolvedItem, b: ResolvedItem): { code: string; via: [MatrixKey, MatrixKey] } | null {
  let best: { code: string; via: [MatrixKey, MatrixKey] } | null = null;
  for (const ka of keysOf(a)) {
    for (const kb of keysOf(b)) {
      const code = segregationCell(ka, kb);
      if (!best || (RANK[code] ?? 0) > (RANK[best.code] ?? 0)) best = { code, via: [ka, kb] };
    }
  }
  return best;
}

/**
 * 177.848(e)(6) carve-out: materials of the SAME class may travel together
 * despite a secondary hazard, if they cannot react dangerously. We cannot
 * decide "cannot react dangerously" from the table, so this returns a flag for
 * the human rather than silently clearing the pair.
 */
function sameClassCarveOutApplies(a: ResolvedItem, b: ResolvedItem, v: VehicleProposal): boolean {
  // TWO defects lived in the previous one-liner, and the second is worse.
  //
  // It granted the exception UNCONDITIONALLY. 177.848(e)(6) permits same-class
  // materials to travel together despite a secondary hazard only IF they cannot
  // react dangerously with each other, and nothing in the table decides that.
  // The old code turned an O cell into a note and continued, so the conditional
  // exception was not conditional on anything. Same shape as the (e)(3) defect
  // and the same fix: the signer asserts it or it does not apply.
  //
  // And it was ORDER DEPENDENT, because it asked only whether `a` carried a
  // subsidiary hazard. Verified: UN3516 then UN1581 returned PASS and COMMITTED
  // while UN1581 then UN3516 refused, on the identical pair. A verdict that
  // depends on the order two items were typed in is not a verdict, and it broke
  // the permutation invariant this solver claims elsewhere.
  if (a.hazardClass !== b.hazardClass) return false;
  if (!a.hazards.some((h) => h.subsidiary) && !b.hazards.some((h) => h.subsidiary)) return false;
  return v.nonReactionAsserted === true;
}

export function checkVehicle(items: ResolvedItem[], v: VehicleProposal, vehicleIndex: number): { violations: Violation[]; notes: string[]; comparisons: number } {
  const violations: Violation[] = [];
  const notes: string[] = [];
  let comparisons = 0;

  // ── axis 1: Forbidden, and it fires before anything else ──────────────────
  items.forEach((r, i) => {
    if (r.forbidden) {
      violations.push({
        code: "FORBIDDEN_MATERIAL", items: [i], vehicle: vehicleIndex,
        message: `${r.name} is designated Forbidden in column 3 of the 172.101 table and may not be offered for transportation at all. It has no identification number, which is why an index keyed on UN numbers returns nothing for it.`,
        citations: [cite("17321-a-forbidden")],
      });
    }
    if (r.outsidePart177) {
      notes.push(`${r.name} carries symbol A or W, so it is regulated only by aircraft or vessel and 49 CFR part 177 highway segregation does not apply to it.`);
    }
    for (const h of r.hazards) {
      if (h.matrixKey === null && h.notCoveredReason && !r.forbidden) {
        notes.push(`${r.name}, hazard ${h.raw}: ${h.notCoveredReason}. No restriction arises from the table for this hazard (177.848(e)(1)).`);
      }
    }
    if (r.specialProvisionReview.length) {
      notes.push(`${r.name} carries special provision ${r.specialProvisionReview.join(", ")}, which can alter the hazard class the segregation table keys on. Verify the classification.`);
    }
  });

  // ── axes 2 to 4: pairwise ─────────────────────────────────────────────────
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!, b = items[j]!;
      comparisons++;

      // axis 4 first, because no barrier and no table cell rescues it.
      const hardBlock =
        (isClass8Liquid(a) && keysOf(b).some((k) => CLASS_4_OR_5.has(k))) ||
        (isClass8Liquid(b) && keysOf(a).some((k) => CLASS_4_OR_5.has(k)));
      if (hardBlock) {
        // BOTH conditions, because the clause states both. Granting the
        // exception on singleShipper alone cleared UN1830 over UN1748 with a
        // barrier, which is the precise pair the (e)(3) hard block exists for.
        const truckloadCarveOut = v.singleShipper === true && v.nonReactionAsserted === true;
        if (!truckloadCarveOut) {
          violations.push({
            code: "CORROSIVE_OVER_OXIDIZER", items: [i, j], vehicle: vehicleIndex,
            message: `${a.name} and ${b.name} pair a Class 8 corrosive liquid with a Class 4 or Class 5 material. Separation does not rescue this: the regulation blocks it notwithstanding the methods of separation employed. The only exception is a truckload shipment by a single shipper where the mixture is known not to cause a fire or a dangerous evolution of heat or gas.`,
            citations: [cite("e3-corrosive-hard-block")],
          });
          continue;
        }
        notes.push(`${a.name} and ${b.name} rely on the truckload exception in 177.848(e)(3), which this load claims on BOTH required grounds: a truckload shipment by a single shipper, and an explicit assertion that the mixture will not cause a fire or a dangerous evolution of heat or gas. The second is a fact about the chemistry that no table decides, and the signer owns it under 172.204.`);
      }

      // axis 3: the narrative prohibitions of 177.848(c).
      const ka = keysOf(a), kb = keysOf(b);
      const fourTwoVsEight =
        (ka.includes("4.2") && isClass8Liquid(b)) || (kb.includes("4.2") && isClass8Liquid(a));
      if (fourTwoVsEight) {
        violations.push({
          code: "PROHIBITED_TOGETHER", items: [i, j], vehicle: vehicleIndex,
          message: `${a.name} and ${b.name} pair a Division 4.2 spontaneously combustible material with a Class 8 liquid. 177.848(c) prohibits this in addition to the table.`,
          citations: [cite("c-42-vs-8")],
        });
        continue;
      }
      // 177.848(c), the cyanide rule. Placed with the other narrative
      // prohibitions because it is one, and because a solid cyanide falls
      // outside the 177.848(d) matrix entirely, which made this the ONLY
      // applicable refusal path for the pair that was passing.
      const cyanideAcid =
        (isCyanide(a) && (keysOf(b).includes("8") || isAcidNamed(b))) ||
        (isCyanide(b) && (keysOf(a).includes("8") || isAcidNamed(a)));
      if (cyanideAcid) {
        violations.push({
          code: "PROHIBITED_TOGETHER", items: [i, j], vehicle: vehicleIndex,
          message: `${a.name} and ${b.name} pair a cyanide with an acid or a Class 8 material. 177.848(c) prohibits carrying cyanides with acids where the mixture would generate hydrogen cyanide. Whether THIS mixture would is a chemistry judgement no table decides, so this refuses on the pairing. If the Class 8 material is a base rather than an acid, the clause does not apply and the refusal is conservative.`,
          citations: [cite("c-cyanide-acid")],
        });
        continue;
      }

      const sixOneA = (x: ResolvedItem) => keysOf(x).includes("6.1 zone A");
      const barred =
        (sixOneA(a) && kb.some((k) => BARRED_WITH_61_PGI_A.has(k) && (k !== "8" || isClass8Liquid(b)))) ||
        (sixOneA(b) && ka.some((k) => BARRED_WITH_61_PGI_A.has(k) && (k !== "8" || isClass8Liquid(a))));
      if (barred) {
        violations.push({
          code: "PROHIBITED_TOGETHER", items: [i, j], vehicle: vehicleIndex,
          message: `${a.name} and ${b.name} pair a Division 6.1 Packing Group I Hazard Zone A material with a class 177.848(c) bars it from travelling with. This prohibition is additional to the table.`,
          citations: [cite("c-61pgI-zoneA")],
        });
        continue;
      }

      // axis 2: the published matrix.
      const worst = worstCell(a, b);
      if (!worst) continue;
      const [ra, rb] = worst.via;

      // 177.848(f) IS NOT A CELL VALUE, IT IS A REFERRAL, and it must not be
      // maskable by one.
      //
      // worstCell reduces every combination of the two items' hazard sets to a
      // single most-restrictive code, ranking X above O above * above blank.
      // That ranking is right for restrictiveness and wrong for routing: the
      // asterisk does not say "less restrictive than O", it says "the answer is
      // in the compatibility table". A pair whose PRIMARY classes are both
      // explosive but whose SUBSIDIARY hazards happen to produce an O therefore
      // had the O win, and a barrier cleared it, and the compatibility table was
      // never consulted at all.
      //
      // Verified: UN0018 (1.2G, subsidiary 8 and 6.1) with UN0350 (1.4B) and a
      // barrier returned PASS and exported a shipping paper, while compatibility
      // groups G and B are X under 177.848(g)(2).
      //
      // So the referral is decided on whether ANY combination is an asterisk,
      // independently of which code ranks highest.
      const referredToCompatibility = keysOf(a).some((ka) =>
        keysOf(b).some((kb) => segregationCell(ka, kb) === "*"),
      );

      if (worst.code === "*" || referredToCompatibility) {
        const groups = [...groupsOf(a), ...groupsOf(b)];
        const fp = resolveCompatibility(groups);
        if (!fp.ok) {
          violations.push({
            code: "EXPLOSIVE_INCOMPATIBLE", items: [i, j], vehicle: vehicleIndex, cell: "*",
            message: `${a.name} and ${b.name} are both Class 1, so 177.848(f) governs. ${fp.reason}.`,
            citations: [cite("e4-asterisk"), fp.citation],
          });
          continue;
        }
        for (const rw of fp.rewrites) {
          notes.push(`Loading rewrote compatibility groups ${rw.from.join(", ")} to group ${rw.to} under 177.848(g)(3)(${rw.rule === "2" ? "ii" : "iii"}). The re-check runs against the rewritten group, not the original.`);
        }
        // Identities, not just group letters. The 177.848(g) footnotes are
        // CONDITIONS whose truth depends on what the material actually is, and
        // a Set of letters cannot answer "is it a firework" or "is it a
        // substance rather than an article".
        const g = checkGroups(fp.groups, [
          { name: a.name, hazardClass: a.hazardClass },
          { name: b.name, hazardClass: b.hazardClass },
        ]);
        if (!g.ok) {
          violations.push({
            code: "EXPLOSIVE_INCOMPATIBLE", items: [i, j], vehicle: vehicleIndex, cell: "*",
            message: g.reason
              ? `${a.name} and ${b.name}: ${g.reason}`
              : `${a.name} and ${b.name} resolve to compatibility groups ${g.a} and ${g.b}, which the 177.848(f) table marks ${g.code}.`,
            citations: [cite("e4-asterisk"), g.citation],
          });
          continue;
        }
        notes.push(...g.notes);
        // The compatibility table cleared them. If the referral fired because a
        // SUBSIDIARY combination is an asterisk while some other combination is
        // an X or an O, that other cell still governs, so fall through rather
        // than treating the compatibility result as the whole answer.
        if (worst.code === "*") continue;
      }

      if (worst.code === "X") {
        // 177.848(e)(5) note A: ammonium nitrate may load with 1.1 or 1.5
        // notwithstanding the X, unless 177.835(c) prohibits it.
        const anCarveOut =
          (AMMONIUM_NITRATE.has(a.item.id ?? "") && (rowNote(rb) === "A" || rb === "1.1 and 1.2" || rb === "1.5")) ||
          (AMMONIUM_NITRATE.has(b.item.id ?? "") && (rowNote(ra) === "A" || ra === "1.1 and 1.2" || ra === "1.5"));
        if (anCarveOut) {
          notes.push(`${a.name} and ${b.name} would be X in the table, but note A permits ammonium nitrate to load with Division 1.1 or 1.5 unless 177.835(c) prohibits it. Confirm 177.835(c) does not apply. ${cite("e5-note-A").section}: "${cite("e5-note-A").text}"`);
          continue;
        }
        violations.push({
          code: "PROHIBITED_TOGETHER", items: [i, j], vehicle: vehicleIndex, cell: "X",
          message: `${a.name} (${rowLabel(ra)}) and ${b.name} (${rowLabel(rb)}) are marked X in the 177.848(d) table.`,
          citations: [cite("e2-X")],
        });
        continue;
      }

      if (worst.code === "O") {
        if (sameClassCarveOutApplies(a, b, v)) {
          notes.push(`${cite("e6-same-class-carveout").section}. ${a.name} and ${b.name} are both class ${a.hazardClass}. 177.848(e)(6) allows same-class materials to travel together despite a secondary hazard only where they cannot react dangerously with each other, and this load asserts that explicitly. The assertion is a fact about the chemistry that no table decides, and the signer owns it under 172.204.`);
          continue;
        }
        if (v.barriersPresent !== true) {
          violations.push({
            code: "SEPARATION_REQUIRED", items: [i, j], vehicle: vehicleIndex, cell: "O",
            message: `${a.name} (${rowLabel(ra)}) and ${b.name} (${rowLabel(rb)}) are marked O. They may travel together only when separated so that commingling could not occur if a package leaked. No barrier has been asserted for this vehicle. Air space alone does not satisfy this.`,
            citations: [cite("e3-O")],
          });
          continue;
        }
        notes.push(`${a.name} and ${b.name} are marked O and pass on the asserted barrier. The barrier must be a physical impediment, divider or intervening non-hazardous package, not air space.`);
      }
    }
  }

  return { violations, notes, comparisons };
}
