## Try it before you read anything

https://segregation-console.vercel.app

No account, no key, no login. WebMCP is enabled on that origin by a registered
Chrome origin trial, so there is no browser flag to set either. **Open it in
Chrome 149 or later** and `document.modelContext` is live.

One practical note so you do not lose a minute, because the harness matters
here. WebMCP is supported in the ChatGPT desktop app's built-in browser and in
Chrome 149 or later, and this project is verified in both. It is not available
in ChatGPT Work, on Luna, on mobile, or
through the plain browse tool, which is served by a text crawler that runs no
page JavaScript and so reports no tools. In Chrome the surface is live, and the
agent's-eye panel prints the real `getTools()` result so you can check it rather
than take my word.

The page opens on a number it recomputes while you are looking at it:

**Across every ordered pair of the 18 hazard categories in the federal
segregation table, in every barrier configuration, 1,296 cases. The table alone
clears 792 of them. Of those, the full regulation forbids 56.**

`/api/measure` runs the real solver on every request and returns all of it,
including the examples and the composition of that 56, so you can check the
arithmetic rather than take my word for it. Nothing there is cached and nothing
there needs a key.

```
curl -s https://segregation-console.vercel.app/api/measure
curl -s https://segregation-console.vercel.app/api/forbidden-audit
```

A numbered three-minute walk of every live surface, with what would falsify each
claim: https://segregation-console.vercel.app/judge

Then paste the demo manifest and press check. An agent proposes a load, the page
refuses it, and quotes the clause that says why.

## The problem, and who has it

A shipping-compliance officer has a pallet of chemicals and one truck. 49 CFR
177.848 says some of those chemicals may not ride together.

That rule is not a list. It is an 18 by 18 matrix of 324 cells whose values are
not yes and no. 104 cells prohibit. 44 permit only with separation. 25 hand you
off to a different table entirely, one that rewrites itself as you load, because
explosive compatibility groups combine into new groups. 151 are blank, and blank
means no restriction rather than not checked.

Sitting on top of that are narrative prohibitions in 177.848(c) that are
stricter than the matrix, and a rule in 177.848(e)(3) that no amount of
separation rescues. Underneath it is the 172.101 table, 3,293 entries, of which
717 carry a subsidiary hazard that changes which row you are even reading.

Then the officer signs. Under 49 CFR 172.204, each person who offers a hazardous
material for transportation certifies that it is offered in accordance with the
subchapter. The certification is on the person, not on the software. They are
the one holding the pen.

## How many people this is

**20,460.** That is how many US establishments shipped hazardous materials in
DOT-regulated packaging in 2022. The number is not an estimate I made. PHMSA
paid the Census Bureau to add hazmat questions to the 2022 Commodity Flow
Survey specifically to find this out, and the result is published as the
Expanded Hazmat Supplement, Table 1.

14,450 of those establishments ship between one and four distinct materials.
The other six thousand ship five or more out of a single location, and that is
where segregation stops being an occasional question and becomes a daily one,
because you need two incompatible materials and one truck before any of this
matters at all.

The single most frequently shipped entry in that survey is UN1993, flammable
liquids not otherwise specified, shipped by 2,617 establishments. UN1760,
corrosive liquids not otherwise specified, is shipped by 1,619. A Class 8
corrosive is one half of the refusal in the first screenshot on this page, and
the other half is a Class 5.1 oxidizer. Neither is exotic. This is ordinary
freight.

Source: U.S. Census Bureau, 2022 Commodity Flow Survey, Expanded Hazardous
Materials Supplement, Tables 1 and 2, published by PHMSA at
phmsa.dot.gov/hazmat-program-management-data-and-statistics/hazardous-material-commodity-flow-statistics

Ask an agent to do this and it will read the segregation table, because the
segregation table is the thing that looks like the answer. That is the failure I
built this to make visible.

## Why it is called Placard

The hazard placard is the most recognisable object in this whole domain. The
diamond on the side of the truck is how a firefighter arriving at a wreck knows
what is burning.

256 entries in the 172.101 table do not have one, and cannot.

## The thing that should worry you

256 entries in the 172.101 table are designated Forbidden.

Not one of them has an identification number. That is not missing data. Under
172.101(d)(1) a Forbidden material may not be offered for transportation at all,
so the regulation declines to assign it a number.

Every tool I have seen that resolves chemicals does it by UN number. Ask any of
them for ammonium chlorate and you get nothing back. Nothing back is
indistinguishable from not regulated.

