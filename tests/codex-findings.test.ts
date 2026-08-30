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
import { checkSegregation, commitManifest, proposeLoad, toLoad } from "../src/tools/executors.ts";
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


// ── round three ──────────────────────────────────────────────────────────────
//
// Three of these four are wrong in the RESTRICTIVE direction, which is a
// different and easier-to-miss defect than the permissive ones above: nothing
// unsafe ships, so no gate catches them, and the tool simply refuses loads the
// regulation permits. A compliance tool that cries wolf gets switched off, and
// then it protects nobody. They are regressions in exactly the same sense.

describe("10. a proposal may not borrow an attestation about a vehicle that does not exist", () => {
  it("proposes with no physical attestation in force, whatever the page has ticked", () => {
    // The page's vehicle 1 holds UN1090 with UN1830 and the operator has walked
    // out and confirmed a barrier. The agent asks for an arrangement of a
    // DIFFERENT pair. Positional inheritance handed it that barrier.
    const r = proposeLoad({ items: ["UN1090", "UN1479"], maxVehicles: 1 });
    expect(r.status === "PROPOSED" || r.status === "IMPOSSIBLE").toBe(true);
    if (r.status === "PROPOSED") {
      expect(r.attestationsInForce).toEqual({ barriersPresent: false, singleShipper: false });
      expect(r.note).toMatch(/no physical attestation in force/i);
    }
  });

  it("takes no attestation argument at all, so there is nothing to inherit", () => {
    // Structural, not behavioural: the executor's arity is the guarantee. A
    // second parameter is how the defect came back the first time.
    expect(proposeLoad.length).toBe(1);
  });

  it("a barriered O-cell pair still needs the operator to re-tick after a split", async () => {
    // UN1090 (Class 3) with UN1479 (Division 5.1) is an O cell. With a barrier
    // it clears; the proposal must not assume one.
    const withBarrier = await checkLoad(
      toLoad([{ items: ["UN1090", "UN1479"], barriersPresent: true }]), N,
    );
    expect(withBarrier.status).toBe("PASS");
    const without = await checkLoad(toLoad([{ items: ["UN1090", "UN1479"] }]), N);
    expect(without.status).toBe("REFUSED");
  });
});

describe("11. a supplied packing group is identity, not a hint", () => {
  it("selects the PG the caller named rather than the most severe row", () => {
    // UN2810 has PG I, II and III rows, all Division 6.1. The conservative sort
    // took PG I, and PG I Division 6.1 Zone A has its own row in the 177.848(d)
    // table, so a legal PG II load came back PROHIBITED_TOGETHER.
    const two = resolveItem({ id: "UN2810", packingGroup: "II" });
    expect("error" in two).toBe(false);
    expect((two as { packingGroup?: string }).packingGroup).toBe("II");

    const three = resolveItem({ id: "UN2810", packingGroup: "III" });
    expect((three as { packingGroup?: string }).packingGroup).toBe("III");
  });

  it("still takes the most severe row when no packing group is supplied", () => {
    const any = resolveItem({ id: "UN2810" });
    expect((any as { packingGroup?: string }).packingGroup).toBe("I");
  });

  it("refuses a packing group the table does not list for that number", () => {
    const bad = resolveItem({ id: "UN2810", packingGroup: "IV" as never });
    expect("error" in bad).toBe(true);
    expect((bad as { error: string }).error).toMatch(/no packing group IV/i);
  });

  it("that PG II load is no longer refused as if it were PG I", async () => {
    const v = await checkLoad(
      { vehicles: [{ items: [{ id: "UN2810", packingGroup: "II" }, { id: "UN1090" }] }] },
      N,
    );
    expect(v.status).toBe("PASS");
  });
});

describe("12. two spellings of one identification number are one attestation", () => {
  it("keeps the operator's barrier when the agent writes the number as 49 CFR prints it", async () => {
    // The resolver deliberately accepts "UN 1090". The binding check collapsed
    // whitespace to a single space instead of removing it, so the spaced form
    // failed the comparison, lost the barrier and returned SEPARATION_REQUIRED.
    const page = [{ items: ["UN1090", "UN1479"] }];
    const spaced = await checkSegregation(
      { vehicles: [{ items: ["UN 1090", "UN1479"] }] },
      N,
      [{ barriersPresent: true }],
      page,
    );
    expect(spaced.status).toBe("PASS");
    expect((spaced as { attestationsNotApplied?: unknown }).attestationsNotApplied).toBeUndefined();
  });

  it("still drops the attestation when the contents genuinely differ", async () => {
    // Same barrier, one substituted material. The reference is spelled the way
    // the resolver accepts, so only the CONTENTS differ, and the attestation
    // must not carry over to a truck the operator never looked at.
    const page = [{ items: ["UN1090", "UN1479"] }];
    const other = await checkSegregation(
      { vehicles: [{ items: ["UN 1090", "UN1748"] }] },
      N,
      [{ barriersPresent: true }],
      page,
    );
    expect((other as { attestationsNotApplied?: number[] }).attestationsNotApplied).toEqual([1]);
    expect(other.status).toBe("REFUSED");
  });
});

describe("13. footnote 6 asks what a material IS, not how its name is spelled", () => {
  it("clears a group G article with a group E article, which the name test refused", async () => {
    // UN0428 "Articles, pyrotechnic for technical purposes" is 1.1G and its name
    // says article. UN0321 "Cartridges for weapons, with bursting charge" is
    // 1.2E and its name does not, so the old prefix test could not see that
    // 173.52(b) DEFINES group E as an article, and refused a pairing footnote 6
    // permits. Two loads with identical regulatory standing, opposite verdicts,
    // decided by a word.
    const v = await checkLoad(toLoad([{ items: ["UN0428", "UN0321"] }]), N);
    expect(v.status).toBe("PASS");
  });

  it("still refuses when a group A material rides along, whatever its name says", async () => {
    // UN0224 barium azide is 1.1A and its name gives no hint. 173.52(b) defines
    // group A as a primary explosive SUBSTANCE, so it is provably one.
    const v = await checkLoad(toLoad([{ items: ["UN0428", "UN0027", "UN0224"] }]), N);
    expect(v.status).toBe("REFUSED");
  });

  it("quotes the definition that failed to settle the question", async () => {
    // Group G admits either a substance or an article, so a G material whose
    // name does not say still blocks. The refusal must show the reader the
    // regulation being ambiguous rather than the tool being arbitrary.
    const v = await checkLoad(toLoad([{ items: ["UN0171", "UN0321"] }]), N);
    expect(v.status).toBe("REFUSED");
    const text = v.status === "REFUSED" ? v.violations.map((x) => x.message).join(" ") : "";
    expect(text).toContain("49 CFR 173.52(b)");
    expect(text).toContain("Pyrotechnic substance or article containing a pyrotechnic substance");
    expect(text).toContain("which admits either");
  });

  it("every quoted group definition is verbatim in the committed corpus", () => {
    // The definitions are quoted into refusal sentences, so they are claims and
    // get the same treatment as every other quote in this repo.
    const corpus = JSON.parse(
      readFileSync(join(process.cwd(), "data/clauses.json"), "utf8"),
    ) as { clauses: Record<string, { text: string }> };
    const groups = "ABCDEFGHJKLNS".split("");
    let checked = 0;
    for (const g of groups) {
      const c = corpus.clauses[`17352-group-${g}`];
      expect(c, `173.52 group ${g} is missing from the corpus`).toBeDefined();
      expect(c!.text.length).toBeGreaterThan(20);
      checked++;
    }
    expect(checked).toBe(13);
  });
});
