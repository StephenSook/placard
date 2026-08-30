"""Produce the narration audio the timing stage depends on: one mp3 per beat via
ElevenLabs TTS, each under ~30s so the voice never degrades, then concatenate with a
fixed GAP of silence between beats and loudness-normalize to a single narration.mp3.

The per-beat clips (01_*.mp3 ...) AND narration.mp3 both land in OUT. build_timing.py
then measures the per-beat clips + the SAME GAP to derive drift-free beat windows, so
GAP here MUST equal GAP in build_timing.py.

Key gotcha: concat then loudnorm (the loudnorm pass re-encodes). Do NOT ship a raw
`-c copy` concat as the final: stream-copy concat of CBR-ish mp3s can mis-time the total.

Setup: export XI_KEY (e.g. from a keychain), then: python3 gen_narration.py
"""
import json
import os
import subprocess
import sys
import urllib.request

# ------------------------------------------------------------------ CONFIG (edit me)
VOICE = "3TStB8f3X3To0Uj5R7RK"
MODEL = "eleven_multilingual_v2"
KEY = os.environ["XI_KEY"]           # export XI_KEY=$(security find-generic-password -s elevenlabs-api-key -w)
OUT = "video/narration"
GAP = 0.45                            # MUST match build_timing.py GAP
LUFS = -14                            # per-file target before the final render's own normalize pass
BEATS = [
    ('01_refusal', 'This load is legal according to the federal segregation table. Watch it get refused anyway. Sulfuric acid, calcium hypochlorite, one truck. The table says separate them and they may travel. The page says no, and quotes the line.'),
    ('02_signer', 'Somebody signs for that. Under 49 CFR 172.204 the person who signs the shipper certification becomes personally responsible for the load being right. Not the software. The person holding the pen.'),
    ('03_howmany', 'There are twenty thousand four hundred and sixty of them. That is how many US establishments shipped hazardous materials in DOT regulated packaging in 2022, counted by the Census Bureau in a survey PHMSA paid for specifically to find out.'),
    ('04_gap', 'Ask an agent to load that truck and it reads the segregation table, because the table is the thing that looks like the answer. Across every ordered pair of the eighteen hazard categories, the table alone clears seven hundred and ninety two configurations. Of those, the full regulation forbids fifty six. That endpoint recomputes it on every request.'),
    ('05_propose', 'So the agent does the part agents are good at. It reads the manifest, resolves the names, and proposes an arrangement. Nothing here is staged. This is the deployed page, running now.'),
    ('06_refuse', 'And the page does the part agents are unreliable at. It refuses, it names the two materials, and it quotes one seventy seven point eight four eight, e three, word for word from a pinned e C F R snapshot. Not a paraphrase. The sentence.'),
    ('07_barrier', 'Tick the barrier box, the one an operator ticks when there really are dividers in the truck, and it still refuses. That clause blocks Class 8 liquids above or adjacent to Class 5 materials notwithstanding the methods of separation employed. No separation reaches it.'),
    ('08_export', 'Two vehicles. Now it passes, and only now does the export tool exist. The shipping paper comes out in the basic description sequence one seventy two point two zero two requires, with the certification printed on it rather than buried.'),
    ('09_forbidden', 'Ammonium chlorate has no identification number. Not missing data. A Forbidden material may not be offered for transportation at all, so the table gives it none. Two hundred and fifty six entries are like this. Ask a U N keyed index for any of them and you get nothing back, and nothing reads as not regulated.'),
    ('10_webmcp', "This is why the surface is WebMCP. Tools register against a live document, so the agent's toolset is a function of page state. Propose exists only while the load fails. Export exists only while it passes. They are never both there. The agent cannot choose the unsafe action, because from where it stands the action does not exist."),
    ('11_close', 'Open it yourself. No account, no key, no browser flag.'),
]
# ------------------------------------------------------------------ end CONFIG

os.makedirs(OUT, exist_ok=True)


def tts(name, text):
    body = json.dumps({
        "text": text, "model_id": MODEL,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0, "use_speaker_boost": True},
    }).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}",
        data=body, headers={"xi-api-key": KEY, "Content-Type": "application/json"})
    path = f"{OUT}/{name}.mp3"
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        f.write(r.read())
    d = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", path]).decode().strip())
    print(f"{name}: {d:.1f}s ({len(text.split())} words)")
    return path


paths = [tts(n, t) for n, t in BEATS]


def dur(path):
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", path]).decode().strip())


# Concat WAVs, never the ElevenLabs mp3s. The mp3 concat demuxer dropped ~20% of the audio
# on the Aloud film (138s of 175s) while every per-clip ffprobe read correct, so this decodes
# first and then GATES on the arithmetic before anything downstream trusts the timing.
wavs = []
for p in paths:
    w = p.replace(".mp3", ".wav")
    subprocess.run(["ffmpeg", "-y", "-i", p, "-ar", "44100", "-ac", "2", w],
                   capture_output=True, check=True)
    wavs.append(w)
speech = sum(dur(w) for w in wavs)

sil = f"{OUT}/_gap.wav"
subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                "-t", str(GAP), sil], capture_output=True, check=True)

listf = f"{OUT}/list.txt"
with open(listf, "w") as f:
    for i, w in enumerate(wavs):
        f.write(f"file '{w}'\n")
        if i < len(wavs) - 1:          # gaps BETWEEN beats only; a trailing gap skews timing
            f.write(f"file '{sil}'\n")

raw = f"{OUT}/narration_raw.wav"
subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listf,
                "-c", "pcm_s16le", raw], capture_output=True, check=True)

expected = speech + GAP * (len(wavs) - 1)
got = dur(raw)
print(f"concat gate: expected {expected:.2f}s, got {got:.2f}s, delta {abs(got - expected):.3f}s")
if abs(got - expected) > 0.25:
    sys.exit(f"FAIL: concat lost audio ({expected:.2f} vs {got:.2f}). Do not proceed.")

# Final as WAV: ffmpeg 8.x lame can assert-crash encoding loudnorm output to mp3.
final = f"{OUT}/narration.wav"
subprocess.run(["ffmpeg", "-y", "-i", raw, "-af", f"loudnorm=I={LUFS}:TP=-1.5:LRA=11",
                "-ar", "44100", final], capture_output=True, check=True)
print(f"narration.wav: {dur(final):.1f}s ({dur(final)/60:.2f} min) -> {final}")
