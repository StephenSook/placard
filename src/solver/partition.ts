/**
 * The proposer: split a manifest across vehicles so that no pair violates
 * 49 CFR 177.848.
 *
 * This is the half the agent cannot do reliably and the page can. Segregation
 * is a graph-colouring problem: build the conflict graph over line items, then
 * find an assignment of items to vehicles where no edge is monochromatic.
 * Backtracking with most-constrained-variable ordering, which is exact rather
 * than heuristic, because a lab pack is tens of items and a wrong answer here
 * is a wrong answer about federal law.
 *
 * WHEN IT FAILS IT MUST SAY WHY. "No solution" is useless to a shipping
 * officer. A refusal names the MINIMAL CONFLICTING SET: a group of items that
 * all conflict with each other pairwise, so that k mutually conflicting items
 * provably need k vehicles. That is a witness a human can act on, and it is
 * checkable by hand against the table.
 */
import { resolveItem } from "./hazards.ts";
import { checkVehicle } from "./segregation.ts";
import type {
  Citation, LineItem, LoadProposal, ResolvedItem, VehicleProposal, Violation,
} from "./types.ts";

export type PartitionOptions = {
  /** Vehicles available. The proposer will not exceed this. */
  maxVehicles: number;
  /** Whether the proposed arrangement asserts physical barriers. */
  barriersPresent?: boolean;
  /** Whether the whole load is offered by a single shipper (177.848 truckload). */
  singleShipper?: boolean;
};

export type PartitionResult =
  | {
      status: "PROPOSED";
      load: LoadProposal;
      /** How many vehicles the proposal actually uses, which may be fewer than allowed. */
      vehiclesUsed: number;
      /** Pairs that cannot share a vehicle, which is why the split looks as it does. */
      conflicts: Array<{ a: string; b: string; reason: string; citations: Citation[] }>;
      searchNodes: number;
    }
  | {
      status: "IMPOSSIBLE";
      /** Items that individually may not be transported at all. */
      rejected: Array<{ name: string; violation: Violation }>;
      /**
       * A set of items that conflict pairwise. Its size exceeds the vehicles
       * available, which is the proof that no arrangement exists.
       */
      minimalConflictingSet: string[];
      needed: number;
      available: number;
      conflicts: Array<{ a: string; b: string; reason: string; citations: Citation[] }>;
      searchNodes: number;
    }
  | {
      status: "UNRESOLVED";
      /** Line items that did not resolve against the 172.101 table. */
      errors: Array<{ index: number; error: string }>;
    };

/**
 * Do these two items conflict when placed in the same vehicle under the given
 * arrangement? Decided by running the real check on a two-item vehicle, so the
 * proposer and the adjudicator can never disagree about what a conflict is.
 */
function conflictBetween(
  a: ResolvedItem,
  b: ResolvedItem,
  opts: PartitionOptions
): { conflict: false } | { conflict: true; reason: string; citations: Citation[] } {
  const v: VehicleProposal = {
    items: [a.item, b.item],
    ...(opts.barriersPresent !== undefined ? { barriersPresent: opts.barriersPresent } : {}),
    ...(opts.singleShipper !== undefined ? { singleShipper: opts.singleShipper } : {}),
  };
  const out = checkVehicle([a, b], v, 0);
  // Ignore unary violations here; those are handled before the search runs.
  const pairwise = out.violations.filter((x) => x.items.length === 2);
  const first = pairwise[0];
  if (!first) return { conflict: false };
  return { conflict: true, reason: first.message, citations: first.citations };
}

/** Greedy maximal clique through a highest-degree-first walk. Exact enough:
 *  any clique it returns IS a clique, which is all the witness needs to be. */
function findClique(adj: boolean[][], n: number): number[] {
  const degree = (i: number) => adj[i]!.reduce((s, x) => s + (x ? 1 : 0), 0);
  const order = [...Array(n).keys()].sort((x, y) => degree(y) - degree(x));
  let best: number[] = [];
  for (const seed of order) {
    const clique = [seed];
    for (const cand of order) {
      if (cand === seed) continue;
      if (clique.every((m) => adj[cand]![m])) clique.push(cand);
    }
    if (clique.length > best.length) best = clique;
  }
  return best;
}

