/**
 * THE CLAUSES THAT WERE QUOTED AND NEVER APPLIED.
 *
 * The citation gate proves every clause the app quotes is a verbatim substring
 * of the pinned eCFR. It ran green from the first commit and it says NOTHING
 * about whether the rule is implemented. An audit of which clause ids actually
 * appear in a `cite(...)` call found TEN of twenty-four orphaned, and two of
 * those were live prohibitions:
 *
 *   - sodium cyanide with sulfuric acid returned PASS and exported a shipping
 *     paper, while 177.848(c) prohibits exactly that pairing by name;
 *   - 1.4S fireworks with 1.1G fireworks did the same, while footnote 5 of the
 *     177.848(f) table prohibits exactly that pairing by name.
 *
 * Both were reachable from the demo corpus. Neither had a test, because every
 * test was written against a rule someone had already thought to implement.
 *
 * One test per recovered rule, each reproducing the load that used to clear.
 */
import { describe, it, expect } from "vitest";
import { checkLoad } from "../src/solver/index.ts";
import { checkSegregation, commitManifest, isMalformed, toLoad } from "../src/tools/executors.ts";
import {
  CHECK_SEGREGATION_SCHEMA, COMMIT_MANIFEST_SCHEMA, PROPOSE_LOAD_SCHEMA,
} from "../src/tools/schemas.ts";
import { attestOf, wireOf } from "./attest.ts";

const N = "orphan-regression";

async function clears(vehicles: Parameters<typeof toLoad>[0]) {
  const v = await checkLoad(toLoad(vehicles), N);
  if (v.status !== "PASS") return false;
  const c = await commitManifest(
    { approvalToken: (v as { approvalToken: string }).approvalToken, vehicles: wireOf(vehicles) },
    N,
    attestOf(vehicles),
  );
  return c.status === "COMMITTED";
}

/** Every clause cited by a refusal, or an empty list when the load passed. */
async function citedSections(vehicles: Parameters<typeof toLoad>[0]) {
  const v = await checkLoad(toLoad(vehicles), N);
  if (v.status !== "REFUSED") return [];
  return v.violations.flatMap((x) => x.citations.map((c) => c.section));
}

/** Every refusal message, or an empty string when the load passed. */
async function refusalText(vehicles: Parameters<typeof toLoad>[0]) {
  const v = await checkLoad(toLoad(vehicles), N);
  return v.status === "REFUSED" ? v.violations.map((x) => x.message).join(" ") : "";
}

describe("177.848(c), the narrative prohibition that is stricter than the matrix", () => {
  it("refuses a cyanide with an acid, which the (d) matrix alone clears", async () => {
    // UN1689 sodium cyanide is 6.1. UN1830 sulfuric acid is 8. The matrix cell
    // for that pair is not X, so the whole load passed and exported. 177.848(c)
    // names the pairing outright: cyanides with acids, where the mixture would
    // generate hydrogen cyanide.
    expect(await clears([{ items: ["UN1689", "UN1830"], barriersPresent: true }])).toBe(false);
    expect((await citedSections([{ items: ["UN1689", "UN1830"] }])).some((x) => x.includes("177.848"))).toBe(true);
  });

  it("matches on the acid's NAME as well as its class, because 177.848(c) says acids", async () => {
    // Hydrofluoric acid solution, UN1790, is Class 8 and also named an acid.
    expect(await clears([{ items: ["UN1689", "UN1790"] }])).toBe(false);
  });

  it("does not refuse a cyanide with something that is neither Class 8 nor an acid", async () => {
    // Guards against fixing the above by refusing every load containing a
    // cyanide. UN1090 acetone is Class 3 and is not an acid.
    expect(await refusalText([{ items: ["UN1689", "UN1090"] }])).not.toContain("hydrogen cyanide");
  });
});

describe("177.848(f) footnotes are CONDITIONS, not permissions", () => {
  it("refuses 1.4S fireworks with 1.1G fireworks under footnote 5", async () => {
    // UN0337 is Fireworks, 1.4S. UN0333 is Fireworks, 1.1G. Their compatibility
    // groups produce a footnote cell, and the code read any non-X cell as
    // permission, so this exported.
    expect(await clears([{ items: ["UN0337", "UN0333"] }])).toBe(false);
    expect((await citedSections([{ items: ["UN0337", "UN0333"] }])).some((x) => x.includes("177.848"))).toBe(true);
  });

  it("keeps clearing an explosive pair whose cell carries no unmet condition", async () => {
    // Guards against fixing the above by refusing every explosive pair.
    expect(await refusalText([{ items: ["UN0333", "UN0334"] }])).not.toContain("Footnote 5");
  });
});

