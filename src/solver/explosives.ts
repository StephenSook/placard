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
export function checkGroups(groups: Set<CompatibilityGroup>): { ok: true } | { ok: false; a: CompatibilityGroup; b: CompatibilityGroup; code: string; citation: Citation } {
  const list = [...groups];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!, b = list[j]!;
      const code = compatibilityCell(a, b);
      if (code === "X" || code.startsWith("X(")) {
        return { ok: false, a, b, code, citation: cite("g2-X") };
      }
    }
  }
  return { ok: true };
}
