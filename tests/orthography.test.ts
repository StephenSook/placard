/**
 * The 172.101 table is not internally consistent about British and American
 * spelling, so an index that matches names literally loses real materials in
 * BOTH directions. These tests pin that behaviour, because the failure mode is
 * an empty result, and an empty result reads as "not regulated".
 */
import { describe, it, expect } from "vitest";
import { HMT, lookupByName, normalizeOrthography, resolveName } from "../src/solver/corpus.ts";
import { classifyLineItem } from "../src/tools/executors.ts";

describe("the corpus really does contain both spellings", () => {
  // If a future eCFR snapshot normalises these, this test tells us the
  // justification for the whole mechanism has changed, rather than silently
  // leaving dead code behind.
  it("still has British-spelled entries", () => {
    const sulph = HMT.filter((e) => /sulph/i.test(e.name));
    const caesium = HMT.filter((e) => /caesium/i.test(e.name));
    expect(sulph.length, "no -sulph- entries left in the table").toBeGreaterThan(0);
    expect(caesium.length, "no Caesium entries left in the table").toBeGreaterThan(0);
    // The specific ones the comment in corpus.ts names.
    expect(sulph.map((e) => e.name)).toContain("Nicotine sulphate, solid");
    expect(sulph.map((e) => e.name)).toContain("Titanium disulphide");
  });
});

describe("normalizeOrthography", () => {
  it("maps British forms onto the American forms the table mostly uses", () => {
    expect(normalizeOrthography("Sulphuric acid")).toBe("sulfuric acid");
    expect(normalizeOrthography("Aluminium powder, coated")).toBe("aluminum powder coated");
    expect(normalizeOrthography("Caesium hydroxide")).toBe("cesium hydroxide");
  });

  it("never lets two DIFFERENT hazard classes resolve to one silent answer", () => {
    // Injectivity is NOT the property to assert here, and asserting it is how I
    // found the real defect. Normalisation does merge names, because the
    // federal table itself spells the same material several ways: "Articles,
    // explosive, n.o.s" and "Articles, explosive, n.o.s." are the same row set.
    //
    // The property that actually matters is that a merged key must never
    // produce a CONFIDENT answer when the entries behind it disagree about
    // hazard class, because the class picks the row of the 177.848(d) matrix.
    let checked = 0;
    const buckets = new Map<string, Set<string>>();
    for (const e of HMT) {
      const k = normalizeOrthography(e.name);
      if (!buckets.has(k)) buckets.set(k, new Set());
      buckets.get(k)!.add(e.class);
    }
    for (const [key, classes] of buckets) {
      if (classes.size < 2) continue;
      checked++;
      const r = resolveName(key);
      expect(r.kind, `"${key}" spans ${[...classes].join(", ")} and must refuse`).toBe("ambiguous");
    }
    expect(checked, "found no multi-class names, so this checked nothing").toBeGreaterThan(50);
  });

  it("still resolves the names that are genuinely unambiguous", () => {
    // Bucketed once rather than a filter inside a filter. The quadratic version
    // took 11.5 seconds on 3,293 entries and was the slowest thing in the suite
    // by an order of magnitude.
    const buckets = new Map<string, Set<string>>();
    for (const e of HMT) {
      const k = normalizeOrthography(e.name);
      if (!buckets.has(k)) buckets.set(k, new Set());
      buckets.get(k)!.add(e.class);
    }
    const unique = HMT.filter((e) => buckets.get(normalizeOrthography(e.name))!.size === 1);
    expect(unique.length).toBeGreaterThan(2000);
    expect(resolveName(unique[0]!.name).kind).toBe("resolved");
  });

  it("does NOT rewrite meaning, only spelling", () => {
    // glycerol and glycerin are the same substance in ordinary speech, but the
    // table carries them as separate entries, so rewriting one to the other
    // would move a query onto a different row. Deliberately not done.
    expect(normalizeOrthography("glycerol")).toBe("glycerol");
  });
});

describe("lookupByName resolves either spelling", () => {
  it("finds an American-spelled entry from a British query", () => {
    const hit = lookupByName("aluminium powder, coated");
    expect(hit?.name).toBe("Aluminum powder, coated");
    expect(hit?.un).toBe("UN1309");
  });

  it("finds a BRITISH-spelled entry from an American query, which is the half that surprises people", () => {
    // UN3445 is spelled "Nicotine sulphate" in the federal table. A US shipper
    // searching the American spelling would otherwise get nothing back.
    const hit = lookupByName("nicotine sulfate, solid");
    expect(hit?.un).toBe("UN3445");
  });

  it("still prefers an exact literal match over a normalised one", () => {
    const exact = lookupByName("Titanium disulphide");
    expect(exact?.un).toBe("UN3174");
  });
});

describe("classify_line_item on a real supplier line", () => {
  it("surfaces sulfuric acid from a British-spelled, unit-laden line", () => {
    const r = classifyLineItem({ text: "2 drums sulphuric acid soln 60%" });
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(r.candidates[0]!.name).toMatch(/sulfuric acid/i);
    // It is a candidate list, never a classification.
    expect(r.confirmationRequired).toBe(true);
  });

  it("ranks the right material ABOVE the entries that merely share the token 'acid'", () => {
    // Before normalisation this exact line returned Azidodithiocarbonic acid,
    // Butyric acid and Cacodylic acid, and the right answer was absent from the
    // list entirely. Near-misses lower down are fine, because this returns
    // candidates for a human to confirm rather than a classification. What must
    // hold is that the correct entry is first.
    const r = classifyLineItem({ text: "2 drums sulphuric acid soln 60%" });
    const names = r.candidates.map((c) => c.name.toLowerCase());
    expect(names[0]).toMatch(/sulfuric acid/);
    const noise = names.findIndex((n) => n.includes("azidodithiocarbonic"));
    if (noise !== -1) expect(noise).toBeGreaterThan(0);
  });
});
