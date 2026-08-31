# Hazmat load segregation, 49 CFR 177.848

Paste a chemical manifest and watch an agent load a truck legally: it proposes, the page shows
exactly which federal rule each pair breaks, and the shipping paper cannot be exported until the
load actually passes.

**Live:** https://segregation-console.vercel.app
**Check it in three minutes:** https://segregation-console.vercel.app/judge
**Component states:** https://segregation-console.vercel.app/states

WebMCP is enabled on that origin by a registered Chrome origin trial, so **no browser flag is
needed**. Open it in Chrome 149 or later and `document.modelContext` is live.

One honest warning: asking ChatGPT to *open* the URL uses its text crawler, which does not execute
page JavaScript and therefore reports no tools. It says so itself. If you look for the tool surface
there and find nothing, that is the crawler rather than the page.

---

## Two commands, no account, no API key

```bash
npm ci
npm run verify:data   # re-hash the corpus, prove every quoted clause is verbatim
npm test              # 14 test files. All 324 segregation cells and all 169
                      # compatibility cells exhaustively, plus property,
                      # metamorphic, fixed-point, adversarial and gate tests.
npm run test:e2e      # 3 files, through the REAL WebMCP runtime in a browser
```

`test:e2e` is the one worth running if you only run one. Chromium exposes
`document.modelContext` behind `--enable-features=WebMCP`, so the agent surface
is exercised for real rather than asserted at the source level: tool
registration, the anticorrelated gate below, the hash-bound commit, and the
refusal of an attestation sent as a tool argument. It also runs the phone
layout in WebKit, which is not decoration: a horizontal-overflow regression was
invisible in Chromium's phone emulation and 1286px wide in WebKit.

`verify:data` prints a receipt of what it actually checked, because a gate that passes having
examined nothing is indistinguishable from one that works:

```
PASS  checked 14 hashes, 42 verbatim clauses (9604 characters), 493 table cells, 3293 table entries
```

---

## Checkable without an account, a key, or running anything

The challenge rules say judges are not required to test the project. So every
claim here is checkable from a URL:

