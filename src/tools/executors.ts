/**
 * Tool executors, as pure functions.
 *
 * Deliberately separated from the React binding so that every tool's behaviour
 * is testable in Node with no browser, no agent and no WebMCP runtime. The
 * hook in useHazmatTools.ts does nothing but wire these to the registry, so
 * anything a judge can prove about these functions holds for the tools.
 *
 * RESULTS ARE KEPT SMALL ON PURPOSE. Tool execution is local, but the model
 * that generates the arguments and reads the results is cloud-hosted, so both
 * transit the model provider. The spec calls this out as privacy leakage
 * through over-parameterization (6.3.3). The honest claim is that the manifest
 * file never leaves the browser and all computation is local, NOT that nothing
 * leaves the browser.
 */
import {
  HMT, lookupByUn, lookupByName, forbiddenEntries, resolveItem,
  checkLoad, verifyApproval, proposePartition, cite, normalizeOrthography,
} from "../solver/index.ts";
import type { Citation, LineItem, LoadProposal, VehicleProposal } from "../solver/types.ts";

/** Trim a corpus entry to the fields an agent actually needs. */
function brief(e: (typeof HMT)[number]) {
  return {
    name: e.name,
    id: e.un,
    hazardClass: e.class,
    packingGroup: e.pg,
    labels: e.labels,
    forbidden: e.forbidden,
    ...(e.forbidden
      ? { note: "Forbidden in column 3 of the 172.101 table. It has no identification number because it may not be offered for transportation at all." }
      : {}),
    ...(e.symbols.airOnly ? { note: "Symbol A: regulated only when offered by aircraft, so 49 CFR part 177 highway segregation does not apply." } : {}),
    ...(e.symbols.vesselOnly ? { note: "Symbol W: regulated only when offered by vessel, so 49 CFR part 177 highway segregation does not apply." } : {}),
  };
}

const norm = (s: string) => s.toLowerCase().trim();

// ── lookup_material ──────────────────────────────────────────────────────────

export type MaterialBrief = ReturnType<typeof brief>;
export type LookupResult = {
  matches: MaterialBrief[];
  note?: string | undefined;
  citation?: Citation | undefined;
};

export function lookupMaterial(input: { query: string }): LookupResult {
  const q = norm(input.query);
  if (!q) return { matches: [], note: "Empty query." };

  // An identification number, if it looks like one.
  if (/^(un|na|id)\s?\d{4}$/.test(q)) {
    const rows = lookupByUn(q.replace(/\s/g, "").toUpperCase());
    if (rows.length) {
      return {
        matches: rows.slice(0, 6).map(brief),
        note: rows.length > 1 ? `${rows.length} rows share this identification number, one per packing group.` : undefined,
      };
    }
  }

  // Exact name, then the table's own synonym pointers, then substring.
  const exact = lookupByName(input.query);
  const subs = HMT.filter((e) => norm(e.name).includes(q)).slice(0, 8);
  const seen = new Set<number>();
  const matches: ReturnType<typeof brief>[] = [];
  for (const e of [...(exact ? [exact] : []), ...subs]) {
    if (seen.has(e.index)) continue;
    seen.add(e.index);
    matches.push(brief(e));
  }

  if (matches.length === 0) {
    // Do NOT let an empty result read as "not regulated". That inference is
    // the exact failure this project exists to prevent.
    return {
      matches: [],
      note:
        "No entry matched. This does NOT mean the material is unregulated. Check the spelling, try a " +
        "synonym, or search the Forbidden materials by name: there are " + forbiddenEntries().length +
        " entries the table designates Forbidden and none of them carries an identification number.",
    };
  }
  const anyForbidden = matches.some((m) => m.forbidden);
  return {
    matches,
    ...(anyForbidden ? { citation: cite("17321-a-forbidden") } : {}),
  };
}

// ── classify_line_item ───────────────────────────────────────────────────────

/**
 * Cheap token overlap. Deliberately not fuzzy-clever: the human confirms.
 *
 * Both sides pass through normalizeOrthography first, so a line written
 * "2 drums sulphuric acid soln 60%" scores against "Sulfuric acid with more
 * than 51 percent acid". Without it that line matched Azidodithiocarbonic acid
 * and Butyric acid on the shared token "acid", and the correct entry did not
 * appear in the candidate list at all.
 */
