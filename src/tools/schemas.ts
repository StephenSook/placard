/**
 * Tool schemas and annotations, hoisted to module scope and frozen.
 *
 * THIS IS NOT STYLE. `use-webmcp-tool` compares `inputSchema` and
 * `annotations` by `JSON.stringify` to decide whether to re-register a tool.
 * An inline object literal is a new object on every render, so the hook would
 * tear down and re-register the tool on every state change, which churns the
 * agent's view of the page and defeats the point of a stable tool surface.
 * Its own source says so: "Key-order sensitive: {a, b} vs {b, a} re-registers
 * even though the objects are semantically identical, pass a stable literal."
 *
 * WebMCP has exactly TWO annotations, verified against the Draft Community
 * Group Report of 26 August 2026: `readOnlyHint` and `untrustedContentHint`.
 * `destructiveHint`, `idempotentHint` and `openWorldHint` belong to the
 * broader MCP annotation set and appear nowhere in the WebMCP spec, which is
 * why the first-party hook's types expose exactly two.
 *
 * Both are HINTS to the agent, not enforcement. That is precisely why the
 * solver is deterministic and non-LLM, and why the commit gate re-derives its
 * verdict inside execute rather than trusting anything the agent asserts.
 *
 * Every string field carries a maxLength. The spec lists "Restricting maximum
 * input lengths" as a mitigation against description and prompt-injection
 * attacks (section 6.4.1), and every argument here transits the model
 * provider, so the schemas are kept as narrow as the task allows (6.3.3,
 * privacy leakage through over-parameterization).
 */

/**
 * How a material is named in a tool call.
 *
 * NOT a UN-number pattern. A material designated Forbidden in column 3 of the
 * 172.101 table has NO identification number, because under 172.101(d)(1) it
 * may not be offered for transportation at all. A schema that required a UN
 * number would make the 256 most dangerous materials in the table
 * inexpressible to the agent, which is the same defect this project exists to
 * expose, reproduced one layer up.
 */
const MATERIAL_REF = {
  type: "string",
  minLength: 1,
  maxLength: 200,
  description:
    "An identification number such as UN1090, or a proper shipping name. Materials designated " +
    "Forbidden have no identification number and must be given by name.",
} as const;

export const READ_ONLY = Object.freeze({ readOnlyHint: true });
export const READ_ONLY_UNTRUSTED = Object.freeze({ readOnlyHint: true, untrustedContentHint: true });
/** The mutating tool. Omitting readOnlyHint is the signal; there is no
 *  destructiveHint in WebMCP to set. */
export const MUTATING = Object.freeze({ readOnlyHint: false });

export const LOOKUP_MATERIAL_SCHEMA = Object.freeze({
  type: "object",
  required: ["query"],
  additionalProperties: false,
  properties: {
    query: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description:
        "A proper shipping name, a common synonym, or an identification number such as UN1090. " +
        "Materials the table designates Forbidden have NO identification number, so search them by name.",
    },
  },
});

export const CLASSIFY_LINE_ITEM_SCHEMA = Object.freeze({
  type: "object",
  required: ["text"],
  additionalProperties: false,
  properties: {
    text: {
      type: "string",
      minLength: 1,
      maxLength: 500,
      description:
        "One line of a manifest as it was actually written, for example " +
        '"acetone waste, about 2L, from the Kim lab". Free text only, one item at a time.',
    },
  },
});

/** Shared shape for a proposed vehicle. Kept minimal on purpose. */
const VEHICLE_SCHEMA = Object.freeze({
  type: "object",
  required: ["items"],
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      minItems: 0,
      maxItems: 60,
      items: MATERIAL_REF,
      description: "The materials loaded in this vehicle, by identification number or proper shipping name.",
    },
    barriersPresent: {
      type: "boolean",
      description:
        "True ONLY if physical impediments, dividers, or packages of non-hazardous material " +
        "separate incompatible items so that commingling could not occur if a package leaked. " +
        "Air space alone does not satisfy this. Some pairings are prohibited regardless.",
    },
    singleShipper: {
      type: "boolean",
      description:
        "True only if this vehicle is a truckload shipment loaded by ONE shipper. Goods from " +
        "different shippers loaded together are not a truckload shipment.",
    },
  },
});

export const PROPOSE_LOAD_SCHEMA = Object.freeze({
  type: "object",
  required: ["items", "maxVehicles"],
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 60,
      items: MATERIAL_REF,
      description: "Every material to be shipped, by identification number or proper shipping name.",
    },
    maxVehicles: {
      type: "integer",
      minimum: 1,
      maximum: 20,
      description: "How many vehicles are available.",
    },
    barriersPresent: { type: "boolean", description: "Whether physical barriers will separate incompatible items." },
    singleShipper: { type: "boolean", description: "Whether one shipper is loading the whole shipment." },
  },
});

export const CHECK_SEGREGATION_SCHEMA = Object.freeze({
  type: "object",
  required: ["vehicles"],
  additionalProperties: false,
  properties: {
    vehicles: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: VEHICLE_SCHEMA,
      description: "The proposed arrangement, one entry per vehicle.",
    },
  },
});

export const COMMIT_MANIFEST_SCHEMA = Object.freeze({
  type: "object",
  required: ["approvalToken", "vehicles"],
  additionalProperties: false,
  properties: {
    approvalToken: {
      type: "string",
      pattern: "^[a-f0-9]{64}$",
      description:
        "The token check_segregation returned for THIS exact load. The token is bound to a hash " +
        "of the load, so it will not validate against any other arrangement.",
    },
    vehicles: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: VEHICLE_SCHEMA,
      description: "The exact arrangement to export. Must match the one the token was issued for.",
    },
  },
});

/**
 * Descriptions are what the agent reasons over, so they are written for a
 * model rather than for a developer: they say what the tool does, when to
 * reach for it, and what it will refuse.
 */
export const DESCRIPTIONS = Object.freeze({
  lookup_material:
    "Look up a hazardous material in the 49 CFR 172.101 Hazardous Materials Table by name, synonym " +
    "or identification number. Returns hazard class, packing group, label codes and special " +
    "provisions. Also returns materials the table designates Forbidden, which carry NO " +
    "identification number because they may not be offered for transportation at all.",

  classify_line_item:
    "Normalize one free-text manifest line into a candidate 49 CFR 172.101 entry. Use this when " +
    "the user pastes a line as it was actually written rather than an identification number. " +
    "Returns ranked candidates for a human to confirm; it does not decide.",

  propose_load:
    "Given the materials to ship and the vehicles available, compute an arrangement that satisfies " +
    "49 CFR 177.848. If no arrangement exists, returns the specific set of materials that conflict " +
    "with one another, so the refusal names items rather than saying no solution.",

  check_segregation:
    "Adjudicate a proposed arrangement against 49 CFR 177.848. Returns PASS with an approval token, " +
    "or REFUSED with the verbatim text of every governing regulation. Checks four independent " +
    "grounds: materials forbidden outright, the segregation table, the narrative prohibitions that " +
    "are stricter than the table, and the corrosive-over-oxidizer rule that no barrier satisfies.",

  commit_manifest:
    "Export the shipping paper for a load that has passed segregation review. Requires an approval " +
    "token issued by check_segregation for this exact arrangement. This tool is only present while " +
    "the current load passes; if the load changes it disappears, and it independently re-derives " +
    "the verdict from the exact contents being exported before writing anything.",
});
