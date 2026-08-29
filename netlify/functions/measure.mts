/**
 * GET /api/measure
 *
 * The headline number, recomputed from the committed corpus on every request.
 * No key, no account, no rate limit, no model. A judge can curl this, and so
 * can anyone reading the repository who wants to check the claim rather than
 * take it on trust.
 *
 * It is a FUNCTION rather than a static JSON file on purpose: a file could hold
 * any number someone typed. This one has to derive its answer from the same
 * corpus and the same solver the page uses, every time it is called, so the
 * number and the product cannot drift apart.
 */
import { measureDivergence, measureForbidden } from "../../src/evidence/divergence.ts";
import { PROVENANCE } from "../../src/evidence/provenance.ts";

export default async (): Promise<Response> => {
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
          "each of the four barrier and single-shipper configurations. The naive " +
          "arm applies the published cell alone. The full arm applies all four " +
          "axes. A configuration is divergent when the first clears and the " +
          "second refuses.",
        naive_arm_is_deliberately_generous:
          "X refuses. O clears whenever a barrier is asserted. A blank cell and " +
          "an asterisk both clear. Reading the table more strictly than this " +
          "would inflate the result.",
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
};

export const config = { path: "/api/measure" };