| Surface | What it answers |
|---|---|
| [`/judge`](https://segregation-console.vercel.app/judge) | A numbered three-minute itinerary. Each step states a claim, gives the one click that checks it, and names what would falsify it. |
| [`/api/measure`](https://segregation-console.vercel.app/api/measure) | The headline number, recomputed from the committed corpus per request. |
| [`/api/forbidden-audit`](https://segregation-console.vercel.app/api/forbidden-audit) | The 256 Forbidden entries, with the steps to verify the count against ecfr.gov yourself. |

### The headline number, and what it is not

Over every ordered pair of the 18 hazard categories the segregation table
indexes, in each barrier and truckload-carve-out configuration, **1,296
configurations** were examined. The table alone clears **792** of them. Of those,
the full regulation forbids **56**, on two grounds the table does not express:
177.848 explosive compatibility (48) and the 177.848(e)(3) corrosive-over-oxidizer
block (8).

That is a measurement of **the size of the gap an agent reasons across** when it
treats the table as the whole rule. It is **not** a benchmark of any model's
accuracy, and no language model was run to produce it. A model-versus-tool
comparison would need an API key this project does not have, would be
unreproducible for anyone without one, and would measure the model rather than
the regulation. This number measures the regulation, anyone can recompute it in a
second, and it cannot move unless 49 CFR moves.

The endpoint ships that caveat in its own response, under `honest_limits`, rather
than only in the README.

### Agent evaluations, no API key

Smoke mode executes the expected tool calls against the live page with no LLM:

```bash
# The load PASSES here, so commit_manifest exists and propose_load does not.
npx webmcp-evals smoke \
  -u "https://segregation-console.vercel.app/?load=UN1090&check=1" \
  -e evals/segregation.evals.json -v

# The load is REFUSED here, so propose_load exists and commit_manifest does not.
npx webmcp-evals smoke \
  -u "https://segregation-console.vercel.app/?load=UN1830,UN1748&check=1" \
  -e evals/segregation-refused.evals.json -v
```

5 of 5, then 2 of 2, both run against the live origin.

**There are two commands because there have to be.** The harness takes one URL
per run, and no single page state registers both gated tools any more. That is
not a workaround for the split, it is the anticorrelation proved by the harness
rather than described in prose: the same page, two states, and the tool set
differs in exactly the two positions the regulation controls.

Two things about the command are not obvious and cost me an hour, so they are
written down rather than left for you to discover:

- **It needs Google Chrome Canary.** The harness hardcodes that channel and
  exposes no flag to change it. `brew install --cask google-chrome@canary`.
- **The URL carries state on purpose.** Three of the five tools exist only in
  particular page states, which is the entire point of the project. Smoke mode
  opens a fresh page per case, so a bare URL registers two tools and most cases
  fail with "tool is not available".

It scored 2 of 6 the first time I actually ran it, on the single-file version of
these evals. Running a command you publish is not optional.


---

## What this is

A shipping-compliance officer has a pallet of chemicals and one truck. 49 CFR 177.848 says some of
those chemicals may not ride together. The rule is an 18 by 18 matrix whose cells are not binary,
plus an explosives compatibility table that **rewrites itself** as you load, plus narrative
prohibitions that are stricter than the matrix, plus a subsidiary-hazard rule that fires on 717 of
3,293 table entries.

The agent does what agents are good at: reading messy free text and searching the space of ways to
split a load across vehicles. The page does what agents are demonstrably unreliable at: applying
the regulation exactly. When it refuses, it quotes the governing clause word for word.

## Four independent grounds for refusal, and only one of them is the matrix

An agent reasoning from the segregation table alone clears loads that three of these forbid.

| Ground | Source |
|---|---|
| The material is Forbidden outright and has no identification number | `173.21(a)`, `172.101(d)(1)` |
| The 18 by 18 matrix, most restrictive across both hazard sets | `177.848(d)`, `(e)(6)` |
| Narrative prohibitions **stricter than** the matrix | `177.848(c)` |
| Corrosive over oxidizer, which no barrier rescues | `177.848(e)(3)` |

### The demonstration

**Sulfuric acid and calcium hypochlorite.** The table cell is `O`, which reads as "separate them
and they may travel together". Tick the barrier box and the page **still refuses**, because
177.848(e)(3) blocks Class 8 liquids above or adjacent to Class 4 or 5 materials notwithstanding
the methods of separation employed.

**Ammonium chlorate.** It has no UN number at all, because under 172.101(d)(1) a Forbidden material
may not be offered for transportation, so the table assigns it none. **256 entries are like this.**
Any index keyed on an identification number returns nothing for all 256, and nothing reads as "not
regulated". This corpus keeps them, and so does the tool surface: a material may be given to any
tool by name.

---

## The WebMCP surface

Five tools, all imperative and on the top-level document. ChatGPT's in-app browser supports neither
the declarative HTML form API nor tools registered inside iframes, so a declarative gate would be
invisible to it.

| Tool | Annotations | Present when |
|---|---|---|
| `lookup_material` | `readOnlyHint` | always, registered at mount |
| `classify_line_item` | `readOnlyHint`, `untrustedContentHint` | always, registered at mount |
| `propose_load` | `readOnlyHint` | **only while the load does not pass** |
| `check_segregation` | `readOnlyHint` | the manifest is non-empty |
| `commit_manifest` | mutating | **only while the load passes** |

Those last two are ANTICORRELATED, and exactly so: they are complements. With a
manifest loaded, precisely one of them is registered at any moment. A legal
split is meaningless for a load that already passes, so `propose_load` exists
exactly when `commit_manifest` does not, and the page hands the agent the one
capability the regulation currently permits while the other leaves in the same
instant.

The first version of that gate said `verdict === REFUSED`, and it was a dead
end worth reporting. The page's verdict is set by the OPERATOR pressing check.
An agent calling `check_segregation` gets its answer back but deliberately does
not move page state, which is what stops it talking `commit_manifest` into
existence for a load nobody adjudicated. Gating the remedy on REFUSED inherited
that: an agent with an unchecked manifest called `check_segregation`, was
refused, and found **both** gated tools absent with nothing to reach for. It
was reproduced, then fixed by gating on the exact complement instead, and there
is now an end-to-end test that fails if the dead end returns.

WebMCP defines exactly two annotations. `destructiveHint`, `idempotentHint` and `openWorldHint`
belong to the wider MCP set and appear nowhere in the WebMCP Draft Community Group Report, so they
appear nowhere here, and a test asserts it.

### The gate has three layers and only one of them is the boundary

- **Visible.** `commit_manifest` is absent from the agent's registry while the load does not pass,
  and `propose_load` is absent while it does. This is the UX and the thing you watch change, and
  it changes in two directions at once. It is **not** the security property: the WebMCP
  tool map is keyed by tool name, so any same-origin script can register over it, and the spec
  flags an unprotected unregister-then-reregister window.
- **Load-bearing.** `commit_manifest`'s handler re-derives the verdict from a SHA-256 of the exact
  contents it is about to export and refuses on any mismatch. A stale load, a mutated load and a
  same-named shadow tool are therefore all uncommittable regardless of registration order.
- **Structural.** A static single-origin site with zero third-party JavaScript and
  `script-src 'self'`, so no foreign script is running to register anything.

A test calls the commit handler **directly** on a failing load, which is exactly what a shadow tool
could do, and it is still refused.

---

## The corpus

Pinned to one eCFR snapshot, hash-manifested, and re-derivable:

```bash
npm run extract   # re-fetch and re-derive everything from the pinned date
npm run facts     # regenerate FACTS.md, the only figures this project may claim
```

| | |
|---|---:|
| eCFR snapshot | `2026-08-27` |
| Title 49 `latest_amended_on` | `2026-08-19` |
| 172.101 physical rows | 3,687 |
| Entries after resolving packing-group continuations | 3,293 |
| **Forbidden entries, none with an identification number** | **256** |
| Synonym pointer rows extracted from the table itself | 394 |
| Entries with a subsidiary hazard | 717 |
| 177.848(d) matrix | 18 by 18 = 324 cells |
| Census | X 104, O 44, \* 25, blank 151 |
| Verbatim clauses, each gate-checked as a substring of the source | 41 |

Clauses are sliced from the pinned XML by literal anchors, and an anchor that matches zero or two
times **fails the build** rather than shipping a confident quote of the wrong sentence.

---

## Legal

49 CFR is a work of the United States Government and is not subject to copyright under 17 U.S.C.
105. This project is **not** the official Code of Federal Regulations, is **not** legal advice, and
uses no NARA seal or CFR logo. The eCFR is an editorial compilation; only GPO's own PDF and text
versions have legal status. The person who signs the shipper certification retains responsibility
under 49 CFR 172.204. No IMDG Code content and no standard incorporated by reference under
49 CFR 171.7 is included. See `NOTICE` and `data/PROVENANCE.md`.

Licensed under Apache-2.0. See `LICENSE`.
