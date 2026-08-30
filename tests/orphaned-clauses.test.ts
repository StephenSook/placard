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
import { commitManifest, toLoad } from "../src/tools/executors.ts";

const N = "orphan-regression";

async function clears(vehicles: Parameters<typeof toLoad>[0]) {
  const v = await checkLoad(toLoad(vehicles), N);
  if (v.status !== "PASS") return false;
  const c = await commitManifest(
    { approvalToken: (v as { approvalToken: string }).approvalToken, vehicles },
    N,
  );
  return c.status === "COMMITTED";
}

async function refusalCiting(vehicles: Parameters<typeof toLoad>[0], section: string) {
  const v = await checkLoad(toLoad(vehicles), N);
  const cites = (v.violations ?? []).flatMap((x) => x.citations.map((c) => c.section));
  return v.status === "REFUSED" && cites.some((s) => s.includes(section));
}

describe("177.848(c), the narrative prohibition that is stricter than the matrix", () => {
  it("refuses a cyanide with an acid, which the (d) matrix alone clears", async () => {
    // UN1689 sodium cyanide is 6.1. UN1830 sulfuric acid is 8. The matrix cell
    // for that pair is not X, so the whole load passed and exported. 177.848(c)
    // names the pairing outright: cyanides with acids, where the mixture would
    // generate hydrogen cyanide.
    expect(await clears([{ items: ["UN1689", "UN1830"], barriersPresent: true }])).toBe(false);
    expect(await refusalCiting([{ items: ["UN1689", "UN1830"] }], "177.848")).toBe(true);
  });

  it("matches on the acid's NAME as well as its class, because 177.848(c) says acids", async () => {
    // Hydrofluoric acid solution, UN1790, is Class 8 and also named an acid.
    expect(await clears([{ items: ["UN1689", "UN1790"] }])).toBe(false);
  });

  it("does not refuse a cyanide with something that is neither Class 8 nor an acid", async () => {
    // Guards against fixing the above by refusing every load containing a
    // cyanide. UN1090 acetone is Class 3 and is not an acid.
    const v = await checkLoad(toLoad([{ items: ["UN1689", "UN1090"] }]), N);
    const msgs = (v.violations ?? []).map((x) => x.message).join(" ");
    expect(msgs).not.toContain("hydrogen cyanide");
  });
});

describe("177.848(f) footnotes are CONDITIONS, not permissions", () => {
  it("refuses 1.4S fireworks with 1.1G fireworks under footnote 5", async () => {
    // UN0337 is Fireworks, 1.4S. UN0333 is Fireworks, 1.1G. Their compatibility
    // groups produce a footnote cell, and the code read any non-X cell as
    // permission, so this exported.
    expect(await clears([{ items: ["UN0337", "UN0333"] }])).toBe(false);
    expect(await refusalCiting([{ items: ["UN0337", "UN0333"] }], "177.848")).toBe(true);
  });

  it("keeps clearing an explosive pair whose cell carries no unmet condition", async () => {
    // Guards against fixing the above by refusing every explosive pair.
    const v = await checkLoad(toLoad([{ items: ["UN0333", "UN0334"] }]), N);
    expect(["PASS", "REFUSED"]).toContain(v.status);
    const msgs = (v.violations ?? []).map((x) => x.message).join(" ");
    expect(msgs).not.toContain("Footnote 5");
  });
});
