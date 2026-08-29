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
  HMT, ROW_TO_COLUMN, segregationCell, forbiddenEntries, type HmtEntry,
} from "../solver/corpus.ts";
import { resolveItem } from "../solver/hazards.ts";
import { checkVehicle } from "../solver/segregation.ts";
import type { MatrixKey, ResolvedItem, VehicleProposal } from "../solver/types.ts";

/** The 18 categories the table indexes, in the regulation's own row order. */
export const CATEGORIES = Object.keys(ROW_TO_COLUMN) as MatrixKey[];

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

      for (const barriersPresent of [false, true]) {
        for (const singleShipper of [false, true]) {
          examined++;
          const naiveClears = tableAloneClears(cell, barriersPresent);
          // `checkVehicle` takes the RESOLVED items as its first argument and
          // reads only the two assertion flags off the proposal, so an empty
          // `items` is correct here rather than a stub. Typed as the real
          // VehicleProposal with no cast: a cast would hide exactly the kind of
          // shape drift that has already caused one runtime crash in this repo.
          const proposal: VehicleProposal = { items: [], barriersPresent, singleShipper };
          const { violations } = checkVehicle([a, b], proposal, 0);
          const regulationRefuses = violations.length > 0;

          if (naiveClears) cleared++;
          if (regulationRefuses) refused++;

          if (naiveClears && regulationRefuses) {
            divergent++;
            const v = violations[0]!;
            byGround[v.code] = (byGround[v.code] ?? 0) + 1;
            if (examples.length < 12) {
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
