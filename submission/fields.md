# Devpost submission fields

Deadline 2026-09-03 20:00 UTC (Sep 3, 1:00 PM PT).
**Keep every text answer at or under 255 characters.** The additional-info form
silently discards the whole save when a field runs long: no error, a redirect
that looks like success, and the old values back on reload. Verify by reloading.

---

## Tagline

Three drafts. All lead with a sensory verb and a person, carry one checkable
number, and put the restraint in the second clause rather than the first.

**A.**
> Paste a chemical manifest and watch an agent load a truck legally. The page
> shows which federal rule each pair breaks, quoted verbatim, and the export tool
> does not exist until the load passes. 24 of 792 table-cleared loads are illegal.

**B.**
> Watch an agent try to load a hazmat truck and get refused by the regulation
> itself, quoted word for word. The tool that exports the shipping paper is not
> registered until the load is legal. 256 forbidden materials have no UN number.

**C.**
> An agent proposes a hazmat truck load, the page shows exactly which line of
> 49 CFR each pair breaks, and the shipping paper cannot be exported until it
> passes. 24 of the 792 loads the segregation table clears are actually illegal.

---

## Required fields

**28249 Submitter Type** (dropdown)
> Individual

**28250 Country of residence** (dropdown)
> United States

**28252 App Status** (dropdown)
> New

**28254 Live URL**
> https://segregation-console.netlify.app

**28256 Public code repo**
> https://github.com/StephenSook/hazmat-segregation-console

**28259 Level of learning** (dropdown)
> Significant

**28260 Career AI value** (dropdown)
> Yes

---

**28257 Which agent(s) or client(s) did you test your WebMCP tools with?**
(required, textarea, keep under 255 characters)

*DRAFT. Do not submit until the ChatGPT in-app browser run has actually
happened. Right now this answer would be describing a test that has not been
performed, and the whole project is about not doing that.*

> ChatGPT's in-app browser on GPT-5.6, and Chrome 149 with the origin trial live
> (no flag needed). Also checked with Lighthouse's agentic-browsing audits, which
> pass webmcp-schema-validity and webmcp-registered-tools, and with webmcp-evals
> in smoke mode.

*If the ChatGPT run does not happen before submission, the honest version is:*

> Chrome 149+ with the WebMCP origin trial live on the origin, verified by
> registering and aborting a tool at runtime. Lighthouse agentic-browsing scores
> 100 and passes webmcp-schema-validity and webmcp-registered-tools.
> evals/segregation.evals.json runs against the live page in smoke mode.

---

**28258 Which AI tools have you leveraged while working on this project?**
(required, textarea, keep under 255 characters)

> Claude Code (Opus) for the build, and OpenAI Codex as a second model running
> adversarial review on my own diffs until a round came back clean. Deliberately
> no model at runtime: the regulation is applied by a deterministic solver, not
> inferred.

---

**28253 If Existing, explain what you updated** (optional)
> Not applicable. New, built entirely within the submission period.

**28255 Testing instructions / credentials** (optional, judges only)
> No credentials. Nothing is gated. https://segregation-console.netlify.app/judge
> is a numbered three-minute route through every claim, each with the one click
> that checks it. /api/measure and /api/forbidden-audit answer without a key.

---

## Still open before this can be submitted

1. **The project has no name.** The repository is named for what it does.
   Devpost's own guidance says not to let AI name a project, so this one is
   yours. It is the first thing a judge reads.
2. **Field 28257 needs the ChatGPT in-app browser run to be real.**
3. **Demo video** is scripted and audited but not rendered, and it is required.
