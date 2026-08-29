# Demo video script

Target **under 3:00** (challenge rules). Aiming 2:35 to 2:45 of speech.
Audio is REQUIRED: a silent screencast with music does not satisfy the rules.
AI text to speech is explicitly permitted.

**Every number below is traceable to FACTS.md.** Nothing may be spoken that is
not in that file. Checked before rendering, because a published video cannot be
edited and its spoken numbers are claims like any other.

| Figure spoken | FACTS.md row |
|---|---|
| 3,293 entries | Entries after resolving packing-group continuations |
| 256 Forbidden, none with a number | Entries designated Forbidden / Of those, how many carry a UN number |
| 18 by 18, 324 cells | The segregation matrix |
| 1,296 / 792 / 24 | The measured divergence |
| UN1830 class 8, UN1748 class 5.1 | The demo manifest, resolved from the corpus |

---

## 0:00 – 0:18  Cold open, no narration for the first 6 seconds

**On screen:** a messy manifest pasted in. The agent normalises it, puts
everything on one truck, and calls `check_segregation`. The Verdict Card stamps
**REFUSED** with 177.848(e)(3) quoted verbatim. The barriers box is ticked.

> (from 0:06) This load looks legal. The segregation table says these two may
> travel together if you separate them. The barrier is ticked. And the page
> still refuses, because a different clause of the same regulation blocks
> corrosive liquids over oxidizers no matter how you separate them.

## 0:18 – 0:40  Who this is for

**On screen:** the shipping paper's certification block, then the hazard rail.

> A shipping-compliance officer signs that certification. Under 49 CFR 172.204
> signing makes them personally responsible for the load being right. They are
> the one holding the pen, and 49 CFR 177.848 is an eighteen by eighteen matrix
> of three hundred and twenty four cells, plus an explosives table that rewrites
> itself as you load, plus narrative rules that are stricter than the matrix.

## 0:40 – 1:05  The measurement

**On screen:** `/api/measure` raw JSON in a browser tab.

> So how big is the gap? Across every ordered pair of the eighteen hazard
> categories, in every barrier configuration, one thousand two hundred and
> ninety six cases. The table alone clears seven hundred and ninety two of them.
> Of those, the full regulation forbids twenty four. That endpoint recomputes it
> on every request. No key, no account.

## 1:05 – 1:50  The loop, and the tool that does not exist

**On screen:** the tool registry strip. `commit_manifest` is ABSENT. The agent
re-proposes across two vehicles, the verdict flips to PASS, and
`commit_manifest` appears in the strip. The shipping paper exports.

> Here is the part that is about WebMCP. While the load fails, the commit tool
> is not registered. The agent cannot see it, so it cannot call it. Watch the
> registry when the verdict flips.
>
> And that visible change is the interface, not the security. Any same-origin
> script could register a tool with the same name. So the commit handler
> independently re-derives the verdict from a hash of the exact bytes it is
> about to export, and refuses on any mismatch. A test calls that handler
> directly on a failing load, which is what an impostor tool would do, and it is
> still refused.

## 1:50 – 2:15  The material with no number

**On screen:** typing "ammonium chlorate", the lookup returning FORBIDDEN with
173.21(a) quoted, then `/api/forbidden-audit`.

> One more. Ammonium chlorate has no UN number at all. Not missing, not unknown.
> The regulation gives it none, because a Forbidden material may not be offered
> for transportation in the first place. Two hundred and fifty six entries are
> like that. Every one of them comes back empty from a lookup keyed on
> identification numbers, and empty reads as "not regulated".

## 2:15 – 2:40  Reproduce it

**On screen:** terminal running `npm run verify:data`, printing the receipt,
then the Lighthouse scores.

> Everything here is checkable. This re-hashes the corpus and proves all
> twenty four quoted clauses are verbatim substrings of a pinned eCFR snapshot,
> and it prints what it actually examined, so a gate that checked nothing cannot
> pass as one that works. Clone it, run two commands, no key.

## 2:40 – 2:50  Close

**On screen:** `/judge`.

> The regulation was always the specification. This just makes it the one thing
> the agent cannot argue with.

---

## Pre-render checklist, blocking

- [ ] Every spoken figure appears in FACTS.md
- [ ] Duration under 180 s, measured with ffprobe on the rendered file
- [ ] Integrated loudness between -16 and -14 LUFS, measured with ffmpeg ebur128
- [ ] 1920x1080, 30 fps
- [ ] No fictional persona named, no synthetic data on screen
- [ ] Footage is the real deployed product, not a mock
