/**
 * The public solver surface. Pure: no React, no network, no model.
 *
 * The one property that matters: a PASS carries an approval token bound to a
 * content hash of the exact load that passed. commit_manifest recomputes that
 * hash from the bytes it is about to export and refuses on mismatch, so a
 * stale load, a mutated load and a shadow tool registered under the same name
 * are all uncommittable regardless of registration order.
 */
import { resolveItem } from "./hazards.ts";
import { checkVehicle } from "./segregation.ts";
import { approvalToken, loadDigest, canonical } from "./hash.ts";
import type { LoadProposal, ResolvedItem, Verdict, Violation } from "./types.ts";

export * from "./types.ts";
export { resolveItem, matrixKeyFor } from "./hazards.ts";
export { resolveCompatibility, checkGroups } from "./explosives.ts";
export { approvalToken, loadDigest, canonical } from "./hash.ts";
export { cite, CLAUSE_IDS, HMT, SEGREGATION, COMPATIBILITY, forbiddenEntries, lookupByUn, lookupByName, segregationCell, ROW_TO_COLUMN } from "./corpus.ts";
export { checkVehicle, worstCell } from "./segregation.ts";
export { proposePartition } from "./partition.ts";
export type { PartitionOptions, PartitionResult } from "./partition.ts";

export type CheckResult = Verdict & { digest: string };

/**
 * Adjudicate a proposed load. Deterministic and total: every input either
 * produces a verdict or an explicit resolution error, never a silent pass.
 */
export async function checkLoad(load: LoadProposal, nonce: string): Promise<CheckResult> {
  const violations: Violation[] = [];
  const notes: string[] = [];
  let checked = 0;

  if (load.vehicles.length === 0) {
    return { status: "REFUSED", violations: [], checked: 0, notes: ["No vehicles were proposed."], digest: await loadDigest(load) };
  }

  load.vehicles.forEach((v, vi) => {
    const resolved: ResolvedItem[] = [];
    v.items.forEach((item, ii) => {
      const r = resolveItem(item);
      if ("error" in r) {
        violations.push({
          code: "UNRESOLVED_MATERIAL", items: [ii], vehicle: vi,
          message: `Could not resolve line item ${ii + 1}: ${r.error}. A load cannot be cleared on a material the table does not identify, and this is a lookup failure rather than a finding that the material is forbidden.`,
          citations: [],
        });
        return;
      }
      resolved.push(r);
    });
    const out = checkVehicle(resolved, v, vi);
    violations.push(...out.violations);
    notes.push(...out.notes);
    checked += out.comparisons;
  });

  const digest = await loadDigest(load);
  if (violations.length > 0) return { status: "REFUSED", violations, checked, notes, digest };
  return { status: "PASS", approvalToken: await approvalToken(load, nonce), checked, notes, digest };
}

/**
 * Re-verify a token against the exact load being committed. This is the
 * security boundary, not the tool registry: the registry is keyed by name and
 * any same-origin script can register over a name, so absence from it is a UX
 * affordance and defence in depth, never the guarantee.
 */
export async function verifyApproval(load: LoadProposal, token: string, nonce: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!/^[a-f0-9]{64}$/.test(token)) return { ok: false, reason: "approval token is not a SHA-256 hex digest" };
  const expected = await approvalToken(load, nonce);
  if (token !== expected) {
    return { ok: false, reason: "approval token does not match this load. The load changed after it was checked, or the token was issued for a different load. Re-run check_segregation." };
  }
  // Belt and braces: a matching token on a load that no longer passes would
  // mean the solver is non-deterministic, which is itself a refusal condition.
  const re = await checkLoad(load, nonce);
  if (re.status !== "PASS") return { ok: false, reason: "the load does not pass on re-check despite a matching token" };
  return { ok: true };
}

/** Stable identity of a load, for display and audit. */
export function loadFingerprint(load: LoadProposal): string {
  return canonical(load);
}
