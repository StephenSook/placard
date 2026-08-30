/**
 * Split a test's convenient one-object-per-vehicle shape into the two things
 * the tool surface now keeps apart.
 *
 * barriersPresent, singleShipper and nonReactionAsserted are attestations about
 * the physical vehicle that only the operator at the console can make. They
 * used to be ordinary tool arguments, and an agent that sent barriersPresent
 * turned a REFUSED O cell into a committed shipping paper. So they no longer
 * travel on the wire at all: they arrive as a separate trust-context argument,
 * and a wire that carries one is refused.
 *
 * Tests still want to write a vehicle as one object, so this splits it.
 */
import type { Attestations, WireRef } from "../src/tools/executors.ts";

export type TestVehicle = { items: WireRef[] } & Attestations;

/** The wire half: items only. */
export const wireOf = (vs: TestVehicle[]) => vs.map(({ items }) => ({ items }));

/** The trust-context half: the attestations, by vehicle. */
export const attestOf = (vs: TestVehicle[]): Attestations[] =>
  vs.map(({ items: _items, ...a }) => a);
