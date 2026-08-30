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
import { attestOf, wireOf } from "./attest.ts";
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
    { approvalToken: (v as { approvalToken: string }).approvalToken, vehicles: wireOf(vehicles) },
    N,
    attestOf(vehicles),
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

/* ── round two ─────────────────────────────────────────────────────────────
   A fix is itself a fresh reviewable diff, so the review was run again on the
   fixes. It returned five more, four of them critical, and one of them was in
   a feature written two hours earlier while fixing another. */

describe("6. the 177.848(e)(6) same-class carve-out needs the reaction determination", () => {
  const clears = async (v: Parameters<typeof toLoad>[0]) => {
    const r = await checkLoad(toLoad(v), N);
    return r.status === "PASS";
  };

  it("refuses the pair without a non-reaction assertion", async () => {
    expect(await clears([{ items: ["UN3516", "UN1581"] }])).toBe(false);
  });

  it("gives the SAME verdict in either item order, which it did not before", async () => {
    // Verified before the fix: UN3516 then UN1581 returned PASS and COMMITTED,
    // while UN1581 then UN3516 refused, on the identical pair. The helper asked
    // only whether the FIRST item carried a subsidiary hazard.
    //
    // The assertion must be TRUE here, or the carve-out never runs and both
    // orders refuse for an unrelated reason, which is what made the first
    // version of this test unable to detect the asymmetry at all.
    const opts = { nonReactionAsserted: true } as const;
    const a = await checkLoad(toLoad([{ items: ["UN3516", "UN1581"], ...opts }]), N);
    const b = await checkLoad(toLoad([{ items: ["UN1581", "UN3516"], ...opts }]), N);
    expect(a.status, `${a.status} one way, ${b.status} the other`).toBe(b.status);
  });

  it("is order-independent across a wider sample, since the invariant is general", async () => {
    const pairs: Array<[string, string]> = [
      ["UN3516", "UN1581"], ["UN1830", "UN1748"], ["UN0018", "UN0350"],
      ["UN1090", "UN1830"], ["UN1309", "UN1748"],
    ];
    for (const [x, y] of pairs) {
      for (const opts of [{}, { nonReactionAsserted: true }, { barriersPresent: true }]) {
        const f = await checkLoad(toLoad([{ items: [x, y], ...opts }]), N);
        const r = await checkLoad(toLoad([{ items: [y, x], ...opts }]), N);
        expect(f.status, `${x}/${y} with ${JSON.stringify(opts)}`).toBe(r.status);
      }
    }
  });
});

describe("7. compatibility group L multiplicity survives de-duplication", () => {
  it("refuses two DIFFERENT group L explosives", async () => {
    // resolveCompatibility de-duplicates into a Set, which is right for the
    // rewrite rules and wrong for a rule about identity: two different L
    // materials collapsed to one "L" and the size check could not see them.
    const r = await checkLoad(toLoad([{ items: ["UN0380", "UN0248"] }]), N);
    expect(r.status).toBe("REFUSED");
  });
});

describe("8. the console must not silently improve a manifest", () => {
  // Source checks, and honestly labelled as such: this logic lives inside a
  // React component that the rest of this suite does not mount.
  const console_ = readFileSync(join(import.meta.dirname, "..", "src", "Console.tsx"), "utf8");

  it("resolves references through resolveItem, not lookupMaterial's first hit", () => {
    // Taking the first candidate bypassed the ambiguous-name refusal:
    // "Articles, explosive, n.o.s." became UN0350 at 1.4B and then passed with
    // acetone, while the equally valid UN0354 makes that pair an X.
    expect(console_).toMatch(/resolveItem\(looksLikeIdentifier\(ref\)/);
    expect(console_).not.toMatch(/lookupMatches\(lookupMaterial\(\{ query: q \}\)\)\[0\]/);
  });

  it("reports unresolved references instead of filtering them away", () => {
    // UN1090,NOT-A-MATERIAL silently became an acetone-only load and committed
    // a shipping paper for a manifest nobody submitted.
    expect(console_).toMatch(/unresolved/);
    expect(console_).toMatch(/console__urlProblem/);
  });
});

describe("9. a URL may describe a load, never attest to one", () => {
  const console_ = readFileSync(join(import.meta.dirname, "..", "src", "Console.tsx"), "utf8");

  it("never reads the three assertions from query parameters", () => {
    // Verified before the fix: ?load=UN1830,UN1748&barriers=1&shipper=1&
    // nonreaction=1 returned PASS and COMMITTED with nobody having asserted
    // anything. A shared link manufactured the operator's signature.
    for (const p of ["barriers", "shipper", "nonreaction"]) {
      expect(console_, `the URL still reads ${p}`).not.toMatch(new RegExp(`q\\.get\\("${p}"\\)`));
    }
  });

  it("starts every assertion false when a load arrives from a link", () => {
    expect(console_).toMatch(/barriersPresent: false,\s*\n\s*singleShipper: false,\s*\n\s*nonReactionAsserted: false,/);
  });
});

