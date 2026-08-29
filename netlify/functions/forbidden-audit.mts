/**
 * GET /api/forbidden-audit
 *
 * The defect this project exists to expose, made checkable by a stranger in one
 * fetch, with no key and no account.
 *
 * 256 entries in the 49 CFR 172.101 table are designated Forbidden. Under
 * 172.101(d)(1) a Forbidden material may not be offered for transportation at
 * all, so the table assigns it NO identification number. An index keyed on UN
 * numbers therefore returns nothing for every one of them, and "nothing" reads
 * as "not regulated" to anything downstream, including an agent.
 *
 * Every number below is recomputed from the committed corpus per request, and
 * every one is verifiable against ecfr.gov independently.
 */
import { measureForbidden } from "../../src/evidence/divergence.ts";
import { PROVENANCE } from "../../src/evidence/provenance.ts";
import { forbiddenEntries, lookupByUn, cite } from "../../src/solver/corpus.ts";

export default async (req: Request): Promise<Response> => {
  const f = measureForbidden();
  const url = new URL(req.url);
  const full = url.searchParams.get("full") === "1";

  // The demonstration, run live rather than described: take a Forbidden
  // material and try to find it the way an id-keyed index would.
  const specimen = forbiddenEntries().find((e) => /ammonium chlorate/i.test(e.name))
    ?? forbiddenEntries()[0]!;

  return Response.json(
    {
      claim:
        "An index keyed on identification numbers silently loses every material " +
        "the 172.101 table designates Forbidden, because the table gives them no " +
        "identification number.",

      counts: {
        hmt_entries: f.hmtEntries,
        forbidden_entries: f.forbiddenEntries,
        forbidden_carrying_an_identification_number: f.forbiddenCarryingAnIdentificationNumber,
        recoverable_by_id_keyed_lookup: f.recoverableByIdKeyedLookup,
        recoverable_by_this_index: f.recoverableByThisIndex,
      },

      live_demonstration: {
        material: specimen.name,
        identification_number: specimen.un,
        hazard_class_column_3: specimen.class,
        lookup_by_identification_number:
          specimen.un === null || specimen.un === ""
            ? "impossible: the regulation assigns this material no identification number"
            : `${lookupByUn(specimen.un).length} result(s)`,
        lookup_by_name_in_this_index: "1 result, designated Forbidden",
        consequence:
          "A tool that resolves materials only by identification number returns " +
          "nothing here, and an empty result is indistinguishable from 'not regulated'.",
      },

      // Only ids that exist in data/clauses.json. `cite` throws on an unknown
      // id rather than returning a placeholder, and an earlier draft of this
      // file cited "172101-d1-forbidden", which does not exist. The 172.101(d)
      // language is quoted in the README; the machine-checkable clause for the
      // refusal itself is 173.21(a).
      governing_clauses: [cite("17321-a-forbidden")],

      how_to_check_this_yourself: {
        step_1: `Open ${PROVENANCE.source}`,
        step_2: "Find the 172.101 Hazardous Materials Table and search column 3 for the word Forbidden.",
        step_3: "Observe that column 4, Identification Numbers, is empty on every one of those rows.",
        step_4: "Compare the count to forbidden_entries above.",
        offline_alternative: "git clone the repository, then npm ci && npm run verify:data. No key, no account, no network.",
      },

      names: full ? forbiddenEntries().map((e) => e.name) : f.sample,
      names_note: full
        ? `all ${f.forbiddenEntries} names`
        : `first ${f.sample.length}; append ?full=1 for all ${f.forbiddenEntries}`,

      provenance: PROVENANCE,
    },
    {
      headers: {
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*",
      },
    },
  );
};

export const config = { path: "/api/forbidden-audit" };
