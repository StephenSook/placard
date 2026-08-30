/**
 * 177.848(f) is not a lookup, it is a REWRITING SYSTEM.
 *
 * Per 177.848(g)(3), loading changes the effective compatibility group:
 *   "2" any combination of C, D or E is assigned to group E
 *   "3" any combination of C, D or E with N is assigned to group D
 * so the group you must re-check against is not the group you started with.
 * That is why this is an explicit iterate-to-fixed-point rather than a table
 * read, and why the tests assert termination, confluence and idempotence.
 */
import { compatibilityCell, cite } from "./corpus.ts";
import type { Citation, CompatibilityGroup } from "./types.ts";

const CDE = new Set<CompatibilityGroup>(["C", "D", "E"]);

export type Rewrite = { rule: "2" | "3"; from: CompatibilityGroup[]; to: CompatibilityGroup; citation: Citation };

export type FixedPoint =
  | { ok: true; groups: Set<CompatibilityGroup>; rewrites: Rewrite[] }
  | { ok: false; reason: string; citation: Citation };

/**
 * Apply the reassignment rules until nothing fires. Bounded: non-termination
 * would be a bug in this function, not a property of the regulation, so it
 * throws rather than looping.
 */
export function resolveCompatibility(input: Iterable<CompatibilityGroup>): FixedPoint {
  let groups = new Set(input);
  const rewrites: Rewrite[] = [];
  const BOUND = 16;

  for (let i = 0; ; i++) {
    if (i > BOUND) throw new Error(`compatibility rewriting did not converge in ${BOUND} iterations`);

    const cde = [...groups].filter((g) => CDE.has(g));

    // Rule 3 first: C/D/E combined WITH N becomes D. Applying rule 2 first
    // would collapse C/D/E to E and lose the N interaction, so order matters
    // here and the confluence test pins it.
    if (cde.length >= 1 && groups.has("N")) {
      const from = [...cde, "N" as CompatibilityGroup];
      for (const g of from) groups.delete(g);
      groups.add("D");
      rewrites.push({ rule: "3", from, to: "D", citation: cite("g3iii-CDE-N") });
      continue;
    }
    if (cde.length >= 2) {
      const from = cde;
      for (const g of from) groups.delete(g);
      groups.add("E");
      rewrites.push({ rule: "2", from, to: "E", citation: cite("g3ii-CDE") });
      continue;
    }
    break;
  }

  // 177.848(g)(3)(i): group L travels only with an IDENTICAL explosive, so L in
  // company with anything else at all is a conflict, INCLUDING a second,
  // different group L material.
  //
  // The input is de-duplicated into a Set on entry, which is right for the
  // rewrite rules and wrong here: two different L explosives collapse to one
  // "L" and `groups.size > 1` cannot see them. Verified: UN0380 with UN0248
  // returned PASS and COMMITTED, though the regulation permits L only with an
  // identical explosive and these are two different ones. Multiplicity is
  // therefore counted from the ORIGINAL input rather than from the Set.
  const lCount = [...input].filter((g) => g === "L").length;
  if (lCount > 1) {
    return { ok: false, reason: "compatibility group L may only be carried with an identical explosive, and this load carries more than one group L material", citation: cite("g3i-group-L") };
  }
  if (groups.has("L") && groups.size > 1) {
    return { ok: false, reason: "compatibility group L may only be carried with an identical explosive", citation: cite("g3i-group-L") };
  }

  return { ok: true, groups, rewrites };
}

/** Pairwise check over the 13x13 table, after the fixed point has been taken. */
/**
 * The identities the footnote rules need, which a Set of group letters cannot
 * carry. 177.848(g) footnotes depend on WHAT the material is, not just its
 * compatibility group.
 */
export type ExplosiveIdentity = {
  name: string;
  /** Hazard class as printed in column 3, for example "1.4S" or "1.1G". */
  hazardClass: string;
};

/**
 * WHETHER A CLASS 1 ENTRY IS AN ARTICLE OR A SUBSTANCE.
 *
 * 177.848(g)(vi) grants its permission to explosive ARTICLES in compatibility
 * group G, and only while no explosive SUBSTANCE rides in the same vehicle. The
 * 172.101 table has no article-or-substance column, so the first version of
 * this tested the proper shipping name: `/^substances?[,\s]/` matched 14 of 388
 * Class 1 entries, black powder and TNT and PETN were invisible to it, and
 * "Articles, explosive, n.o.s." with black powder passed while the same article
 * with the literally-named "Substances, explosive, n.o.s." refused. Identical
 * regulatory situations, opposite verdicts, decided by a word in a name.
 *
 * 173.52(b) table 1 is the actual source, and it settles most of it by
 * DEFINITION rather than by spelling. Seven groups are defined as articles, one
 * as a substance, and five admit either:
 *
 *   B E F H J K N   defined as an article
 *   A               defined as a substance
 *   C D G L S       defined as either, so the corpus still cannot tell
 *
 * That is why the map below is keyed on the compatibility group and each entry
 * carries its own verbatim definition: a refusal that cannot settle the
 * question quotes the definition that failed to settle it, so a reader sees the
 * regulation being ambiguous rather than the tool being arbitrary.
 *
 * Where the group admits either, the proper shipping name is still consulted,
 * as a secondary signal and never as a contradiction of the group. An
 * unevaluable condition is not a satisfied one, the rule footnote 4 already
 * follows, so a material that is neither provably an article nor provably a
 * substance blocks the permission rather than being assumed harmless.
 */
