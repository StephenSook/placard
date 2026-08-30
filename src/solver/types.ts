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
  /**
   * UN, NA or ID number. Optional and nullable, because a Forbidden material
   * has none at all: under 172.101(d)(1) it may not be offered for transport,
   * so the table assigns it no identification number. A caller may therefore
   * identify an item by name alone, and must be able to.
   */
  id?: string | null;
  /** Proper shipping name, used when there is no id. */
  name?: string;
  /** Operator-supplied. 177.848(d) covers Class 8 LIQUIDS only, so this matters. */
  state?: PhysicalState;
  quantity?: string;
  /**
   * Operator-supplied packing group, used ONLY to disambiguate an
   * identification number that spans several hazard classes. UN1950 covers five
   * entries across Divisions 2.1 and 2.2, and the class decides the segregation
   * verdict, so a number alone is not always enough to identify a material.
   */
  packingGroup?: string | null;
  /**
   * Operator-supplied inhalation hazard zone, used ONLY to disambiguate an
   * identification number whose rows are otherwise identical. UN1744 lists two
   * "Bromine solutions" rows at Class 8 PG I with the same labels, separated
   * only by special provision 1 against 2, which is Hazard Zone A against Zone
   * B. 6.1 PG I Zone A has its own row in the 177.848(d) table and Zone B does
   * not, so the zone decides the verdict. Without this field that reference is
   * underdetermined and refuses; with it the operator says which one is on the
   * dock.
   */
  pihZone?: PihZone | null;
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
  /**
   * True when the label string could not be PARSED at all, as opposed to being
   * a class the 177.848(d) table genuinely does not cover.
   *
   * The distinction is the whole point. "6.2 has no row" and "I do not
   * understand this string" were both reported as "no restriction arises from
   * the table", so a corrupt label read as a clean bill of health. UN3535's
   * column 6 reads "6.1. 4.1" with a stray period and UN3101's reads "1" with
   * no division; both produced a material with NO matrix keys that passed
   * against everything, including a Division 1.1 explosive.
   */
  unparsed?: boolean;
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
    /** The line item did not resolve against the 172.101 table at all. This is
     *  deliberately NOT reported as FORBIDDEN_MATERIAL: a material the table
     *  does not contain and a material the table forbids are different facts,
     *  and reporting a lookup failure as a federal prohibition is a lie in the
     *  safer direction, which is still a lie. */
    | "UNRESOLVED_MATERIAL"
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
  /**
   * The SECOND half of the 177.848(e)(3) exception, and it is not optional.
   *
   * The clause permits a truckload shipment by a single shipper only where it
   * is ALSO known that the mixture will not cause a fire or a dangerous
   * evolution of heat or gas. That is a fact about the chemistry, not about the
   * paperwork, and nothing in the 172.101 table decides it.
   *
   * It was previously treated as a note while the exception was granted on
   * singleShipper alone, which cleared sulfuric acid over calcium hypochlorite,
   * the exact pair this project uses to demonstrate the hard block. The signer
   * must now assert it explicitly or the exception does not apply.
   */
  nonReactionAsserted?: boolean;
};

export type LoadProposal = { vehicles: VehicleProposal[] };

export type Verdict =
  | { status: "PASS"; approvalToken: string; checked: number; notes: string[] }
  | { status: "REFUSED"; violations: Violation[]; checked: number; notes: string[] };
