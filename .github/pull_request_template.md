## What this changes

<!-- One or two sentences. -->

## Why

<!-- If this changes a regulatory conclusion, cite the clause and say where it
     lives in the corpus. A change to what the machine refuses needs a source,
     not an argument. -->

## Checks

- [ ] `npm run typecheck`
- [ ] `npm run verify:data` passes and its receipt shows a non-zero count
- [ ] `npm test`
- [ ] `npm run build`

## If this touches the corpus or a quoted clause

- [ ] Re-derived with `npm run extract` from the pinned snapshot rather than edited by hand
- [ ] `data/SHA256SUMS` regenerated and staged
- [ ] Every quoted clause is still a verbatim substring of the source
- [ ] `FACTS.md` regenerated if any claimable figure moved

## If this touches the tool surface

- [ ] Annotations are still only `readOnlyHint` and `untrustedContentHint`
- [ ] `commit_manifest` is still absent from the registry while the load does not pass
- [ ] The commit handler still refuses a failing load when called directly
