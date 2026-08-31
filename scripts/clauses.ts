/**
 * Verbatim clause extraction.
 *
 * Every regulation string this app shows a human is a slice of the committed
 * eCFR XML taken by this file, never a sentence anyone retyped. That is what
 * makes the citation-integrity test meaningful: `npm run verify:data` asserts
 * each entry here still appears, byte for byte, in the pinned source.
 *
 * Anchors are literal substrings and each must match EXACTLY ONCE. A clause
 * that matches zero times or twice fails the build rather than silently
 * shifting to the wrong text when a future snapshot is pinned.
 *
 * Note the corpus contains an OCR-style typo in 177.848(e): "lnstructions",
 * with a lowercase L. We match the actual bytes and do not correct them.
 */

export type ClauseSpec = {
  id: string;
  section: string;
  /** Which pinned section file the text lives in. */
  slug: string;
  /** Literal substring where the quote begins. Must occur exactly once. */
  from: string;
  /** Literal substring where the quote ends, inclusive. Must occur exactly once after `from`. */
  to: string;
};

export const CLAUSES: ClauseSpec[] = [
  // ── 177.848(e), how to read the segregation table ──────────────────────────
  {
    id: "e1-blank", section: "49 CFR 177.848(e)(1)", slug: "177-848-segregation",
    from: "The absence of any hazard class",
    to: "indicates that no restrictions apply.",
  },
  {
    id: "e2-X", section: "49 CFR 177.848(e)(2)", slug: "177-848-segregation",
    from: 'The letter "X" in the table indicates that these materials may not be loaded',
    to: "during the course of transportation.",
  },
  {
    id: "e3-O", section: "49 CFR 177.848(e)(3)", slug: "177-848-segregation",
    from: 'The letter "O" in the table indicates',
    to: "commingling of hazardous materials would not occur.",
  },
  {
    // The money shot: a barrier does not rescue this pairing.
    id: "e3-corrosive-hard-block", section: "49 CFR 177.848(e)(3)", slug: "177-848-segregation",
    from: "Notwithstanding the methods of separation employed",
    to: "a dangerous evolution of heat or gas.",
  },
  {
    id: "e4-asterisk", section: "49 CFR 177.848(e)(4)", slug: "177-848-segregation",
    from: 'The "*" in the table indicates',
    to: "in paragraph (f) of this section.",
  },
  {
    id: "e5-note-A", section: "49 CFR 177.848(e)(5)", slug: "177-848-segregation",
    from: 'The note "A" in the second column',
    to: "unless otherwise prohibited by § 177.835(c).",
  },
  {
    id: "e6-subsidiary", section: "49 CFR 177.848(e)(6)", slug: "177-848-segregation",
    from: "When the § 172.101 table or § 172.402",
    to: "more restrictive than that required by the primary hazard.",
  },
  {
    id: "e6-same-class-carveout", section: "49 CFR 177.848(e)(6)", slug: "177-848-segregation",
    from: "However, hazardous materials of the same class",
    to: "reacting dangerously with each other",
  },

  // ── 177.848(c), narrative overrides STRICTER than the table ────────────────
  {
    id: "c-cyanide-acid", section: "49 CFR 177.848(c)", slug: "177-848-segregation",
    from: "cyanides, cyanide mixtures or solutions",
    to: "would generate hydrogen cyanide;",
  },
  {
    id: "c-42-vs-8", section: "49 CFR 177.848(c)", slug: "177-848-segregation",
    from: "Division 4.2 materials may not be stored",
    to: "transported with Class 8 liquids;",
  },
  {
    id: "c-61pgI-zoneA", section: "49 CFR 177.848(c)", slug: "177-848-segregation",
    from: "Division 6.1 Packing Group I, Hazard Zone A material",
    to: "4.1, 4.2, 4.3, 5.1 or 5.2 materials.",
  },

  // ── 177.848(g), the Class 1 rewriting rules ────────────────────────────────
  {
    id: "g5-fireworks", section: "49 CFR 177.848(g)(v)", slug: "177-848-segregation",
    from: '"5" means Division 1.4S fireworks',
    to: "Division 1.1 or 1.2 (explosive) materials.",
  },
  {
    id: "g6-group-G", section: "49 CFR 177.848(g)(vi)", slug: "177-848-segregation",
    from: '"6" means explosive articles in compatibility group G',
    to: "carried in the same transport vehicle.",
  },
  {
    id: "h-lower-division", section: "49 CFR 177.848(h)", slug: "177-848-segregation",
    from: "explosives of the same compatibility group but of different divisions",
    to: "Division 1.1 being lower than Division 1.2).",
  },

  {
    id: "g1-blank", section: "49 CFR 177.848(g)(1)", slug: "177-848-segregation",
    from: "A blank space in the table indicates that no restrictions apply.",
    to: "A blank space in the table indicates that no restrictions apply.",
  },
  {
    id: "g2-X", section: "49 CFR 177.848(g)(2)", slug: "177-848-segregation",
    from: 'The letter "X" in the table indicates that explosives of different compatibility groups',
    to: "may not be carried on the same transport vehicle.",
  },
  {
    id: "g3i-group-L", section: "49 CFR 177.848(g)(3)(i)", slug: "177-848-segregation",
    from: '"1" means an explosive from compatibility group L',
    to: "with an identical explosive.",
  },
  {
    id: "g3ii-CDE", section: "49 CFR 177.848(g)(3)(ii)", slug: "177-848-segregation",
    from: '"2" means',
    to: "is assigned to compatibility group E.",
  },
  {
    id: "g3iii-CDE-N", section: "49 CFR 177.848(g)(3)(iii)", slug: "177-848-segregation",
    from: '"3" means',
    to: "is assigned to compatibility group D.",
  },

  {
    id: "g3iv-detonators", section: "49 CFR 177.848(g)(3)(iv)", slug: "177-848-segregation",
    from: '"4" means see § 177.835(g)',
    to: "when transporting detonators.",
  },

  // ── 173.21, forbidden materials ────────────────────────────────────────────
  {
    id: "17321-a-forbidden", section: "49 CFR 173.21(a)", slug: "173-21-forbidden",
    from: 'Materials that are designated "Forbidden"',
    to: "in Column 3 of the § 172.101 table.",
  },
  {
    id: "17321-e-packaging", section: "49 CFR 173.21(e)", slug: "173-21-forbidden",
    from: "A material in the same packaging, freight container, or overpack",
    to: "or to produce corrosive materials.",
  },

  // ── 172.102, the hazard zones the 2.3 rows depend on ───────────────────────
  {
    id: "sp1-zone-A", section: "49 CFR 172.102, special provision 1", slug: "172-102-special-provisions",
    from: "This material is poisonous by inhalation (see § 171.8 of this subchapter) in Hazard Zone A",
    to: "described as an inhalation hazard under the provisions of this subchapter.",
  },
  {
    id: "sp128-reclass", section: "49 CFR 172.102, special provision 128", slug: "172-102-special-provisions",
    from: "Regardless of the provisions of § 172.101(c)(12)",
    to: "required by this part for subsidiary hazards.",
  },
  // A SUBSIDIARY HAZARD THE 172.101 LABEL COLUMN DOES NOT CARRY. The type B
  // self-reactives (UN3221, UN3222, UN3231, UN3232) are listed class 4.1 with
  // labels showing only 4.1, and special provision 53 adds an EXPLOSIVE
  // subsidiary whose class and division come from an approval this tool cannot
  // read. Several Class 1 rows against Class 3 are X, so the division decides
  // the verdict and the corpus cannot supply it.
  {
    id: "sp53-explosive-subsidiary", section: "49 CFR 172.102, special provision 53", slug: "172-102-special-provisions",
    from: "Packages of these materials must bear the subsidiary risk label",
    to: "immediately following the primary hazard class in the shipping description",
  },

  // ── 173.52(b) table 1, what each compatibility group IS ────────────────────
  //
  // 172.101 has no article-or-substance column, and 177.848(g)(vi) grants its
  // permission to explosive ARTICLES in group G provided no explosive
  // SUBSTANCES ride in the same vehicle. Without a source for that distinction
  // the only signal was whether a proper shipping name happened to begin with
  // the word "Article", so "Cartridges for weapons, with bursting charge"
  // blocked a load it is entitled to join, on its spelling.
  //
  // 173.52(b) table 1 settles it for most groups by definition: B, E, F, H, J,
  // K and N are defined as articles and A as a substance. C, D, G, L and S are
  // defined as either, and there the corpus still cannot tell, which the
  // refusal now says in those words rather than implying the material is
  // suspect.
  {
    id: "17352-group-A", section: "49 CFR 173.52(b), table 1, compatibility group A", slug: "173-52-compatibility-groups",
    from: "Primary explosive substance",
    to: "1.1A",
  },
  {
    id: "17352-group-B", section: "49 CFR 173.52(b), table 1, compatibility group B", slug: "173-52-compatibility-groups",
    from: "Article containing a primary explosive substance and not containing",
    to: "1.4B",
  },
  {
    id: "17352-group-C", section: "49 CFR 173.52(b), table 1, compatibility group C", slug: "173-52-compatibility-groups",
    from: "Propellant explosive substance",
    to: "1.4C",
  },
  {
    id: "17352-group-D", section: "49 CFR 173.52(b), table 1, compatibility group D", slug: "173-52-compatibility-groups",
    from: "Secondary detonating explosive substance or black powder",
    to: "1.5D",
  },
  {
    id: "17352-group-E", section: "49 CFR 173.52(b), table 1, compatibility group E", slug: "173-52-compatibility-groups",
    from: "Article containing a secondary detonating explosive substance, without means of initiation, with a propelling charge",
    to: "1.4E",
  },
  {
    id: "17352-group-F", section: "49 CFR 173.52(b), table 1, compatibility group F", slug: "173-52-compatibility-groups",
    from: "Article containing a secondary detonating explosive substance with its means of initiation",
    to: "1.4F",
  },
  {
    id: "17352-group-G", section: "49 CFR 173.52(b), table 1, compatibility group G", slug: "173-52-compatibility-groups",
    from: "Pyrotechnic substance",
    to: "1.4G",
  },
  {
    id: "17352-group-H", section: "49 CFR 173.52(b), table 1, compatibility group H", slug: "173-52-compatibility-groups",
    from: "Article containing both an explosive substance and white phosphorus",
    to: "1.3H",
  },
  {
    id: "17352-group-J", section: "49 CFR 173.52(b), table 1, compatibility group J", slug: "173-52-compatibility-groups",
    from: "Article containing both an explosive substance and flammable liquid or gel",
    to: "1.3J",
  },
  {
    id: "17352-group-K", section: "49 CFR 173.52(b), table 1, compatibility group K", slug: "173-52-compatibility-groups",
    from: "Article containing both an explosive substance and a toxic chemical agent",
    to: "1.3K",
  },
  {
    id: "17352-group-L", section: "49 CFR 173.52(b), table 1, compatibility group L", slug: "173-52-compatibility-groups",
    from: "Explosive substance or article containing an explosive substance and presenting a special risk",
    to: "1.3L",
  },
  {
    id: "17352-group-N", section: "49 CFR 173.52(b), table 1, compatibility group N", slug: "173-52-compatibility-groups",
    from: "Articles predominantly containing extremely insensitive substances",
    to: "1.6N",
  },
  {
    id: "17352-group-S", section: "49 CFR 173.52(b), table 1, compatibility group S", slug: "173-52-compatibility-groups",
    from: "Substance or article so packed or designed",
    to: "1.4S",
  },

  // ── 172.202 and 172.204, what the shipping paper must say ─────────────────
  //
  // The exported document quoted both of these before either was pinned. The
  // certification wording on the paper was a paraphrase presented as what the
  // signer is taking on, and the video script's own source table claimed
  // data/clauses.json as its source for two sections the corpus did not
  // contain. A quote is where fabrication hides, so both are now sliced from
  // the pinned XML like every other clause and the document quotes the slice.
  {
    id: "172202-a-sequence", section: "49 CFR 172.202(a)", slug: "172-202-shipping-paper-description",
    from: "The shipping description of a hazardous material on the shipping paper must include:",
    to: "The packing group in Roman numerals, as designated for the hazardous material in Column (5) of the",
  },
  {
    id: "172204-a-general", section: "49 CFR 172.204(a)", slug: "172-204-shippers-certification",
    from: "each person who offers a hazardous material for transportation shall certify",
    to: "the certification contained in paragraph (a)(1) of this section",
  },
  {
    id: "172204-a1-certification", section: "49 CFR 172.204(a)(1)", slug: "172-204-shippers-certification",
    from: "This is to certify that the above-named materials are properly classified",
    to: "according to the applicable regulations of the Department of Transportation.",
  },
  {
    id: "172203-m-pih", section: "49 CFR 172.203(m)", slug: "172-203-additional-description",
    from: "Notwithstanding the hazard class to which a material is assigned, for materials that are poisonous by inhalation",
    to: "shall be entered on the shipping paper immediately following the shipping description.",
  },
];
