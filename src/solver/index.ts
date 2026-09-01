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
import { cite } from "./corpus.ts";
import { checkVehicle } from "./segregation.ts";
import { approvalToken, loadDigest, canonical } from "./hash.ts";
import type { LoadProposal, ResolvedItem, Verdict, Violation } from "./types.ts";

export * from "./types.ts";
export { resolveItem, matrixKeyFor } from "./hazards.ts";
export { resolveCompatibility, checkGroups } from "./explosives.ts";
export { approvalToken, loadDigest, canonical } from "./hash.ts";
export { cite, CLAUSE_IDS, HMT, SEGREGATION, COMPATIBILITY, forbiddenEntries, lookupByUn, lookupByName, segregationCell, ROW_TO_COLUMN, normalizeOrthography } from "./corpus.ts";
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

  // A LOAD WITH NOTHING IN IT IS NOT A PASSING LOAD. Zero vehicles was already
  // refused; zero ITEMS was not, so `{vehicles:[{items:[]}]}` returned PASS with
  // pairsChecked 0, issued an approval token, and committed a shipping paper
  // whose lines array was empty. It is also the exit door for any bug upstream
  // that empties the manifest: whatever silently drops the cargo, the check
  // then has nothing left to object to.
  //
  // An individual empty vehicle stays legal, because adding a second truck
  // before filling it is an ordinary intermediate state. What is refused is a
  // load that, taken as a whole, carries nothing.
  if (load.vehicles.every((v) => v.items.length === 0)) {
    return {
      status: "REFUSED",
      violations: [{
        code: "UNRESOLVED_MATERIAL", items: [], vehicle: 0,
        message: "This load contains no line items at all. There is nothing to adjudicate and nothing to describe on a shipping paper, so no approval token is issued.",
        citations: [],
      }],
      checked: 0,
      notes: [],
      digest: await loadDigest(load),
    };
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
    // Assumptions the verdict is allowed to make and a signed paper is not.
    // Saying so HERE is what gives an agent the remedy in the same breath as
    // the verdict, instead of a surprise refusal at export.
    for (const r of resolved) {
      if (r.packingGroupAssumed) {
        notes.push(
          `${r.name}: several 172.101 rows differ only in packing group and none was supplied; ` +
          `the strictest (PG ${r.packingGroup}) decided this verdict. Export will refuse until ` +
          `packingGroup is asserted, because a shipping paper may not print an assumed one.`,
        );
      }
      if (r.pihMandatedNoZone) {
        notes.push(
          `${r.name} carries special provision 6, poisonous by inhalation by rule, with no hazard ` +
          `zone in any column; the conservative Zone A row decided this verdict. Export refuses ` +
          `for this material: its zone comes from an approval this corpus does not contain, the ` +
          `172.203(m) entry cannot print without one, and a zone is not something a caller can ` +
          `assert. A stated gap in coverage.`,
        );
      }
      // The mandated Class 8 subsidiary arrives from special provision 128,
      // not from the label column, so the verdict says where it came from.
      if (r.specialProvisions.some((sp) => sp.trim() === "128") && r.hazards.some((h) => h.raw === "8" && h.subsidiary)) {
        const c = cite("sp128-class8-subsidiary");
        notes.push(`${r.name}: a Class 8 subsidiary hazard was applied from ${c.section}: "${c.text}"`);
      }
    }
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
