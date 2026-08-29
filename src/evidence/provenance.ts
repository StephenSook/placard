/**
 * Provenance, imported from the generated record rather than typed by hand.
 *
 * These dates appear on judge-facing surfaces and in a public API response, so
 * they are exactly the class of figure that must never be transcribed from
 * memory into a constant. data/provenance.json is derived from
 * data/PROVENANCE.md by `npm run provenance`, and a test asserts the two still
 * agree, so a stale date cannot reach a reader without failing the build.
 *
 * A plain JSON import rather than a Vite `?raw` import, because this module is
 * also bundled into a Netlify function by esbuild, which does not understand
 * Vite's query suffixes.
 */
import provenanceJson from "../../data/provenance.json" with { type: "json" };

export const PROVENANCE = {
  ecfr_snapshot: provenanceJson.ecfr_snapshot,
  title_49_latest_amended_on: provenanceJson.title_49_latest_amended_on,
  title_49_up_to_date_as_of: provenanceJson.title_49_up_to_date_as_of,
  source: provenanceJson.endpoint,
  legal_status:
    "The eCFR is an editorial compilation and is not the official legal edition " +
    "of the CFR. 49 CFR is a work of the United States Government, not subject " +
    "to copyright under 17 U.S.C. 105. This is not legal advice.",
} as const;
