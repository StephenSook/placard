## Try it before you read anything

https://segregation-console.vercel.app

No account, no key, no login. WebMCP is enabled on that origin by a registered
Chrome origin trial, so there is no browser flag to set either. **Open it in
Chrome 149 or later** and `document.modelContext` is live.

One honest warning, because I tried it and it did not work the way the rules
imply: asking ChatGPT to open the URL used its TEXT CRAWLER, which does not
execute page JavaScript and therefore reports no tools. It said so itself. If
you look for the tool surface there and find nothing, that is the crawler rather
than the page, and Chrome shows you the real thing.

The page opens on a number it recomputes while you are looking at it:

**Across every ordered pair of the 18 hazard categories in the federal
segregation table, in every barrier configuration, 1,296 cases. The table alone
clears 792 of them. Of those, the full regulation forbids 32.**

`/api/measure` runs the real solver on every request and returns all of it,
including the examples, so you can check the arithmetic rather than take my word
for it. Nothing there is cached and nothing there needs a key.

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

Then the officer signs. Under 49 CFR 172.204, signing the shipper certification
makes them personally responsible for the load being right, and makes them a
hazmat employee under subpart H. They are the person holding the pen.

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

A load plan whose two checkboxes are worded as assertions about the physical
world rather than as preferences, because that is what they are. Barriers means
impediments, dividers or non-hazardous packages, and PHMSA interpretation
03-0300 is explicit that air space alone does not satisfy it.

A shipping paper in the 172.202(a) basic description sequence, with the 172.204
certification printed on screen rather than buried, because signing it is a
regulated act.

What the officer does not get is a system that decided for them, and does not
get a shipping paper for a load that does not pass.

## Why this is a strong fit for WebMCP

Because the interesting question in agentic browsing is not what the agent can
reach. It is what the agent cannot.

Most tool surfaces are a menu. Everything is registered, always, and safety
lives in the model's judgment about which one to call. That works until the
model is confidently wrong, and in this domain confidently wrong means a truck
fire.

WebMCP registers tools against a live document with an AbortSignal, which means
the tool set is a function of page state rather than a fixed manifest. So the
action space can be made to depend on whether the action is currently legal.
`commit_manifest` is not disabled, not greyed out, not guarded by a polite error
message. While the load fails it is not in `getTools()` at all. The agent cannot
choose it, because from where the agent stands it does not exist.

That is a property of WebMCP specifically. An out-of-process MCP server does not
know what your page currently believes. This one does, because it is the page.

There is a second half to that which I only found by driving the real client.
Registration follows the PAGE's verdict, not the agent's call. An agent that
speculatively calls `check_segregation` on some other, legal load gets a PASS and
an approval token back, and `commit_manifest` still does not appear, because the
load on the page has not changed. The agent cannot talk the tool into existence.
It has to actually fix the truck.

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
name first. That decision still holds even though I could not reach that client:
the imperative top-level surface is the one that works everywhere, and a
declarative gate would have been a bet on a path I cannot verify.

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
propose_load         readOnlyHint                       manifest is non-empty
check_segregation    readOnlyHint                       manifest is non-empty
commit_manifest      mutating                           ONLY while the load passes
```

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
`script-src 'self'`, so no foreign script is running to register anything. If you
open DevTools you will see two CSP refusals. Those are Netlify's own injected
toolbar, refused by the policy. Our built HTML contains no inline script and no
inline style, and a test asserts it.

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
PASS  checked 10 hashes, 24 verbatim clauses (4700 characters), 493 table cells, 3293 table entries
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
```

Two things about that command are not obvious and cost me an hour, so they are
written down rather than left for you to discover:

- **It needs Google Chrome Canary.** The harness hardcodes that channel and
  exposes no flag to change it. `brew install --cask google-chrome@canary`.
- **The URL carries state on purpose.** Three of the five tools only exist while
  the page has a manifest, and `commit_manifest` only exists while the load
  passes, which is the entire point of the project. Smoke mode opens a fresh
  page per case, so a bare URL registers two tools and four cases fail with
  "tool is not available". `?load=UN1090&check=1` puts the page in a passing
  state, so all five are registered and all six cases run.

That is 6 of 6. It was 2 of 6 until I actually ran it.


162 tests. Lighthouse on the live origin: agentic browsing 100, accessibility
100, best practices 100, SEO 100, performance 98.

Verified by hand in Chrome 151 against the live origin with no flag, driving
`document.modelContext` directly: `getTools` returns 2 tools at mount and 4 once
a manifest is loaded, `executeTool` on `check_segregation` with a barrier
asserted returns REFUSED carrying 177.848(e)(3) verbatim, and `commit_manifest`
is absent throughout.