I found this because my own first parser had the bug. It filtered the table on a
`^(UN|NA|ID)\d{4}$` pattern and silently deleted the 256 most dangerous rows in
the corpus, and the extraction still looked fine, because 3,003 rows came
through and nobody counts. The fix is in the repository history. The audit
endpoint exists so you can confirm the count against ecfr.gov yourself.

## What the officer actually gets

A verdict, and the clause that produced it, quoted word for word from a pinned
eCFR snapshot rather than paraphrased.

When it refuses, it names the two specific items and the specific ground. Not
"segregation conflict". Sulfuric acid and calcium hypochlorite, cell O, and the
sentence from 177.848(e)(3) that blocks Class 8 liquids above or adjacent to
Class 4 and 5 materials notwithstanding the methods of separation employed.

A load plan whose three checkboxes are worded as assertions about the physical
world rather than as preferences, because that is what they are. Each one states
the condition its clause actually asks for: the barrier box asserts that if a
package leaked in normal transport the contents could not commingle, which is
what 177.848(e)(3) requires and is not the same as a divider being present.
Those checkboxes are the ONLY route by which an assertion reaches the solver. No
tool argument and no URL parameter can make one, and any edit that changes what
a vehicle holds clears the assertions made about it.

A shipping paper in the 172.202(a) basic description sequence, with subsidiary
hazards in parentheses as 172.202(a)(3) requires, and the 172.204(a)(1)
certification printed verbatim on screen rather than buried, because signing it
is a regulated act.

What the officer does not get is a system that decided for them, and does not
get a shipping paper for a load that does not pass.

## Why this is a strong fit for WebMCP

Because the interesting question in agentic browsing is not what the agent can
reach. It is what the agent cannot.

Most tool surfaces are a menu. Everything is registered, always, and safety lives
in the model's judgment about which one to call. That works until the model is
confidently wrong, and in this domain confidently wrong means a truck fire.

WebMCP registers tools against a live document with an AbortSignal, so the tool
set is a function of page state rather than a fixed manifest. The action space
can therefore be made to depend on whether the action is currently legal.
`commit_manifest` is not disabled, not greyed out, not guarded by a polite error
message. While the load fails it is not in `getTools()` at all. The agent cannot
choose it, because from where the agent stands it does not exist.

**The part I think is actually new is that the two gated tools are exact
complements.** With a manifest on the page, `propose_load` is registered exactly
when `commit_manifest` is not:

```
load REFUSED   ->  propose_load REGISTERED   commit_manifest ABSENT
load PASSES    ->  propose_load ABSENT       commit_manifest REGISTERED
```

Never both. Never neither. The page hands the agent the capability the regulation
currently permits and takes the other away in the same instant, in opposite
directions.

That symmetry is doing real work, and I only got it right after getting it
wrong. My first version gated the remedy on the verdict being REFUSED, which
looks the same and is not: a manifest nobody had checked yet was neither passing
nor refused, so the agent had no export AND no way to ask for a legal
arrangement. It was stranded by a tool surface trying to protect it. Gating on
the exact complement of the export condition, rather than on a lookalike, is what
removes that dead end. **Withholding a capability is only safe if the remedy for
withholding it is present in the same breath.**

That is a property of WebMCP specifically. An out-of-process MCP server does not
know what your page currently believes. This one does, because it is the page.

There is a second half I only found by driving the real client. Registration
follows the PAGE's verdict, not the agent's call. An agent that speculatively
calls `check_segregation` on some other, legal load gets a PASS and an approval
token back, and `commit_manifest` still does not appear, because the load on the
page has not changed. The agent cannot talk the tool into existence. It has to
actually fix the truck.

And the anticorrelation is not a claim in prose. It is why the eval harness below
takes TWO commands: the harness opens one URL per run, and no single page state
registers both gated tools any more. Same page, two states, and the tool set
differs in exactly the two positions the regulation controls.

## How it creates a better user experience

The officer and the agent work the same page and go through the same solver, so
the two can never get different answers about a material or a load. There is no
sync step and no second source of truth to drift.

The agent does the parts agents are good at. It reads "2 drums sulphuric acid
soln 60%" out of a supplier email and puts Sulfuric acid at the top of a ranked
candidate list for the officer to confirm, including when the supplier used the
British spelling, which matters more than it sounds: the 172.101 table is not
internally consistent about that. It contains "Nicotine sulphate" and "Titanium
disulphide" alongside ninety entries spelled with an f, so a US shipper
searching "nicotine sulfate" was getting nothing back. The agent also searches
the space of ways to split a manifest across vehicles, which is a graph
colouring problem a person does badly and slowly.

