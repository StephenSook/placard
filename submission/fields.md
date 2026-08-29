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

## Required fields, all DECIDED

Each from a fact already established in the build rather than a preference, so
none of these is waiting on anyone.

| Field | Answer | Why this and not another |
|---|---|---|
| 28249 Submitter Type | **Individual** | Built solo. The writeup says so and the git history is one author. |
| 28250 Country | **United States** | Author is a computer science student at Kennesaw State, Georgia. |
| 28252 App Status | **New** | First commit is inside the submission window. Nothing predates it. |
| 28254 Live URL | `https://segregation-console.netlify.app` | Origin-trial token is bound to this exact origin, so it cannot move. |
| 28256 Public repo | `https://github.com/StephenSook/placard` | Public, Apache-2.0 detected in the About sidebar, 100% community health. |
| 28259 Level of learning | **Significant** | The WebMCP runtime facts in the writeup were learned by driving the client, not read. |
| 28260 Career AI value | **Yes** | The adversarial-review discipline transfers to any codebase. |

**28253 If Existing, what did you update** (optional)
> Not applicable. New, built entirely within the submission period.

---

**28257 Which agent(s) or client(s) did you test your WebMCP tools with?**
(required, textarea, 255 characters max)

**DECIDED. Chrome only, and the answer says so, because the ChatGPT attempt did
not exercise WebMCP.**

Attempted 2026-08-29 on a ChatGPT Plus account: asked it to open the live URL
and name the tools. It used its TEXT CRAWLER, said so in its own words ("the
text crawler isn't exposing the JavaScript-registered tools directly"), then
fell back to web and GitHub search. No model picker is exposed on that account,
only a thinking-effort control, so there is no Sol or Terra to select. WebMCP
was never reached, so naming ChatGPT here would describe a test that did not
happen.

> Chrome 151 with the WebMCP origin trial live on the origin, no flag. Driven
> through document.modelContext directly: getTools, executeTool, and tools
> unregistering by AbortSignal as page state changes. Lighthouse
> agentic-browsing scores 100. webmcp-evals runs against the live page in smoke
> mode.

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

This field now carries the client steer, because a judge who tries ChatGPT
first, sees the text crawler, and concludes the tools do not exist would be
drawing a wrong conclusion from a real observation.

> No credentials, nothing gated. USE CHROME 149+: the origin trial is
> registered so no flag is needed, and document.modelContext is live. ChatGPT's
> browsing may use its text crawler, which does not execute page JavaScript and
> so sees no tools. /judge is a numbered 3-minute route; the APIs need no key.

---

## Still open before this can be submitted

Exactly one thing, and it is a decision rather than work.

1. **The demo video.** `video_required: true` on the form, so `submit_project`
   refuses without it and itemises it as missing. The script is written and
   every figure in it is audited against FACTS.md; it has not been rendered
   because the owner decided against a video. Until that changes the submission
   cannot complete, and that is the whole of the remaining blockage.

Settled and no longer open: the project is named **Placard**; the repository is
renamed, public and at 100% community health; every required text and dropdown
field is decided above; and field 28257 no longer waits on a ChatGPT run,
because that run was attempted, did not reach WebMCP, and the answer says so.
