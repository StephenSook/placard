/**
 * THE HEADLINE NUMBER, and it is computed rather than measured against a model.
 *
 * The claim this project makes is that an agent reasoning from the 177.848(d)
 * segregation table alone will clear loads the regulation forbids, because the
 * table is one of FOUR independent refusal axes. That claim is checkable
 * without a model, without an API key and without a benchmark, by asking a
 * question the corpus can answer on its own:
 *
 *   Over every ordered pair of the 18 hazard categories the table indexes, in
 *   every barrier and shipper configuration, how many configurations does the
 *   TABLE ALONE clear that the FULL REGULATION refuses?
 *
 * WHY THIS RATHER THAN A MODEL BENCHMARK. A "we ran GPT on 40 scenarios"
 * number would need an OpenAI key this project does not have, would be
 * unreproducible for anyone without one, would drift as the model changes, and
 * would measure the model rather than the regulation. This number measures the
 * regulation. Anyone can recompute it from the committed corpus in a second,
 * and it cannot move unless 49 CFR moves.
 *
 * WHAT IT IS NOT. It is not a claim about any specific model's accuracy, and it
 * is not a probability that an agent errs. It is the SIZE OF THE GAP an agent
 * is reasoning across when it uses the table as though the table were the whole
 * rule. The gap is the hazard; how often a given model falls into it is a
 * separate question this endpoint does not answer and does not pretend to.
 *
 * NO SYNTHETIC DATA. Each of the 18 categories is represented by a REAL entry
 * drawn from the committed 172.101 table, chosen deterministically (see
 * `representatives`), so every pair compared is a pair of materials that
 * actually exist in the regulation.
 */
import {
  HMT, SEGREGATION, segregationCell, forbiddenEntries, type HmtEntry,
} from "../solver/corpus.ts";
import { resolveItem } from "../solver/hazards.ts";
import { checkVehicle } from "../solver/segregation.ts";
import type { MatrixKey, ResolvedItem, VehicleProposal } from "../solver/types.ts";

/**
 * The 18 categories the table indexes, in THE REGULATION'S OWN ROW ORDER.
 *
 * Derived from SEGREGATION.rows rather than from Object.keys(ROW_TO_COLUMN),
 * and that is not a style preference. JavaScript orders integer-like string
 * keys FIRST and in ascending numeric order, so Object.keys on that record
 * returns ["3", "7", "8", "1.1 and 1.2", ...]: classes 3, 7 and 8 leap to the
 * front because they look like array indices, and every other key follows in
 * insertion order.
 *
 * That silently transposed the rendered 177.848(d) table against its own row
 * labels. Every one of the 18 rows was captioned with one hazard class and
 * filled with another's data, so the panel told a reader that Explosives and
 * Class 3 have no restriction between them when the row it had drawn was
 * Flammable liquids. The count of divergent configurations was unaffected,
 * because that iterates all ordered pairs, which is order-independent. The
 * DISPLAY was wrong, and the display is what a person reads.
 */
export const CATEGORIES = SEGREGATION.rows.map((r) => r.key) as MatrixKey[];

/**
 * What an agent reading ONLY the table would conclude for one pair.
 *
 * This is the generous reading, deliberately. `X` refuses. `O` means "may be
 * loaded together only when separated", so a barrier clears it. `*` routes to
 * 177.848(f) for explosives, and a blank imposes no restriction, so both clear.
 * Reading the table any more strictly than this would inflate the result, and
 * the number is only worth publishing if the naive arm is given every benefit.
 */
export function tableAloneClears(code: string, barriersPresent: boolean): boolean {
  if (code === "X") return false;
  if (code === "O") return barriersPresent;
  return true;
}

/**
 * One real 172.101 entry per category, chosen deterministically.
 *
 * Determinism matters more than elegance here: the published number must be
 * identical on every machine and every run, so the choice is "lowest table
 * index that resolves to exactly this category and is not itself Forbidden",
 * which depends only on the committed corpus.
 */
export function representatives(): Map<MatrixKey, HmtEntry> {
  const out = new Map<MatrixKey, HmtEntry>();
  for (const entry of HMT) {
    if (entry.forbidden || !entry.un) continue;
    const r = resolveItem({ id: entry.un, name: entry.name });
    if ("error" in r) continue;
    const keys = r.hazards.map((h) => h.matrixKey).filter((k): k is MatrixKey => k !== null);
    // Exactly one category, so the pair being compared is unambiguous and the
    // most-restrictive rule of (e)(6) is not silently doing the work.
    if (keys.length !== 1) continue;
    const k = keys[0]!;
    if (!out.has(k)) out.set(k, entry);
  }
  return out;
}

export type Divergence = {
  categories: number;
  representedCategories: number;
  unrepresented: MatrixKey[];
  configurationsExamined: number;
  tableAloneClears: number;
  regulationRefuses: number;
  /** Table clears, regulation refuses. The gap. */
  divergent: number;
  /** Divergent as a share of the configurations the table alone cleared. */
  divergentShareOfCleared: number;
  byGround: Record<string, number>;
  /**
   * The CATEGORY pairs that diverge, as matrix keys rather than material names.
   *
   * Separate from `examples` on purpose. `examples` is capped and carries the
   * real material names for a human to read; this is the complete set, keyed the
   * way the 177.848(d) table is indexed, so a renderer can ring the exact cells.
   * The matrix panel originally tried to derive these from `examples` and rang
   * nothing at all, because it was comparing matrix keys against chemical names.
   */
  divergentPairs: Array<[MatrixKey, MatrixKey]>;
  examples: Array<{
    a: string; b: string; cell: string; barriersPresent: boolean;
    singleShipper: boolean; code: string; clause: string;
  }>;
};