Note what it does NOT do: it never classifies. `classify_line_item` returns
candidates with `confirmationRequired` set, so injected or ambiguous text cannot
become a line item without a human choosing it.

The page does the part agents are demonstrably unreliable at, which is applying
the regulation exactly, every time, with a citation.

And the officer watches it happen. The tool registry strip along the bottom
shows what the agent can currently see. When the verdict flips to pass,
`commit_manifest` appears in it. That single frame is the whole argument, and it
is visible to a human rather than buried in a trace.

## What people and agents can do together that was hard before

Before: the agent proposes a load and asserts it is legal. You either trust it
or you check all 324 cells yourself, in which case what was the agent for.

Now: the agent proposes, the page adjudicates, and the refusal arrives with the
clause attached. The officer is reviewing a cited legal conclusion instead of
auditing a model's reasoning. Those are different jobs and only one of them is
possible in the time available.

The specific thing that was not possible before is negative capability. An agent
could always be told not to do something. It could not previously be placed in a
world where the thing is absent, by a page, at the moment it becomes unsafe, and
restored the moment it becomes safe again. That is new, and it generalises well
past hazmat.

## How I implemented WebMCP

Five tools, all imperative, all on the top-level document. ChatGPT's in-app
browser supports neither the declarative HTML form API nor tools registered
inside iframes, so a declarative gate would be invisible to the client the rules
name first. That decision is now verified in that client. In the desktop app's
built-in browser (GPT-5.6 Sol, site tools enabled), the agent found the two
always-on tools, watched `propose_load` and `check_segregation` register the
moment the manifest gained its first line item, and said so unprompted: "The
registry is state-dependent, so I'm tracking each change before calling
anything." It was refused with 177.848(e)(3) quoted verbatim, and it could not
export, reporting that the site withheld `commit_manifest` because the load
failed.

```js
document.modelContext.registerTool({
  name: "lookup_material",
  description: "Resolve a material by identification number or proper shipping name.",
  inputSchema: { /* ... */ },
  annotations: { readOnlyHint: true },
  execute: async (input) => { /* ... */ },
}, { signal: controller.signal });
```

```
TOOL                 ANNOTATIONS                        REGISTERED WHEN
lookup_material      readOnlyHint                       always, at mount
classify_line_item   readOnlyHint untrustedContentHint  always, at mount
propose_load         readOnlyHint                       manifest non-empty AND load not passing
check_segregation    readOnlyHint                       manifest is non-empty
commit_manifest      mutating                           ONLY while the load passes
```

The last two rows are the anticorrelation argued above: with a manifest on the
page, exactly one of them is registered at any moment.

Unregistration is AbortSignal driven, which is the current spec: `unregisterTool`
was removed in April 2026 and `provideContext` in March.

WebMCP defines exactly two annotations. `destructiveHint`, `idempotentHint` and
`openWorldHint` belong to the wider MCP set and appear nowhere in the WebMCP
Draft Community Group Report, so they appear nowhere here, and a test fails if
one ever does.

`classify_line_item` carries `untrustedContentHint` because it ingests free text
that may have arrived in a supplier email. The hint is advisory, which is
exactly why the solver is deterministic. Text injected into a manifest cannot
flip a verdict, because no model is in the path that produces one.

The origin is served with `Origin-Agent-Cluster: ?1` and
`Permissions-Policy: tools=(self)`, both from the spec rather than from habit.
WebMCP is disabled in a document that is not origin-keyed, and requesting that
explicitly is the difference between the tool surface existing and quietly not existing.

## The design decision the whole thing rests on

The regulation never touches a model.

A segregation verdict has no judgment call in it. The cell is X or it is not.
The material is Forbidden or it is not. An LLM computing that would be slower,
unauditable, and wrong some fraction of the time, and here that fraction is a
tanker.

So the solver is plain TypeScript over a corpus extracted from one pinned eCFR
snapshot, and the model does the two things it is genuinely good at: reading
messy text into typed fields, and searching for a legal split.

The hard part was the deterministic half, and it stayed hard. The segregation
table is narrower than the set of hazard classes it appears to cover. Class 8 is
liquids only. Division 6.1 appears only as packing group I hazard zone A. Class
9 is absent entirely, which means no restriction rather than an oversight.
Division 2.3 splits into hazard zone A and hazard zone B, and which one a
material lands in comes from a special provision in a different section. Getting
that wrong produces a confident answer about a row that does not exist.

## The gate is three layers and only one is a security boundary

I want to be precise here, because the flattering version of this is wrong.

**Visible.** `commit_manifest` is absent from the agent's registry while the load
fails. This is the interface and the thing you watch change. It is **not** the
security property. The WebMCP tool map is keyed by tool name, so any same-origin
script could register over it, and the spec itself flags an unprotected window
between unregister and re-register.