type ExplosiveForm = "article" | "substance" | "either";

const GROUP_FORM: Record<CompatibilityGroup, { form: ExplosiveForm; citation: Citation }> = {
  A: { form: "substance", citation: cite("17352-group-A") },
  B: { form: "article", citation: cite("17352-group-B") },
  C: { form: "either", citation: cite("17352-group-C") },
  D: { form: "either", citation: cite("17352-group-D") },
  E: { form: "article", citation: cite("17352-group-E") },
  F: { form: "article", citation: cite("17352-group-F") },
  G: { form: "either", citation: cite("17352-group-G") },
  H: { form: "article", citation: cite("17352-group-H") },
  J: { form: "article", citation: cite("17352-group-J") },
  K: { form: "article", citation: cite("17352-group-K") },
  L: { form: "either", citation: cite("17352-group-L") },
  N: { form: "article", citation: cite("17352-group-N") },
  S: { form: "either", citation: cite("17352-group-S") },
};

const isFirework = (e: ExplosiveIdentity) => /firework/i.test(e.name);
const divisionOf = (e: ExplosiveIdentity) => (/^1\.(\d)/.exec(e.hazardClass) ?? [])[1] ?? "";

/** The compatibility group letter carried by a class such as "1.2E". */
const groupOf = (e: ExplosiveIdentity): CompatibilityGroup | undefined => {
  const m = /^1\.\d\s*([A-S])$/.exec(e.hazardClass.trim().toUpperCase());
  const g = m?.[1] as CompatibilityGroup | undefined;
  return g && g in GROUP_FORM ? g : undefined;
};

/**
 * The DESCRIPTION half of a 173.52(b) table 1 row, without the trailing group
 * letter and classification codes that share the row.
 *
 * The clause slice is verbatim and stays that way, because that is what the
 * citation gate proves. A prefix of a verbatim slice is still verbatim, so
 * trimming " G 1.1G 1.2G 1.3G 1.4G" off the end for display costs nothing and
 * stops a refusal sentence trailing off into table cells.
 */
const definitionText = (c: Citation) => c.text.replace(/\s+[A-S](\s+1\.\d[A-S])+$/, "").trim();

const formOf = (e: ExplosiveIdentity) => {
  const g = groupOf(e);
  return g ? GROUP_FORM[g] : undefined;
};

const isProvablyArticle = (e: ExplosiveIdentity) => {
  const f = formOf(e)?.form;
  if (f === "article") return true;
  if (f === "substance") return false;
  return /^articles?[,\s]/i.test(e.name.trim());
};

const isProvablySubstance = (e: ExplosiveIdentity) => {
  const f = formOf(e)?.form;
  if (f === "substance") return true;
  if (f === "article") return false;
  return /^substances?[,\s]/i.test(e.name.trim());
};