/**
 * Recompute the divergence from the committed corpus.
 *
 * Pure, synchronous and cheap: 18 x 18 x 4 configurations, each one a real
 * `checkVehicle` call over two real materials.
 */
export function measureDivergence(): Divergence {
  const reps = representatives();
  const unrepresented = CATEGORIES.filter((c) => !reps.has(c));

  let examined = 0, cleared = 0, refused = 0, divergent = 0;
  const byGround: Record<string, number> = {};
  const examples: Divergence["examples"] = [];
  const divergentPairs: Array<[MatrixKey, MatrixKey]> = [];
  const seenPair = new Set<string>();

  const resolvedCache = new Map<MatrixKey, ResolvedItem>();
  const resolved = (k: MatrixKey): ResolvedItem | null => {
    if (resolvedCache.has(k)) return resolvedCache.get(k)!;
    const e = reps.get(k);
    if (!e || !e.un) return null;
    const r = resolveItem({ id: e.un, name: e.name });
    if ("error" in r) return null;
    resolvedCache.set(k, r);
    return r;
  };

  for (const ka of CATEGORIES) {
    for (const kb of CATEGORIES) {
      const a = resolved(ka), b = resolved(kb);
      if (!a || !b) continue;
      const cell = segregationCell(ka, kb);

      // THE SECOND AXIS IS THE TRUCKLOAD CARVE-OUT AS A WHOLE, not singleShipper
      // alone. 177.848(e)(3) needs BOTH a single-shipper truckload AND an
      // explicit non-reaction assertion before its exception applies, so
      // sweeping singleShipper while leaving nonReactionAsserted false produced
      // two identical halves: measured, 0 of 648 combinations flipped on it, and
      // every published count was exactly twice the number of distinct
      // configurations. The share was unaffected, the absolute numbers were not.
      //
      // Sweeping the carve-out itself makes all four configurations real.
      for (const barriersPresent of [false, true]) {
        for (const truckloadCarveOut of [false, true]) {
          const singleShipper = truckloadCarveOut;
          const nonReactionAsserted = truckloadCarveOut;
          examined++;
          const naiveClears = tableAloneClears(cell, barriersPresent);
          // `checkVehicle` takes the RESOLVED items as its first argument and
          // reads only the two assertion flags off the proposal, so an empty
          // `items` is correct here rather than a stub. Typed as the real
          // VehicleProposal with no cast: a cast would hide exactly the kind of
          // shape drift that has already caused one runtime crash in this repo.
          const proposal: VehicleProposal = { items: [], barriersPresent, singleShipper, nonReactionAsserted };
          const { violations } = checkVehicle([a, b], proposal, 0);
          const regulationRefuses = violations.length > 0;

          if (naiveClears) cleared++;
          if (regulationRefuses) refused++;

          if (naiveClears && regulationRefuses) {
            divergent++;
            const v = violations[0]!;
            byGround[v.code] = (byGround[v.code] ?? 0) + 1;
            const pk = `${ka}::${kb}`;
            if (!seenPair.has(pk)) { seenPair.add(pk); divergentPairs.push([ka, kb]); }
            // Cap PER GROUND rather than overall. Taking the first twelve
            // meant the explosives cases, which come first in the regulation's
            // row order, filled the list and the signature
            // corrosive-over-oxidizer case disappeared from the published
            // evidence entirely. A sample that omits a whole ground is not a
            // sample of the finding.
            const perGround = examples.filter((e) => e.code === v.code).length;
            if (perGround < 6) {
              examples.push({
                a: a.name, b: b.name, cell: cell === "" ? "(blank)" : cell,
                barriersPresent, singleShipper, code: v.code,
                clause: v.citations[0]?.section ?? "",
              });
            }
          }
        }
      }
    }
  }

  return {
    categories: CATEGORIES.length,
    representedCategories: reps.size,
    unrepresented,
    configurationsExamined: examined,
    tableAloneClears: cleared,
    regulationRefuses: refused,
    divergent,
    divergentShareOfCleared: cleared === 0 ? 0 : Number((divergent / cleared).toFixed(4)),
    byGround,
    divergentPairs,
    examples,
  };
}

/**
 * The other half of the evidence, and the one a stranger can check against
 * ecfr.gov directly: how many materials an identification-number-keyed index
 * silently loses.
 */
export function measureForbidden() {
  const forbidden = forbiddenEntries();
  const withUn = forbidden.filter((e) => e.un !== null && e.un !== "");
  return {
    hmtEntries: HMT.length,
    forbiddenEntries: forbidden.length,
    forbiddenCarryingAnIdentificationNumber: withUn.length,
    recoverableByIdKeyedLookup: withUn.length,
    recoverableByThisIndex: forbidden.length,
    sample: forbidden.slice(0, 8).map((e) => e.name),
  };
}
