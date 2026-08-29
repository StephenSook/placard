/**
 * One regression test per defect found by an adversarial second-model review of
 * the whole repository, each reproducing the exact load that was cleared.
 *
 * All five were WRONG IN THE PERMISSIVE DIRECTION or left the page compromised,
 * and all five passed a 147-test suite, which is the useful part: every one of
 * them lived in a path the existing tests never exercised.
 */
import { describe, it, expect } from "vitest";
import { checkLoad } from "../src/solver/index.ts";
import { commitManifest, toLoad } from "../src/tools/executors.ts";
import { resolveItem } from "../src/solver/hazards.ts";
import { entriesByName } from "../src/solver/corpus.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const N = "codex-regression";

/** PASS plus a successful export, which is the outcome that actually matters. */
async function clears(vehicles: Parameters<typeof toLoad>[0]) {
  const v = await checkLoad(toLoad(vehicles), N);
  if (v.status !== "PASS") return false;
  const c = await commitManifest(
    { approvalToken: (v as { approvalToken: string }).approvalToken, vehicles },
    N,
  );
  return c.status === "COMMITTED";
}

describe("1. a subsidiary O cell must not hide the explosive compatibility referral", () => {
  it("refuses UN0018 with UN0350 even though a barrier is asserted", async () => {
    // UN0018 is 1.2G carrying subsidiary Class 8 and 6.1. Pairing the
    // SUBSIDIARY 8 against UN0350 yields O, which outranks the asterisk in the
    // most-restrictive reduction, so a barrier cleared it and 177.848(f) was
    // never consulted. Compatibility groups G and B are X under (g)(2).
    expect(await clears([{ items: ["UN0018", "UN0350"], barriersPresent: true }])).toBe(false);
  });

  it("still routes an ordinary explosive pair through the compatibility table", async () => {
    // Guards against fixing the above by refusing all explosives.
    const v = await checkLoad(toLoad([{ items: ["UN0360"] }]), N);
    expect(v.status).toBe("PASS");
  });
});

describe("2. an identification number spanning hazard classes must refuse", () => {
  it("refuses UN1950, which covers Divisions 2.1 and 2.2", () => {
    const r = resolveItem({ id: "UN1950" });
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).toMatch(/spanning hazard classes/);
  });

  it("does not export UN1950 with UN2910", async () => {
    expect(await clears([{ items: ["UN1950", "UN2910"], barriersPresent: false }])).toBe(false);
  });

  it("still resolves a number whose rows differ only by packing group", () => {
    // UN1830's rows share Class 8, so the verdict is the same for all of them
    // and refusing would be a false alarm.
    const r = resolveItem({ id: "UN1830" });
    expect(r).not.toHaveProperty("error");
    expect((r as { hazardClass: string }).hazardClass).toBe("8");
  });
});

describe("3. punctuation must not decide whether a name is ambiguous", () => {
  const withComma = "Ammunition, incendiary with or without burster, expelling charge, or propelling charge";
  const withoutComma = "Ammunition, incendiary with or without burster, expelling charge or propelling charge";

  it("both spellings see the same entries", () => {
    const a = entriesByName(withComma).map((e) => e.un).sort();
    const b = entriesByName(withoutComma).map((e) => e.un).sort();
    expect(a).toEqual(b);
  });

  it("both spellings refuse, so safety does not depend on a comma", () => {
    for (const n of [withComma, withoutComma]) {
      expect(resolveItem({ name: n }), n).toHaveProperty("error");
    }
  });
});

describe("4. the 177.848(e)(3) exception needs BOTH of its conditions", () => {
  const PAIR = ["UN1830", "UN1748"];

  it("refuses with a barrier and a single shipper but NO non-reaction assertion", async () => {
    expect(
      await clears([{ items: PAIR, barriersPresent: true, singleShipper: true }]),
    ).toBe(false);
  });

  it("refuses with the non-reaction assertion but NO single shipper", async () => {
    expect(
      await clears([{ items: PAIR, barriersPresent: true, nonReactionAsserted: true }]),
    ).toBe(false);
  });

  it("permits only when both are asserted, since that is what the clause says", async () => {
    expect(
      await clears([
        { items: PAIR, barriersPresent: true, singleShipper: true, nonReactionAsserted: true },
      ]),
    ).toBe(true);
  });
});

describe("5. the attack demo must always be able to clean up after itself", () => {
  // This is a SOURCE check rather than a behavioural one, and it is worth
  // saying so: exercising it properly needs a DOM harness this project does not
  // otherwise require. So it asserts the specific structure, not merely that
  // some `finally` exists somewhere. A first version checked only for the
  // keyword and survived a mutation that removed this exact cleanup, because a
  // different runner in the same file also has one.
  const src = readFileSync(join(import.meta.dirname, "..", "src", "ui", "AttackPanel.tsx"), "utf8");

  it("aborts the shadow tool in a finally attached to the ATTACK runner", () => {
    const m = /finally\s*\{([\s\S]{0,240}?)\}/g;
    const blocks = [...src.matchAll(m)].map((x) => x[1]!);
    const cleanup = blocks.filter((b) => /shadow\.current\?\.abort\(\)/.test(b));
    expect(cleanup.length, "no finally block aborts the shadow controller").toBeGreaterThan(0);
    // and that same block must clear the handle and release the running flag
    expect(cleanup.some((b) => /shadow\.current = null/.test(b) && /setRunning\(false\)/.test(b))).toBe(true);
  });

  it("also aborts on unmount, so a delay cannot outlive the component", () => {
    expect(src).toMatch(/useEffect\(\(\) => \(\) => \{[^}]*shadow\.current\?\.abort\(\)/);
  });

  it("holds the controller OUTSIDE the runner, in a ref", () => {
    expect(src).toMatch(/const shadow = useRef<AbortController \| null>\(null\)/);
  });
});