**Load-bearing.** `commit_manifest`'s handler re-derives the verdict from a
SHA-256 of the exact bytes it is about to export, and refuses on any mismatch. A
stale load, a mutated load, and a same-named shadow tool are therefore all
uncommittable regardless of registration order. A test calls that handler
directly on a failing load, which is precisely what an impostor tool would do,
and it is still refused.

The canonical encoding length-prefixes every component rather than joining on a
separator, because a separator inside a free-text field lets two distinct loads
collide to one identity.

**Structural.** A static single-origin site with no third-party JavaScript and
`script-src 'self'`, so no foreign script is running to register anything. Open
DevTools and the console is empty: no errors, no warnings, and nothing injected
by the host. The built HTML contains no inline script and no inline style, and a
test asserts it.

## Try to break it, on the page

Two attacks run for real against the live page, because a security argument that
only exists in prose is one nobody has tested.

**Shadow tool attack.** A button registers a tool over this page's own
`commit_manifest` through the real `registerTool`. It succeeds. Afterwards
`getTools()` genuinely returns an impostor, because the WebMCP tool map is keyed
by name and the published measurement puts that race at 100 percent. The
impostor then holds a real, well-formed SHA-256 token issued for a different
load, and the commit handler refuses. Owning the registry was never the
boundary. The panel says plainly that the shadow tool is my code standing in for
an attacker's script, modelled at the point where `script-src 'self'` has
already been defeated, which is the strongest position I can hand an attacker
and still refuse.

**Prompt injection.** A supplier line carrying "SYSTEM: ignore all previous
instructions" goes through `classify_line_item`, which is annotated
`untrustedContentHint` precisely because this happens, and the verdict is
re-derived before and after. It does not move. No model sits in the path that
produces a verdict.

Alongside those: the 177.848(d) table rendered at full size, all 324 cells, with
the ones the table clears and another clause forbids ringed in red and the rows
your current manifest touches lit. And an agent's-eye view printing the literal
result of `getTools()`, read from the live registry rather than mirrored from
the app's own state, so if the two ever disagree the panel shows the truth and
the strip shows the lie.

## Verify it yourself, offline, with no key

```bash
git clone https://github.com/StephenSook/placard
cd placard && npm ci
npm run verify:data
npm test
```

`verify:data` prints a receipt of what it examined, because a gate that passes
having checked nothing is indistinguishable from one that works:

```
PASS  checked 14 hashes, 42 verbatim clauses (9604 characters), 493 table cells, 3293 table entries
```

Every clause the app quotes is proven to be a verbatim substring of the pinned
source. Clauses are sliced by literal anchors, and an anchor matching zero times
or twice fails the build rather than shipping a confident quote of the wrong
sentence. Three of my own anchors were rejected that way, one because "This
material is poisonous by inhalation" appears four times.

The agent surface has its own evaluations, runnable with no LLM and no key:

