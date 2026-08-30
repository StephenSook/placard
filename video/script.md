# Placard, demo film script

Target 165 to 175 seconds. Devpost caps the video at 3 minutes and requires audio.

**Every number spoken below is drawn from FACTS.md, which is generated from the
committed 49 CFR corpus by `npm run facts`.** Nothing here may be sourced from
memory. The claims guard in `tests/claims.test.ts` parses this file and fails the
build if a figure drifts from the fact sheet, including the ones spelled out in
words, because a rendered video cannot be corrected.

Voice: ElevenLabs `3TStB8f3X3To0Uj5R7RK`. No em-dashes anywhere, including captions.

## Structure

Hook on execution, never on a title card. The film opens mid-refusal. The
real-time execution window is beats 5 to 8, one continuous uncut take.

| # | Beat | ~s | Picture |
|---|---|---|---|
| 1 | The refusal, cold open | 12 | Live capture: verdict card stamps REFUSED with the clause |
| 2 | Who signs | 14 | Built scene: 172.204 certification, the pen |
| 3 | How many | 13 | Built scene: 20,460 counting up, Census attribution |
| 4 | The gap, measured | 16 | Built scene: 792 bar, 56 highlighted, live API card |
| 5 | Agent proposes | 14 | LIVE TAKE begins, uncut |
| 6 | The page refuses, verbatim | 16 | LIVE TAKE, clause quoted on screen |
| 7 | Barrier does not rescue it | 15 | LIVE TAKE, operator ticks the box, still refused |
| 8 | Split, pass, export | 20 | LIVE TAKE ends: commit_manifest appears, paper exports |
| 9 | The 256 with no placard | 17 | Live capture: ammonium chlorate, no ID number |
| 10 | Capability as state | 18 | Built scene: registry strip, the two anticorrelated tools |
| 11 | Close, one action | 12 | End card: the live URL, repo, 3D placard settles |

## Narration

**1. Cold open, on the refusal.**
> This load is legal according to the federal segregation table. Watch it get
> refused anyway. Sulfuric acid, calcium hypochlorite, one truck. The table says
> separate them and they may travel. The page says no, and quotes the line.

**2. Who signs.**
> Somebody signs for that. Under 49 CFR 172.204 the person who signs the shipper
> certification becomes personally responsible for the load being right. Not the
> software. The person holding the pen.

**3. How many.**
> There are 20,460 of them. That is how many US establishments shipped hazardous
> materials in DOT regulated packaging in 2022, counted by the Census Bureau in a
> survey PHMSA paid for specifically to find out.

**4. The gap, measured.**
> Ask an agent to load that truck and it reads the segregation table, because the
> table is the thing that looks like the answer. Across every ordered pair of the
> 18 hazard categories, the table alone clears 792 configurations. Of those, the
> full regulation forbids fifty six. That endpoint recomputes it on every request.

**5. Agent proposes. LIVE TAKE STARTS HERE, NO CUTS UNTIL BEAT 8 ENDS.**
> So the agent does the part agents are good at. It reads the manifest, resolves
> the names, and proposes an arrangement. Nothing here is staged. This is the
> deployed page, running now.

**6. The page refuses, and quotes the clause.**
> And the page does the part agents are unreliable at. It refuses, it names the
> two materials, and it quotes 177.848(e)(3) word for word from a pinned eCFR
> snapshot. Not a paraphrase. The sentence.

**7. The barrier does not rescue it.**
> Tick the barrier box, the one an operator ticks when there really are dividers
> in the truck, and it still refuses. That clause blocks Class 8 liquids above or
> adjacent to Class 5 materials notwithstanding the methods of separation
> employed. No separation reaches it.

**8. Split, pass, export.**
> Two vehicles. Now it passes, and only now does the export tool exist. The
> shipping paper comes out in the basic description sequence 172.202 requires,
> with the certification printed on it rather than buried.

**9. The 256 with no placard.**
> Ammonium chlorate has no identification number. Not missing data: a Forbidden
> material may not be offered for transportation at all, so the table gives it
> none. 256 entries are like this. Ask a UN keyed index for any of them and you
> get nothing back, and nothing reads as not regulated.

**10. Capability as state.**
> This is why the surface is WebMCP. Tools register against a live document, so
> the agent's toolset is a function of page state. Propose exists only while the
> load fails. Export exists only while it passes. They are never both there. The
> agent cannot choose the unsafe action, because from where it stands the action
> does not exist.

**11. Close, one action.**
> Open it yourself. No account, no key, no browser flag.

## On-screen close card

- segregation-console.vercel.app
- github.com/StephenSook/placard
- Apache 2.0, corpus pinned to the eCFR snapshot of 2026-08-27

One action, stated once: open the live URL. No second or third call to action.

## Facts this script asserts

| Spoken | Value | Source |
|---|---:|---|
| hazard categories | 18 | FACTS.md |
| table alone clears | 792 | FACTS.md |
| full regulation forbids | 56 (spoken "fifty six") | FACTS.md |
| Forbidden entries with no identification number | 256 | FACTS.md, /api/forbidden-audit |
| US establishments shipping hazmat, 2022 | 20,460 | Census 2022 CFS, Expanded Hazmat Supplement |
| clause quoted | 177.848(e)(3) | data/clauses.json, gate-checked verbatim |
| basic description sequence | 172.202(a) | data/clauses.json, gate-checked verbatim |
| signer responsibility | 172.204(a) | data/clauses.json, gate-checked verbatim |

Two of those rows were false when this table was written. 172.202 and 172.204
were not in the corpus, so the sources column claimed a file that did not
contain them, while the shipping paper printed a PARAPHRASE of the
certification and the film's second beat said the signer "becomes a hazmat
employee under subpart H", which cites the training subpart for a definition
that lives in 171.8. Both sections are now pinned at the same snapshot, the
paper quotes 172.204(a)(1) verbatim, and the beat says only what 172.204(a)
itself says. A source table is a claim like any other.
| corpus snapshot | 2026-08-27 | data/PROVENANCE.md |
