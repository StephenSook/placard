#!/usr/bin/env python3
"""
Write the film's subtitle track from the narration text and the measured beat
clock, so a viewer who cannot hear the film gets the WHOLE narration.

The burned captions are deliberate condensations, sized to be read at a glance
over a live product. A subtitle track is a different job: it is the spoken words,
and it must match them. Both are generated from the same two sources, the beat
clock and gen_narration's BEATS, so neither can drift from what was actually
said.

Sentences inside a beat are laid out proportionally to their character count,
which is a good enough model of speaking rate for a track that only has to keep
up with the voice, and it cannot drift past the beat boundary because each
beat's window is measured from its own rendered clip.

Splits on a full stop FOLLOWED BY WHITESPACE. Splitting on a bare full stop
turns "49 CFR 172.204" into three subtitles.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BEATS = json.loads((ROOT / "film" / "src" / "data" / "beats.json").read_text())
MAX_CHARS = 84  # two comfortable lines at broadcast width


def narration_text() -> dict[str, str]:
    """Read BEATS out of gen_narration.py rather than duplicating it here."""
    src = (ROOT / "gen_narration.py").read_text()
    block = re.search(r"^BEATS = \[$(.*?)^\]$", src, re.S | re.M)
    if not block:
        raise SystemExit("FAIL: could not find BEATS in gen_narration.py")
    pairs = re.findall(r"\(\s*'([^']+)'\s*,\s*(\"[^\"]*\"|'[^']*')\s*\)", block.group(1))
    if not pairs:
        raise SystemExit("FAIL: BEATS parsed to zero entries")
    return {name: text[1:-1] for name, text in pairs}


def wrap(s: str) -> str:
    if len(s) <= MAX_CHARS:
        return s
    words, lines, cur = s.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > MAX_CHARS and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return "\n".join(lines[:2]) if len(lines) <= 2 else "\n".join([lines[0], " ".join(lines[1:])])


def stamp(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main() -> int:
    text = narration_text()
    cues, n = [], 0
    for b in BEATS["beats"]:
        line = text.get(b["id"])
        if line is None:
            print(f"FAIL: beat {b['id']} has no narration in gen_narration.py", file=sys.stderr)
            return 1
        parts = [p.strip() for p in re.split(r"(?<=\.)\s+", line) if p.strip()]
        total = sum(len(p) for p in parts)
        t = b["start"]
        for p in parts:
            d = (b["end"] - b["start"]) * (len(p) / total)
            n += 1
            cues.append(f"{n}\n{stamp(t)} --> {stamp(t + d)}\n{wrap(p)}\n")
            t += d

    out = ROOT / "film" / "out" / "placard.srt"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(cues))
    print(f"{n} cues across {len(BEATS['beats'])} beats -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