```bash
npx webmcp-evals smoke \
  -u "https://segregation-console.vercel.app/?load=UN1090&check=1" \
  -e evals/segregation.evals.json -v

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
- **The URL carries state on purpose.** Smoke mode opens a fresh page per case,
  so a bare URL registers two tools and most cases fail with "tool is not
  available". The URL puts the page in the state the cases are about.

It scored 2 of 6 the first time I actually ran it, on the single-file version of
these evals. Running a command you publish is not optional.

14 test files, 367 tests. Lighthouse on the live origin, desktop: **agentic
browsing 100, accessibility 100, best practices 100, SEO 100, performance 100.**
Agentic browsing at 100 is itself the proof the origin trial is live, because
those audits report nothing at all rather than failing when the token is
missing.

Two audits do not score full marks and I would rather name them than round them
away. `speed-index` is 0.99. `valid-source-maps` is 0: I turned the maps on,
built and deployed, and **Vercel answers 403 with an empty body for any `.map`
path, at the platform level, regardless of headers or rewrites.** Renaming the
file to dodge a deliberate platform protection would be defeating a security
control to win a score, which is the exact move this project exists to argue
against, so the maps stay off and a judge who wants them clones the repository.

Verified by hand in Chrome 151 against the live origin with no flag, driving
`document.modelContext` directly: `getTools` returns 2 tools at mount and 4 once
a manifest is loaded, `executeTool` on `check_segregation` with a barrier
asserted returns REFUSED carrying 177.848(e)(3) verbatim, and `commit_manifest`
is absent throughout.

Verified again in the client the rules name first: the ChatGPT desktop app's
built-in browser on GPT-5.6 Sol, with site tools enabled, given only the URL and
the UN1830 + UN1748 task. The agent discovered the tools, tracked the registry
growing as the manifest changed, returned REFUSED on ground
CORROSIVE_OVER_OXIDIZER with 177.848(e)(3) quoted in full, and closed with: "No
shipping paper was exported. The site withheld commit_manifest because the load
failed, so export was blocked."

## I attacked my own safety claim with a second model, again and again

The claim this project makes is narrow and absolute: no shipping paper can be
exported for a load that fails 49 CFR 177.848. So before shipping I pointed a
second model at the repository with that one question and nothing else, and then
kept doing it.

**Fifteen rounds. Not one has come back empty.** Fifty-two defects, forty-three
of them carrying a numbered regression in `tests/codex-findings.test.ts` and the
rest in its sibling suites. Every one reproduced before it was touched. Every fix
paired with the load that used to clear AND a load that must still clear, so no
fix could degenerate into a blunt refusal. Every guard mutation-tested.

The first round alone found five, and every one of them had already passed a
147-test suite, because every one lived in the interaction between two features
rather than inside either. A green suite measures the paths you thought of.

The architecture held where it was designed to. The token binding, the canonical
encoding and the TOCTOU handling showed no bypass, and the export gate was never
defeated. What the reviews kept finding was upstream of it: the SOLVER returning
PASS for loads the regulation forbids, and the gate faithfully exporting them. A
correct lock on a door in the wrong wall.

The whole list is in the repository. These six taught me the most.

**The 177.848(e)(3) exception was granted on half its conditions.** The clause
permits a single-shipper truckload only where it is ALSO known that the mixture
will not cause a fire or a dangerous evolution of heat or gas. The code granted
it on the single shipper alone and demoted the second condition to a note that
admitted it could not determine the fact. So sulfuric acid over calcium
hypochlorite with a barrier and a single shipper returned PASS and exported: the
exact pair this project exists to refuse, cleared by the tool built to refuse it.

**An agent could forge a fact about the physical world.** `barriersPresent`,
`singleShipper` and `nonReactionAsserted` were ordinary arguments on the tool
schemas. An agent that sent `barriersPresent: true` turned a refused load into a
committed shipping paper in one call, and the schema description for one of them
said, in these words, that an agent must not assert it on the operator's behalf.
Writing a hole down is not closing it. They are gone from every schema now. They
arrive from the operator's checkboxes as a separate trust context, a wire that
carries one is refused by name rather than silently dropped, and every result
reports `attestationsInForce` so an agent can see what was assumed and ask the
operator to change it. That is the division of labour this whole project argues
for, and I had to be shown four times that my own code did not implement it.

**Ten clauses were quoted, verified verbatim, and enforced by nothing.** The
citation gate proves every quoted clause is a substring of the pinned eCFR. It
ran green from the first commit and it never once checked whether the RULE exists
in code. Ten of the twenty-four clauses in the corpus at the time were quoted,
verified, counted in the receipt the README prints, and applied by no code path
at all. Two were live prohibitions reachable from the demo corpus: sodium cyanide
with sulfuric acid exported, and so did 1.4S fireworks with 1.1G fireworks,
because the compatibility footnotes were being read as permission when a footnote
is a condition. A verbatim quote of a rule you do not apply is worse than no
quote, because it reads as evidence of diligence that is not there. Every clause
is now either cited by a live code path or listed in a coverage file with a
written reason, and the build fails on any that is neither.

**One word walked the headline pair out of the row that forbids it.** Physical
state had become an agent-settable field when I added structured references, and
177.848(d) covers Class 8 LIQUIDS only. So an agent re-sent the operator's own
load with the sulfuric acid declared SOLID, walked this project's signature pair
out of the row that forbids it, borrowed the operator's barrier, and committed a
shipping paper. One word, through a field I had added an hour earlier. State is
refused by name now, like the other three physical claims.

**An unevaluable condition is not a satisfied one, and I had to learn that
twice.** 177.848(g)(vi) permits group G articles with C, D and E "other than
fireworks and those requiring special handling", and nothing in 172.101
designates a material as requiring special handling, so that exclusion cannot be
evaluated at all. I fixed it there and left the identical shape in 177.848(e)(5)
note A, which permits ammonium nitrate with Division 1.1 or 1.5 "unless otherwise
prohibited by 177.835(c)". 177.835(c) is not in the pinned corpus, so my code
granted the permission and pushed a note reading "Confirm 177.835(c) does not
apply", which asked a reader to discharge a burden nothing could discharge.
Ammonium nitrate with black powder exported a shipping paper for a cell the table
marks X. Both clauses decline in the same words now, and a test asserts they
still match, because I had fixed the example I was handed and not the pattern
behind it.

**Safety depended on a comma.** The table spells the incendiary-ammunition name
both with and without a comma before "or propelling charge". The no-comma
spelling has exactly one row at 1.4G and resolved cleanly, while the same name
normalised also covers 1.2G and 1.3G.

### The other thirty-five, and the three patterns underneath them

In one line each: a URL that could attest on the operator's behalf; a `?load=`
link that quietly loaded a subset and exported a paper silent about the missing
items; a proposal that borrowed vehicle one's barrier and applied it to trucks
nobody had walked out and looked at; a reference comparison that failed on
"UN 1090", the spelling 49 CFR itself uses; a legal packing-group II load refused
by a severity heuristic; a shipping paper that omitted the subsidiary hazards its
own verdict turned on; an item dragged between bays that carried claims made when
the bay held something else; an approval token that did not bind packing group or
inhalation zone, so two genuinely different loads shared one; a refusal whose
remedy the wire could not express; a removed vehicle that shifted every later bay
left and stole a barrier the operator had asserted; a hard block that reached
gases when the clause reaches liquids; an input box that answered "sulfuric acid"
with a different acid in a different hazard class; a wire that accepted any
property nobody had thought to forbid and silently dropped it, so an approval
token covered bytes the caller never sent; and a clause-reachability gate that
was wrong in both directions twice, once calling dead code live and once calling
live code dead.

Three patterns ran through all of it, and they are the part worth carrying.

**A fix is a fresh diff nobody has reviewed.** Rounds five, six and seven each
found a defect that a previous round's fix had opened or left open, and then
rounds ten through thirteen did it again in one unbroken chain: ten's allowlist
created eleven's dropped-value hole, eleven's call graph created twelve's, and
twelve's repair created thirteen's. That is why the exit condition here is a
clean round rather than a declared finish.

**Round thirteen was this project's own signature defect, turned on its own
gate.** A member form the clause-reachability namer did not recognise, a getter
or a computed key or a function assigned after its object, left the citation
with no enclosing declaration at all, and `[].every(...)` is trivially true, so
it counted as reachable. An unevaluable condition is not a satisfied one, in the
gate as much as in the regulation, so an unrecognised member is now a node that
nothing can reference and the build says so. Reaching one member also certified
every sibling of it, and two more findings ran the other way, reporting live
code dead: a static initialiser runs on import whether or not its class is ever
referenced, and the members of an anonymous default export can be bound to any
local name by the importer. All four were latent, because the shipped source
contains no getters, no classes, no static members and no default exports. I
fixed them rather than writing that exposure down as a reason not to.

**Three separate times, a test written in the same commit as a fix asserted the
resulting hole.** Round six's regression test required the pass that round ten
had to remove. A later test required the pass that let an X cell export. And my
own positive control for the reachability gate asserted the very rule round
twelve overturned. A test is not independent evidence when it was written by the
same hand, in the same hour, as the thing it guards.

**A reviewer's finding is a claim like any other.** Round twelve reported a
cross-payload token reuse, and it did not hold: "UN1090", " UN1090 " and
"un1090" are one material and one load, 49 CFR itself writes UN 1090 with a
space, and an earlier round had to make those compare equal because an agent
using the regulation's own spelling was losing a barrier the operator had
genuinely asserted. I pinned both halves with tests instead of "fixing" it. That
same round had also ended its turn mid-work while printing "no material
findings", which is a verdict-shaped false green, so it was treated as no verdict
and its claims were reproduced by hand before anything moved.

**Round fourteen changed the SCOPE, and that turned out to be the finding.**
Rounds eleven, twelve and thirteen were all scoped to the diff, and all three
landed on the same test helper, which is the only thing a diff-scoped review can
see when every recent diff is that helper. Pointed at the whole repository
against the safety claim instead, it found three defects in the shipped code on
its first pass. A review is only ever as wide as the window you give it.

The worst was one attestation proving two clauses that ask different things. The
operator's checkbox read "will not cause a fire or a dangerous evolution of heat
or gas", which is 177.848(e)(3). The solver also accepted it as proof of
177.848(e)(6), whose condition is that the materials are "not capable of reacting
dangerously with each other", and so reaches outcomes that are neither fire nor
heat nor gas. The narrower assertion was clearing the wider exception. It was
also rendered only while single shipper was ticked, while its value persisted
when it hid, so ticking both and then unticking single shipper committed a
shipping paper on an assertion the operator could no longer see. It states both
conditions now and it never hides, because a hidden control must not hold a live
claim.

Beside it, two more. The name branch of the resolver ignored the packing group
sent alongside the name, so a caller asking for packing group III was adjudicated
and exported as packing group I: the paper named a row the caller had explicitly
not asked for. And a comma inside a proper shipping name is not a separator.
URLSearchParams decodes %2C before any split can see it, so "Acetylene, solvent
free", a real Forbidden entry with no identification number, tore into two
unresolved fragments while the acetone beside it loaded, checked, and minted an
approval token for a manifest nobody had sent.

**Round fifteen made me correct a number I had already published, and that is
the one I would want a judge to read.** The headline figure counts
configurations the segregation table clears and the full regulation still
forbids. An asterisk cell is not a clearance: 177.848(e)(4) refers that pair to
the compatibility table in paragraph (f), so an agent that stops at the table
has not been told yes, only that it has not been told no. Counting the referral
as a clearance is the generous reading, and 48 of the 56 rest on it. My own
endpoint said the opposite, that reading the table more strictly "would inflate
the result", when in fact it would drop the figure from 56 to 8. The arithmetic
was right and the framing was backwards. The number stands as an UPPER BOUND on
the naive-table failure rather than a floor, `/api/measure` now says so in those
words, and it publishes the composition, 48 explosive and 8 corrosive, so
nobody has to take my word for the split.

The same round found a subsidiary hazard the 172.101 table does not print.
Special provision 53 adds an EXPLOSIVE subsidiary risk label to the type B
self-reactives, and its class and division come from an approval no corpus
contains, so UN3221 with acetone returned PASS and committed a paper showing
only 4.1 and 3. I did not take the reviewer's word for what SP53 says: it is
sliced from the pinned 172.102 source and proved verbatim by the same citation
gate as everything else, which is why the receipt now reads 42 clauses rather
than 41. A load carrying it is refused.

Two more. The barrier checkbox asserted less than its clause requires, reading
"physical barriers separate incompatible items" when 177.848(e)(3) asks for
separation such that commingling could not occur in the event of leakage: a
divider satisfies the words and not the condition. And a proper shipping name
that identifies more than one material was resolving to whichever row came
first, so "Bromine solutions" committed Hazard Zone A with no zone supplied and
"Diesel fuel" committed NA1993 though the name also identifies UN1202.

I am putting this in the writeup rather than quietly fixing it because the
alternative is a submission that claims a safety property and hides the evidence
that the claim was tested. The review command, the loads that reproduced each
defect, and the tests are all in the repository.

The corpus grew through all of this rather than being trimmed to fit. It is now
eight pinned sections and 42 verbatim clauses, 9,604 characters of regulation
text, each proven byte for byte against the committed source.

## Challenges

**The corpus I started with was wrong, and it looked fine.** 2,480 of 3,687
rows, zero of the 256 Forbidden entries, and a 17 by 18 matrix that should be 18
by 18. Every one of those failures was silent. I rebuilt the extraction against a
pinned snapshot with a structural gate that fails the build if the matrix is not
324 cells or if any Forbidden entry somehow carries a number.

**A gitignored corpus made its own verification vacuous.** The raw eCFR XML was
excluded from the repository as re-fetchable. It is re-fetchable. It is also
absent on a clean checkout, so the gate proving every clause verbatim
verified none of them, and passed locally only because the files happened to sit
in my working tree. The first CI run ever caught it, and only because the gate
fails on an absent source instead of skipping, and prints what it actually
examined. `0 verbatim clauses (0 characters)` cannot be mistaken for a pass. The
fix was to track the source, not to weaken the gate.

**My own thesis bit my own code.** The function that packages the manifest for
the solver filtered on the identification number, so the Forbidden material in
the demo manifest was silently dropped and the page reported a lesser verdict.
That is the exact defect this project exists to expose, reproduced one layer up,
by me, in the file that demonstrates it. The tool schema had it too: items were
constrained to a UN number pattern, which made all 256 Forbidden materials
inexpressible to the agent.

**A cast is not a conversion.** `check_segregation` returns a flattened shape for
the agent, and the console cast it to the solver's internal type. It typechecked
and then crashed at runtime on a field that does not exist there.

**Tests that pass while the page fails.** I wrote a contrast guard that compared
colour tokens against background tokens. Every token passed. The live page still
failed six contrast checks, because rules dimmed whole cards with `opacity` and
the text inside came along for the ride. A token measuring 5.08:1 renders at
3.50:1 under `opacity: 0.75`. A check that reads tokens is structurally blind to
that, so the replacement checks the mechanism instead: no rule may set both a
text property and a fractional opacity. It immediately found two more the
Lighthouse run had not reported.

**Verify where a finding lives, not just that it is real.** Seven CI runs went
red minutes after I wired Dependabot. I read that as `npm ci` failing on a clean
checkout, which would have been serious, since the README tells a judge to run
exactly that. Those were Dependabot's own branches proposing React 19 against a
React 18 tree. Main had been green the entire time and the lockfile I was about
to fix was already correct.

**A host is a dependency, and its billing state is an outage.** Two days before
the deadline the platform I had deployed to stopped building mid-run, credit
exhausted, which froze the judged URL on a commit that predated four security
fixes. Moving hosts is not a redeploy: a Chrome origin-trial token is bound to
one origin, so on the new origin `document.modelContext` was simply undefined
and the entire tool surface was gone, with nothing on the page to say so. I
measured that against both origins before believing it, registered a token for
the new one, and re-verified the whole chain on the deployed site rather than on
the merge.

## What I learned

**Mutation testing is the only thing that told me the truth about my tests.** My
solver suite was 36 tests and green, and it survived 5 of 10 deliberate mutants.
Half of it was decorative. Every suite in this repository has since been
mutation-checked, and I found real gaps every time, including in the guards I
wrote specifically to catch this class of problem.

**A number that goes on a public page has to be computed, not remembered.** I
planned to publish an unaided model's failure rate over 40 scenarios. There is
no OpenAI key on this machine and none in the sponsor credits, so that number was
not runnable. I did not invent it and I did not quietly drop the section. I
replaced it with something the corpus can answer on its own, which turned out to
be better: it needs no key, anyone can recompute it in a second, and it cannot
drift unless 49 CFR changes.

**Say what the number is not.** The divergence figure measures the size of the
gap an agent reasons across when it treats the table as the whole rule. It is
not a benchmark of any model's accuracy, and no language model was run to produce
it. That sentence ships inside the API response, under `honest_limits`, not just
in the README, because the response is what gets quoted.

**Rigor is scored as trust in the claim it supports, not as rigor.** I cut
several numbers that measured whether the system was correct and kept the one
that measures the hazard being removed.

**Documenting a hole is not closing it, and I did it three times.** A schema
description telling an agent not to assert something, while handing it the field.
A comment reading "NEVER quietly load a subset" directly above the code that
loaded the subset. A citation gate proving my quotes were verbatim while ten of
the rules behind them were enforced by nothing. Each one reads like diligence in
review, which is exactly what makes it dangerous: the note satisfies the reader
who would otherwise have checked. Every claim in this repository now has a test
that fails when the claim stops being true, and the ones that could not have a
test were deleted rather than left standing.

**A fix is a fresh diff nobody has reviewed.** Three consecutive later rounds
found a defect that a previous round's fix had opened, including one where the
regression test written in the same commit asserted the resulting hole. That is
why the exit condition is a clean round rather than a declared finish, and it is
the single most useful process rule I took out of this build.

## What's next

A real shipping-compliance officer, under a real agreement. I wrote to a
university environmental health and safety shipping desk during the build and
have not heard back yet, which is the honest status rather than a roadmap item.
Everything here runs on the real regulation, and the one thing it has never had
is a practitioner telling me which of these refusals would actually annoy them
at 6am.

Beyond that: 173.21(e) packaging-level segregation, which is a third refusal
axis below the vehicle, and the air and vessel modes that this deliberately
excludes today. 173.21(e) is quoted in the corpus and named as out of scope in
the coverage file rather than left to look enforced, because it operates at the
package level and needs packaging data the 172.101 table does not carry. The
177.848(g)(vi) special-handling exclusion goes the other way: nothing in the
pinned corpus designates a material as requiring special handling, so that
permission is refused in code rather than assumed.

## Scope, stated plainly

This is not the official Code of Federal Regulations and it is not legal advice.
The eCFR is an editorial compilation. Only GPO's own editions have legal status.
The person who signs the shipper certification retains responsibility under
49 CFR 172.204.

49 CFR is a work of the United States Government and is not subject to copyright
under 17 U.S.C. 105, which is why the corpus is redistributable and committed
here. No IMDG Code content and no standard incorporated by reference under
49 CFR 171.7 is included. No NARA seal and no CFR logo is used.

No shipping-compliance officer has used this in production, and I have not
claimed one has. The regulation is real, the corpus is real and pinned, every
citation is machine-verified against it, and the demo manifest is six real
entries from the 172.101 table.

Built solo. Apache-2.0.
