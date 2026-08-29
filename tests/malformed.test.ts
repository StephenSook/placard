/**
 * A TOOL EXPOSED TO AN AGENT MUST NEVER THROW. It refuses.
 *
 * An exception carries no clause, no reason and nothing a caller can act on,
 * and an agent that gets one has no way to correct its call. Before this suite
 * every executor threw on every malformed input, and the only reason anyone
 * noticed is that webmcp-evals generates sample arguments from the published
 * schema and one of them produced "t.map is not a function" out of
 * commit_manifest. That is the fuzzing a real agent does by accident.
 */
import { describe, it, expect } from "vitest";
import {
  lookupMaterial, classifyLineItem, proposeLoad, checkSegregation, commitManifest,
  coerceVehicles, isMalformed,
} from "../src/tools/executors.ts";

const NONCE = "malformed-test";

/** Everything an agent might plausibly send by mistake, plus a few hostile shapes. */
const GARBAGE: unknown[] = [
  undefined, null, "sample", 42, true, [], {},
  { vehicles: "sample" },
  { vehicles: null },
  { vehicles: [null] },
  { vehicles: [{ items: "not an array" }] },
  { vehicles: [{ items: [1, 2, 3] }] },
  { vehicles: [{}] },
  { items: "sample", maxVehicles: 1 },
  { items: [], maxVehicles: 1 },
  { items: ["UN1090"], maxVehicles: 0 },
  { items: ["UN1090"], maxVehicles: "two" },
  { query: "" },
  { query: 42 },
  { text: null },
  { approvalToken: 1, vehicles: [] },
  { approvalToken: "x" },
];

const CALLS: Array<[string, (a: unknown) => unknown]> = [
  ["lookup_material", (a) => lookupMaterial(a as never)],
  ["classify_line_item", (a) => classifyLineItem(a as never)],
  ["propose_load", (a) => proposeLoad(a as never)],
  ["check_segregation", (a) => checkSegregation(a as never, NONCE)],
  ["commit_manifest", (a) => commitManifest(a as never, NONCE)],
];

describe("no executor throws on malformed input", () => {
  for (const [name, fn] of CALLS) {
    it(`${name} refuses rather than throwing, on every garbage shape`, async () => {
      const threw: string[] = [];
      for (const g of GARBAGE) {
        try { await fn(g); } catch (e) { threw.push(`${JSON.stringify(g)} -> ${String(e).slice(0, 80)}`); }
      }
      expect(threw, `${name} threw:\n${threw.join("\n")}`).toEqual([]);
    });
  }

  it("checked a non-trivial number of shapes", () => {
    expect(GARBAGE.length).toBeGreaterThan(15);
  });
});

describe("an argument refusal is DISTINGUISHABLE from a regulatory refusal", () => {
  // They must not look alike. One means "your call was wrong", the other means
  // "the regulation forbids this load", and conflating them would let a
  // malformed request read as a compliance result.
  it("marks argument refusals so a caller can tell them apart", async () => {
    const bad = await commitManifest({ approvalToken: 1 as never, vehicles: "x" as never }, NONCE);
    expect(isMalformed(bad)).toBe(true);
  });

  it("does NOT mark a genuine regulatory refusal as malformed", async () => {
    const real = await checkSegregation(
      { vehicles: [{ items: ["UN1830", "UN1748"], barriersPresent: true }] }, NONCE,
    );
    expect(real.status).toBe("REFUSED");
    expect(isMalformed(real)).toBe(false);
  });

  it("and a malformed commit never produces a shipping paper", async () => {
    const bad = await commitManifest({ approvalToken: "x", vehicles: "nope" as never }, NONCE);
    expect(bad).not.toHaveProperty("shippingPaper");
  });
});

describe("coerceVehicles", () => {
  it("accepts the real shape and rejects everything else", () => {
    expect(coerceVehicles([{ items: ["UN1090"] }])).toEqual([{ items: ["UN1090"] }]);
    expect(coerceVehicles([{ items: ["UN1090"], barriersPresent: true }]))
      .toEqual([{ items: ["UN1090"], barriersPresent: true }]);
    for (const bad of ["x", 1, null, undefined, {}, [null], [{ items: 1 }], [{ items: [1] }]]) {
      expect(coerceVehicles(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("REFUSES a non-boolean assertion rather than dropping it", () => {
    // This test used to assert the opposite, that a bad assertion was silently
    // dropped, on the reasoning that dropping only makes the verdict stricter.
    // That is true and it is not the point: the CALLER could not tell. A
    // request with singleShipper: "true" returned a regulatory PASS with an
    // approval token and isMalformed false, so an agent had no way to learn its
    // field was ignored. Silence about a rejected input is the same defect as
    // silence about an unresolvable material.
    expect(coerceVehicles([{ items: ["UN1090"], singleShipper: "true" }])).toBeNull();
    expect(coerceVehicles([{ items: ["UN1090"], nonReactionAsserted: 1 }])).toBeNull();
    // and a genuinely absent field is still fine
    expect(coerceVehicles([{ items: ["UN1090"] }])).toEqual([{ items: ["UN1090"] }]);
  });

  it("a request with a bad assertion is marked malformed, not passed", async () => {
    const r = await checkSegregation(
      { vehicles: [{ items: ["UN1090"], singleShipper: "true" as never }] }, NONCE,
    );
    expect(isMalformed(r)).toBe(true);
    expect(r.status).toBe("REFUSED");
  });
});
