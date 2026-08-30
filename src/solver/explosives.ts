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

const isFirework = (e: ExplosiveIdentity) => /firework/i.test(e.name);
const divisionOf = (e: ExplosiveIdentity) => (/^1\.(\d)/.exec(e.hazardClass) ?? [])[1] ?? "";
/** 172.101 names explosive entries as "Articles, ..." or "Substances, ...". */
const isExplosiveSubstance = (e: ExplosiveIdentity) =>
  /^substances?[,\s]/i.test(e.name.trim());

export function checkGroups(
  groups: Set<CompatibilityGroup>,
  /** Optional identities. Without them the footnote rules cannot run and say so. */
  identities: ExplosiveIdentity[] = [],
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
        // 177.848(g)(vi): group G articles may travel with C, D and E ONLY IF
        // no explosive SUBSTANCES are in the same vehicle.
        const substances = identities.filter(isExplosiveSubstance);
        if (substances.length > 0) {
          return {
            ok: false, a, b, code, citation: cite("g6-group-G"),
            reason: `Footnote 6 permits compatibility group G articles with groups C, D and E only where explosive SUBSTANCES are not carried in the same vehicle, and ${substances[0]!.name} is one.`,
          };
        }
        if (identities.length === 0) {
          notes.push(`A footnote 6 cell applies and its condition, that no explosive substances share the vehicle, could not be evaluated because no material identities were supplied. Confirm it by hand.`);
        }
      }

      if (code.includes("4")) {
        // 177.848(g)(3)(iv) refers out to 177.835(g), which is NOT in this
        // corpus. Flag rather than clear: an unevaluated condition is not a
        // satisfied one.
        notes.push(`${cite("g3iv-detonators").section}: "${cite("g3iv-detonators").text}" That section is outside this corpus, so this pairing is NOT cleared by this tool. A person must check 177.835(g).`);
      }
    }
  }
  return { ok: true, notes };
}
