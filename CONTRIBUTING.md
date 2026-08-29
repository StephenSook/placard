# Contributing

## Run everything first

```bash
npm ci
npm run verify:data   # corpus hashes and verbatim-clause integrity
npm test
npm run build
```

No account and no API key is needed for any of that. If `verify:data` fails on a
clean checkout, that is a bug and worth an issue on its own.

## The one rule that matters

**A change to what the machine refuses needs a source, not an argument.**

Every regulatory conclusion in this repository traces to a clause sliced out of
a pinned eCFR snapshot by a literal anchor, and a gate asserts that every quoted
clause is a verbatim substring of the committed corpus. So:

- Do not hand-edit anything in `data/`. Change `scripts/extract.ts` or
  `scripts/clauses.ts` and re-derive with `npm run extract`.
- Do not add a figure to a document, a comment, an error message or a test
  unless you can say which page of the regulation it is on. A number in a test
  assertion is the worst place for an unverified figure, because the suite then
  defends it: correcting the code fails CI and reads as a regression.
- An anchor that matches zero times or twice must fail the build. Do not relax
  an anchor to make it match. Find the sentence.

## Style

- Comments explain **why**, especially why an obvious simpler thing is wrong.
  Several comments in this repository exist because the simpler version was
  written first and was subtly incorrect.
- No em dashes in prose. Use a period, a colon, a comma or parentheses.
- Prefer a justification that states what you KNOW ("this is not verified") over
  one that states a mechanism you assume, because the first stays true when the
  evidence changes.

## Tests

New solver behaviour needs a test that FAILS without the change. Verify that by
reverting the change and watching it go red, not by assuming. Several tests here
were written, passed, and were then found to be vacuous under mutation.

If you touch the segregation logic, the bar is a mutation check: change the
predicate, confirm a test catches it, change it back.

## Commits

One logical change each. Stage named paths rather than `git add -A`, and verify
what the commit CONTAINS rather than that the command succeeded.