## I attacked my own safety claim with a second model, and it earned its keep

The claim this project makes is narrow and absolute: no shipping paper can be
exported for a load that fails 49 CFR 177.848. So before shipping I pointed a
second model at the whole repository with that one question and nothing else.

It found five real defects. I reproduced every one before touching anything, and
every one of them had passed a 147-test suite, because every one lived in the
interaction between two features rather than inside either. That is the part
worth reporting: a green suite measures the paths you thought of.

The architecture held where it was designed to. The token binding, the canonical
encoding and the TOCTOU handling showed no bypass, and the export gate was never
defeated. What the review found was upstream of it: the SOLVER was returning
PASS for loads the regulation forbids, and the gate was faithfully exporting
them. A correct lock on a door in the wrong wall.

**A subsidiary cell hid the explosives referral.** The most-restrictive
reduction ranks X above O above the asterisk. That is right for restrictiveness
and wrong for routing, because the asterisk does not mean "less restrictive", it
means "the answer is in the 177.848(f) table". UN0018 is Division 1.2G carrying
a subsidiary Class 8, so the subsidiary pairing produced an O, the O outranked
the asterisk, a barrier cleared the O, and the compatibility table was never
consulted. It exported. Groups G and B are X.

**An identification number is not always an identifier either.** UN1950 covers
five entries across Divisions 2.1 and 2.2 and the resolver took the first, a 2.2
aerosol. This is the same defect I had fixed for proper shipping names one
commit earlier and left in place for numbers, which is worse, because a number
looks authoritative. The shipping paper also carried the wrong proper shipping
name, so the document named a material nobody had described.

**Safety depended on a comma.** The table spells the incendiary-ammunition name
both with and without a comma before "or propelling charge". The no-comma
spelling has exactly one row at 1.4G and resolved cleanly, while the same name
normalised also covers 1.2G and 1.3G.

**The 177.848(e)(3) exception was granted on half its conditions.** The clause
permits a single-shipper truckload only where it is ALSO known that the mixture
will not cause a fire or a dangerous evolution of heat or gas. The code granted
it on the single shipper alone and demoted the second condition to a note that
admitted it could not determine the fact. So sulfuric acid over calcium
hypochlorite with a barrier and a single shipper returned PASS and exported: the
exact pair this project exists to refuse, cleared by the tool built to refuse
it. The signer now asserts non-reaction explicitly, and the tool schema tells an
agent in as many words not to assert it on the operator's behalf.

**And my own attack demo could leave the page compromised**, because its
AbortController was scoped inside the runner and aborted only on the happy path.

All five are fixed, each with a regression test reproducing the exact load that
was cleared, plus the negative case that stops the fix becoming a blunt refusal:
an ordinary explosive pair still routes through the compatibility table, a
number whose rows differ only by packing group still resolves, and the (e)(3)
exception still applies when both of its conditions are genuinely asserted.

Then I mutation-tested those regression tests, because a test that cannot fail
is decoration. Four of five caught their defect immediately. The fifth asserted
merely that some `finally` existed and survived deleting the very cleanup it was
written to guard, because another function in the same file also had one. It now
asserts the specific block, and is caught three separate ways.

I am putting this in the writeup rather than quietly fixing it because the
alternative is a submission that claims a safety property and hides the evidence
that the claim was tested. The five defects are gone. The discipline that found
them is the more durable thing, and it is reproducible: the review command, the
loads that reproduced each defect, and the tests are all in the repository.

## Challenges

**The corpus I started with was wrong, and it looked fine.** 2,480 of 3,687
rows, zero of the 256 Forbidden entries, and a 17 by 18 matrix that should be 18
by 18. Every one of those failures was silent. I rebuilt the extraction against a
pinned snapshot with a structural gate that fails the build if the matrix is not
324 cells or if any Forbidden entry somehow carries a number.

**A gitignored corpus made its own verification vacuous.** The raw eCFR XML was
excluded from the repository as re-fetchable. It is re-fetchable. It is also
absent on a clean checkout, so the gate proving all 24 clauses are verbatim
verified zero of them, and passed locally only because the files happened to sit
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

## What's next

A real shipping-compliance officer, under a real agreement. I wrote to a
university environmental health and safety shipping desk during the build and
have not heard back yet, which is the honest status rather than a roadmap item.
Everything here runs on the real regulation, and the one thing it has never had
is a practitioner telling me which of these refusals would actually annoy them
at 6am.

Beyond that: 173.21(e) packaging-level segregation, which is a third refusal
axis below the vehicle, and the air and vessel modes that this deliberately
excludes today.

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
