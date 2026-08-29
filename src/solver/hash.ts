/**
 * Canonical encoding and the approval token.
 *
 * The token is what makes the commit gate a real boundary rather than a UI
 * affordance. `check_segregation` issues it on a pass; `commit_manifest`
 * recomputes it from the exact bytes it is about to export and refuses on any
 * mismatch. A stale load, a mutated load, and a shadow tool registered under
 * the same name are then all uncommittable, regardless of registration order.
 *
 * LENGTH-PREFIXED, NEVER JOINED ON A SEPARATOR. Building a hash input by
 * joining free text on a delimiter lets two distinct loads collide to one
 * identity: ("ab", "c") and ("a", "bc") produce the same string under a naive
 * join, and a proper shipping name can contain any character. Length-prefixing
 * removes the whole class rather than forbidding a character we cannot police.
 */
import type { LoadProposal, VehicleProposal, LineItem } from "./types.ts";

const enc = new TextEncoder();

/** Length-prefixed field: the byte length, a colon, then the bytes. */
function field(s: string): string {
  return `${enc.encode(s).length}:${s}`;
}

function canonicalItem(i: LineItem): string {
  // Fixed key order, normalized case, no optional-field ambiguity.
  return [
    field(i.id ?? ""),
    field((i.name ?? "").trim().toLowerCase()),
    field(i.state ?? "unknown"),
    field((i.quantity ?? "").trim()),
  ].join("");
}

function canonicalVehicle(v: VehicleProposal): string {
  // Items are sorted so that reordering a bay does not change its identity.
  // This is deliberate and matches the solver invariant that permuting item
  // order never changes a verdict.
  const items = v.items.map(canonicalItem).sort();
  return [
    field(String(items.length)),
    items.join(""),
    field(v.barriersPresent ? "1" : "0"),
    field(v.singleShipper ? "1" : "0"),
  ].join("");
}

/** Stable, collision-resistant encoding of a proposed load. */
export function canonical(load: LoadProposal): string {
  // Vehicles are NOT sorted: which bay an item sits in is part of the load.
  return [
    field("49cfr177848/v1"),
    field(String(load.vehicles.length)),
    ...load.vehicles.map(canonicalVehicle),
  ].join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The approval token for a load. The nonce is per-session and never leaves the
 * page, so a token cannot be forged from the load alone by anything that has
 * not already seen a genuine pass in this session.
 */
export async function approvalToken(load: LoadProposal, nonce: string): Promise<string> {
  return sha256Hex(`${field(canonical(load))}${field(nonce)}`);
}

/** Content hash of a load, independent of any nonce. For display and audit. */
export async function loadDigest(load: LoadProposal): Promise<string> {
  return sha256Hex(canonical(load));
}