export function checkGroups(
  groups: Set<CompatibilityGroup>,
  /** The two materials being compared. */
  identities: ExplosiveIdentity[] = [],
  /**
   * EVERY explosive in the vehicle, because footnote 6's proviso is written
   * about the transport vehicle and not about the pair. Evaluating it pairwise
   * let a group G article and a group C article clear each other while an
   * explosive substance sat in the same truck, since the G/S and C/S pairs land
   * on different cells and never run the check. Defaults to the pair so a
   * caller that has only the pair still gets the stricter, not the laxer, read.
   */
  vehicle: ExplosiveIdentity[] = identities,
): { ok: true; notes: string[] } | { ok: false; a: CompatibilityGroup; b: CompatibilityGroup; code: string; citation: Citation; reason?: string } {
  const list = [...groups];
  const notes: string[] = [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!, b = list[j]!;
      const code = compatibilityCell(a, b);
      if (code === "X" || code.startsWith("X(")) {
        return { ok: false, a, b, code, citation: cite("g2-X") };
      }

      // FOOTNOTES ARE CONDITIONS, NOT PERMISSIONS, and treating them as
      // permissions is how 1.4S fireworks shipped with 1.1G fireworks. A cell
      // of "4/5" or "6" does not mean "allowed"; it means "allowed IF", and the
      // condition depends on identity that a group letter does not carry.
      if (code.includes("5")) {
        // 177.848(g)(v): Division 1.4S FIREWORKS may not load with 1.1 or 1.2.
        const fireworks14S = identities.filter((e) => isFirework(e) && e.hazardClass.toUpperCase() === "1.4S");
        const oneOneOrTwo = identities.filter((e) => ["1", "2"].includes(divisionOf(e)));
        if (fireworks14S.length > 0 && oneOneOrTwo.length > 0) {
          return {
            ok: false, a, b, code, citation: cite("g5-fireworks"),
            reason: `${fireworks14S[0]!.name} is Division 1.4S fireworks and ${oneOneOrTwo[0]!.name} is Division ${oneOneOrTwo[0]!.hazardClass}. Footnote 5 prohibits that pairing on the same transport vehicle.`,
          };
        }
      }

      if (code.includes("6")) {
        // 177.848(g)(vi) HAS THREE CONDITIONS. This code checked one, then two,
        // then all three, each time because a review found the missing one.
        // The articles must be in group G; they must be OTHER THAN fireworks
        // AND OTHER THAN those requiring special handling; and no explosive
        // substance may ride in the same transport vehicle.
        //
        // Two of the three can be decided from the corpus. The third cannot,
        // and that is why this cell refuses unconditionally today. 172.101
        // designates no material as requiring special handling: the phrase is
        // not a column, a symbol or a special provision code, and 177.848 does
        // not define it. An unevaluable condition is not a satisfied one, the
        // rule footnote 4 already follows.
        //
        // It is worth saying plainly that this is the hole pinning 173.52
        // opened. Deriving article status from the compatibility group was
        // right, and it removed a blanket fail-closed that had been standing in
        // for every unevaluable condition at once, so UN0428 with UN0321 went
        // straight to PASS and COMMITTED with a shipping paper.
        //
        // The order below is not decoration. A condition the corpus can prove
        // VIOLATED is a better refusal than one it merely cannot evaluate, so a
        // firework is named as a firework and an explosive substance as an
        // explosive substance, and the special-handling gap is what is left
        // when neither of those fired.
        const fireworks = vehicle.filter(isFirework);
        if (fireworks.length > 0) {
          return {
            ok: false, a, b, code, citation: cite("g6-group-G"),
            reason: `footnote 6 permits compatibility group G articles with groups C, D and E only for articles OTHER THAN FIREWORKS, and ${fireworks[0]!.name} is a firework.`,
          };
        }

        const substances = vehicle.filter(isProvablySubstance);
        if (substances.length > 0) {
          const bad = substances[0]!;
          const def = formOf(bad);
          return {
            ok: false, a, b, code, citation: cite("g6-group-G"),
            reason:
              `footnote 6 permits compatibility group G articles with groups C, D and E only where ` +
              `explosive substances are not carried in the same transport vehicle, and ${bad.name} ` +
              `is an explosive substance` +
              (def?.form === "substance"
                ? `, because 49 CFR 173.52(b) defines its compatibility group as "${definitionText(def.citation)}"`
                : "") + ".",
          };
        }

        const unproven = vehicle.filter((e) => !isProvablyArticle(e));
        if (unproven.length > 0) {
          const bad = unproven[0]!;
          const def = formOf(bad);
          return {
            ok: false, a, b, code, citation: cite("g6-group-G"),
            reason:
              `footnote 6 permits compatibility group G ARTICLES with groups C, D and E, and ` +
              `${bad.name} cannot be shown to be an explosive article. The 172.101 table carries ` +
              `no article-or-substance column, and ` +
              (def
                ? `49 CFR 173.52(b) defines its compatibility group as "${definitionText(def.citation)}", which admits either. `
                : `its compatibility group could not be read from the hazard class ${JSON.stringify(bad.hazardClass)}. `) +
              `So the permission cannot be shown to apply and is not granted.`,
          };
        }

        const g = vehicle.find((e) => groupOf(e) === "G") ?? identities[0];
        return {
          ok: false, a, b, code, citation: cite("g6-group-G"),
          reason:
            `footnote 6 permits compatibility group G articles with groups C, D and E only for ` +
            `articles OTHER THAN FIREWORKS AND THOSE REQUIRING SPECIAL HANDLING. Every other ` +
            `condition is satisfied here, but the 49 CFR 172.101 table designates no material as ` +
            `requiring special handling and 177.848 does not define the phrase, so that exclusion ` +
            `cannot be evaluated` + (g ? ` for ${g.name}` : "") + ` and the permission is not ` +
            `granted. This is a stated gap in coverage, not a judgement about the load.`,
        };
      }

      if (code.includes("4")) {
        // FAIL CLOSED. 177.848(g)(3)(iv) refers out to 177.835(g), which is not
        // in this corpus, so this tool cannot evaluate the condition.
        //
        // This used to push a NOTE reading "this pairing is NOT cleared by this
        // tool" and then return ok, which cleared it. UN0500 with UN0462 hit
        // the S/C cell "4/5", returned PASS, and exported a shipping paper
        // while the note beside it said the opposite. An unevaluated condition
        // is not a satisfied one, and a sentence saying so is not a refusal.
        //
        // Refusing is the conservative direction and the honest one: the tool
        // declines what it cannot verify, names the section a person must read,
        // and does not hand over a document on the strength of a caveat.
        return {
          ok: false, a, b, code, citation: cite("g3iv-detonators"),
          reason: `their compatibility cell is "${code}", and footnote 4 refers the decision out to 49 CFR 177.835(g) for detonators. That section is outside this tool's corpus, so the condition cannot be evaluated here and is therefore not satisfied. A person must check 177.835(g).`,
        };
      }
    }
  }
  return { ok: true, notes };
}
