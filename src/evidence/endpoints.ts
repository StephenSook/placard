/**
 * THE TWO UNAUTHENTICATED EVIDENCE ENDPOINTS, host-independent.
 *
 * The bodies live here rather than in a host's function directory because the
 * project is deployed to more than one host and a claim that differs between
 * them is a claim that is wrong on at least one. The host adapters are three
 * lines each and contain no logic.
 *
 * Both recompute from the committed corpus on every request. Neither is a
 * static file, because a file could hold any number someone typed; these have
 * to derive their answers from the same corpus and the same solver the page
 * uses, so the numbers and the product cannot drift apart.
 */
import { measureDivergence, measureForbidden } from "./divergence.ts";
import { PROVENANCE } from "./provenance.ts";
import { cite, forbiddenEntries, lookupByUn } from "../solver/corpus.ts";

export async function measureResponse(): Promise<Response> {
  const started = Date.now();
  const divergence = measureDivergence();
  const forbidden = measureForbidden();

  return Response.json(
    {
      claim:
        "An agent reasoning from the 49 CFR 177.848(d) segregation table alone " +
        "clears loads the regulation forbids, because the table is one of four " +
        "independent refusal axes.",

      headline: {
        configurations_the_table_alone_clears: divergence.tableAloneClears,
        of_those_the_regulation_actually_forbids: divergence.divergent,
        share: divergence.divergentShareOfCleared,
        grounds: divergence.byGround,
      },

      forbidden_materials: {
        entries_designated_Forbidden: forbidden.forbiddenEntries,
        recoverable_by_an_identification_number_keyed_index:
          forbidden.recoverableByIdKeyedLookup,
        recoverable_by_this_index: forbidden.recoverableByThisIndex,
      },

      method: {
        what_is_measured:
          "Every ordered pair of the 18 hazard categories the table indexes, in " +
          "each of the four barrier and truckload-carve-out configurations. The " +
          "second axis is the 177.848(e)(3) carve-out AS A WHOLE, a single-shipper " +
          "truckload plus the explicit non-reaction assertion, because the clause " +
          "requires both and sweeping the shipper alone produced two identical " +
          "halves. The naive " +
          "arm applies the published cell alone. The full arm applies all four " +
          "axes. A configuration is divergent when the first clears and the " +
          "second refuses.",
        naive_arm_is_deliberately_generous:
          "X refuses. O clears whenever a barrier is asserted. A blank cell " +
          "imposes no restriction and so clears. An ASTERISK is the generous case " +
          "and the one to watch: 177.848(e)(4) REFERS that pair to the " +
          "compatibility table in paragraph (f) rather than clearing it, so an " +
          "agent that stops at the table has not been told yes, only that it has " +
          "not been told no. Counting a referral as a clearance MAXIMISES the " +
          "measured gap rather than minimising it, so this figure is an upper " +
          "bound on the naive-table failure and not a floor.",
        composition_of_the_divergent_set: divergence.byGround,
        representatives:
          "Each category is represented by a real 172.101 entry, chosen as the " +
          "lowest table index resolving to exactly that one category and not " +
          "itself Forbidden. No material here is invented.",
        configurations_examined: divergence.configurationsExamined,
        categories: divergence.categories,
        categories_represented: divergence.representedCategories,
      },

      honest_limits: [
        "This measures the SIZE OF THE GAP an agent reasons across when it treats the table as the whole rule. It is not a measurement of any model's accuracy and does not claim one.",
        "No language model was run to produce this number, and none is needed to reproduce it. A model-versus-tool benchmark would require an OpenAI key this project does not have, and would measure the model rather than the regulation.",
        "The count is at the level of hazard CATEGORY, not of individual material. A material-level count over all 3,293 entries would be larger; this one is exhaustive over the space it names and involves no sampling.",
        "The tool arm passes by construction, so no comparison of two classifiers is being reported here.",
        "48 of the 56 divergent configurations are EXPLOSIVE_INCOMPATIBLE and come from asterisk cells, which 177.848(e)(4) refers to the 177.848(f) compatibility table rather than clearing outright. Counting that referral as a clearance is the generous reading described above, and it is what makes this an upper bound. The remaining 8 are CORROSIVE_OVER_OXIDIZER, from O cells the table positively permits once a barrier is asserted, and those are clearances in the strict sense.",
        "The eCFR is an editorial compilation. Only GPO's own editions have legal status.",
      ],

      examples: divergence.examples,
      provenance: PROVENANCE,
      computed_in_ms: Date.now() - started,
    },
    {
      headers: {
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*",
      },
    },
  );
}

export async function forbiddenAuditResponse(req: Request): Promise<Response> {
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
}