function score(entryName: string, text: string): number {
  const a = new Set(normalizeOrthography(norm(entryName)).split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  const b = new Set(normalizeOrthography(norm(text)).split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / a.size;
}

export function classifyLineItem(input: { text: string }) {
  const text = input.text;
  const idMatch = /\b(UN|NA|ID)\s?(\d{4})\b/i.exec(text);
  if (idMatch) {
    const rows = lookupByUn(`${idMatch[1]!.toUpperCase()}${idMatch[2]}`);
    if (rows.length) {
      return {
        candidates: rows.slice(0, 3).map((e) => ({ ...brief(e), confidence: "identification number found in the text" })),
        confirmationRequired: true,
      };
    }
  }
  const ranked = HMT
    .map((e) => ({ e, s: score(e.name, text) }))
    .filter((x) => x.s > 0.34)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  return {
    candidates: ranked.map((x) => ({ ...brief(x.e), confidence: `${Math.round(x.s * 100)}% name-token overlap` })),
    confirmationRequired: true,
    note:
      ranked.length === 0
        ? "Nothing matched confidently. Ask the operator for the proper shipping name or identification number rather than guessing."
        : "These are candidates, not a classification. A human must confirm the entry before it is used. " +
          "This tool reads text that may have come from a supplier email or spreadsheet; nothing in that text " +
          "can change a segregation verdict, because the verdict is computed from the confirmed entry alone.",
  };
}

// ── propose_load ─────────────────────────────────────────────────────────────

export function proposeLoad(input: {
  items: string[]; maxVehicles: number; barriersPresent?: boolean; singleShipper?: boolean;
}) {
  const items: LineItem[] = input.items.map((ref) =>
    looksLikeId(ref) ? { id: ref.replace(/\s/g, "").toUpperCase() } : { name: ref }
  );
  const r = proposePartition(items, {
    maxVehicles: input.maxVehicles,
    ...(input.barriersPresent !== undefined ? { barriersPresent: input.barriersPresent } : {}),
    ...(input.singleShipper !== undefined ? { singleShipper: input.singleShipper } : {}),
  });

  if (r.status === "UNRESOLVED") {
    return { status: "UNRESOLVED" as const, errors: r.errors };
  }
  if (r.status === "IMPOSSIBLE") {
    return {
      status: "IMPOSSIBLE" as const,
      reason: r.rejected.length
        ? "One or more materials may not be transported at all, so no arrangement exists."
        : `These ${r.needed} materials each conflict with every other one in the set, so they need ${r.needed} vehicles and only ${r.available} are available.`,
      rejected: r.rejected.map((x) => ({ name: x.name, why: x.violation.message })),
      conflictingSet: r.minimalConflictingSet,
      vehiclesNeeded: r.needed,
      vehiclesAvailable: r.available,
    };
  }
  return {
    status: "PROPOSED" as const,
    vehicles: r.load.vehicles.map((v, i) => ({ vehicle: i + 1, items: v.items.map((x) => x.id ?? x.name ?? "") })),
    vehiclesUsed: r.vehiclesUsed,
    conflictsAvoided: r.conflicts.length,
    note: "This is a proposal. Run check_segregation on it to obtain an approval token; nothing can be exported without one.",
  };
}

// ── check_segregation ────────────────────────────────────────────────────────

/** An identification number as the 172.101 table writes it. */
const looksLikeId = (s: string) => /^(UN|NA|ID)\s?\d{4}$/i.test(s.trim());

/**
 * Turn wire references into line items. A reference is EITHER an
 * identification number or a proper shipping name, because a Forbidden
 * material has no identification number and must still be checkable.
 */
/** The shape a vehicle takes on the wire, between the agent and the solver. */
export type WireVehicle = { items: string[]; barriersPresent?: boolean; singleShipper?: boolean };

export function toLoad(vehicles: WireVehicle[]): LoadProposal {
  return {
    vehicles: vehicles.map((v): VehicleProposal => ({
      items: v.items.map((ref) =>
        looksLikeId(ref) ? { id: ref.replace(/\s/g, "").toUpperCase() } : { name: ref }
      ),
      ...(v.barriersPresent !== undefined ? { barriersPresent: v.barriersPresent } : {}),
      ...(v.singleShipper !== undefined ? { singleShipper: v.singleShipper } : {}),
    })),
  };
}

export async function checkSegregation(
  input: { vehicles: Array<{ items: string[]; barriersPresent?: boolean; singleShipper?: boolean }> },
  nonce: string
) {
  const load = toLoad(input.vehicles);
  const v = await checkLoad(load, nonce);
  if (v.status === "PASS") {
    return {
      status: "PASS" as const,
      approvalToken: v.approvalToken,
      pairsChecked: v.checked,
      notes: v.notes,
      note: "The token is bound to a hash of this exact arrangement. Change anything and it stops validating.",
    };
  }
  return {
    status: "REFUSED" as const,
    pairsChecked: v.checked,
    violations: v.violations.map((x) => ({
      vehicle: x.vehicle + 1,
      ground: x.code,
      ...(x.cell ? { tableCell: x.cell } : {}),
      explanation: x.message,
      regulation: x.citations.map((c) => ({ section: c.section, text: c.text })),
    })),
    notes: v.notes,
  };
}

// ── commit_manifest ──────────────────────────────────────────────────────────

export async function commitManifest(
  input: { approvalToken: string; vehicles: Array<{ items: string[]; barriersPresent?: boolean; singleShipper?: boolean }> },
  nonce: string
) {
  // THE SECURITY BOUNDARY. Not the registry: the WebMCP tool map is keyed by
  // name, so any same-origin script can register over a name and absence from
  // the registry is a UX affordance plus defence in depth, never the
  // guarantee. The guarantee is that this function re-derives the verdict from
  // the exact bytes it is about to export.
  const load = toLoad(input.vehicles);
  const check = await verifyApproval(load, input.approvalToken, nonce);
  if (!check.ok) {
    return {
      status: "REFUSED" as const,
      reason: check.reason,
      note: "No shipping paper was produced. Re-run check_segregation on the arrangement you intend to ship.",
    };
  }
  return {
    status: "COMMITTED" as const,
    shippingPaper: buildShippingPaper(load),
    note: "The signer remains responsible for the certification under 49 CFR 172.204. This is not the official CFR and it is not legal advice.",
  };
}

/** The deliverable: a shipping-paper description per 49 CFR 172 subpart C. */
export function buildShippingPaper(load: LoadProposal) {
  return load.vehicles.map((v, i) => ({
    vehicle: i + 1,
    barriersPresent: v.barriersPresent === true,
    singleShipper: v.singleShipper === true,
    lines: v.items.map((item) => {
      const r = resolveItem(item);
      if ("error" in r) return { error: r.error };
      // Basic description sequence per 172.202(a): identification number,
      // proper shipping name, hazard class, packing group.
      return {
        identificationNumber: r.item.id,
        properShippingName: r.name,
        hazardClass: r.hazardClass,
        packingGroup: r.packingGroup,
        labelCodes: r.hazards.map((h) => h.raw),
      };
    }),
  }));
}
