#!/usr/bin/env python3
"""
Build the beat clock from the narration clips themselves.

THE TIMING IS MEASURED, NEVER TYPED. Each beat's window comes from the real
duration of that beat's rendered narration clip plus the fixed gap the concat
inserts, so the film's sequence boundaries and the voice cannot drift apart. A
retimed line changes the clock, and every derived duration in the composition
follows, because the composition reads this file rather than carrying numbers.

`index` and `name` exist for the demo-video-studio verification harness, which
extracts a frame at every beat's MIDPOINT. A fixed sampling grid can miss a
short beat entirely and still report a pass.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CLIPS = ROOT / "narration"
OUT = ROOT / "film" / "src" / "data" / "beats.json"
FPS = 30
GAP = 0.45
TAKE_START = 67.75
TAIL = 6.0  # the close card outlives the last line, deliberately


def seconds(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return round(float(out.stdout.strip()), 3)


def main() -> int:
    clips = sorted(CLIPS.glob("*.mp3"))
    if not clips:
        print(f"FAIL: no narration clips in {CLIPS}", file=sys.stderr)
        return 1

    beats, t = [], 0.0
    for i, c in enumerate(clips):
        d = seconds(c)
        beats.append({
            "index": i + 1,
            "id": c.stem,
            "name": c.stem,
            "start": round(t, 3),
            "end": round(t + d, 3),
            "dur": d,
            "startFrame": round(t * FPS),
            "durFrames": round(d * FPS),
        })
        t += d + GAP

    narration = round(t - GAP, 3)
    film = round(narration + TAIL, 3)
    OUT.write_text(json.dumps({
        "fps": FPS,
        "narrationSeconds": narration,
        "filmSeconds": film,
        "filmFrames": round(film * FPS),
        "gap": GAP,
        "takeStart": TAKE_START,
        "beats": beats,
    }, indent=2) + "\n")
    print(f"{len(beats)} beats, narration {narration}s, film {film}s = {round(film * FPS)} frames")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
