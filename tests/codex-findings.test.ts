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
import {
  checkSegregation, classifyLineItem, commitManifest, isMalformed, lookupMaterial, proposeLoad,
  toLoad,
} from "../src/tools/executors.ts";
import { attestOf, wireOf } from "./attest.ts";
import { resolveItem } from "../src/solver/hazards.ts";
import { entriesByName } from "../src/solver/corpus.ts";
import { readdirSync, readFileSync } from "node:fs";
import { measureDivergence } from "../src/evidence/divergence.ts";
import { reachableCitedIds, type Source } from "./reachability.ts";
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
    expect((r as { error: string }).error).toMatch(/different materials/);
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
  it("names the article condition rather than the spelling of a name", async () => {
    // UN0428 "Articles, pyrotechnic for technical purposes" is 1.1G and its name
    // says article. UN0321 "Cartridges for weapons, with bursting charge" is
    // 1.2E and its name does not, so the old prefix test could not see that
    // 173.52(b) DEFINES group E as an article, and blamed UN0321.
    //
    // THIS TEST ASSERTED PASS AND THAT WAS THE DEFECT. Footnote 6 has a third
    // condition, "other than ... those requiring special handling", which this
    // corpus cannot evaluate for anything, and the assertion locked in a
    // permission that had never been earned. The pair still refuses; what
    // changed is that the refusal now names the condition that actually blocks.
    const v = await checkLoad(toLoad([{ items: ["UN0428", "UN0321"] }]), N);
    expect(v.status).toBe("REFUSED");
    const text = v.status === "REFUSED" ? v.violations.map((x) => x.message).join(" ") : "";
    expect(text).toContain("REQUIRING SPECIAL HANDLING");
    expect(text).toContain("stated gap in coverage");
    // And it must NOT blame UN0321, whose group settles the article question.
    expect(text).not.toContain("cannot be shown to be an explosive article");
  });

  it("no footnote 6 pairing reaches COMMITTED while special handling is unevaluable", async () => {
    // The gate that the assertion above used to hold open. Broad rather than
    // pointed on purpose: a permission nothing can earn must be earned by
    // nothing.
    for (const items of [["UN0428", "UN0321"], ["UN0428", "UN0027"], ["UN0333", "UN0321"]]) {
      expect(await clears([{ items }]), `${items.join(" + ")} exported`).toBe(false);
    }
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
    // And the article condition is reported BEFORE the special-handling gap,
    // because a condition the corpus can weigh beats one it cannot evaluate.
    expect(text).not.toContain("stated gap in coverage");
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

// ── round four ───────────────────────────────────────────────────────────────
//
// Three of these four were opened or left open BY THE ROUND THREE FIXES, which
// is the argument for iterating a review until a round comes back empty rather
// than until it declares itself finished. A fix is a fresh reviewable diff.

describe("14. a split clears every physical attestation, not just one of them", () => {
  it("the console copies no attestation onto a vehicle the proposal invented", () => {
    // proposeLoad stopped taking attestations, and this caller undid it: it
    // copied bay 1's barrier and single-shipper ticks onto every vehicle the
    // proposal returned, so a split produced two trucks marked attested and an
    // exported paper that said "barriers asserted" for both. The reaction
    // assertion was already cleared here, with a comment stating the reason
    // that applies to all three.
    const src = readFileSync(join(process.cwd(), "src/Console.tsx"), "utf8");
    // The proposal builds its bays through newBay, the one factory, and newBay
    // starts every physical assertion false. Asserting on the factory rather
    // than on each call site is the point: the rule lives in one place.
    const setBays = /setBays\(r\.vehicles\.map\([^)]*\)[^;]*\);/.exec(src)?.[0] ?? "";
    expect(setBays, "the proposal's setBays call was not found").not.toBe("");
    expect(setBays).toContain("newBay(");
    expect(setBays).not.toContain("bays[0]");

    const factory = /const newBay = useCallback\([\s\S]*?\}\), \[\]\);/.exec(src)?.[0] ?? "";
    expect(factory, "newBay was not found").not.toBe("");
    for (const f of ["barriersPresent: false", "singleShipper: false", "nonReactionAsserted: false"]) {
      expect(factory, `newBay does not start ${f}`).toContain(f);
    }
  });
});

describe("15. an attestation is bound to MATERIALS, not to how they were spelled", () => {
  const page = [{ items: ["UN1090", "UN1479"] }];

  it("keeps the barrier when the agent names the material instead of numbering it", async () => {
    // "Acetone" and UN1090 are the same 172.101 row. Comparing reference
    // STRINGS dropped the barrier and turned PASS into REFUSED for a truck the
    // operator had genuinely walked out to and inspected.
    const v = await checkSegregation(
      { vehicles: [{ items: ["Acetone", "UN1479"] }] }, N, [{ barriersPresent: true }], page,
    );
    expect(v.status).toBe("PASS");
    expect((v as { attestationsNotApplied?: unknown }).attestationsNotApplied).toBeUndefined();
  });

  it("keeps it for the spaced form 49 CFR itself prints", async () => {
    const v = await checkSegregation(
      { vehicles: [{ items: ["UN 1090", "UN1479"] }] }, N, [{ barriersPresent: true }], page,
    );
    expect(v.status).toBe("PASS");
  });

  it("counts duplicates, so a repeated material is not the same load", async () => {
    const v = await checkSegregation(
      { vehicles: [{ items: ["UN1090", "UN1090"] }] }, N, [{ barriersPresent: true }],
      [{ items: ["UN1090", "UN1479"] }],
    );
    expect((v as { attestationsNotApplied?: number[] }).attestationsNotApplied).toEqual([1]);
  });

  it("never lets two DIFFERENT materials compare equal", async () => {
    const v = await checkSegregation(
      { vehicles: [{ items: ["Acetone", "UN1748"] }] }, N, [{ barriersPresent: true }], page,
    );
    expect((v as { attestationsNotApplied?: number[] }).attestationsNotApplied).toEqual([1]);
  });
});

