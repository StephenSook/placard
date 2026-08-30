# YouTube upload package for the Placard demo film

Everything below is ready to paste. The film file, the subtitle file and the
thumbnail are listed with their paths. Nothing here is uploaded automatically:
the account is yours.

## Files

| What | Path |
|---|---|
| Video, 4K master | `video/film/out/placard-4k.mp4` |
| Video, 1080p verified master | `video/film/out/placard-final-1080.mp4` |
| Subtitles, English | `video/film/out/placard.srt` |
| Custom thumbnail | `video/film/out/thumbnail-candidate.jpg` |

Upload the 4K master. YouTube re-encodes either one, and the 4K source gives it
a better ladder to encode from. Attach the SRT under Subtitles, English, and set
the custom thumbnail.

## Settings

- **Visibility: Public.** The rules require a public video, and the judging
  period runs to Sep 22. Do not set it to Unlisted.
- **Category:** Science & Technology.
- **Made for kids:** No.
- **Comments:** on or off, either is fine.
- Leave "Alter or synthesise content" unticked for the picture, which is a real
  screen recording, and tick the synthetic-voice disclosure if YouTube asks: the
  narration is AI text to speech, which the hackathon rules explicitly permit.

## Title

    Watch a page refuse a legal hazmat load and quote the federal rule (WebMCP)

## Description

    Placard is a 49 CFR hazmat load-segregation console. An agent proposes how
    to split a chemical manifest across trucks, the page adjudicates every pair
    against the federal tables, and the tool that exports the shipping paper
    does not exist in the agent's registry until the load provably passes.

    Live, no account and no key: https://segregation-console.vercel.app
    Source, Apache-2.0: https://github.com/StephenSook/placard
    Three-minute judge walkthrough: https://segregation-console.vercel.app/judge

    The number in the film is recomputed on every request, by the real solver,
    at an endpoint anyone can call:
    https://segregation-console.vercel.app/api/measure

    Across every ordered pair of the 18 hazard categories in the 177.848(d)
    segregation table, the table alone clears 792 configurations. The full
    regulation forbids 56 of them. That gap is what an agent reasons across when
    it treats the table as the whole rule.

    256 entries in the 172.101 table are designated Forbidden, and not one has
    an identification number, because a Forbidden material may not be offered
    for transportation at all. Ask a UN-keyed index for any of them and you get
    nothing back, and nothing back is indistinguishable from not regulated.
    https://segregation-console.vercel.app/api/forbidden-audit

    Every quotation in the film is verbatim from a pinned eCFR snapshot of
    2026-08-27, and a one-command gate proves each one is a byte-for-byte
    substring of the committed source.

    Built for The WebMCP Challenge. Narration is AI text to speech. The screen
    recording is the deployed page, uncut through the execution window.

    0:00 A legal load, refused
    0:18 Who signs for it
    0:34 20,460 establishments
    0:49 The gap, measured
    1:07 The agent proposes
    1:19 Refused, with the clause
    1:35 The barrier does not help
    1:47 Two vehicles, and the export tool appears
    2:04 256 entries with no number
    2:19 Why the surface is WebMCP
    2:35 Open it yourself

## Chapters

Paste these at the end of the description, replacing CHAPTERS_GO_HERE. They are
generated from the film's own beat clock, so they match the cuts by
construction.

    0:00 A legal load, refused
    0:18 Who signs for it
    0:34 20,460 establishments
    0:49 The gap, measured
    1:07 The agent proposes
    1:19 Refused, with the clause
    1:35 The barrier does not help
    1:47 Two vehicles, and the export tool appears
    2:04 256 entries with no number
    2:19 Why the surface is WebMCP
    2:35 Open it yourself

## Before you publish

1. Watch it once at full size with sound. It is 2 minutes 45 seconds.
2. Confirm the first 15 seconds show the product working, which the rules ask
   for. Beat one is the refusal, cold, with no title card.
3. After publishing, check the URL answers:
   `curl -s "https://www.youtube.com/oembed?url=<watch-url>&format=json"`
   HTTP 200 with a title means it is public and reachable.
4. Send me the watch URL and I will set it on the Devpost submission.
