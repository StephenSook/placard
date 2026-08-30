/**
 * WHICH CLAUSES THIS SOLVER ACTUALLY ENFORCES.
 *
 * The citation gate proves every quoted clause is a verbatim substring of the
 * pinned eCFR. It says nothing about whether the RULE exists in code, and for
 * the life of this project ten of twenty-four clauses were extracted, verified,
 * counted in the receipt printed to readers, and enforced by nothing. Two of
 * them were live prohibitions: sodium cyanide with sulfuric acid returned PASS
 * and exported a shipping paper, and so did 1.4S fireworks with 1.1G fireworks.
 *
 * A verbatim quote of a rule you do not apply is worse than no quote, because
 * it is evidence of diligence that is not there.
 *
 * So every clause in the corpus must be in exactly one of two states, and a
 * test asserts it: cited by a code path, or listed here with a REASON. Adding a
 * clause to the corpus without doing one or the other fails the build.
 */

/** Clauses deliberately NOT enforced, each with why. */
export const REFERENCE_ONLY: Record<string, string> = {
  "e1-blank":
    "A definition, not a rule. It states that a blank cell imposes no restriction, which is " +
    "the solver's behaviour by construction: a blank produces no violation. There is nothing " +
    "to enforce and nothing to cite.",

  "g1-blank":
    "The same definition for the 177.848(f) compatibility table.",

  "h-lower-division":
    "A PERMISSION with a consequence, not a prohibition. It allows explosives of one " +
    "compatibility group but different divisions to travel together provided the whole " +
    "shipment is handled as the lower division. Not implementing it makes this tool stricter " +
    "rather than more permissive, because those pairs are then judged by the matrix on their " +
    "own divisions. Quoted so a reader can see the allowance exists and that we do not grant it.",

  "17321-e-packaging":
    "A THIRD REFUSAL AXIS this tool does not implement. 173.21(e) operates at the package, " +
    "freight container and overpack level, below the vehicle level everything here works at. " +
    "Implementing it needs packaging data the 172.101 table does not carry. It is quoted, and " +
    "named as out of scope in the README and the writeup, so its absence is stated rather than " +
    "implied. This is the one orphan that represents a real gap in coverage.",
};

/**
 * Clauses enforced through a NOTE rather than a violation, because the
 * regulation makes them conditional on a judgement no table decides. They are
 * cited at the point the note is raised.
 */
export const ADVISORY: readonly string[] = [
  "e6-same-class-carveout",
  "g3iv-detonators",
];
