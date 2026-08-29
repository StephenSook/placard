/** Domain types for the 49 CFR 177.848 load-segregation solver. */

/** A cell code in the 177.848(d) table, verbatim from 177.848(e). */
export type CellCode = "" | "X" | "O" | "*";

/** One of the 18 rows/columns of the 177.848(d) table. */
export type MatrixKey =
  | "1.1 and 1.2" | "1.3" | "1.4" | "1.5" | "1.6"
  | "2.1" | "2.2" | "2.3 zone A" | "2.3 zone B"
  | "3" | "4.1" | "4.2" | "4.3" | "5.1" | "5.2"
  | "6.1 zone A" | "7" | "8";

/** Poison-inhalation-hazard zone, from special provisions 1-4 (49 CFR 172.102). */
export type PihZone = "A" | "B" | "C" | "D";

/** Explosive compatibility group, the letter in a Class 1 division like "1.1D". */
export type CompatibilityGroup =
  "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "J" | "K" | "L" | "N" | "S";

/** Physical state, which 177.848(d) needs because two of its rows say "liquids". */
export type PhysicalState = "liquid" | "solid" | "gas" | "unknown";

/** A line item as the operator or the agent supplies it. */
export type LineItem = {
  /** UN, NA or ID number. Null for a Forbidden material, which has none. */
  id: string | null;
  /** Proper shipping name, used when there is no id. */
  name?: string;
  /** Operator-supplied. 177.848(d) covers Class 8 LIQUIDS only, so this matters. */
  state?: PhysicalState;
  quantity?: string;
};

/** A material after resolution against the corpus. */
export type ResolvedItem = {
  item: LineItem;
  name: string;
  /** Column 3. The literal string "Forbidden" is a real value here. */
  hazardClass: string;
  packingGroup: string | null;
  /** Primary plus every subsidiary implied by the column 6 label codes. */
  hazards: Hazard[];
  specialProvisions: string[];
  pihZone: PihZone | null;
  state: PhysicalState;
  forbidden: boolean;
  /** Symbol A or W: regulated only by air or vessel, so outside Part 177. */
  outsidePart177: boolean;
  /** Column 7 codes that can change class, PG or subsidiary hazard. */
  specialProvisionReview: string[];
};

/** One hazard a material presents, primary or subsidiary. */
export type Hazard = {
  /** As written in the table, e.g. "3", "1.1D", "6.1". */
  raw: string;
  /** The 177.848(d) key, or null when the table does not cover this hazard. */
  matrixKey: MatrixKey | null;
  /** Why there is no matrix key, when there is none. */
  notCoveredReason?: string;
  compatibilityGroup: CompatibilityGroup | null;
  subsidiary: boolean;
};

/** A quoted piece of regulation. Every string here is a verbatim substring
 *  of the committed corpus, which `npm run verify:data` proves. */
export type Citation = {
  /** e.g. "49 CFR 177.848(e)(3)". */
  section: string;
  /** Verbatim text. Never paraphrased. */
  text: string;
};

export type Violation = {
  code:
    | "FORBIDDEN_MATERIAL"
    | "PROHIBITED_TOGETHER"
    | "SEPARATION_REQUIRED"
    | "CORROSIVE_OVER_OXIDIZER"
    | "EXPLOSIVE_INCOMPATIBLE"
    | "PACKAGE_INCOMPATIBLE";
  /** Indices into the vehicle's item list. One entry for a unary violation. */
  items: number[];
  vehicle: number;
  cell?: CellCode;
  message: string;
  citations: Citation[];
};

export type VehicleProposal = {
  items: LineItem[];
  /** True only when physical impediments separate incompatible items.
   *  Air space alone does not satisfy this (PHMSA interpretation 03-0300). */
  barriersPresent?: boolean;
  /** A "truckload" is loaded by ONE shipper (PHMSA interpretation 04-0031). */
  singleShipper?: boolean;
};

export type LoadProposal = { vehicles: VehicleProposal[] };

export type Verdict =
  | { status: "PASS"; approvalToken: string; checked: number; notes: string[] }
  | { status: "REFUSED"; violations: Violation[]; checked: number; notes: string[] };