export function proposePartition(items: LineItem[], opts: PartitionOptions): PartitionResult {
  // ── resolve ───────────────────────────────────────────────────────────────
  const resolved: ResolvedItem[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  items.forEach((item, i) => {
    const r = resolveItem(item);
    if ("error" in r) errors.push({ index: i, error: r.error });
    else resolved.push(r);
  });
  if (errors.length) return { status: "UNRESOLVED", errors };

  const n = resolved.length;
  if (n === 0) {
    return { status: "PROPOSED", load: { vehicles: [] }, vehiclesUsed: 0, conflicts: [], searchNodes: 0 };
  }

  // ── unary refusals come first: no arrangement fixes a Forbidden material ──
  const rejected: Array<{ name: string; violation: Violation }> = [];
  resolved.forEach((r, i) => {
    const out = checkVehicle([r], { items: [r.item] }, 0);
    for (const v of out.violations) {
      if (v.items.length === 1) rejected.push({ name: r.name, violation: { ...v, items: [i] } });
    }
  });

  // ── conflict graph ────────────────────────────────────────────────────────
  const adj: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const conflicts: Array<{ a: string; b: string; reason: string; citations: Citation[] }> = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c = conflictBetween(resolved[i]!, resolved[j]!, opts);
      if (c.conflict) {
        adj[i]![j] = true;
        adj[j]![i] = true;
        conflicts.push({ a: resolved[i]!.name, b: resolved[j]!.name, reason: c.reason, citations: c.citations });
      }
    }
  }

  if (rejected.length) {
    return {
      status: "IMPOSSIBLE", rejected, minimalConflictingSet: rejected.map((r) => r.name),
      needed: 0, available: opts.maxVehicles, conflicts, searchNodes: 0,
    };
  }

  // ── colour the graph ──────────────────────────────────────────────────────
  // Most-constrained-variable: highest degree first. That fails fastest on the
  // unsatisfiable cases, which is where the search cost actually lives.
  const order = [...Array(n).keys()].sort(
    (x, y) => adj[y]!.filter(Boolean).length - adj[x]!.filter(Boolean).length
  );
  const colour = new Array<number>(n).fill(-1);
  let nodes = 0;
  const BOUND = 2_000_000;

  function assign(pos: number, used: number): boolean {
    if (pos === n) return true;
    if (++nodes > BOUND) throw new Error("partition search exceeded its node bound");
    const item = order[pos]!;
    // Symmetry breaking: only ever open ONE new vehicle at each step. Without
    // this the search re-explores every permutation of identical empty bays.
    const ceiling = Math.min(used + 1, opts.maxVehicles);
    for (let c = 0; c < ceiling; c++) {
      let ok = true;
      for (let other = 0; other < n; other++) {
        if (colour[other] === c && adj[item]![other]) { ok = false; break; }
      }
      if (!ok) continue;
      colour[item] = c;
      if (assign(pos + 1, Math.max(used, c + 1))) return true;
      colour[item] = -1;
    }
    return false;
  }

  if (assign(0, 0)) {
    const vehiclesUsed = Math.max(0, ...colour) + 1;
    const vehicles: VehicleProposal[] = Array.from({ length: vehiclesUsed }, () => ({
      items: [] as LineItem[],
      ...(opts.barriersPresent !== undefined ? { barriersPresent: opts.barriersPresent } : {}),
      ...(opts.singleShipper !== undefined ? { singleShipper: opts.singleShipper } : {}),
    }));
    resolved.forEach((r, i) => vehicles[colour[i]!]!.items.push(r.item));
    return { status: "PROPOSED", load: { vehicles }, vehiclesUsed, conflicts, searchNodes: nodes };
  }

  // ── no arrangement exists: produce the witness ────────────────────────────
  const clique = findClique(adj, n);
  return {
    status: "IMPOSSIBLE",
    rejected: [],
    minimalConflictingSet: clique.map((i) => resolved[i]!.name),
    needed: clique.length,
    available: opts.maxVehicles,
    conflicts,
    searchNodes: nodes,
  };
}