describe("an attestation is not a tool argument", () => {
  /**
   * THE FORGERY THAT SURVIVED TWO ADVERSARIAL ROUNDS.
   *
   * `barriersPresent`, `singleShipper` and `nonReactionAsserted` decide whether
   * an `O` cell passes and whether the 177.848(e)(3) exception is available.
   * Each is a fact about a physical vehicle. All three were ordinary arguments
   * on the tool schemas, so an agent could assert, on the operator's behalf,
   * that barriers were installed in a truck it cannot see. Reproduced: acetone
   * with UN1479 refused, the same call with `barriersPresent: true` returned
   * PASS and exported a shipping paper.
   *
   * The same forgery was closed on the URL two rounds earlier and left open
   * here, on the surface that is actually judged. The schema descriptions even
   * said "an agent must not assert it on the operator's behalf" while handing
   * the agent the field. Writing a hole down is not closing it.
   */
  const OCELL = ["UN1090", "UN1479"]; // Class 3 with a 5.1 oxidizer

  it("refuses the wire attestation instead of honouring it", async () => {
    const forged = await checkSegregation(
      { vehicles: [{ items: OCELL, barriersPresent: true } as never] }, N,
    );
    expect(isMalformed(forged)).toBe(true);
  });

  it("still refuses the load when the field is simply omitted", async () => {
    const plain = await checkSegregation({ vehicles: [{ items: OCELL }] }, N);
    expect(plain.status).toBe("REFUSED");
    expect(isMalformed(plain)).toBe(false);
  });

  it("passes only when the OPERATOR asserts it, through the trust-context argument", async () => {
    // Non-vacuity: the attestation still does its regulatory work. If this
    // failed, the fix would be "ignore the barrier" rather than "route it".
    const asserted = await checkSegregation(
      { vehicles: [{ items: OCELL }] }, N, [{ barriersPresent: true }],
    );
    expect(asserted.status).toBe("PASS");
  });

  it("reports what was in force, so an agent can see what it could not set", async () => {
    const r = await checkSegregation({ vehicles: [{ items: OCELL }] }, N, [{ barriersPresent: true }]);
    if (isMalformed(r)) throw new Error("unexpected malformed");
    expect(r.attestationsInForce).toEqual([
      { vehicle: 1, barriersPresent: true, singleShipper: false, nonReactionAsserted: false },
    ]);
  });

  it("commits against the operator's attestations, not the caller's", async () => {
    // The bytes being hashed carry the operator's attestations, so a caller
    // cannot alter what the token is bound to.
    const v = await checkSegregation({ vehicles: [{ items: OCELL }] }, N, [{ barriersPresent: true }]);
    if (isMalformed(v) || v.status !== "PASS") throw new Error("expected PASS");
    const withOperator = await commitManifest(
      { approvalToken: v.approvalToken, vehicles: [{ items: OCELL }] }, N, [{ barriersPresent: true }],
    );
    expect(withOperator.status).toBe("COMMITTED");

    // The same token, with the operator's checkbox off, is bound to different
    // bytes and stops validating.
    const withoutOperator = await commitManifest(
      { approvalToken: v.approvalToken, vehicles: [{ items: OCELL }] }, N, [],
    );
    expect(withoutOperator.status).toBe("REFUSED");
  });

  it("keeps the attestation fields out of every published schema", async () => {
    // The agent-facing contract is the schema. A field that is refused at
    // runtime but still advertised invites the call and then rejects it.
    const schemas = JSON.stringify([
      PROPOSE_LOAD_SCHEMA, CHECK_SEGREGATION_SCHEMA, COMMIT_MANIFEST_SCHEMA,
    ]);
    for (const k of ["barriersPresent", "singleShipper", "nonReactionAsserted"]) {
      expect(schemas, `${k} is still advertised to the agent`).not.toContain(`"${k}"`);
    }
    // Non-vacuity: the schemas are really in there.
    expect(schemas).toContain("maxVehicles");
    expect(schemas).toContain("approvalToken");
  });
});