describe("16. narrowing by packing group must not pick between different materials", () => {
  it("refuses NA1993 PG I, which is two liquids under one number and one group", () => {
    const r = resolveItem({ id: "NA1993", packingGroup: "I" });
    expect("error" in r).toBe(true);
    expect((r as { error: string }).error).toMatch(/different materials/);
  });

  it("refuses UN2031 PG II, whose rows differ by nitric acid strength", () => {
    const r = resolveItem({ id: "UN2031", packingGroup: "II" });
    expect("error" in r).toBe(true);
    const e = (r as { error: string }).error;
    expect(e).toMatch(/different materials/);
    expect(e).toContain("packing group II");
  });

  it("resolves once the proper shipping name is supplied alongside the number", () => {
    const r = resolveItem({
      id: "UN2031",
      packingGroup: "II",
      name: "Nitric acid other than red fuming, with more than 20 percent and less than 65 percent nitric acid",
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.packingGroup).toBe("II");
    expect(r.name).toContain("less than 65 percent");
  });

  it("refuses a name that number does not carry, rather than ignoring it", () => {
    const r = resolveItem({ id: "UN1090", name: "Sulfuric acid" });
    expect("error" in r).toBe(true);
    expect((r as { error: string }).error).toMatch(/no entry named/);
  });

  it("still resolves the whole demo manifest, which is the non-vacuity check", () => {
    // A rule this strict is worth nothing if it also refuses the load the
    // README, the video and the judge itinerary all walk through.
    for (const id of ["UN1090", "UN1830", "UN1748", "UN1309", "UN0360"]) {
      const r = resolveItem({ id });
      expect("error" in r, `${id} no longer resolves`).toBe(false);
    }
  });
});

// ── round five ───────────────────────────────────────────────────────────────

describe("17. every edit that changes a bay's contents clears that bay's attestations", () => {
  it("the invalidation lives at the one place bays are written", () => {
    // Three rounds fixed this one path at a time: the tool stopped accepting
    // attestations as arguments, the check stopped applying them to contents
    // they were not made about, the proposal stopped copying them onto invented
    // vehicles, and the MANUAL edits were still carrying them. Put UN1830 in
    // bay one, tick all three, put UN1748 in bay two, drag it across, and the
    // pair arrives carrying assertions made when the bay held something else.
    //
    // A handler cannot forget a rule it does not have to remember, so the guard
    // is that no content-mutating handler calls setBays directly.
    const src = readFileSync(join(process.cwd(), "src/Console.tsx"), "utf8");
    expect(src).toContain("const mutateBays = useCallback(");
    for (const handler of ["const removeVehicle = useCallback", "const move = useCallback"]) {
      const at = src.indexOf(handler);
      expect(at, `${handler} not found`).toBeGreaterThan(-1);
      // The handler's own body: up to the start of the next top-level const.
      const rest = src.slice(at + handler.length);
      const body = rest.slice(0, rest.indexOf("\n  const "));
      expect(body.length, `${handler} body did not delimit`).toBeGreaterThan(50);
      expect(body, `${handler} writes bays without the invalidation`).not.toMatch(/\bsetBays\(/);
      expect(body).toMatch(/\bmutateBays\(/);
    }
  });

  it("the attestation-carrying pair is refused when nothing has been asserted", async () => {
    // The load the move sequence produced. Without the operator's assertions it
    // must not pass, which is what makes carrying them across a real defect.
    const bare = await checkLoad(toLoad([{ items: ["UN1830", "UN1748"] }]), N);
    expect(bare.status).toBe("REFUSED");
  });
});

describe("18. the signed paper records every classification and condition it rested on", () => {
  it("prints subsidiary hazards in the 172.202(a)(3) sequence", async () => {
    const { buildShippingPaper, describeHazard } = await import("../src/tools/executors.ts");
    expect(describeHazard("2.2", ["2.2", "5.1"])).toBe("2.2 (5.1)");
    expect(describeHazard("3", ["3"])).toBe("3");
    expect(describeHazard("8", ["8", "6.1", "6.1"])).toBe("8 (6.1)");

    // And on a real document, not only on the helper. UN1717 acetyl chloride is
    // Class 3 with a Class 8 subsidiary, and both belong on the paper.
    const paper = buildShippingPaper(toLoad([{ items: ["UN1717"] }]) as never);
    const line = paper[0]!.lines[0]!;
    expect("error" in line ? line.error : "", "UN1717 did not reach the paper").toBe("");
    expect((line as { hazardDescription?: string }).hazardDescription).toBe("3 (8)");
  });

  it("records the non-reaction assertion the approval may have rested on", async () => {
    const { buildShippingPaper } = await import("../src/tools/executors.ts");
    const paper = buildShippingPaper(
      toLoad([{ items: ["UN1830", "UN1748"], nonReactionAsserted: true }]) as never,
    );
    expect(paper[0]!.nonReactionAsserted).toBe(true);
    // The renderer dropped it while the document carried it, which is the shape
    // of defect a source guard catches and a data test does not.
    const ui = readFileSync(join(process.cwd(), "src/ui/ShippingPaper.tsx"), "utf8");
    expect(ui).toContain("v.nonReactionAsserted");
    expect(ui).toContain("hazardDescription");
    // And the renderer's types are derived, not hand-narrowed, which is how the
    // field came to be dropped in silence in the first place.
    expect(ui).toContain("ReturnType<typeof buildShippingPaper>");
  });
});

describe("19. the hazard zone is part of a material's identity", () => {
  it("refuses UN1744 Bromine solutions PG I, whose two rows are Zone A and Zone B", () => {
    const r = resolveItem({ id: "UN1744", name: "Bromine solutions", packingGroup: "I" });
    expect("error" in r).toBe(true);
    const e = (r as { error: string }).error;
    expect(e).toMatch(/2 different materials/);
    expect(e).toContain("Zone A");
    expect(e).toContain("Zone B");
  });

  it("resolves either one once the operator names the zone", () => {
    for (const zone of ["A", "B"] as const) {
      const r = resolveItem({ id: "UN1744", name: "Bromine solutions", packingGroup: "I", pihZone: zone });
      if ("error" in r) throw new Error(r.error);
      expect(r.pihZone).toBe(zone);
    }
  });

  it("the zone changes the verdict, which is why collapsing the rows was wrong", async () => {
    const zoneA = await checkLoad({
      vehicles: [{ items: [{ id: "UN1744", name: "Bromine solutions", packingGroup: "I", pihZone: "A" }, { id: "UN1090" }] }],
    }, N);
    const zoneB = await checkLoad({
      vehicles: [{ items: [{ id: "UN1744", name: "Bromine solutions", packingGroup: "I", pihZone: "B" }, { id: "UN1090" }] }],
    }, N);
    expect(zoneA.status).not.toBe(zoneB.status);
  });

  it("refuses a zone that number does not carry", () => {
    const r = resolveItem({ id: "UN1744", name: "Bromine solutions", packingGroup: "I", pihZone: "D" });
    expect("error" in r).toBe(true);
    expect((r as { error: string }).error).toMatch(/no Hazard Zone D/);
  });
});

// ── round six ────────────────────────────────────────────────────────────────

describe("20. the approval token binds every field the resolver uses", () => {
  it("UN1744 Zone A and Zone B are different loads to the hash", async () => {
    const { canonical, approvalToken } = await import("../src/solver/hash.ts");
    const base = { id: "UN1744", name: "Bromine solutions", packingGroup: "I" };
    const a = toLoad([{ items: [{ ...base, pihZone: "A" }] }]);
    const b = toLoad([{ items: [{ ...base, pihZone: "B" }] }]);
    expect(canonical(a)).not.toBe(canonical(b));
    expect(await approvalToken(a, N)).not.toBe(await approvalToken(b, N));
  });

  it("a packing group alone changes the canonical bytes", async () => {
    const { canonical } = await import("../src/solver/hash.ts");
    const two = toLoad([{ items: [{ id: "UN2810", packingGroup: "II" }] }]);
    const three = toLoad([{ items: [{ id: "UN2810", packingGroup: "III" }] }]);
    expect(canonical(two)).not.toBe(canonical(three));
  });

  it("a token issued for the Zone B load does not verify the Zone A load", async () => {
    const { approvalToken, verifyApproval } = await import("../src/solver/index.ts");
    const base = { id: "UN1744", name: "Bromine solutions", packingGroup: "I" };
    const b = toLoad([{ items: [{ ...base, pihZone: "B" }, { id: "UN1090" }] }]);
    const token = await approvalToken(b, N);
    const cross = await verifyApproval(
      toLoad([{ items: [{ ...base, pihZone: "A" }, { id: "UN1090" }] }]), token, N,
    );
    expect(cross.ok).toBe(false);
  });

  it("the canonical format is versioned, because adding a field invalidates old tokens", async () => {
    const { canonical } = await import("../src/solver/hash.ts");
    expect(canonical(toLoad([{ items: ["UN1090"] }]))).toContain("49cfr177848/v2");
  });
});

describe("21. the wire can express the identity the resolver asks for", () => {
  it("accepts a structured reference and reaches a different verdict per zone", async () => {
    const base = { id: "UN1744", name: "Bromine solutions", packingGroup: "I" };
    const a = await checkSegregation({ vehicles: [{ items: [{ ...base, pihZone: "A" }, "UN1090"] }] }, N);
    const b = await checkSegregation({ vehicles: [{ items: [{ ...base, pihZone: "B" }, "UN1090"] }] }, N);
    expect(a.status).toBe("REFUSED");
    expect(b.status).toBe("PASS");
  });

  it("the bare reference still refuses, so the remedy the refusal names is reachable", async () => {
    // A refusal whose remedy the wire cannot carry is a dead end dressed as
    // guidance. This pair asserts both halves: the refusal, and the route out.
    const bare = await checkSegregation({ vehicles: [{ items: ["UN1744", "UN1090"] }] }, N);
    expect(bare.status).toBe("REFUSED");
  });

  it("refuses an attestation smuggled inside an item object", async () => {
    const v = await checkSegregation(
      { vehicles: [{ items: [{ id: "UN1090", barriersPresent: true } as never, "UN1479"] }] }, N,
    );
    expect(v.status).toBe("REFUSED");
    expect((v as { reason?: string }).reason).toMatch(/malformed request/);
  });

  it("the published schema offers the structured form", async () => {
    const { CHECK_SEGREGATION_SCHEMA } = await import("../src/tools/schemas.ts");
    const item = (CHECK_SEGREGATION_SCHEMA as never as {
      properties: { vehicles: { items: { properties: { items: { items: { anyOf: unknown[] } } } } } };
    }).properties.vehicles.items.properties.items.items;
    expect(Array.isArray(item.anyOf)).toBe(true);
    const obj = (item.anyOf as { type: string; properties?: Record<string, unknown> }[])
      .find((x) => x.type === "object");
    expect(obj, "the schema has no object form, so pihZone cannot be sent").toBeDefined();
    expect(Object.keys(obj!.properties!)).toContain("pihZone");
  });
});

describe("22. the paper carries the classifications the approval was computed from", () => {
  it("prints the 172.203(m) inhalation-hazard entry with the zone", async () => {
    const { buildShippingPaper } = await import("../src/tools/executors.ts");
    const paper = buildShippingPaper(toLoad([{ items: ["UN1017", "UN1090"] }]) as never);
    const chlorine = paper[0]!.lines.find(
      (l) => "properShippingName" in l && l.properShippingName === "Chlorine",
    ) as { inhalationHazard?: string | null; hazardDescription?: string } | undefined;
    expect(chlorine, "UN1017 did not reach the paper").toBeDefined();
    expect(chlorine!.inhalationHazard).toBe("Toxic-Inhalation Hazard, Zone B");
    expect(chlorine!.hazardDescription).toBe("2.3 (5.1, 8)");

    // And nothing is printed where the clause does not apply.
    const acetone = paper[0]!.lines.find(
      (l) => "properShippingName" in l && l.properShippingName === "Acetone",
    ) as { inhalationHazard?: string | null } | undefined;
    expect(acetone!.inhalationHazard).toBeNull();
  });

  it("the renderer prints it, and says what the document does NOT carry", () => {
    const ui = readFileSync(join(process.cwd(), "src/ui/ShippingPaper.tsx"), "utf8");
    expect(ui).toContain("l.inhalationHazard");
    expect(ui).toContain("cert.scope");
  });

  it("the scope note names the clauses implemented and the ones that are not", async () => {
    const { shipperCertification } = await import("../src/tools/executors.ts");
    const scope = shipperCertification().scope;
    for (const c of ["172.202(a)", "172.202(a)(3)", "172.203(m)", "172.102"]) {
      expect(scope, `the scope note does not mention ${c}`).toContain(c);
    }
    expect(scope).toMatch(/NOT generated/);
  });
});

describe("23. removing a vehicle does not revoke attestations from the ones that shift", () => {
  it("bays are compared by a stable key, not by array index", () => {
    const src = readFileSync(join(process.cwd(), "src/Console.tsx"), "utf8");
    const at = src.indexOf("const mutateBays = useCallback(");
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf("\n  const ", at + 10));
    // Deleting an empty vehicle 2 shifts vehicle 3 to index 1, where an
    // index-keyed comparison finds the empty bay that used to be there and
    // clears a barrier the operator asserted about unchanged contents.
    expect(body, "mutateBays still compares prev[i]").not.toMatch(/prev\[i\]/);
    expect(body).toContain("bay.key");
    expect(src).toContain("key: `bay-${nextBayKey.current++}`");
  });
});

// ── round seven ──────────────────────────────────────────────────────────────
//
// The round itself died mid-turn, which is no verdict. It had already named a
// concrete lead before it went, so the lead was reproduced by hand: it was
// real, and it was the worst one yet.

describe("24. physical state is an attestation, not an identity field", () => {
  const page = [{ items: [{ id: "UN1830" }, { id: "UN1748" }] }];

  it("refuses a state declared on the wire, by name", async () => {
    const v = await checkSegregation(
      { vehicles: [{ items: [{ id: "UN1830", state: "solid" } as never, "UN1748"] }] }, N,
    );
    expect(v.status).toBe("REFUSED");
    expect((v as { reason?: string }).reason).toMatch(/malformed request/);
    expect((v as { reason?: string }).reason).toMatch(/Physical state and quantity are NOT among them/);
  });

  it("the headline pair cannot be walked out of its row by declaring it solid", async () => {
    // 177.848(d) covers Class 8 LIQUIDS only. With state on the wire, an agent
    // re-sent the operator's own load with the acid declared SOLID, the
    // contents comparison saw the same two materials, the operator's barrier
    // was applied to a configuration nobody had looked at, and UN1830 with
    // UN1748 returned PASS and COMMITTED. That is the load this project exists
    // to refuse, cleared by one word.
    const forged = await checkSegregation(
      { vehicles: [{ items: [{ id: "UN1830", state: "solid" } as never, "UN1748"] }] },
      N, [{ barriersPresent: true }], page,
    );
    expect(forged.status).toBe("REFUSED");

    // And the honest version of the same load is still refused on its merits.
    const honest = await checkSegregation(
      { vehicles: [{ items: ["UN1830", "UN1748"] }] }, N, [{ barriersPresent: true }], page,
    );
    expect(honest.status).toBe("REFUSED");
  });

  it("the schema does not offer state, and says why", async () => {
    const { CHECK_SEGREGATION_SCHEMA } = await import("../src/tools/schemas.ts");
    const item = (CHECK_SEGREGATION_SCHEMA as never as {
      properties: { vehicles: { items: { properties: { items: { items: { anyOf: { type: string; properties?: Record<string, unknown>; description?: string }[] } } } } } };
    }).properties.vehicles.items.properties.items.items;
    const obj = item.anyOf.find((x) => x.type === "object")!;
    expect(Object.keys(obj.properties!)).not.toContain("state");
    expect(obj.description).toMatch(/Physical state and quantity/);
  });

  it("refuses quantity on the wire, for the same reason as state", async () => {
    // Quantity is a commercial and physical fact about the shipment, and the
    // schema advertised that it reaches the shipping paper while the document
    // model never carried it. An agent could send "999 railcars", get PASS and
    // COMMITTED, and receive a paper mentioning no quantity at all. A field
    // that is accepted, ignored and advertised is worse than one refused.
    const v = await checkSegregation(
      { vehicles: [{ items: [{ id: "UN1830", quantity: "999 railcars" } as never, "UN1748"] }] }, N,
    );
    expect(v.status).toBe("REFUSED");
    expect((v as { reason?: string }).reason).toMatch(/quantity/i);
  });
});

// ── round eight, a WHOLE-REPO pass by a different model family ────────────────
//
// Codex was out of quota and Grok's balance was empty, so this round ran on
// Gemini with a whole-repo brief rather than a diff. It reported four findings.
// TWO REPRODUCED. The two that did not include the one it ranked most severe,
// which is the argument for reproducing every finding before touching anything:
// a load it said passed unconditionally was refused, and a load it said was
// falsely refused already passed.

describe("25. the 177.848(e)(3) hard block is about LIQUIDS", () => {
  it("no longer blocks a Class 2.3 gas that carries a subsidiary Class 8", async () => {
    // UN1048 hydrogen bromide, anhydrous is Division 2.3 with a subsidiary
    // Class 8, and its state resolves correctly to "gas". The predicate asked
    // for `state !== "solid"`, which is a different set, so a clause reaching
    // only Class 8 LIQUIDS was hard-blocking a gas against Class 5 materials.
    const withBarrier = await checkLoad(toLoad([{ items: ["UN1048", "UN1438"], barriersPresent: true }]), N);
    expect(withBarrier.status).toBe("PASS");
  });

  it("still lets the table adjudicate that pair, rather than clearing it outright", async () => {
    // The non-vacuity half. Removing the hard block must hand the pair to the
    // matrix, not wave it through: the O cell still needs a barrier.
    const noBarrier = await checkLoad(toLoad([{ items: ["UN1048", "UN1438"] }]), N);
    expect(noBarrier.status).toBe("REFUSED");
  });

  it("and a real Class 8 LIQUID is still blocked notwithstanding any separation", async () => {
    // The headline refusal of this entire project, and two more like it. If the
    // narrower predicate had leaked, this is where it would show.
    for (const items of [["UN1830", "UN1748"], ["UN1789", "UN1479"]]) {
      const v = await checkLoad(toLoad([{ items, barriersPresent: true, singleShipper: false }]), N);
      expect(v.status, `${items.join(" + ")} cleared the hard block`).toBe("REFUSED");
    }
  });
});

describe("26. propose_load accepts the item shape its own schema publishes", () => {
  it("takes a structured identity, which the schema advertises and the executor refused", () => {
    // PROPOSE_LOAD_SCHEMA shares MATERIAL_REF with the other two tools, so the
    // published contract promised an object form while this executor still
    // demanded strings and answered "items must be a non-empty array of
    // strings". A tool surface that documents a shape it rejects is worse than
    // one that never offered it.
    const r = proposeLoad({ items: [{ id: "UN1090" }, { id: "UN1830" }], maxVehicles: 2 });
    expect(r.status).toBe("PROPOSED");
  });

  it("resolves an ambiguous number when the caller supplies the zone", () => {
    // The whole reason the object form exists, now reachable from propose too.
    const bare = proposeLoad({ items: ["UN1744", "UN1090"], maxVehicles: 2 });
    expect(bare.status).toBe("UNRESOLVED");
    const named = proposeLoad({
      items: [{ id: "UN1744", name: "Bromine solutions", packingGroup: "I", pihZone: "B" }, "UN1090"],
      maxVehicles: 2,
    });
    expect(named.status).toBe("PROPOSED");
  });

  it("still refuses an attestation on the wire, through the new path", () => {
    const r = proposeLoad({ items: [{ id: "UN1090", barriersPresent: true } as never], maxVehicles: 2 });
    expect(r.status).toBe("REFUSED");
  });

  it("all three tools coerce items through the same function", () => {
    // The divergence existed because propose had its own check. One coercer.
    const src = readFileSync(join(process.cwd(), "src/tools/executors.ts"), "utf8");
    expect(src).not.toContain("isStringArray");
    expect((src.match(/coerceRef\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

// ── round nine ───────────────────────────────────────────────────────────────

describe("27. note A names two divisions, and the table merges three", () => {
  it("does not clear a Division 1.2 explosive with ammonium nitrate", async () => {
    // 177.848(e)(5) permits UN1942 with "Division 1.1 (explosive) or Division
    // 1.5 materials". The 177.848(d) table has no 1.1 row and no 1.2 row: it
    // has ONE row labelled "1.1 and 1.2". Keying the carve-out on that merged
    // row handed the permission to every Division 1.2 material. UN1942 with
    // UN0171, a Division 1.2G explosive, returned PASS and COMMITTED and
    // exported a shipping paper for an X cell.
    expect(await clears([{ items: ["UN1942", "UN0171"] }])).toBe(false);
  });

  it("still distinguishes the divisions the clause names, in the refusal", async () => {
    // THIS TEST ASSERTED THE HOLE, and it is the second time in this project
    // that a regression test written in the same commit as a fix defended the
    // gap the NEXT round found. It read `expect(v.status).toBe("PASS")` for
    // UN1942 with UN0027, so the suite would have defended an X cell reaching
    // a committed shipping paper on a condition the tool cannot evaluate.
    //
    // A guard retires by asserting the SUCCESSOR state, never by being
    // deleted. What this test exists to protect is the 1.1-versus-1.2
    // distinction, and that distinction is still observable, now in the GROUND
    // of the refusal rather than in the verdict: a Division 1.1 material gets
    // note A's own clause and the unevaluable-condition wording, a Division 1.2
    // material never reaches note A at all and is refused as a plain X.
    const eleven = await checkLoad(toLoad([{ items: ["UN1942", "UN0027"] }]), N);
    const twelve = await checkLoad(toLoad([{ items: ["UN1942", "UN0171"] }]), N);
    expect(eleven.status).toBe("REFUSED");
    expect(twelve.status).toBe("REFUSED");

    const sections = (v: typeof eleven) =>
      v.status === "REFUSED" ? v.violations.flatMap((x) => x.citations.map((c) => c.section)) : [];
    const text = (v: typeof eleven) =>
      v.status === "REFUSED" ? v.violations.map((x) => x.message).join(" ") : "";

    // The 1.1D pair is refused THROUGH note A, naming the condition it cannot
    // evaluate. 177.835(c) is not in the pinned corpus.
    expect(sections(eleven)).toContain("49 CFR 177.848(e)(5)");
    expect(text(eleven)).toContain("177.835(c)");
    expect(text(eleven)).toContain("stated gap in coverage");

    // The 1.2G pair never gets there: note A does not mention Division 1.2.
    expect(sections(twelve)).not.toContain("49 CFR 177.848(e)(5)");
    expect(text(twelve)).not.toContain("177.835(c)");
  });

  it("reads the resolved division rather than the merged row key", () => {
    const src = readFileSync(join(process.cwd(), "src/solver/segregation.ts"), "utf8");
    expect(src).toContain("isDivision11or15");
    expect(src, "the carve-out still keys on the merged row").not.toMatch(/rb === "1\.1 and 1\.2"/);
  });
});

describe("28. a proposal has to round-trip, or its own instructions are impossible", () => {
  it("echoes back enough identity to re-check the arrangement it proposed", async () => {
    // propose_load flattened every item to `id ?? name`, so a caller who
    // resolved UN1744 by supplying name, packing group and zone got back the
    // bare string "UN1744", which names three different materials. The tool's
    // own note says to check the proposal for an approval token, and the
    // proposal it returned could not be checked.
    const ref = { id: "UN1744", name: "Bromine solutions", packingGroup: "I", pihZone: "B" };
    const p = proposeLoad({ items: [ref, "UN1090"], maxVehicles: 2 });
    expect(p.status).toBe("PROPOSED");
    if (p.status !== "PROPOSED") return;
    const back = await checkSegregation(
      { vehicles: p.vehicles.map((v) => ({ items: v.items })) }, N,
    );
    expect(back.status).toBe("PASS");
  });

  it("keeps a reference short when the short form provably resolves the same", () => {
    // Not merely "shortest that resolves": UN2810 alone resolves cleanly, to
    // packing group I, so echoing it back for a PG II item would name a
    // different material. The short form is offered only when it lands on the
    // same name, packing group and zone.
    const plain = proposeLoad({ items: ["UN1090", "UN1830"], maxVehicles: 2 });
    if (plain.status !== "PROPOSED") throw new Error(plain.status);
    expect(plain.vehicles.flatMap((v) => v.items).every((x) => typeof x === "string")).toBe(true);

    const pg = proposeLoad({ items: [{ id: "UN2810", packingGroup: "II" }, "UN1090"], maxVehicles: 2 });
    if (pg.status !== "PROPOSED") throw new Error(pg.status);
    const echoed = pg.vehicles.flatMap((v) => v.items).find((x) => typeof x !== "string");
    expect(echoed, "UN2810 PG II was flattened to a bare number").toBeDefined();
    expect(echoed).toMatchObject({ id: "UN2810", packingGroup: "II" });
  });
});

describe("29. quantity is a claim about the shipment, not a way of naming a material", () => {
  it("is refused on the wire, like state", async () => {
    // The schema advertised that quantity reaches the shipping paper while the
    // document model never carried it, so an agent could send "999 railcars",
    // reach COMMITTED, and receive a paper mentioning no quantity at all. A
    // field that is accepted, ignored and advertised is worse than one refused.
    const v = await checkSegregation(
      { vehicles: [{ items: [{ id: "UN1090", quantity: "999 railcars" } as never] }] }, N,
    );
    expect(v.status).toBe("REFUSED");
    expect((v as { reason?: string }).reason).toMatch(/quantity/i);
  });

  it("is gone from the published schema, so nothing promises what is not delivered", async () => {
    const { CHECK_SEGREGATION_SCHEMA } = await import("../src/tools/schemas.ts");
    const item = (CHECK_SEGREGATION_SCHEMA as never as {
      properties: { vehicles: { items: { properties: { items: { items: { anyOf: { type: string; properties?: Record<string, unknown> }[] } } } } } };
    }).properties.vehicles.items.properties.items.items;
    const obj = item.anyOf.find((x) => x.type === "object")!;
    expect(Object.keys(obj.properties!)).not.toContain("quantity");
    expect(Object.keys(obj.properties!)).not.toContain("state");
  });
});

describe("30. the coverage gate must not count dead citation helpers", () => {
  it("the two clauses those helpers cite are carried by a live path", async () => {
    const { shipperCertification } = await import("../src/tools/executors.ts");
    const cert = shipperCertification();
    const sections = cert.rules.map((r) => r.section);
    expect(sections).toContain("49 CFR 172.202(a)");
    expect(sections).toContain("49 CFR 172.203(m)");
    // And the scope note is BUILT from them, so the sections it names cannot
    // drift from the sections the code cites.
    for (const s of sections) expect(cert.scope).toContain(s);
  });

  it("the reachability filter no longer infers reachability from text at all", () => {
    // RETIRED ONTO THE SUCCESSOR STATE. This asserted the literal regex
    // `export (?:function |const`, which round ten showed was still blind to
    // four declaration forms. A guard retires by asserting what replaced it,
    // never by being deleted, so it now pins the parser and the mutation test
    // below drives every form.
    const src = readFileSync(join(process.cwd(), "tests/claims.test.ts"), "utf8");
    expect(src).not.toContain("export (?:function |const");
    expect(src).toContain("reachableCitedIds");
  });
});

// ── round ten ────────────────────────────────────────────────────────────────

describe("31. note A granted an X-cell exemption on a condition nothing can evaluate", () => {
  it("does not export ammonium nitrate with a Division 1.1 explosive", async () => {
    // REPRODUCED BEFORE THE FIX: two real records, UN1942 ammonium nitrate and
    // UN0027 black powder (Division 1.1D), in one vehicle returned PASS and
    // then COMMITTED, exporting a shipping paper for a cell the 177.848(d)
    // table marks X. The only thing standing between that load and the export
    // was a NOTE reading "Confirm 177.835(c) does not apply".
    //
    // 177.835(c) is not in this tool's pinned corpus, so there was nothing to
    // confirm it against, and the vehicle-combination facts it turns on are
    // not in the 172.101 table either. An unevaluable condition is not a
    // satisfied one.
    expect(await clears([{ items: ["UN1942", "UN0027"] }])).toBe(false);
  });

  it("names the condition it cannot evaluate instead of asking for a promise", async () => {
    // The refusal has to say WHICH fact is missing. "Confirm 177.835(c) does
    // not apply" put the burden on a reader who has no way to discharge it,
    // which is the documenting-a-hole move this project argues against.
    const v = await checkLoad(toLoad([{ items: ["UN1942", "UN0027"] }]), N);
    expect(v.status).toBe("REFUSED");
    const text = v.status === "REFUSED" ? v.violations.map((x) => x.message).join(" ") : "";
    expect(text).toContain("cannot be evaluated");
    expect(text).toContain("stated gap in coverage");
    expect(text).not.toContain("Confirm 177.835(c) does not apply");
  });

  it("keeps the same shape as the 177.848(g)(vi) refusal it should have matched", () => {
    // This defect survived nine rounds because round six fixed the EXAMPLE it
    // was handed, 177.848(g)(vi), and not the PATTERN behind it. Both clauses
    // carry a condition the corpus cannot evaluate, and both must now decline
    // the permission in the same words, so the next unevaluable condition is
    // recognisable as one.
    const seg = readFileSync(join(process.cwd(), "src/solver/segregation.ts"), "utf8");
    const exp = readFileSync(join(process.cwd(), "src/solver/explosives.ts"), "utf8");
    expect(seg).toContain("stated gap in coverage");
    expect(exp).toContain("stated gap in coverage");
  });

  it("still refuses ammonium nitrate with Division 1.2, which note A never named", async () => {
    // The negative half, so the fix cannot degenerate into one blunt refusal
    // that hides the distinction the previous round recovered.
    expect(await clears([{ items: ["UN1942", "UN0171"] }])).toBe(false);
  });
});

describe("32. a named denylist only refuses the claims somebody already thought of", () => {
  const N32 = "round-ten-allowlist";

  it("refuses a quantity at VEHICLE level, where only attestations were checked", async () => {
    // REPRODUCED BEFORE THE FIX. coerceRef rejected state and quantity by name
    // at the ITEM level; coerceVehicles checked only the three attestation
    // names, so this returned PASS with an approval token and the quantity was
    // dropped on the floor. The token hashes the COERCED load, so the caller
    // held approval for bytes it had not sent.
    const r = await checkSegregation(
      { vehicles: [{ items: [{ id: "UN1090" }], quantity: "999 railcars" }] } as never, N32, [{}],
    );
    expect(r.status).toBe("REFUSED");
  });

  it("refuses an unrecognised property at every layer, and names the path", async () => {
    // The review named ONE layer. An audit's examples are a sample, not an
    // inventory, so the fix is an exact allowlist per layer rather than three
    // more forbidden names, and the refusal says exactly where the property was.
    const top = await checkSegregation({ vehicles: [{ items: ["UN1090"] }], foo: 1 } as never, N32, [{}]);
    const veh = await checkSegregation({ vehicles: [{ items: ["UN1090"], foo: 1 }] } as never, N32, [{}]);
    const item = await checkSegregation({ vehicles: [{ items: [{ id: "UN1090", foo: 1 }] }] } as never, N32, [{}]);
    expect(top.status).toBe("REFUSED");
    expect(veh.status).toBe("REFUSED");
    expect(item.status).toBe("REFUSED");
    expect((top as { reason: string }).reason).toContain("foo");
    expect((veh as { reason: string }).reason).toContain("vehicles[0].foo");
    expect((item as { reason: string }).reason).toContain("vehicles[0].items[0].foo");
  });

  it("covers commit_manifest, propose_load, lookup_material and classify_line_item", async () => {
    // commit_manifest re-derives the verdict from the bytes it exports, so an
    // ignored property there is the one that reaches the shipping paper.
    const c = await commitManifest(
      { vehicles: [{ items: ["UN1090"] }], approvalToken: "x", foo: 1 } as never, N32, [{}],
    );
    expect(c.status).toBe("REFUSED");
    expect(proposeLoad({ items: ["UN1090"], maxVehicles: 2, foo: 1 } as never).status).toBe("REFUSED");
    expect(isMalformed(lookupMaterial({ query: "acetone", foo: 1 } as never))).toBe(true);
    expect(isMalformed(classifyLineItem({ text: "acetone", foo: 1 } as never))).toBe(true);
  });

  it("does not become a blunt refusal: the published shapes still work", async () => {
    // The negative half. Every form the schemas advertise must still pass.
    expect((await checkSegregation({ vehicles: [{ items: ["UN1090"] }] }, N32, [{}])).status).toBe("PASS");
    // All four allowed identity keys at once, on the material whose Zone A and
    // Zone B rows are two different loads. This is the shape round eight added
    // so a refusal's own remedy could be sent, and the allowlist must not undo it.
    expect(
      (await checkSegregation(
        { vehicles: [{ items: [{ id: "UN1744", name: "Bromine", packingGroup: "I", pihZone: "A" }] }] },
        N32, [{}],
      )).status,
    ).not.toBe("REFUSED");
    expect(proposeLoad({ items: ["UN1090"], maxVehicles: 2 }).status).toBe("PROPOSED");
    expect(isMalformed(lookupMaterial({ query: "acetone" }))).toBe(false);
    expect(isMalformed(classifyLineItem({ text: "2 drums acetone" }))).toBe(false);
  });

  it("stops offering a property it refuses two sentences later", () => {
    // The refusal text listed `quantity` among an item's allowed properties and
    // then said quantity is not among them. A contradictory refusal is a
    // refusal an agent cannot act on.
    const src = readFileSync(join(process.cwd(), "src/tools/executors.ts"), "utf8");
    expect(src).not.toContain("packingGroup, pihZone or quantity");
    expect(src).toContain("packingGroup or pihZone");
  });
});

describe("33. the clause gate inferred reachability from text, and text cannot see scope", () => {
  const cited = (files: Source[]) => reachableCitedIds(files, files);
  const one = (text: string) => cited([{ path: "src/solver/x.ts", text }]);

  it("counts a citation that something actually calls", () => {
    // The positive control. Without this the test below passes on a filter
    // that simply returns nothing, which is the vacuous-gate failure this
    // whole family of guards exists to prevent.
    //
    // The trailing `caller();` is load-bearing and this test failed without it
    // when the filter became a real call graph in round eleven. Under the old
    // reference COUNT, `live` looked used because `caller` mentioned it; under
    // a graph, nothing calls `caller`, so both are dead and the old version of
    // this control was asserting the very hole round eleven reported.
    expect(one(`
      export function live() { return cite("e2-X"); }
      export function caller() { return live(); }
      caller();
    `).has("e2-X")).toBe(true);
  });

  it("does not count a private module helper", () => {
    // Not exported, never called. The old split only ever looked at lines
    // beginning `export`, so this sat inside a retained neighbour's chunk.
    expect(one(`
      function dead() { return cite("e2-X"); }
      export function other() { return 1; }
    `).has("e2-X")).toBe(false);
  });

  it("treats a default export as reachable, deliberately", () => {
    // RETIRED ONTO THE SUCCESSOR STATE. This asserted that a named default
    // export nobody imports is dead, and round twelve showed the cost of that
    // rule: `import Foo from "./x"` binds a LOCAL name, this analysis does not
    // resolve modules, so the exported declaration had no references and a LIVE
    // citation read as dead. A false dead fails the build for the wrong reason,
    // and the tempting repair is to weaken the gate until it goes green.
    //
    // So a default export is a root. That is a permissive choice made on
    // purpose, in the direction this gate accepts, and it is inert here: the
    // shipped source contains no default export at all, which the next
    // assertion pins so the choice cannot start mattering unnoticed.
    expect(one(`export default function dead() { return cite("e2-X"); }`).has("e2-X")).toBe(true);
    // Walk src rather than the git index, so a file that is about to ship but
    // is not tracked yet is still scanned. A guard scoped to tracked files is
    // blind to exactly the thing being added.
    const shipped = readdirSync(join(process.cwd(), "src"), { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => /(^|\n)export default\b/.test(readFileSync(join(process.cwd(), "src", f), "utf8")));
    expect(shipped, "a default export in src would silently become a reachability root").toEqual([]);
  });

  it("does not count a class method on a class nobody uses", () => {
    expect(one(`export class Dead { cites() { return cite("e2-X"); } }`).has("e2-X")).toBe(false);
  });

  it("does not count an object-literal method nobody calls", () => {
    expect(one(`export const bag = { cites: () => cite("e2-X") };`).has("e2-X")).toBe(false);
  });

  it("does not treat a bare re-export as a caller", () => {
    // `export { dead } from "./x"` puts the name in the text a second time, so
    // the old use-count read it as a call. Re-exporting a function does not
    // reach it.
    expect(cited([
      { path: "src/solver/x.ts", text: `export function dead() { return cite("e2-X"); }` },
      { path: "src/solver/index.ts", text: `export { dead } from "./x.ts";` },
    ]).has("e2-X")).toBe(false);
  });

  it("does not count a live inner function inside a dead outer one", () => {
    // Nesting is why every enclosing name is checked rather than the innermost.
    expect(one(`
      export function dead() {
        function inner() { return cite("e2-X"); }
        return inner();
      }
    `).has("e2-X")).toBe(false);
  });
});

// ── round eleven ─────────────────────────────────────────────────────────────

describe("34. a supplied field with an unusable value was still being dropped", () => {
  const N34 = "round-eleven";

  it("refuses an empty-string identity field instead of ignoring it", async () => {
    // REPRODUCED BEFORE THE FIX. Round ten refused unsupported property NAMES
    // so a token could not cover bytes the caller had not sent. coerceRef then
    // did exactly that to supported names with unusable VALUES: "" and null
    // were skipped, so { id: "UN1090", name: "" } canonicalised to a bare
    // UN1090. It returned PASS, and the token committed a DIFFERENT payload.
    const r = await checkSegregation(
      { vehicles: [{ items: [{ id: "UN1090", name: "" }] }] } as never, N34, [{}],
    );
    expect(r.status).toBe("REFUSED");
  });

  it("refuses a null identity field", async () => {
    const r = await checkSegregation(
      { vehicles: [{ items: [{ id: "UN1090", name: null }] }] } as never, N34, [{}],
    );
    expect(r.status).toBe("REFUSED");
  });

  it("no longer lets two different payloads share one approval token", async () => {
    // The exact-bytes claim is the whole security argument, so this asserts it
    // end to end rather than asserting the coercer in isolation.
    const withEmpty = await checkSegregation(
      { vehicles: [{ items: [{ id: "UN1090", name: "" }] }] } as never, N34, [{}],
    );
    expect(withEmpty.status).toBe("REFUSED");
    expect(withEmpty).not.toHaveProperty("approvalToken");
  });

  it("closes the schema hole that permitted it", () => {
    // id and name carried maxLength and no minLength, so "" was schema-valid
    // and the published contract disagreed with the running code.
    const src = readFileSync(join(process.cwd(), "src/tools/schemas.ts"), "utf8");
    expect(src).toContain('id: { type: "string", minLength: 1');
    expect(src).toContain('name: { type: "string", minLength: 1');
  });

  it("still accepts every identity field that is actually usable", async () => {
    // The negative half: refusing empty values must not refuse real ones.
    const r = await checkSegregation(
      { vehicles: [{ items: [{ id: "UN1744", name: "Bromine", packingGroup: "I", pihZone: "A" }] }] },
      N34, [{}],
    );
    expect(r.status).not.toBe("REFUSED");
  });
});

describe("35. counting references is not a call graph", () => {
  const cited = (files: Source[]) => reachableCitedIds(files, files);
  const one = (text: string) => cited([{ path: "src/solver/x.ts", text }]);

  it("does not count a citation inside a chain nothing calls", () => {
    // `helper` is referenced, so a reference COUNT called it live. Nothing
    // calls `dead`, so nothing reaches either of them.
    expect(one(`
      function dead() { return helper(); }
      function helper() { return cite("e2-X"); }
    `).has("e2-X")).toBe(false);
  });

  it("does not let a function reach itself by recursing", () => {
    expect(one(`
      function dead(n) { if (n) return dead(n - 1); return cite("e2-X"); }
    `).has("e2-X")).toBe(false);
  });

  it("follows an aliased import, so a live citation is not reported dead", () => {
    // The other direction, and the more dangerous one here: a false DEAD fails
    // the build for the wrong reason and invites weakening the gate to get
    // green again.
    const files: Source[] = [
      { path: "src/solver/x.ts", text: `export function original() { return cite("e2-X"); }` },
      {
        path: "src/ui/y.ts",
        text: `import { original as alias } from "./x.ts";\nfunction ui() { return alias(); }\nui();`,
      },
    ];
    expect(reachableCitedIds([files[0]!], files).has("e2-X")).toBe(true);
  });

  it("reaches through module-level code, which is what runs on import", () => {
    expect(one(`
      function a() { return b(); }
      function b() { return cite("e2-X"); }
      a();
    `).has("e2-X")).toBe(true);
  });
});

// ── round twelve ─────────────────────────────────────────────────────────────

describe("36. the call graph was wrong in both directions again", () => {
  const cited = (files: Source[], i = 0) => reachableCitedIds([files[i]!], files);
  const one = (text: string) => cited([{ path: "src/solver/x.ts", text }]);

  it("follows a default import bound to a different local name", () => {
    // FALSE DEAD, the dangerous direction: `import Foo from "./x"` binds a
    // local name and this analysis does not resolve modules, so the exported
    // declaration had no references at all and a live citation read as dead.
    const files: Source[] = [
      { path: "src/solver/x.ts", text: `export default function bar() { return cite("e2-X"); }` },
      { path: "src/ui/y.ts", text: `import Foo from "./x.ts";\nfunction ui() { return Foo(); }\nui();` },
    ];
    expect(cited(files).has("e2-X")).toBe(true);
  });

  it("does not let a member access credit a same-named module helper", () => {
    // FALSE LIVE: `q.dead` is a property read, not a call to a helper that
    // happens to share the name.
    const files: Source[] = [
      {
        path: "src/solver/x.ts",
        text: `function dead() { return cite("e2-X"); }\nexport const q = { dead: 1 };`,
      },
      { path: "src/ui/y.ts", text: `import { q } from "./x.ts";\nfunction ui() { return q.dead; }\nui();` },
    ];
    expect(cited(files).has("e2-X")).toBe(false);
  });

  it("reaches an object's methods, which is what member access stood in for", () => {
    // Having stopped counting `bag.cites` as a reference to `cites`, reaching
    // `bag` has to reach the methods it declares or this becomes a false dead.
    const files: Source[] = [
      { path: "src/solver/x.ts", text: `export const bag = { cites: () => cite("e2-X") };` },
      { path: "src/ui/y.ts", text: `import { bag } from "./x.ts";\nfunction ui() { return bag.cites(); }\nui();` },
    ];
    expect(cited(files).has("e2-X")).toBe(true);
  });

  it("does not treat a declaration as a use of itself", () => {
    // THE ROOT CAUSE. `isOwnName` asked whether the parent declared a FUNCTION,
    // so `export const bag = { ... }` did not match, its own name counted as a
    // reference, and sitting at module level made it a root. Everything the
    // object declared then came alive.
    expect(one(`export const bag = { cites: () => cite("e2-X") };`).has("e2-X")).toBe(false);
  });
});

describe("37. the approval token binds the resolved load, not the wire spelling", () => {
  const N37 = "round-twelve";
  const token = async (items: unknown[]) => {
    const r = await checkSegregation({ vehicles: [{ items }] } as never, N37, [{}]);
    expect(r.status).toBe("PASS");
    return (r as { approvalToken: string }).approvalToken;
  };

  it("gives spellings of the SAME material the same token, on purpose", async () => {
    // A review read this as cross-payload token reuse. It is not a defect and
    // it is pinned here so it is not "fixed" later: 49 CFR itself writes
    // UN 1090 with a space, and round five had to make those compare equal
    // because an agent using the regulation's own spelling was losing a barrier
    // the operator had genuinely asserted. The token binds the load the handler
    // is about to EXPORT, so identical loads share a token by construction.
    const bare = await token(["UN1090"]);
    for (const spelling of [" UN1090 ", "un1090", { id: "UN1090" }, { id: " UN1090 " }]) {
      expect(await token([spelling]), `${JSON.stringify(spelling)} is the same load`).toBe(bare);
    }
  });

  it("gives a DIFFERENT load a different token, and refuses across them", async () => {
    // The half that would actually be a break. Two of a material is not one of
    // it, and a token issued for the pair must not commit the single.
    const two = await token(["UN1090", "UN1090"]);
    const one = await token(["UN1090"]);
    expect(two).not.toBe(one);
    const c = await commitManifest(
      { vehicles: [{ items: ["UN1090"] }], approvalToken: two }, N37, [{}],
    );
    expect(c.status).toBe("REFUSED");
  });
});

// ── round thirteen ───────────────────────────────────────────────────────────

describe("38. the reachability graph was vacuously true for forms it did not know", () => {
  const R = (files: Source[], i = 0) => reachableCitedIds([files[i]!], files).has("e2-X");
  const one = (text: string) => reachableCitedIds(
    [{ path: "src/solver/x.ts", text }], [{ path: "src/solver/x.ts", text }],
  );

  it("does not certify a sibling method because another member was reached", () => {
    // The container edged to ALL of its members, so calling one made every
    // other one live, which is exactly how a dead prohibition could satisfy the
    // clause gate. Member nodes are namespaced now and a property access edges
    // to that one node.
    expect(one(`
      export const bag = { used() { return 1; }, dead() { return cite("e2-X"); } };
      bag.used();
    `).has("e2-X")).toBe(false);
  });

  it("fails CLOSED on a member form the namer does not recognise", () => {
    // THE WORST OF THE FOUR, and it is this project's own signature defect.
    // A getter, a computed key or a post-declaration assignment left the
    // citation with NO enclosing declaration, and `[].every(...)` is trivially
    // true, so it counted as reachable. An unevaluable condition is not a
    // satisfied one, in the gate as much as in the regulation.
    expect(one(`export const bag = { get dead() { return cite("e2-X"); } };`).has("e2-X")).toBe(false);
    expect(one(`export const bag = { ["de" + "ad"]() { return cite("e2-X"); } };`).has("e2-X")).toBe(false);
    expect(one(`
      export const bag = {};
      bag.dead = function () { return cite("e2-X"); };
    `).has("e2-X")).toBe(false);
  });

  it("treats a static initialiser and a static block as module evaluation", () => {
    // Both RUN when the module is imported, whether or not the class is ever
    // referenced, so requiring a reference to the class was a false DEAD, which
    // fails the build for the wrong reason.
    expect(R([
      { path: "src/solver/x.ts", text: `export class C { static value = cite("e2-X"); }` },
      { path: "src/main.ts", text: `import "./x.ts";` },
    ])).toBe(true);
    expect(R([
      { path: "src/solver/x.ts", text: `export class C { static { cite("e2-X"); } }` },
      { path: "src/main.ts", text: `import "./x.ts";` },
    ])).toBe(true);
  });

  it("roots the members of an anonymous default export", () => {
    // `export default { ... }` can be bound to any local name by its importer,
    // and this analysis does not resolve modules, so its members are rooted.
    expect(R([
      { path: "src/solver/x.ts", text: `export default { cites() { return cite("e2-X"); } };` },
      { path: "src/ui/y.ts", text: `import bag from "./x.ts";\nfunction ui(){ return bag.cites(); }\nui();` },
    ])).toBe(true);
  });

  it("still reaches a member that IS called, and still refuses a dead container", () => {
    // The negative half, so none of the above degenerates into a blunt refusal.
    expect(R([
      { path: "src/solver/x.ts", text: `export const bag = { cites: () => cite("e2-X") };` },
      { path: "src/ui/y.ts", text: `import { bag } from "./x.ts";\nfunction ui(){ return bag.cites(); }\nui();` },
    ])).toBe(true);
    expect(one(`export const bag = { cites: () => cite("e2-X") };`).has("e2-X")).toBe(false);
  });

  it("pins the limitation it does NOT close, so it stays a decision", () => {
    // A shorthand reference marks the function live without proving it is
    // called. That is the same permissiveness that lets `arr.map(helper)` work,
    // and closing it would fail the build on live callbacks. Asserted here so
    // it cannot change silently and so a reader sees it is known, not missed.
    expect(one(`
      const f = () => cite("e2-X");
      export const bag = { f };
    `).has("e2-X")).toBe(true);
  });
});

// ── round fourteen, a WHOLE-REPO pass after three diff-scoped rounds ──────────

describe("39. one attestation was proving two clauses that ask different things", () => {
  const src = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

  it("asks for BOTH conditions, because 177.848(e)(3) and (e)(6) differ", () => {
    // (e)(3) is satisfied when the mixture "would not cause a fire or a
    // dangerous evolution of heat or gas". (e)(6) needs the materials to be
    // "not capable of reacting dangerously with each other", which also covers
    // outcomes that are neither fire nor heat nor gas. The checkbox stated only
    // the first and the solver accepted it as proof of the second, so the
    // narrower assertion cleared the wider exception.
    const ui = src("src/ui/LoadPlanPanel.tsx");
    expect(ui).toContain("cannot react dangerously with each other");
    expect(ui).toContain("fire or a dangerous evolution of heat or gas");
    expect(ui).toContain("177.848(e)(6)");
  });

  it("never hides a control that still holds a live claim", () => {
    // It rendered only while single shipper was ticked, and kept its value when
    // it hid. Tick both, untick single shipper, and a same-class pair with
    // subsidiary hazards committed on an assertion the operator could not see.
    const ui = src("src/ui/LoadPlanPanel.tsx");
    expect(ui).not.toContain("{bay.singleShipper && (");
  });
});

describe("40. a name reference ignored the identity fields sent with it", () => {
  it("honours a supplied packing group on the name branch", async () => {
    // REPRODUCED: { name: "Adhesives, containing a flammable liquid",
    // packingGroup: "III" } was adjudicated and exported as packing group I,
    // so the paper named a row the caller had explicitly not asked for. The id
    // branch narrowed on both fields; this branch narrowed on neither.
    const r = resolveItem({ name: "Adhesives, containing a flammable liquid", packingGroup: "III" });
    expect("error" in r).toBe(false);
    expect((r as { packingGroup?: string | null }).packingGroup).toBe("III");
  });

  it("refuses a packing group that name does not have, rather than substituting", async () => {
    const r = resolveItem({ name: "Adhesives, containing a flammable liquid", packingGroup: "IV" as never });
    expect("error" in r).toBe(true);
  });

  it("still resolves a bare name with no identity fields", async () => {
    // The negative half: narrowing must not become a blunt refusal.
    const r = resolveItem({ name: "Adhesives, containing a flammable liquid" });
    expect("error" in r).toBe(false);
  });
});

// ── round fifteen, whole repository again ────────────────────────────────────

describe("41. a subsidiary hazard the 172.101 label column does not carry", () => {
  const N41 = "round-fifteen";

  it("refuses the type B self-reactives rather than adjudicating them", async () => {
    // REPRODUCED: UN3221 with UN1090 returned PASS, minted a token, and
    // committed a paper showing only 4.1 and 3. Special provision 53 adds an
    // EXPLOSIVE subsidiary whose class and division come from an approval this
    // corpus does not contain, and several Class 1 rows are X against Class 3,
    // so the missing division decides the verdict.
    for (const id of ["UN3221", "UN3222", "UN3231", "UN3232"]) {
      expect("error" in resolveItem({ id }), `${id} must refuse`).toBe(true);
    }
    const vehicles = [{ items: [{ id: "UN3221" }, { id: "UN1090" }] }];
    const r = await checkSegregation({ vehicles }, N41, [{}]);
    expect(r.status).toBe("REFUSED");
  });

  it("quotes the provision verbatim rather than asserting what it says", async () => {
    const r = resolveItem({ id: "UN3221" });
    const msg = "error" in r ? r.error : "";
    expect(msg).toContain("special provision 53");
    expect(msg).toContain('subsidiary risk label, "EXPLOSIVE"');
    expect(msg).toContain("stated gap in coverage");
  });
});

describe("42. a proper shipping name that names more than one material", () => {
  it("refuses a name whose rows differ in identity", () => {
    // "Bromine solutions" has two Class 8 PG I rows differing only by Hazard
    // Zone A against B, and committed Zone A although no zone was sent.
    // "Diesel fuel" committed NA1993 although the name also identifies UN1202.
    for (const name of ["Bromine solutions", "Diesel fuel"]) {
      expect("error" in resolveItem({ name }), `${name} must refuse`).toBe(true);
    }
  });

  it("still resolves a name whose rows differ only by packing group", () => {
    // The negative half. Severity ordering settles the packing-group axis, so
    // narrowing must not turn every multi-row name into a refusal.
    expect("error" in resolveItem({ name: "Adhesives, containing a flammable liquid" })).toBe(false);
  });
});

describe("43. the published gap is an upper bound, and says so", () => {
  it("names the asterisk composition rather than calling a referral a clearance", () => {
    // 48 of the 56 come from asterisk cells, which 177.848(e)(4) refers to the
    // compatibility table rather than clearing. Counting a referral as a
    // clearance maximises the gap, so the figure is an upper bound. The
    // endpoint used to say the opposite, that a stricter reading would inflate
    // it, which is backwards.
    const div = measureDivergence();
    expect(div.byGround.EXPLOSIVE_INCOMPATIBLE).toBe(48);
    expect(div.byGround.CORROSIVE_OVER_OXIDIZER).toBe(8);
    expect(div.divergent).toBe(48 + 8);

    const ep = readFileSync(join(process.cwd(), "src/evidence/endpoints.ts"), "utf8");
    expect(ep).toContain("upper");
    expect(ep).not.toContain("would inflate the result");
  });
});

describe("44. the special provisions the solver does NOT know, audited", () => {
  // SP53 was found by a reviewer looking at one row. That prompted the obvious
  // question: what else is in column 7? Measured against the committed corpus
  // on 2026-08-31, deterministically rather than by asking a model.
  //
  //   403 distinct special provisions are in use across data/hmt.json.
  //   15 have text in 172.102 that mentions class, division, subsidiary hazard,
  //   packing group or hazard zone. 13 of those 15 are unknown to hazards.ts,
  //   which handles only 1 to 4 (the inhalation zones), 53 and 128.
  //
  // Every one of the 13 was then checked for DIRECTION, which is the only
  // question that matters for the safety claim. An exemption the solver ignores
  // ("not subject to the requirements") makes this tool stricter than the
  // regulation, which cannot produce a false PASS. What could produce one is a
  // provision that makes a material MORE restricted than its label column says,
  // which is exactly what SP53 does. None of the remaining 13 do, because the
  // defaults below are conservative. These tests pin that.
  const SOLVER_KNOWS = ["1", "2", "3", "4", "53", "128"];

  it("takes the more restrictive row when column 7 does not fix the zone", () => {
    // SP6 asserts a material is poisonous-by-inhalation without naming a zone.
    // Division 2.3 Zone A and Zone B are different rows in the 177.848(d)
    // table, so an undetermined zone has to resolve to the stricter one.
    for (const id of ["UN3168", "NA9035"]) {
      const r = resolveItem({ id });
      expect("error" in r, `${id} should resolve`).toBe(false);
      const item = r as { pihZone?: string | null; hazards: Array<{ matrixKey: string | null }> };
      expect(item.pihZone ?? null).toBe(null);
      expect(item.hazards[0]?.matrixKey).toBe("2.3 zone A");
    }
    const src = readFileSync(join(process.cwd(), "src/solver/hazards.ts"), "utf8");
    expect(src).toContain("take the MORE restrictive of the two published rows");
  });

  it("does not take an optional reclassification that would loosen the row", () => {
    // SP114 says a jet perforating gun MAY be reclassed to a lower division.
    // Taking an optional downgrade on the material's behalf would be the
    // permissive direction, so UN0494 stays where the table puts it.
    const r = resolveItem({ id: "UN0494" });
    expect("error" in r).toBe(false);
    expect((r as { hazardClass: string }).hazardClass).toBe("1.4D");
  });

  it("still refuses the one provision whose direction IS unsafe", () => {
    // The control for this whole audit. SP53 adds an explosive subsidiary the
    // label column does not print, so it is the one that must fail closed.
    expect("error" in resolveItem({ id: "UN3221" })).toBe(true);
    expect(SOLVER_KNOWS).toContain("53");
  });
});
